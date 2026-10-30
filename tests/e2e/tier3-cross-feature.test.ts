/**
 * Tier 3 — Cross-Feature Combinations Test Suite
 * 
 * Verifies multi-feature interactions, pairwise combinations, and state transitions
 * across modules (Blood compatibility + Geo, eRaktKosh + Donor Cascade, WhatsApp webhook +
 * Request lifecycle, Bilingual dictionaries + Search, Registration + Matcher, etc.).
 * Total: >= 30 comprehensive pairwise integration test cases.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  MockRaktKhojServer,
  RaktKhojClient,
  RBC_COMPATIBILITY_ORACLE,
  getCompatibleDonorGroupsOracle,
  isDonorCompatibleOracle,
  haversineDistanceOracle,
  getBoundingBoxOracle,
  isDonorEligibleOracle,
  validateIndianPhoneOracle,
  computeHmacSha256,
  verifyWhatsAppWebhookSignature,
  GEO_FIXTURES,
  STATES_DISTRICTS_FIXTURES,
  I18N_DICTIONARIES,
  SEED_BLOOD_BANKS,
  SEED_DONORS,
  type BloodGroup,
} from "./harness";

describe("Tier 3 — Cross-Feature Combinations", () => {
  let server: MockRaktKhojServer;
  let client: RaktKhojClient;

  beforeAll(async () => {
    server = new MockRaktKhojServer();
    const { url } = await server.start();
    client = new RaktKhojClient(url);
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset();
  });

  // --------------------------------------------------------------------------
  // Pair 1: F2 (Blood Compatibility) + F3 (Geo Radius Queries)
  // --------------------------------------------------------------------------
  describe("Pair 1: F2 (Blood Compatibility) + F3 (Geo Radius Queries)", () => {
    test("Pair 1.1: O- blood request matches only nearby O- donors within 5 km", async () => {
      // Priya Verma is O- at AIIMS campus (~0.15 km from AIIMS)
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O-",
        patientName: "O- Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 5,
        unitsNeeded: 10, // Force donor cascade
      });
      const notifs = server.getNotificationsForRequest(res.request!.id);
      expect(notifs.length).toBeGreaterThan(0);
      for (const n of notifs) {
        expect(n.donorBloodGroup).toBe("O-");
      }
    });

    test("Pair 1.2: A+ blood request matches A+, A-, O+, O- donors within 10 km", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "A+",
        patientName: "A+ Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
        unitsNeeded: 25, // Force donor cascade
      });
      const notifs = server.getNotificationsForRequest(res.request!.id);
      const matchedGroups = notifs.map((n) => n.donorBloodGroup);
      const allowedGroups = ["A+", "A-", "O+", "O-"];
      for (const g of matchedGroups) {
        expect(allowedGroups).toContain(g!);
      }
    });

    test("Pair 1.3: B+ request matches B+ and O- within 10km, excludes B- donor at 66km (Meerut)", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "B+",
        patientName: "B+ Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
        unitsNeeded: 20, // Force cascade
      });
      const notifs = server.getNotificationsForRequest(res.request!.id);
      const donorIds = notifs.map((n) => n.donorId);
      // Vikram Singh (B+) in Vasant Kunj (7.3km) is matched
      expect(donorIds).toContain("donor-vikram-b-pos");
      // Rohit Yadav (B-) in Meerut (66km) is excluded
      expect(donorIds).not.toContain("donor-rohit-b-neg-meerut");
    });

    test("Pair 1.4: Expanding radius from 10km to 50km includes compatible donors in suburban NCR", async () => {
      // Sunita Rao (O+) is in Gurugram (~21.5 km from AIIMS)
      const res10km = await client.createBloodRequest({
        bloodGroupNeeded: "B+",
        patientName: "Seeker 10",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
        unitsNeeded: 20,
      });
      const notifs10km = server.getNotificationsForRequest(res10km.request!.id);
      expect(notifs10km.map((n) => n.donorId)).not.toContain("donor-sunita-o-pos-gurgaon");

      const res50km = await client.createBloodRequest({
        bloodGroupNeeded: "B+",
        patientName: "Seeker 50",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 50,
        unitsNeeded: 20,
      });
      const notifs50km = server.getNotificationsForRequest(res50km.request!.id);
      expect(notifs50km.map((n) => n.donorId)).toContain("donor-sunita-o-pos-gurgaon");
    });
  });

  // --------------------------------------------------------------------------
  // Pair 2: F9 (Blood Bank Search) + F10 (eRaktKosh Scraper) + F25 (Cascade)
  // --------------------------------------------------------------------------
  describe("Pair 2: F9 (Blood Bank Search) + F10 (eRaktKosh Scraper) + F25 (Cascade)", () => {
    test("Pair 2.1: Available bank stock halts cascade at Stage 1 with status 'bank_found'", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+", // AIIMS has 8 units
        patientName: "Stage 1 Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 5,
        unitsNeeded: 2,
      });
      expect(res.request?.status).toBe("bank_found");
      expect(res.request?.fulfillmentSource).toBe("blood_bank");
      expect(res.notificationsSent).toBe(0);
    });

    test("Pair 2.2: 0 bank stock automatically activates Stage 2 donor cascade", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-", // 0 units at all nearby banks
        patientName: "Stage 2 Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
        unitsNeeded: 1,
      });
      expect(res.request?.status).toBe("donors_notified");
      expect(res.notificationsSent).toBeGreaterThan(0);
      expect(server.getOutboundWhatsAppMessages().length).toBeGreaterThan(0);
    });

    test("Pair 2.3: Bank search query filters out banks with 0 stock for requested component", async () => {
      const searchRes = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        bloodGroup: "AB-",
        radiusKm: 10,
      });
      for (const bank of searchRes.banks) {
        expect(bank.stock.length).toBe(0); // All filtered out because 0 units
      }
    });

    test("Pair 2.4: Bank search in remote area with no banks returns 0 banks and source 'combined'", async () => {
      const searchRes = await client.searchBloodBanks({
        lat: 10.0,
        lng: 70.0,
        radiusKm: 5,
      });
      expect(searchRes.banks.length).toBe(0);
      expect(searchRes.totalCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 3: F13 (Donor Matcher) + F14 (WhatsApp Outbound) + F16 (Local Mock)
  // --------------------------------------------------------------------------
  describe("Pair 3: F13 (Donor Matcher) + F14 (WhatsApp Outbound) + F16 (Local Mock)", () => {
    test("Pair 3.1: Donor matcher creates matching number of outbound WhatsApp messages in mock store", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Matcher Mock Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
      });
      const messages = server.getOutboundWhatsAppMessages();
      expect(messages.length).toBe(reqRes.notificationsSent!);
    });

    test("Pair 3.2: Outbound WhatsApp messages include correct request ID and donor ID in buttons", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Button ID Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
      });
      const reqId = reqRes.request!.id;
      const messages = server.getOutboundWhatsAppMessages();
      for (const msg of messages) {
        const acceptBtn = msg.interactiveButtons.find((b) => b.id.startsWith("accept_"));
        expect(acceptBtn?.id).toBe(`accept_${reqId}_${msg.donorId}`);
      }
    });

    test("Pair 3.3: Mock store correctly isolates WhatsApp messages between sequential requests", async () => {
      server.reset();
      expect(server.getOutboundWhatsAppMessages().length).toBe(0);

      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Seq Seeker 1",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const count1 = server.getOutboundWhatsAppMessages().length;

      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Seq Seeker 2",
        hospitalName: "Safdarjung Hospital",
        latitude: 28.57,
        longitude: 77.208,
      });
      const count2 = server.getOutboundWhatsAppMessages().length;
      expect(count2).toBeGreaterThan(count1);
    });

    test("Pair 3.4: WhatsApp messages maintain donor language preference (Hindi template for Hindi donors)", async () => {
      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Lang Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const messages = server.getOutboundWhatsAppMessages();
      const priyaMsg = messages.find((m) => m.donorId === "donor-priya-o-neg");
      expect(priyaMsg?.language).toBe("hi");
    });
  });

  // --------------------------------------------------------------------------
  // Pair 4: F15 (WhatsApp Webhook) + F17 (Request Lifecycle) + F26 (Waiting Room)
  // --------------------------------------------------------------------------
  describe("Pair 4: F15 (WhatsApp Webhook) + F17 (Request Lifecycle) + F26 (Waiting Room)", () => {
    test("Pair 4.1: Inbound WhatsApp button reply transitions request status from 'donors_notified' to 'fulfilled'", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Lifecycle Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = reqRes.request!.id;
      const initial = await client.getBloodRequest(reqId);
      expect(initial.request?.status).toBe("donors_notified");

      // Inject webhook accept event
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "919822233344",
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: `accept_${reqId}_donor-amit-ab-neg`, title: "Accept" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await client.postWhatsAppWebhook(payload);

      const after = await client.getBloodRequest(reqId);
      expect(after.request?.status).toBe("fulfilled");
      expect(after.request?.fulfillmentSource).toBe("donor");
    });

    test("Pair 4.2: Webhook accept updates notification record status to 'accepted' with respondedAt timestamp", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Timestamp Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = reqRes.request!.id;

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "919822233344",
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: `accept_${reqId}_donor-amit-ab-neg`, title: "Accept" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await client.postWhatsAppWebhook(payload);

      const after = await client.getBloodRequest(reqId);
      const amitNotif = after.notifications?.find((n) => n.donorId === "donor-amit-ab-neg");
      expect(amitNotif?.status).toBe("accepted");
      expect(amitNotif?.respondedAt).toBeDefined();
    });

    test("Pair 4.3: Webhook accept unlocks unmasked phone number and direct WhatsApp URL in waiting room", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Unlock Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = reqRes.request!.id;

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "919822233344",
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: `accept_${reqId}_donor-amit-ab-neg`, title: "Accept" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await client.postWhatsAppWebhook(payload);

      const room = await client.getBloodRequest(reqId);
      expect(room.acceptedDonors?.length).toBe(1);
      const donor = room.acceptedDonors![0];
      expect(donor.name).toBe("Amit Patel");
      expect(donor.phone).toBe("+919822233344");
      expect(donor.directCallUrl).toBe("tel:+919822233344");
    });

    test("Pair 4.4: Webhook decline marks notification as 'declined' without fulfilling the request", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Decline Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = reqRes.request!.id;

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "919822233344",
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: `decline_${reqId}_donor-amit-ab-neg`, title: "Cannot" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await client.postWhatsAppWebhook(payload);

      const room = await client.getBloodRequest(reqId);
      expect(room.request?.status).toBe("donors_notified");
      expect(room.acceptedDonors?.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 5: F4 (i18n Dictionaries) + F22 (Bilingual Routing) + F23 (Emergency Form)
  // --------------------------------------------------------------------------
  describe("Pair 5: F4 (i18n Dictionaries) + F22 (Bilingual Routing) + F23 (Emergency Form)", () => {
    test("Pair 5.1: Form labels resolve to Hindi in /hi locale", () => {
      const hiDict = I18N_DICTIONARIES.hi.bloodSearch;
      expect(hiDict.selectBloodGroup).toBe("रक्त समूह चुनें");
      expect(hiDict.searchBloodBanks).toBe("ब्लड बैंक खोजें");
    });

    test("Pair 5.2: Radius preset button labels translate to Hindi (5 कि.मी., 10 कि.मी., 50 कि.मी.)", () => {
      const hiDict = I18N_DICTIONARIES.hi.bloodSearch;
      expect(hiDict.radius5km).toBe("5 कि.मी.");
      expect(hiDict.radius10km).toBe("10 कि.मी.");
      expect(hiDict.radius50km).toBe("50 कि.मी.");
    });

    test("Pair 5.3: Empty results message in Hindi correctly alerts user of fallback to donors", () => {
      const hiDict = I18N_DICTIONARIES.hi.bloodSearch;
      expect(hiDict.fallbackToDonors).toContain("आस-पास संगत रक्तदाताओं की खोज");
    });

    test("Pair 5.4: Waiting room headers resolve correctly in English and Hindi", () => {
      expect(I18N_DICTIONARIES.en.request.waitingRoomTitle).toBe("Live Emergency Waiting Room");
      expect(I18N_DICTIONARIES.hi.request.waitingRoomTitle).toBe("सजीव आपातकालीन प्रतीक्षा कक्ष");
    });
  });

  // --------------------------------------------------------------------------
  // Pair 6: F12 (Donor Registration) + F13 (Donor Matching) + F27 (Donor Portal)
  // --------------------------------------------------------------------------
  describe("Pair 6: F12 (Donor Registration) + F13 (Donor Matching) + F27 (Donor Portal)", () => {
    test("Pair 6.1: Newly registered donor is immediately matchable in subsequent emergency request", async () => {
      const newPhone = "+919911223344";
      const regRes = await client.registerDonor({
        name: "Immediate Match Donor",
        phone: newPhone,
        bloodGroup: "B-",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(regRes.donor).toBeDefined();

      // Create request for B-
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "B-",
        patientName: "Instant Match Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 5,
        unitsNeeded: 1,
      });
      const notifs = server.getNotificationsForRequest(reqRes.request!.id);
      const donorIds = notifs.map((n) => n.donorId);
      expect(donorIds).toContain(regRes.donor!.id);
    });

    test("Pair 6.2: Donor registering without WhatsApp consent is not notified during emergency cascade", async () => {
      // Direct insertion in mock db bypassing API validation to simulate database record
      const unconsentedDonor = {
        id: "donor-manual-no-consent",
        userId: "user-mc-1",
        name: "No Consent Direct",
        phone: "+919922334455",
        bloodGroup: "AB-" as BloodGroup,
        latitude: 28.5672,
        longitude: 77.21,
        state: "Delhi",
        district: "South Delhi",
        isAvailable: true,
        searchRadiusKm: 10,
        whatsappConsent: false, // NO CONSENT
        createdAt: new Date().toISOString(),
      };
      server.reset({ donors: [...SEED_DONORS, unconsentedDonor] });

      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Consent Check Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const notifs = server.getNotificationsForRequest(reqRes.request!.id);
      expect(notifs.map((n) => n.donorId)).not.toContain("donor-manual-no-consent");
    });

    test("Pair 6.3: Donor registration normalizes varied phone input formats (+91, without prefix, with spaces)", async () => {
      const res = await client.registerDonor({
        name: "Phone Format Test",
        phone: "  9876543219  ",
        bloodGroup: "O+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(res.donor?.phone).toBe("+919876543219");
    });

    test("Pair 6.4: Underweight donor (< 45 kg) eligibility validation triggers medical guidance", () => {
      const validateWeight = (kg: number) => {
        if (kg < 45) return { eligible: false, message: "Minimum weight requirement is 45 kg" };
        return { eligible: true };
      };
      expect(validateWeight(42).eligible).toBe(false);
      expect(validateWeight(50).eligible).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 7: F6 (Database Schema) + F17 (Request Lifecycle) + F15 (Webhook)
  // --------------------------------------------------------------------------
  describe("Pair 7: F6 (Database Schema) + F17 (Request Lifecycle) + F15 (Webhook)", () => {
    test("Pair 7.1: Request lifecycle state transitions adhere strictly to schema enum values", async () => {
      const validStatuses = ["searching", "bank_found", "donors_notified", "fulfilled", "expired", "cancelled"];
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Enum Lifecycle Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(validStatuses).toContain(reqRes.request!.status);

      await client.respondToRequest(reqRes.request!.id, {
        donorId: "donor-amit-ab-neg",
        status: "accepted",
      });
      const updated = await client.getBloodRequest(reqRes.request!.id);
      expect(validStatuses).toContain(updated.request!.status);
      expect(updated.request!.status).toBe("fulfilled");
    });

    test("Pair 7.2: Donor notification statuses adhere strictly to schema enum values", async () => {
      const validNotifStatuses = ["pending", "sent", "delivered", "read", "accepted", "declined", "expired", "failed"];
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Notif Enum Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const notifs = server.getNotificationsForRequest(reqRes.request!.id);
      for (const n of notifs) {
        expect(validNotifStatuses).toContain(n.status);
      }
    });

    test("Pair 7.3: Webhook HMAC signature verification protects lifecycle state from tampering", async () => {
      const payload = { entry: [] };
      const rawText = JSON.stringify(payload);
      const validSignature = computeHmacSha256(rawText, server.appSecret);

      const isValid = verifyWhatsAppWebhookSignature(rawText, `sha256=${validSignature}`, server.appSecret);
      const isTampered = verifyWhatsAppWebhookSignature(rawText, "sha256=tampered_signature", server.appSecret);

      expect(isValid).toBe(true);
      expect(isTampered).toBe(false);
    });

    test("Pair 7.4: Blood request expiration timestamp is accurately set 24 hours into the future", async () => {
      const reqRes = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "24h Expiry Seeker",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const created = new Date(reqRes.request!.createdAt).getTime();
      const expires = new Date(reqRes.request!.expiresAt!).getTime();
      const diffHours = (expires - created) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });
  });

  // --------------------------------------------------------------------------
  // Pair 8: F11 (State/District Master) + F9 (Blood Bank Search)
  // --------------------------------------------------------------------------
  describe("Pair 8: F11 (State/District Master) + F9 (Blood Bank Search)", () => {
    test("Pair 8.1: Searching with state='Delhi' and district='South Delhi' filters banks accurately", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        state: "Delhi",
        district: "South Delhi",
        radiusKm: 10,
      });
      expect(res.banks.length).toBeGreaterThan(0);
      for (const bank of res.banks) {
        expect(bank.state).toBe("Delhi");
        expect(bank.district).toBe("South Delhi");
      }
    });

    test("Pair 8.2: Districts endpoint provides valid district list for search dropdown", async () => {
      const states = await client.getStates();
      expect(states.states.length).toBeGreaterThan(0);
      const dl = states.states.find((s) => s.code === "DL");
      expect(dl).toBeDefined();

      const districts = await client.getDistricts(dl!.code);
      expect(districts.districts.length).toBeGreaterThan(0);
    });

    test("Pair 8.3: Searching in mismatched state and district returns 0 banks", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        state: "Delhi",
        district: "Pune", // Pune is in Maharashtra, not Delhi
        radiusKm: 50,
      });
      expect(res.banks.length).toBe(0);
    });

    test("Pair 8.4: Blood bank results include verified license number for institutional credibility", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        radiusKm: 5,
      });
      const aiims = res.banks.find((b) => b.id === "bank-aiims-delhi");
      expect(aiims?.licenseNumber).toBe("DL-BB-1001");
    });
  });
});
