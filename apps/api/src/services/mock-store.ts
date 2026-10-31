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

export interface OutboundPushMessage {
  id: string;
  requestId: string;
  title: string;
  body: string;
  recipientCount: number;
  timestamp: string;
}

export class MockDataStore {
  private bloodBanks: BloodBankCardData[] = [];
  private donors: DonorProfile[] = [];
  private requests: Map<string, BloodRequest> = new Map();
  private notifications: Map<string, DonorNotificationSummary[]> = new Map();
  private pushSubscriptions = new Map<string, Set<string>>();
  private outboundPush: OutboundPushMessage[] = [];

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
    const useSeedFixtures = process.env.NODE_ENV === 'test';

    if (customState?.banks) {
      this.bloodBanks = JSON.parse(JSON.stringify(customState.banks));
    } else if (useSeedFixtures) {
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
    } else {
      // Never expose demonstration blood-bank inventory in local or production searches.
      this.bloodBanks = [];
    }

    if (customState?.donors) {
      this.donors = JSON.parse(JSON.stringify(customState.donors));
    } else if (useSeedFixtures) {
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
        createdAt: d.createdAt,
        updatedAt: d.createdAt,
      }));
    } else {
      // Only donors actually registered in this runtime may appear in live searches.
      this.donors = [];
    }

    this.requests.clear();
    this.notifications.clear();
    this.pushSubscriptions.clear();
    this.outboundPush = [];
    // Fake subscriptions exist only in automated tests. Real devices must explicitly opt in.
    if (useSeedFixtures) {
      for (const donor of this.donors) {
        if (donor.id !== 'donor-manish-no-push-subscription') {
          this.addPushSubscription(donor.id, `test-fcm-token-${donor.id}-${'x'.repeat(48)}`);
        }
      }
    }
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

  public getAllDonors(): DonorProfile[] {
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

  public getAllRequests(): BloodRequest[] {
    return Array.from(this.requests.values());
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

  public getNotificationsForDonor(donorId: string): DonorNotificationSummary[] {
    return Array.from(this.notifications.values())
      .flat()
      .filter((notification) => notification.donorId === donorId);
  }

  public getNotificationForDonorAndRequest(
    requestId: string,
    donorId: string
  ): DonorNotificationSummary | undefined {
    const list = this.notifications.get(requestId);
    return list?.find((n) => n.donorId === donorId);
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

  // Device-scoped web push subscriptions.
  public addPushSubscription(donorId: string, token: string): void {
    const tokens = this.pushSubscriptions.get(donorId) || new Set<string>();
    tokens.add(token);
    this.pushSubscriptions.set(donorId, tokens);
  }
  public getPushTokensForDonor(donorId: string): string[] {
    return [...(this.pushSubscriptions.get(donorId) || new Set<string>())];
  }
  public hasPushSubscription(donorId: string): boolean {
    return (this.pushSubscriptions.get(donorId)?.size || 0) > 0;
  }
  public removePushSubscription(donorId: string, token: string): void {
    const tokens = this.pushSubscriptions.get(donorId);
    if (!tokens) return;
    tokens.delete(token);
    if (tokens.size === 0) this.pushSubscriptions.delete(donorId);
  }
  public removePushSubscriptionToken(token: string): void {
    for (const [donorId, tokens] of this.pushSubscriptions) {
      tokens.delete(token);
      if (tokens.size === 0) this.pushSubscriptions.delete(donorId);
    }
  }
  public recordOutboundPush(message: OutboundPushMessage): void {
    this.outboundPush.push(message);
  }
  public getOutboundPushMessages(): OutboundPushMessage[] {
    return [...this.outboundPush];
  }
  public setNotificationDelivery(requestId: string, donorId: string, status: NotificationStatus): void {
    const notification = this.getNotificationForDonorAndRequest(requestId, donorId);
    if (notification) notification.status = status;
  }

  /**
   * Simulate donor response for local dev and testing
   */
  public simulateDonorReply(
    requestId: string,
    donorIdentifier: string,
    action: 'accepted' | 'declined',
    note?: string
  ): { success: boolean; duplicate?: boolean; requestStatus: RequestStatus } {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (request.status === 'cancelled' || request.status === 'expired') {
      throw new Error(`Cannot respond to a ${request.status} request`);
    }

    const donor =
      this.getDonorById(donorIdentifier) || this.getDonorByPhone(donorIdentifier);

    const donorId = donor ? donor.id : donorIdentifier;
    const notifs = this.notifications.get(requestId);
    const existingNotif = notifs?.find((n) => n.donorId === donorId);
    if (!existingNotif) {
      throw new Error(`Notification not found for request ${requestId} and donor ${donorId}`);
    }

    if (existingNotif.status === 'expired' || existingNotif.status === 'failed') {
      throw new Error(`Cannot respond to a ${existingNotif.status} notification`);
    }

    // Idempotent duplicate check
    if (existingNotif.status === action) {
      return {
        success: true,
        duplicate: true,
        requestStatus: request.status,
      };
    }

    const previousStatus = existingNotif.status;
    const updated = this.updateNotificationStatus(requestId, donorId, action, note);
    if (!updated) {
      throw new Error(`Failed to update notification status for donor ${donorId}`);
    }

    if (action === 'accepted') {
      request.status = 'fulfilled';
      request.fulfillmentSource = 'donor';
    } else if (action === 'declined') {
      // If donor previously accepted, revert request to donors_notified if no other accepted donors remain
      if (previousStatus === 'accepted') {
        const otherAccepted = (notifs || []).some(
          (n) => n.donorId !== donorId && n.status === 'accepted'
        );
        if (!otherAccepted && request.status === 'fulfilled') {
          request.status = 'donors_notified';
          request.fulfillmentSource = null;
        }
      }
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
