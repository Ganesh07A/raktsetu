import { describe, expect, it, beforeEach } from 'bun:test';
import { WhatsAppService } from './whatsapp';
import { mockStore } from './mock-store';

describe('WhatsAppService & Mocking Layer', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    service = new WhatsAppService();
    mockStore.reset();
  });

  it('records outbound template messages in mock store when credentials are unset', async () => {
    const result = await service.sendDonationRequest({
      recipientPhone: '+919876543210',
      donorId: 'donor-1',
      donorName: 'Rahul Sharma',
      requestId: 'req-123',
      patientName: 'Sunil Kumar',
      hospitalName: 'AIIMS New Delhi',
      bloodGroup: 'A+',
      unitsNeeded: 2,
      distanceKm: 3.5,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('mock');
    expect(result.messageId).toStartWith('wamid.HBgM');

    const recorded = service.getOutboundMessages();
    expect(recorded.length).toBe(1);

    const msg = recorded[0]!;
    expect(msg.recipientPhone).toBe('+919876543210');
    expect(msg.parameters.donor_name).toBe('Rahul Sharma');
    expect(msg.parameters.patient_name).toBe('Sunil Kumar');
    expect(msg.parameters.hospital_name).toBe('AIIMS New Delhi');
    expect(msg.parameters.blood_group).toBe('A+');
    expect(msg.parameters.units_needed).toBe('2');
    expect(msg.parameters.distance_km).toBe('3.5');

    // Verify interactive accept and decline button payloads
    expect(msg.interactiveButtons).toBeArray();
    expect(msg.interactiveButtons.length).toBe(2);
    expect(msg.interactiveButtons[0]!.id).toBe('accept_req-123_donor-1');
    expect(msg.interactiveButtons[1]!.id).toBe('decline_req-123_donor-1');
  });

  it('simulates donor button reply and updates request lifecycle state', () => {
    // 1. Create request
    mockStore.createRequest({
      id: 'req-999',
      requesterId: null,
      bloodGroupNeeded: 'O-',
      componentType: 'whole_blood',
      unitsNeeded: 1,
      patientName: 'Pooja',
      patientAge: null,
      emergencyType: 'surgery',
      hospitalName: 'Safdarjung',
      latitude: 28.57,
      longitude: 77.208,
      state: null,
      district: null,
      searchRadiusKm: 10,
      status: 'donors_notified',
      fulfillmentSource: null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });

    // 2. Add notification
    mockStore.addNotification({
      id: 'notif-999-1',
      requestId: 'req-999',
      donorId: 'donor-priya-o-neg',
      status: 'sent',
      sentAt: new Date().toISOString(),
      respondedAt: null,
    });

    // 3. Simulate accept
    const acceptRes = mockStore.simulateDonorReply(
      'req-999',
      'donor-priya-o-neg',
      'accepted'
    );
    expect(acceptRes.success).toBe(true);
    expect(acceptRes.requestStatus).toBe('fulfilled');

    const req = mockStore.getRequest('req-999');
    expect(req?.status).toBe('fulfilled');
    expect(req?.fulfillmentSource).toBe('donor');

    const notifs = mockStore.getNotificationsForRequest('req-999');
    expect(notifs[0]!.status).toBe('accepted');
    expect(notifs[0]!.respondedAt).toBeDefined();

    // 4. Verify accepted donors unlocked contact
    const accepted = mockStore.getAcceptedDonors('req-999');
    expect(accepted.length).toBe(1);
    expect(accepted[0]!.donorId).toBe('donor-priya-o-neg');
    expect(accepted[0]!.phone).toBe('+919811122233');
  });
});
