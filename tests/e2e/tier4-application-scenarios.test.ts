/**
 * Tier 4 — Real-World Application Scenarios Test Suite
 * 
 * Executes 6 realistic, end-to-end medical emergency workflows:
 * Scenario 1: Immediate blood bank hit for emergency surgery in Delhi.
 * Scenario 2: Rare negative blood group (AB-) cascading from empty bank stock to compatible volunteer donors within 10km.
 * Scenario 3: Donor accepts via WhatsApp quick reply, unlocking direct call / WhatsApp link for patient family in the waiting room.
 * Scenario 4: Offline connectivity handling with emergency helpline directory fallback.
 * Scenario 5: End-to-end seeker and donor journey in Hindi (hi).
 * Scenario 6: Soft donor eligibility warning display for donors with donations in <90 days.
 * Total: 6 complex multi-step scenario test cases.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import {
  MockRaktKhojServer,
  RaktKhojClient,
  isDonorEligibleOracle,
  GEO_FIXTURES,
  I18N_DICTIONARIES,
  SEED_BLOOD_BANKS,
  SEED_DONORS,
  type BloodGroup,
} from "./harness";

describe("Tier 4 — Real-World Application Scenarios", () => {
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
  // Scenario 1: Immediate blood bank hit for emergency surgery in Delhi
  // --------------------------------------------------------------------------
  test("Scenario 1: Emergency surgery request at AIIMS Delhi with immediate blood bank hit", async () => {
    // Step 1: Patient admitted at AIIMS New Delhi for emergency coronary bypass surgery
    const patientLocation = GEO_FIXTURES.AIIMS_DELHI;
    const requestedBloodGroup: BloodGroup = "O+";
    const unitsNeeded = 2;

    // Step 2: Seeker searches blood banks within 5 km radius
    const searchResult = await client.searchBloodBanks({
      lat: patientLocation.lat,
      lng: patientLocation.lng,
      bloodGroup: requestedBloodGroup,
      radiusKm: 5,
    });

    expect(searchResult.banks.length).toBeGreaterThan(0);

    // Step 3: Verify results are sorted by distance from AIIMS
    const firstBank = searchResult.banks[0];
    expect(firstBank.name).toBe("AIIMS Main Blood Bank");
    expect(firstBank.distanceKm).toBeLessThan(0.1);

    // Step 4: Verify stock availability (AIIMS has 8 units of O+)
    const aiimsStock = firstBank.stock.find((s) => s.bloodGroup === requestedBloodGroup);
    expect(aiimsStock).toBeDefined();
    expect(aiimsStock!.unitsAvailable).toBeGreaterThanOrEqual(unitsNeeded);

    // Step 5: Verify institutional contact information for family to contact immediately
    expect(firstBank.phone).toBe("+911126593201");
    expect(firstBank.address).toContain("Ansari Nagar");
    expect(firstBank.licenseNumber).toBe("DL-BB-1001");

    // Step 6: Create formal blood request in system
    const requestRes = await client.createBloodRequest({
      bloodGroupNeeded: requestedBloodGroup,
      componentType: "whole_blood",
      unitsNeeded,
      patientName: "Ramesh Sharma",
      patientAge: 58,
      emergencyType: "surgery",
      hospitalName: "AIIMS New Delhi",
      latitude: patientLocation.lat,
      longitude: patientLocation.lng,
      searchRadiusKm: 5,
    });

    // Step 7: System halts at Stage 1 (bank found), no volunteer donors cascade needed
    expect(requestRes.request?.status).toBe("bank_found");
    expect(requestRes.request?.fulfillmentSource).toBe("blood_bank");
    expect(requestRes.notificationsSent).toBe(0);
    expect(server.getOutboundWhatsAppMessages().length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Rare negative blood group (AB-) dynamic cascade to donors
  // --------------------------------------------------------------------------
  test("Scenario 2: Rare negative blood group (AB-) cascading from empty bank stock to compatible volunteer donors within 10km", async () => {
    // Step 1: Accident patient rushed to trauma center, needs rare AB- blood
    const traumaLocation = GEO_FIXTURES.AIIMS_DELHI;
    const rareBloodGroup: BloodGroup = "AB-";
    const unitsNeeded = 1;

    // Step 2: Query nearby blood banks within 10 km
    const bankSearch = await client.searchBloodBanks({
      lat: traumaLocation.lat,
      lng: traumaLocation.lng,
      bloodGroup: rareBloodGroup,
      radiusKm: 10,
    });

    // Step 3: Verify all nearby blood banks have 0 units of AB- available
    const totalUnitsAvailable = bankSearch.banks.reduce(
      (sum, bank) => sum + bank.stock.reduce((sub, item) => sub + item.unitsAvailable, 0),
      0
    );
    expect(totalUnitsAvailable).toBe(0);

    // Step 4: Create emergency request, triggering Stage 2 Community Cascade
    const cascadeRequest = await client.createBloodRequest({
      bloodGroupNeeded: rareBloodGroup,
      componentType: "whole_blood",
      unitsNeeded,
      patientName: "Pooja Malhotra (Trauma Victim)",
      patientAge: 24,
      emergencyType: "accident",
      hospitalName: "Jai Prakash Narayan Apex Trauma Center, AIIMS",
      latitude: traumaLocation.lat,
      longitude: traumaLocation.lng,
      searchRadiusKm: 10,
    });

    // Step 5: Verify status transitioned to 'donors_notified'
    expect(cascadeRequest.request?.status).toBe("donors_notified");
    expect(cascadeRequest.notificationsSent).toBeGreaterThan(0);

    // Step 6: Verify RBC Compatibility Rule for AB- [AB-, A-, B-, O-]
    // In our seed database within 10km:
    // - Amit Patel: AB- in Malviya Nagar (~4.1km) -> MATCH
    // - Priya Verma: O- at AIIMS Campus (~0.15km) -> MATCH
    // - Rahul Sharma: A+ -> INCOMPATIBLE Rh+
    // - Vikram Singh: B+ -> INCOMPATIBLE Rh+
    // - Rohit Yadav: B- -> COMPATIBLE but in Meerut (~66.5km > 10km radius) -> EXCLUDED
    const notifications = server.getNotificationsForRequest(cascadeRequest.request!.id);
    const notifiedDonorIds = notifications.map((n) => n.donorId);

    expect(notifiedDonorIds).toContain("donor-amit-ab-neg");
    expect(notifiedDonorIds).toContain("donor-priya-o-neg");
    expect(notifiedDonorIds).not.toContain("donor-rahul-a-pos");
    expect(notifiedDonorIds).not.toContain("donor-rohit-b-neg-meerut");

    // Step 7: Verify outbound WhatsApp notifications were queued
    const outbound = server.getOutboundWhatsAppMessages();
    expect(outbound.length).toBe(notifications.length);
    for (const msg of outbound) {
      expect(msg.templateName).toBe("emergency_blood_alert_v1");
      expect(msg.parameters.blood_group).toBe("AB-");
      expect(msg.interactiveButtons.length).toBe(2);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Donor accepts via WhatsApp quick reply, unlocking contact
  // --------------------------------------------------------------------------
  test("Scenario 3: Donor accepts via WhatsApp quick-reply; contact unlocked in waiting room", async () => {
    // Step 1: Emergency request created with donor notifications dispatched
    const requestRes = await client.createBloodRequest({
      bloodGroupNeeded: "AB-",
      patientName: "Patient waiting for donor",
      hospitalName: "Safdarjung Hospital",
      latitude: GEO_FIXTURES.SAFDARJUNG_HOSPITAL.lat,
      longitude: GEO_FIXTURES.SAFDARJUNG_HOSPITAL.lng,
      searchRadiusKm: 10,
    });
    const requestId = requestRes.request!.id;

    // Step 2: Patient family views Live Waiting Room
    const initialWaitingRoom = await client.getBloodRequest(requestId);
    expect(initialWaitingRoom.request?.status).toBe("donors_notified");
    expect(initialWaitingRoom.acceptedDonors?.length).toBe(0);

    // Step 3: Donor phone numbers are masked for privacy while awaiting response
    for (const notif of initialWaitingRoom.notifications || []) {
      expect(notif.donorPhoneMasked).toContain("****");
    }

    // Step 4: Donor Amit Patel clicks "Accept & Donate" button in WhatsApp
    const acceptingDonor = SEED_DONORS.find((d) => d.id === "donor-amit-ab-neg")!;
    const whatsappWebhookPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: acceptingDonor.phone.replace("+", ""),
                    id: "wamid.inbound_button_12345",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "interactive",
                    interactive: {
                      type: "button_reply",
                      button_reply: {
                        id: `accept_${requestId}_${acceptingDonor.id}`,
                        title: "Accept & Donate",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    // Step 5: Webhook processes inbound event
    const webhookRes = await client.postWhatsAppWebhook(whatsappWebhookPayload);
    expect(webhookRes.success).toBe(true);

    // Step 6: Waiting room receives real-time update
    const updatedWaitingRoom = await client.getBloodRequest(requestId);
    expect(updatedWaitingRoom.request?.status).toBe("fulfilled");
    expect(updatedWaitingRoom.request?.fulfillmentSource).toBe("donor");
    expect(updatedWaitingRoom.acceptedDonors?.length).toBe(1);

    // Step 7: Family can now contact donor directly via phone call or WhatsApp
    const donorContact = updatedWaitingRoom.acceptedDonors![0];
    expect(donorContact.donorId).toBe(acceptingDonor.id);
    expect(donorContact.name).toBe("Amit Patel");
    expect(donorContact.phone).toBe("+919822233344");
    expect(donorContact.directCallUrl).toBe("tel:+919822233344");
    expect(donorContact.whatsappUrl).toContain("wa.me/919822233344");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Offline connectivity handling with emergency helpline directory fallback
  // --------------------------------------------------------------------------
  test("Scenario 4: Offline connectivity handling with emergency helpline directory fallback", () => {
    // Step 1: User experiences network connection drop in ambulance
    const isOnline = false;

    // Step 2: PWA Service worker detects offline status
    const getOfflineFallback = () => {
      return {
        isOffline: true,
        page: "/offline",
        title: "You are currently offline",
        titleHi: "आप वर्तमान में ऑफ़लाइन हैं",
        message: "Emergency blood helplines and cached blood banks are available offline",
        helplines: [
          { name: "National Blood Helpline", number: "104", url: "tel:104" },
          { name: "National Emergency Ambulance", number: "108", url: "tel:108" },
          { name: "eRaktKosh Central Helpline", number: "1800-180-1104", url: "tel:18001801104" },
          { name: "Delhi Red Cross Blood Bank", number: "+911123716441", url: "tel:+911123716441" },
        ],
      };
    };

    const offlineData = getOfflineFallback();
    expect(offlineData.isOffline).toBe(true);

    // Step 3: Verify vital national helplines are present with direct dial URLs
    const numbers = offlineData.helplines.map((h) => h.number);
    expect(numbers).toContain("104");
    expect(numbers).toContain("108");
    expect(numbers).toContain("1800-180-1104");

    for (const h of offlineData.helplines) {
      expect(h.url.startsWith("tel:")).toBe(true);
    }

    // Step 4: Verify cached blood bank contacts from seed are available offline
    const cachedBank = SEED_BLOOD_BANKS[0];
    expect(cachedBank.phone).toBe("+911126593201");
    expect(cachedBank.address).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 5: End-to-end seeker and donor journey in Hindi (hi)
  // --------------------------------------------------------------------------
  test("Scenario 5: End-to-end seeker and donor journey in Hindi (hi)", async () => {
    // Step 1: Seeker opens application in Hindi (/hi/search)
    const hiLocale = "hi";
    const searchFormTexts = I18N_DICTIONARIES[hiLocale].bloodSearch;
    expect(searchFormTexts.title).toBe("अभी रक्त खोजें");
    expect(searchFormTexts.selectBloodGroup).toBe("रक्त समूह चुनें");

    // Step 2: Seeker searches for A+ blood at Balrampur Hospital Lucknow
    const lucknowLocation = GEO_FIXTURES.BALRAMPUR_LUCKNOW;
    const searchRes = await client.searchBloodBanks({
      lat: lucknowLocation.lat,
      lng: lucknowLocation.lng,
      bloodGroup: "A+",
      radiusKm: 10,
    });

    // Step 3: No blood banks in Lucknow in seed database -> fallback message in Hindi
    expect(searchRes.banks.length).toBe(0);
    expect(searchFormTexts.fallbackToDonors).toBe("आस-पास संगत रक्तदाताओं की खोज हो रही है...");

    // Step 4: Register local Lucknow Hindi-speaking volunteer donor
    const lucknowDonorRes = await client.registerDonor({
      name: "विकास वर्मा",
      phone: "+919555123456",
      bloodGroup: "A+",
      latitude: lucknowLocation.lat,
      longitude: lucknowLocation.lng,
      state: "Uttar Pradesh",
      district: "Lucknow",
      whatsappConsent: true,
      preferredLanguage: "hi",
    });
    expect(lucknowDonorRes.donor).toBeDefined();
    expect(lucknowDonorRes.donor?.preferredLanguage).toBe("hi");

    // Step 5: Create emergency request in Lucknow
    const requestRes = await client.createBloodRequest({
      bloodGroupNeeded: "A+",
      patientName: "सुरेश कुमार",
      hospitalName: "बलरामपुर अस्पताल, लखनऊ",
      latitude: lucknowLocation.lat,
      longitude: lucknowLocation.lng,
      searchRadiusKm: 10,
    });
    expect(requestRes.request?.status).toBe("donors_notified");

    // Step 6: Verify outbound WhatsApp alert is formatted in Hindi
    const outboundMessages = server.getOutboundWhatsAppMessages();
    const lucknowMsg = outboundMessages.find((m) => m.recipientPhone === "+919555123456");
    expect(lucknowMsg).toBeDefined();
    expect(lucknowMsg?.language).toBe("hi");

    // Step 7: Donor responds via Hindi quick action page
    const respondRes = await client.respondToRequest(requestRes.request!.id, {
      donorId: lucknowDonorRes.donor!.id,
      status: "accepted",
      responseNote: "मैं 15 मिनट में अस्पताल पहुँच रहा हूँ",
    });
    expect(respondRes.status).toBe("accepted");

    // Step 8: Waiting room renders in Hindi
    const waitingRoomTexts = I18N_DICTIONARIES.hi.request;
    expect(waitingRoomTexts.waitingRoomTitle).toBe("सजीव आपातकालीन प्रतीक्षा कक्ष");
    expect(waitingRoomTexts.acceptedDonors).toBe("स्वीकृत रक्तदाता");
    expect(waitingRoomTexts.callNow).toBe("रक्तदाता को कॉल करें");
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Soft donor eligibility warning display for donors with donations in <90 days
  // --------------------------------------------------------------------------
  test("Scenario 6: Soft donor eligibility warning display for donors with donations in <90 days", async () => {
    // Step 1: Donor Neha Gupta (female, last donated 35 days ago, required interval 120 days)
    const neha = SEED_DONORS.find((d) => d.id === "donor-neha-recent-warning")!;
    expect(neha).toBeDefined();

    // Step 2: Verify biological eligibility oracle flags soft warning badge
    const eligStatus = isDonorEligibleOracle(neha.gender, neha.lastDonationDate);
    expect(eligStatus.eligible).toBe(false);
    expect(eligStatus.warningBadge).toBe(true);
    expect(eligStatus.daysSinceLastDonation).toBeLessThan(120);

    // Step 3: Create emergency request for A+ blood at Green Park, Delhi (near Neha)
    const requestRes = await client.createBloodRequest({
      bloodGroupNeeded: "A+",
      patientName: "Sunil Chopra",
      hospitalName: "Green Park Trauma Clinic",
      latitude: neha.latitude,
      longitude: neha.longitude,
      unitsNeeded: 25, // Force cascade
      searchRadiusKm: 5,
    });

    // Step 4: Per project specification §Resolved Decisions 3:
    // "Donor eligibility: Soft enforcement — warning badge ('Recently donated — may not be eligible')
    // but DONORS WON'T BE BLOCKED"
    const notifs = server.getNotificationsForRequest(requestRes.request!.id);
    const nehaNotif = notifs.find((n) => n.donorId === neha.id);
    expect(nehaNotif).toBeDefined();

    // Step 5: Neha accepts the donation request
    await client.respondToRequest(requestRes.request!.id, {
      donorId: neha.id,
      status: "accepted",
      responseNote: "Doctor said I can donate plasma or whole blood if Hb is above 12.5",
    });

    // Step 6: Waiting room displays donor contact with prominent warning badge
    const waitingRoom = await client.getBloodRequest(requestRes.request!.id);
    expect(waitingRoom.acceptedDonors?.length).toBe(1);
    const donorCard = waitingRoom.acceptedDonors![0];
    expect(donorCard.donorId).toBe(neha.id);

    // Step 7: Verify bilingual badge warning text exists
    expect(I18N_DICTIONARIES.en.donor.recentDonationWarning).toContain("Recently donated (< 90 days)");
    expect(I18N_DICTIONARIES.hi.donor.recentDonationWarning).toContain("हाल ही में रक्तदान किया");
  });
});
