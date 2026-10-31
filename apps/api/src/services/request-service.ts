import {
  db,
  bloodRequests,
  donorNotifications,
  donorPushSubscriptions,
  donorProfiles,
  users,
  eq,
  ne,
  and,
  or,
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
    pushMessageId?: string | null;
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
            pushMessageId: notif.pushMessageId ?? null,
            status: notif.status,
            sentAt: notif.sentAt ? new Date(notif.sentAt) : new Date(),
          })
          .onConflictDoNothing();
      } catch (err) {
        console.warn('[@repo/api] Warning: Failed to persist notification to DB:', err);
      }
    }
  }

  /** List active web-push tokens registered by a donor. */
  public async getPushTokensForDonor(donorId: string): Promise<string[]> {
    if (!this.isLiveDb()) return mockStore.getPushTokensForDonor(donorId);
    const rows = await db.select({ token: donorPushSubscriptions.fcmToken })
      .from(donorPushSubscriptions)
      .where(eq(donorPushSubscriptions.donorId, donorId));
    return rows.map((row) => row.token);
  }

  public async updateNotificationDelivery(params: {
    requestId: string; donorId: string; status: NotificationStatus; pushMessageId?: string | null;
  }): Promise<void> {
    if (!this.isLiveDb()) {
      mockStore.setNotificationDelivery(params.requestId, params.donorId, params.status);
      return;
    }
    await db.update(donorNotifications)
      .set({ status: params.status, pushMessageId: params.pushMessageId ?? null })
      .where(and(
        eq(donorNotifications.requestId, params.requestId),
        eq(donorNotifications.donorId, params.donorId)
      ));
  }

  public async removePushSubscriptionToken(donorId: string, token: string): Promise<void> {
    if (!this.isLiveDb()) {
      mockStore.removePushSubscription(donorId, token);
      return;
    }
    await db.delete(donorPushSubscriptions).where(and(
      eq(donorPushSubscriptions.donorId, donorId),
      eq(donorPushSubscriptions.fcmToken, token)
    ));
  }

  /**
   * Resolve donor identity using phone number (from msg.from or registration)
   */
  public async findDonorByPhone(
    phone: string
  ): Promise<{ donorId: string; name: string; phone: string; bloodGroup: string } | null> {
    const rawDigits = phone.replace(/\D/g, '');
    const tenDigits = rawDigits.slice(-10);
    const plus91 = `+91${tenDigits}`;

    // 1. Live DB mode: query PostgreSQL exclusively (never fall back to mock data)
    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select({
            donorId: donorProfiles.id,
            name: users.name,
            phone: users.phone,
            bloodGroup: donorProfiles.bloodGroup,
          })
          .from(donorProfiles)
          .innerJoin(users, eq(donorProfiles.userId, users.id))
          .where(
            or(
              eq(users.phone, phone),
              eq(users.phone, plus91),
              eq(users.phone, rawDigits),
              eq(users.phone, tenDigits)
            )
          )
          .limit(1);

        if (rows[0]) {
          return {
            donorId: rows[0].donorId,
            name: rows[0].name || 'Volunteer Donor',
            phone: rows[0].phone,
            bloodGroup: rows[0].bloodGroup,
          };
        }
      } catch (err) {
        console.warn('[@repo/api] Error looking up donor by phone in DB:', err);
      }
      return null;
    }

    // 2. Mock / Test mode: query mock store
    const mockDonor =
      mockStore.getDonorByPhone(phone) ||
      mockStore.getDonorByPhone(plus91) ||
      mockStore.getDonorByPhone(rawDigits) ||
      mockStore.getDonorByPhone(tenDigits) ||
      mockStore.getAllDonors().find((d) => {
        const dDigits = ((d as any).phone || '').replace(/\D/g, '');
        return dDigits.endsWith(tenDigits) || dDigits === rawDigits;
      });

    if (mockDonor) {
      return {
        donorId: mockDonor.id,
        name: (mockDonor as any).name || 'Volunteer Donor',
        phone: (mockDonor as any).phone || phone,
        bloodGroup: mockDonor.bloodGroup,
      };
    }

    return null;
  }

  /**
   * Fetch all active pending notifications for a donor (to safely handle free-text responses)
   */
  public async getPendingNotificationsForDonor(
    donorId: string
  ): Promise<Array<{ requestId: string; notificationId: string; patientName?: string; createdAt?: string }>> {
    const results: Array<{ requestId: string; notificationId: string; patientName?: string; createdAt?: string }> = [];

    // 1. Query live PostgreSQL if active (never fall back to mock data)
    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select({
            requestId: donorNotifications.requestId,
            notificationId: donorNotifications.id,
            status: donorNotifications.status,
            patientName: bloodRequests.patientName,
            requestStatus: bloodRequests.status,
            createdAt: donorNotifications.sentAt,
          })
          .from(donorNotifications)
          .innerJoin(bloodRequests, eq(donorNotifications.requestId, bloodRequests.id))
          .where(
            and(
              eq(donorNotifications.donorId, donorId),
              or(
                eq(donorNotifications.status, 'pending'),
                eq(donorNotifications.status, 'sent'),
                eq(donorNotifications.status, 'delivered'),
                eq(donorNotifications.status, 'read')
              ),
              or(
                eq(bloodRequests.status, 'donors_notified'),
                eq(bloodRequests.status, 'searching')
              )
            )
          );

        for (const r of rows) {
          results.push({
            requestId: r.requestId,
            notificationId: r.notificationId,
            patientName: r.patientName,
            createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
          });
        }
        return results;
      } catch (err) {
        console.warn('[@repo/api] Error querying pending notifications in DB:', err);
        return [];
      }
    }

    // 2. Mock / Test mode: query mock store
    const allRequests = mockStore.getAllRequests();
    for (const req of allRequests) {
      if (req.status !== 'donors_notified' && req.status !== 'searching') continue;
      const notifs = mockStore.getNotificationsForRequest(req.id);
      for (const n of notifs) {
        if (
          n.donorId === donorId &&
          n.status !== 'accepted' &&
          n.status !== 'declined' &&
          n.status !== 'failed' &&
          n.status !== 'expired'
        ) {
          results.push({
            requestId: req.id,
            notificationId: n.id,
            patientName: req.patientName,
            createdAt: n.sentAt || undefined,
          });
        }
      }
    }

    return results;
  }

  /**
   * Verify whether a donor has a notification for a specific request
   */
  public async getNotificationForDonorAndRequest(
    requestId: string,
    donorId: string
  ): Promise<{ id: string; requestId: string; donorId: string; status: string } | null> {
    if (this.isLiveDb()) {
      try {
        const rows = await db
          .select({
            id: donorNotifications.id,
            requestId: donorNotifications.requestId,
            donorId: donorNotifications.donorId,
            status: donorNotifications.status,
          })
          .from(donorNotifications)
          .where(
            and(
              eq(donorNotifications.requestId, requestId),
              eq(donorNotifications.donorId, donorId)
            )
          )
          .limit(1);

        return rows[0] || null;
      } catch (err) {
        console.warn('[@repo/api] Error fetching notification in DB:', err);
        return null;
      }
    }

    const mockNotif = mockStore.getNotificationForDonorAndRequest(requestId, donorId);
    if (mockNotif) {
      return {
        id: mockNotif.id,
        requestId,
        donorId: mockNotif.donorId,
        status: mockNotif.status,
      };
    }

    return null;
  }

  /**
   * Handle donor reply (accept or decline) from a signed push action or authenticated donor session
   */
  public async handleDonorReply(
    requestId: string,
    donorIdentifier: string,
    action: 'accepted' | 'declined',
    note?: string
  ): Promise<{ success: boolean; duplicate?: boolean; requestStatus: RequestStatus }> {
    if (!this.isLiveDb()) {
      return mockStore.simulateDonorReply(requestId, donorIdentifier, action, note);
    }

    // Live DB Mode
    const respondedAt = new Date();

    // Resolve donorId if donorIdentifier is a phone number
    let resolvedDonorId = donorIdentifier;
    if (donorIdentifier.startsWith('+') || /^\d{10,13}$/.test(donorIdentifier)) {
      const donor = await this.findDonorByPhone(donorIdentifier);
      if (donor) {
        resolvedDonorId = donor.donorId;
      }
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch request with row-level lock (FOR UPDATE)
      const dbReq = await tx
        .select()
        .from(bloodRequests)
        .where(eq(bloodRequests.id, requestId))
        .for('update')
        .limit(1);

      if (!dbReq[0]) {
        throw new Error(`Request not found: ${requestId}`);
      }

      const currentReqStatus = dbReq[0].status as RequestStatus;

      // Reject responding to cancelled or expired requests
      if (currentReqStatus === 'cancelled' || currentReqStatus === 'expired') {
        throw new Error(`Cannot respond to a ${currentReqStatus} request`);
      }

      // 2. Fetch existing notification with row-level lock (FOR UPDATE)
      const existingNotif = await tx
        .select()
        .from(donorNotifications)
        .where(
          and(
            eq(donorNotifications.requestId, requestId),
            eq(donorNotifications.donorId, resolvedDonorId)
          )
        )
        .for('update')
        .limit(1);

      if (!existingNotif[0]) {
        throw new Error(`Donor notification not found for request ${requestId} and donor ${resolvedDonorId}`);
      }

      const notif = existingNotif[0];

      // Reject responding if notification itself is expired or failed
      if (notif.status === 'expired' || notif.status === 'failed') {
        throw new Error(`Cannot respond to a ${notif.status} notification`);
      }

      // 3. Duplicate check (idempotent)
      if (notif.status === action) {
        return {
          success: true,
          duplicate: true,
          requestStatus: currentReqStatus,
        };
      }

      const previousStatus = notif.status;

      // 4. Update notification row atomically and check affected rows
      const updatedRows = await tx
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
        )
        .returning();

      if (updatedRows.length === 0) {
        throw new Error(`Failed to update donor notification: database update affected 0 rows`);
      }

      let newRequestStatus = currentReqStatus;

      // 5. State transitions for blood_requests with race protection
      if (action === 'accepted') {
        const updatedReqRows = await tx
          .update(bloodRequests)
          .set({
            status: 'fulfilled',
            fulfillmentSource: 'donor',
          })
          .where(
            and(
              eq(bloodRequests.id, requestId),
              ne(bloodRequests.status, 'cancelled'),
              ne(bloodRequests.status, 'expired')
            )
          )
          .returning();

        if (updatedReqRows.length === 0) {
          throw new Error(`Failed to fulfill request: request ${requestId} was cancelled or expired`);
        }
        newRequestStatus = 'fulfilled';
      } else if (action === 'declined') {
        // If donor previously accepted, revert request to donors_notified if no other accepted donors remain
        if (previousStatus === 'accepted') {
          const otherAccepted = await tx
            .select({ id: donorNotifications.id })
            .from(donorNotifications)
            .where(
              and(
                eq(donorNotifications.requestId, requestId),
                eq(donorNotifications.status, 'accepted'),
                ne(donorNotifications.donorId, resolvedDonorId)
              )
            );

          if (otherAccepted.length === 0 && currentReqStatus === 'fulfilled') {
            const revertedRows = await tx
              .update(bloodRequests)
              .set({
                status: 'donors_notified',
                fulfillmentSource: null,
              })
              .where(
                and(
                  eq(bloodRequests.id, requestId),
                  eq(bloodRequests.status, 'fulfilled')
                )
              )
              .returning();

            if (revertedRows.length > 0) {
              newRequestStatus = 'donors_notified';
            }
          }
        }
      }

      // Keep mockStore in sync for fallback
      try {
        mockStore.simulateDonorReply(requestId, resolvedDonorId, action, note);
      } catch {
        // Ignore mock store sync failure
      }

      return {
        success: true,
        requestStatus: newRequestStatus,
      };
    });
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
            });
          }
        }
      }
    }

    return { request, notifications, acceptedDonors };
  }
}

export const requestService = new RequestService();
