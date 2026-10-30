import {
  db,
  bloodRequests,
  donorNotifications,
  donorProfiles,
  users,
  eq,
  and,
} from '@repo/db';
import {
  type BloodRequest,
  type DonorNotificationSummary,
  type AcceptedDonorContact,
  type NotificationStatus,
  type RequestStatus,
  type BloodGroup,
  type ComponentType,
  type EmergencyType,
  type RadiusPreset,
  haversineDistance,
} from '@repo/shared';
import { mockStore } from './mock-store';

export class RequestService {
  private isLiveDb(): boolean {
    return Boolean(
      process.env.NODE_ENV !== 'test' &&
      process.env.DATABASE_URL &&
      db &&
      process.env.MOCK_SERVICES !== 'true'
    );
  }

  /**
   * Persist a new blood request
   */
  public async createRequest(request: BloodRequest): Promise<BloodRequest> {
    // 1. Always keep in-memory store in sync for fast lookup & mock mode
    mockStore.createRequest(request);

    // 2. Persist to live PostgreSQL database if available
    if (this.isLiveDb()) {
      try {
        await db
          .insert(bloodRequests)
          .values({
            id: request.id,
            requesterId: request.requesterId ?? null,
            bloodGroupNeeded: request.bloodGroupNeeded,
            componentType: request.componentType,
            unitsNeeded: request.unitsNeeded,
            patientName: request.patientName,
            patientAge: request.patientAge ?? null,
            emergencyType: (request.emergencyType as any) ?? null,
            hospitalName: request.hospitalName,
            latitude: request.latitude,
            longitude: request.longitude,
            state: request.state ?? null,
            district: request.district ?? null,
            searchRadiusKm: request.searchRadiusKm,
            status: request.status,
            fulfillmentSource: (request.fulfillmentSource as any) ?? null,
            createdAt: request.createdAt ? new Date(request.createdAt) : new Date(),
            expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.warn('[@repo/api] Warning: Failed to persist blood request to DB, keeping in mockStore:', err);
      }
    }

    return request;
  }

  /**
   * Persist a donor notification
   */
  public async recordNotification(notif: {
    id: string;
    requestId: string;
    donorId: string;
    whatsappMessageId?: string | null;
    status: NotificationStatus;
    donorName?: string;
    donorBloodGroup?: BloodGroup;
    donorPhoneMasked?: string;
    sentAt?: string;
  }): Promise<void> {
    // Sync with mock store
    mockStore.addNotification({
      id: notif.id,
      requestId: notif.requestId,
      donorId: notif.donorId,
      status: notif.status,
      donorName: notif.donorName,
      donorBloodGroup: notif.donorBloodGroup,
      donorPhoneMasked: notif.donorPhoneMasked,
      sentAt: notif.sentAt || new Date().toISOString(),
      respondedAt: null,
    });

    if (this.isLiveDb()) {
      try {
        await db
          .insert(donorNotifications)
          .values({
            id: notif.id,
            requestId: notif.requestId,
            donorId: notif.donorId,
            whatsappMessageId: notif.whatsappMessageId ?? null,
            status: notif.status,
            sentAt: notif.sentAt ? new Date(notif.sentAt) : new Date(),
          })
          .onConflictDoNothing();
      } catch (err) {
        console.warn('[@repo/api] Warning: Failed to persist notification to DB:', err);
      }
    }
  }

  /**
   * Handle donor reply (accept or decline) from WhatsApp webhook or direct deep-link
   */
  public async handleDonorReply(
    requestId: string,
    donorIdentifier: string,
    action: 'accepted' | 'declined',
    note?: string
  ): Promise<{ success: boolean; requestStatus: RequestStatus }> {
    if (!this.isLiveDb()) {
      return mockStore.simulateDonorReply(requestId, donorIdentifier, action, note);
    }

    // Live DB Mode
    let mockResult: { success: boolean; requestStatus: RequestStatus } | null = null;
    try {
      mockResult = mockStore.simulateDonorReply(requestId, donorIdentifier, action, note);
    } catch {
      // Mock store didn't find request, check DB next
    }

    try {
      const dbReq = await db
        .select()
        .from(bloodRequests)
        .where(eq(bloodRequests.id, requestId))
        .limit(1);

      if (!dbReq[0] && !mockResult) {
        throw new Error(`Request not found: ${requestId}`);
      }

      const respondedAt = new Date();

      // Resolve donorId if donorIdentifier is phone
      let resolvedDonorId = donorIdentifier;
      if (donorIdentifier.startsWith('+') || /^\d{10,13}$/.test(donorIdentifier)) {
        const cleanPhone = donorIdentifier.replace(/\D/g, '');
        const donorUser = await db
          .select({ donorId: donorProfiles.id })
          .from(donorProfiles)
          .innerJoin(users, eq(donorProfiles.userId, users.id))
          .where(eq(users.phone, donorIdentifier.startsWith('+') ? donorIdentifier : `+${donorIdentifier}`))
          .limit(1);

        if (donorUser[0]) {
          resolvedDonorId = donorUser[0].donorId;
        }
      }

      // Update donor notification row
      await db
        .update(donorNotifications)
        .set({
          status: action,
          respondedAt,
          responseNote: note ?? null,
        })
        .where(
          and(
            eq(donorNotifications.requestId, requestId),
            eq(donorNotifications.donorId, resolvedDonorId)
          )
        );

      // If donor accepted, transition blood request to fulfilled
      if (action === 'accepted') {
        await db
          .update(bloodRequests)
          .set({
            status: 'fulfilled',
            fulfillmentSource: 'donor',
          })
          .where(eq(bloodRequests.id, requestId));
      }

      return {
        success: true,
        requestStatus: action === 'accepted' ? 'fulfilled' : (mockResult?.requestStatus ?? 'donors_notified'),
      };
    } catch (err) {
      if (mockResult) return mockResult;
      throw err;
    }
  }

  /**
   * Update message status from WhatsApp status receipts (delivered, read, failed)
   */
  public async handleDeliveryReceipt(wamid: string, status: 'delivered' | 'read' | 'failed'): Promise<void> {
    if (this.isLiveDb()) {
      try {
        await db
          .update(donorNotifications)
          .set({ status })
          .where(eq(donorNotifications.whatsappMessageId, wamid));
      } catch (err) {
        console.warn('[@repo/api] Warning: Failed to update delivery receipt in DB:', err);
      }
    }
  }

  /**
   * Fetch blood request and accepted donor contacts
   */
  public async getRequestWithDetails(id: string): Promise<{
    request: BloodRequest | null;
    notifications: DonorNotificationSummary[];
    acceptedDonors: AcceptedDonorContact[];
  } | null> {
    let request: BloodRequest | null = null;
    let notifications: DonorNotificationSummary[] = [];
    const acceptedDonors: AcceptedDonorContact[] = [];

    // Try live DB first
    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select()
          .from(bloodRequests)
          .where(eq(bloodRequests.id, id))
          .limit(1);

        if (rows[0]) {
          const r = rows[0];
          request = {
            id: r.id,
            requesterId: r.requesterId,
            bloodGroupNeeded: r.bloodGroupNeeded as BloodGroup,
            componentType: r.componentType as ComponentType,
            unitsNeeded: r.unitsNeeded,
            patientName: r.patientName,
            patientAge: r.patientAge,
            emergencyType: r.emergencyType as EmergencyType,
            hospitalName: r.hospitalName,
            latitude: r.latitude,
            longitude: r.longitude,
            state: r.state,
            district: r.district,
            searchRadiusKm: r.searchRadiusKm as RadiusPreset,
            status: r.status as RequestStatus,
            fulfillmentSource: r.fulfillmentSource as any,
            createdAt: r.createdAt.toISOString(),
            expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
          };

          // Fetch notifications with donor details
          const notifRows = await db
            .select({
              id: donorNotifications.id,
              requestId: donorNotifications.requestId,
              donorId: donorNotifications.donorId,
              status: donorNotifications.status,
              sentAt: donorNotifications.sentAt,
              respondedAt: donorNotifications.respondedAt,
              donorName: users.name,
              donorPhone: users.phone,
              bloodGroup: donorProfiles.bloodGroup,
              latitude: donorProfiles.latitude,
              longitude: donorProfiles.longitude,
            })
            .from(donorNotifications)
            .innerJoin(donorProfiles, eq(donorNotifications.donorId, donorProfiles.id))
            .innerJoin(users, eq(donorProfiles.userId, users.id))
            .where(eq(donorNotifications.requestId, id));

          notifications = notifRows.map((n) => ({
            id: n.id,
            requestId: n.requestId,
            donorId: n.donorId,
            status: n.status as NotificationStatus,
            donorName: n.donorName ?? 'Volunteer Donor',
            donorBloodGroup: n.bloodGroup as BloodGroup,
            donorPhoneMasked: n.donorPhone
              ? n.donorPhone.replace(/(\+\d{2})(\d{2})\d{4}(\d{4})/, '$1 $2****$3')
              : undefined,
            sentAt: n.sentAt ? n.sentAt.toISOString() : new Date().toISOString(),
            respondedAt: n.respondedAt ? n.respondedAt.toISOString() : null,
          }));

          // Collect accepted donors
          for (const n of notifRows) {
            if (n.status === 'accepted') {
              const dist = haversineDistance(
                request.latitude,
                request.longitude,
                n.latitude,
                n.longitude
              );
              const donorName = n.donorName || 'Volunteer Donor';
              const donorPhone = n.donorPhone || '+919999999999';

              acceptedDonors.push({
                donorId: n.donorId,
                name: donorName,
                phone: donorPhone,
                bloodGroup: n.bloodGroup as BloodGroup,
                distanceKm: dist,
                respondedAt: n.respondedAt ? n.respondedAt.toISOString() : new Date().toISOString(),
                directCallUrl: `tel:${donorPhone}`,
                whatsappUrl: `https://wa.me/${donorPhone.replace('+', '')}?text=${encodeURIComponent(
                  `Namaste ${donorName}, thank you for accepting blood request for ${request.patientName} at ${request.hospitalName}.`
                )}`,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[@repo/api] Error querying live DB for request, falling back to mockStore:', err);
      }
    }

    // If not found in DB or DB offline, fallback to mockStore
    if (!request) {
      request = mockStore.getRequest(id) || null;
      if (!request) return null;

      notifications = mockStore.getNotificationsForRequest(id);
      for (const n of notifications) {
        if (n.status === 'accepted') {
          const donor = mockStore.getDonorById(n.donorId);
          if (donor) {
            const dist = haversineDistance(
              request.latitude,
              request.longitude,
              donor.latitude,
              donor.longitude
            );
            const donorName = (donor as any).name || 'Volunteer Donor';
            const donorPhone = (donor as any).phone || '+919999999999';

            acceptedDonors.push({
              donorId: donor.id,
              name: donorName,
              phone: donorPhone,
              bloodGroup: donor.bloodGroup,
              distanceKm: dist,
              respondedAt: n.respondedAt || new Date().toISOString(),
              directCallUrl: `tel:${donorPhone}`,
              whatsappUrl: `https://wa.me/${donorPhone.replace('+', '')}?text=${encodeURIComponent(
                `Namaste ${donorName}, thank you for accepting blood request for ${request.patientName} at ${request.hospitalName}.`
              )}`,
            });
          }
        }
      }
    }

    return { request, notifications, acceptedDonors };
  }
}

export const requestService = new RequestService();
