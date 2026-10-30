import type {
  BloodBankCardData,
  DonorProfile,
  BloodRequest,
  DonorNotificationSummary,
  AcceptedDonorContact,
  BloodGroup,
  NotificationStatus,
  RequestStatus,
} from '@repo/shared';
import {
  SEED_BLOOD_BANKS,
  SEED_DONORS,
  type SeedBloodBank,
  type SeedDonor,
} from '@repo/db';
import { haversineDistance } from '@repo/shared';

export interface OutboundWhatsAppMessage {
  id: string;
  recipientPhone: string;
  templateName: string;
  language: string;
  parameters: Record<string, string>;
  interactiveButtons: Array<{ id: string; title: string }>;
  timestamp: string;
  requestId?: string;
  donorId?: string;
}

export class MockDataStore {
  private bloodBanks: BloodBankCardData[] = [];
  private donors: DonorProfile[] = [];
  private requests: Map<string, BloodRequest> = new Map();
  private notifications: Map<string, DonorNotificationSummary[]> = new Map();
  private outboundWhatsApp: OutboundWhatsAppMessage[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Reset store to initial seed state
   */
  public reset(customState?: {
    banks?: BloodBankCardData[];
    donors?: DonorProfile[];
  }): void {
    if (customState?.banks) {
      this.bloodBanks = JSON.parse(JSON.stringify(customState.banks));
    } else {
      this.bloodBanks = SEED_BLOOD_BANKS.map((b) => ({
        id: b.id,
        name: b.name,
        licenseNumber: b.licenseNumber,
        state: b.state,
        district: b.district,
        city: b.city,
        address: b.address,
        phone: b.phone,
        email: b.email,
        latitude: b.latitude,
        longitude: b.longitude,
        distanceKm: 0,
        stock: JSON.parse(JSON.stringify(b.stock)),
        isVerified: b.isVerified,
        source: b.source,
        lastStockUpdate: b.lastStockUpdate,
      }));
    }

    if (customState?.donors) {
      this.donors = JSON.parse(JSON.stringify(customState.donors));
    } else {
      this.donors = SEED_DONORS.map((d) => ({
        id: d.id,
        userId: d.userId,
        name: d.name,
        phone: d.phone,
        preferredLanguage: d.preferredLanguage,
        bloodGroup: d.bloodGroup,
        latitude: d.latitude,
        longitude: d.longitude,
        state: d.state,
        district: d.district,
        city: d.city,
        dateOfBirth: d.dateOfBirth,
        gender: d.gender,
        weightKg: d.weightKg,
        lastDonationDate: d.lastDonationDate,
        isAvailable: d.isAvailable,
        searchRadiusKm: d.searchRadiusKm,
        whatsappConsent: d.whatsappConsent,
        createdAt: d.createdAt,
        updatedAt: d.createdAt,
      }));
    }

    this.requests.clear();
    this.notifications.clear();
    this.outboundWhatsApp = [];
  }

  // Blood Banks
  public getBloodBanks(): BloodBankCardData[] {
    return [...this.bloodBanks];
  }

  public getBloodBankById(id: string): BloodBankCardData | undefined {
    return this.bloodBanks.find((b) => b.id === id);
  }

  // Donors
  public getDonors(): DonorProfile[] {
    return [...this.donors];
  }

  public getDonorById(id: string): DonorProfile | undefined {
    return this.donors.find((d) => d.id === id);
  }

  public getDonorByUserId(userId: string): DonorProfile | undefined {
    return this.donors.find((d) => d.userId === userId);
  }

  public getDonorByPhone(phone: string): DonorProfile | undefined {
    // Match exact or stripped
    const clean = phone.replace(/[\s\-\+]/g, '');
    return this.donors.find(
      (d) =>
        d.id === phone ||
        (d as any).phone === phone ||
        ((d as any).phone && (d as any).phone.replace(/[\s\-\+]/g, '') === clean)
    );
  }

  public addDonor(donor: DonorProfile): void {
    this.donors.push(donor);
  }

  public updateDonorAvailability(donorId: string, isAvailable: boolean): boolean {
    const donor = this.getDonorById(donorId);
    if (!donor) return false;
    donor.isAvailable = isAvailable;
    return true;
  }

  // Requests
  public createRequest(request: BloodRequest): void {
    this.requests.set(request.id, request);
  }

  public getRequest(id: string): BloodRequest | undefined {
    return this.requests.get(id);
  }

  public updateRequest(id: string, updates: Partial<BloodRequest>): boolean {
    const existing = this.requests.get(id);
    if (!existing) return false;
    this.requests.set(id, { ...existing, ...updates });
    return true;
  }

  // Notifications
  public addNotification(notif: DonorNotificationSummary & { requestId: string }): void {
    const list = this.notifications.get(notif.requestId) || [];
    list.push(notif);
    this.notifications.set(notif.requestId, list);
  }

  public getNotificationsForRequest(requestId: string): DonorNotificationSummary[] {
    return this.notifications.get(requestId) || [];
  }

  public updateNotificationStatus(
    requestId: string,
    donorId: string,
    status: NotificationStatus,
    note?: string
  ): boolean {
    const list = this.notifications.get(requestId);
    if (!list) return false;
    const notif = list.find((n) => n.donorId === donorId);
    if (!notif) return false;
    notif.status = status;
    notif.respondedAt = new Date().toISOString();
    if (note !== undefined) {
      (notif as any).responseNote = note;
    }
    return true;
  }

  // Outbound WhatsApp Messages
  public recordOutboundWhatsApp(message: OutboundWhatsAppMessage): void {
    this.outboundWhatsApp.push(message);
  }

  public getOutboundWhatsAppMessages(): OutboundWhatsAppMessage[] {
    return [...this.outboundWhatsApp];
  }

  public clearOutboundWhatsAppMessages(): void {
    this.outboundWhatsApp = [];
  }

  /**
   * Simulate donor response for local dev and testing
   */
  public simulateDonorReply(
    requestId: string,
    donorIdentifier: string,
    action: 'accepted' | 'declined',
    note?: string
  ): { success: boolean; requestStatus: RequestStatus } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const donor =
      this.getDonorById(donorIdentifier) || this.getDonorByPhone(donorIdentifier);

    const donorId = donor ? donor.id : donorIdentifier;
    this.updateNotificationStatus(requestId, donorId, action, note);

    if (action === 'accepted') {
      request.status = 'fulfilled';
      request.fulfillmentSource = 'donor';
    }

    return {
      success: true,
      requestStatus: request.status,
    };
  }

  /**
   * Helper to build accepted donor contact list for a request
   */
  public getAcceptedDonors(requestId: string): AcceptedDonorContact[] {
    const request = this.requests.get(requestId);
    if (!request) return [];

    const notifs = this.getNotificationsForRequest(requestId);
    const accepted: AcceptedDonorContact[] = [];

    for (const n of notifs) {
      if (n.status === 'accepted') {
        const donor = this.getDonorById(n.donorId);
        if (donor) {
          const donorName = (donor as any).name || 'Volunteer Donor';
          const donorPhone = (donor as any).phone || '+919999999999';
          const dist = haversineDistance(
            request.latitude,
            request.longitude,
            donor.latitude,
            donor.longitude
          );

          accepted.push({
            donorId: donor.id,
            name: donorName,
            phone: donorPhone,
            bloodGroup: donor.bloodGroup,
            distanceKm: dist,
            respondedAt: n.respondedAt || new Date().toISOString(),
          });
        }
      }
    }

    return accepted;
  }
}

export const mockStore = new MockDataStore();
