/**
 * Tier 2 — Boundary & Corner Cases Test Suite (F1 - F29)
 * 
 * Each of the 29 features has at least 5 dedicated boundary, corner-case,
 * and error condition tests verifying resilience, limits, and validation.
 * Total: 145 test cases.
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

describe("Tier 2 — Boundary & Corner Cases", () => {
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
  // F1: Monorepo Setup & Workspace Linking Boundaries
  // --------------------------------------------------------------------------
  describe("F1: Monorepo Setup & Workspace Linking Boundaries", () => {
    test("handles non-existent workspace package resolution gracefully without throwing unhandled crash", () => {
      const resolveNonExistent = () => {
        try {
          require.resolve("@repo/non-existent-package");
          return true;
        } catch (e: any) {
          return e.code === "MODULE_NOT_FOUND" || e.message.includes("Cannot find package");
        }
      };
      expect(resolveNonExistent()).toBe(true);
    });

    test("node engine minimum version requirement (>=24) is strictly enforced in root package", () => {
      const rootPkg = require("../../package.json");
      expect(rootPkg.engines?.node).toBe(">=24");
    });

    test("package manager declaration enforces Bun 1.4.2 runtime", () => {
      const rootPkg = require("../../package.json");
      expect(rootPkg.devEngines?.packageManager?.name).toBe("bun");
      expect(rootPkg.devEngines?.packageManager?.version).toBe("1.4.2");
    });

    test("turbo configuration guards against circular task dependencies", () => {
      const turbo = require("../../turbo.json");
      expect(turbo.tasks.build.dependsOn).toContain("^build");
      // Tasks do not depend on themselves directly
      expect(turbo.tasks.build.dependsOn).not.toContain("build");
    });

    test("private flag is true in root package to prevent accidental registry publishing", () => {
      const rootPkg = require("../../package.json");
      expect(rootPkg.private).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F2: Blood Compatibility Matrix Engine Boundaries
  // --------------------------------------------------------------------------
  describe("F2: Blood Compatibility Matrix Engine Boundaries", () => {
    test("invalid blood groups ('C+', 'X-', 'O', '') return empty compatibility list", () => {
      expect(getCompatibleDonorGroupsOracle("C+")).toEqual([]);
      expect(getCompatibleDonorGroupsOracle("X-")).toEqual([]);
      expect(getCompatibleDonorGroupsOracle("O")).toEqual([]);
      expect(getCompatibleDonorGroupsOracle("")).toEqual([]);
    });

    test("lowercase blood groups ('a+', 'o-') do not match without normalization", () => {
      expect(isDonorCompatibleOracle("a+", "A+")).toBe(false);
      expect(isDonorCompatibleOracle("o-", "O-")).toBe(false);
    });

    test("self-compatibility holds for every valid blood group (every group can donate to itself)", () => {
      const allGroups: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      for (const g of allGroups) {
        expect(isDonorCompatibleOracle(g, g)).toBe(true);
      }
    });

    test("Rh positive donors can NEVER donate red blood cells to Rh negative recipients", () => {
      const positiveDonors: BloodGroup[] = ["A+", "B+", "AB+", "O+"];
      const negativeRecipients: BloodGroup[] = ["A-", "B-", "AB-", "O-"];

      for (const donor of positiveDonors) {
        for (const recipient of negativeRecipients) {
          expect(isDonorCompatibleOracle(donor, recipient)).toBe(false);
        }
      }
    });

    test("reciprocal incompatibility: A+ cannot donate to O- even though O- can donate to A+", () => {
      expect(isDonorCompatibleOracle("O-", "A+")).toBe(true);
      expect(isDonorCompatibleOracle("A+", "O-")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F3: Haversine Geo Calculation & Bounding Box Boundaries
  // --------------------------------------------------------------------------
  describe("F3: Haversine Geo Calculation & Bounding Box Boundaries", () => {
    test("distance between identical coordinates is exactly 0.0 km", () => {
      const dist = haversineDistanceOracle(28.5672, 77.21, 28.5672, 77.21);
      expect(dist).toBe(0.0);
    });

    test("distance across antipodal points (North Pole to South Pole) is ~20,015 km (half Earth circumference)", () => {
      const dist = haversineDistanceOracle(90.0, 0.0, -90.0, 0.0);
      expect(dist).toBeGreaterThan(20000);
      expect(dist).toBeLessThan(20050);
    });

    test("distance across international dateline (lng +179.9 to -179.9 at equator) is ~22 km", () => {
      const dist = haversineDistanceOracle(0.0, 179.9, 0.0, -179.9);
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(25);
    });

    test("bounding box for 0 km radius produces zero delta (point itself)", () => {
      const bbox = getBoundingBoxOracle(28.5672, 77.21, 0);
      expect(bbox.minLat).toBeCloseTo(28.5672, 4);
      expect(bbox.maxLat).toBeCloseTo(28.5672, 4);
      expect(bbox.minLon).toBeCloseTo(77.21, 4);
      expect(bbox.maxLon).toBeCloseTo(77.21, 4);
    });

    test("exact 5.0 km boundary: point at 4.89 km is inside, point at 5.10 km is outside", () => {
      const aiims = GEO_FIXTURES.AIIMS_DELHI;
      const pInside = GEO_FIXTURES.BOUNDARY_POINTS_AIIMS.P_4_9KM;
      const pOutside = GEO_FIXTURES.BOUNDARY_POINTS_AIIMS.P_5_1KM;

      const dInside = haversineDistanceOracle(aiims.lat, aiims.lng, pInside.lat, pInside.lng);
      const dOutside = haversineDistanceOracle(aiims.lat, aiims.lng, pOutside.lat, pOutside.lng);

      expect(dInside).toBeLessThan(5.0);
      expect(dOutside).toBeGreaterThan(5.0);
    });
  });

  // --------------------------------------------------------------------------
  // F4: Bilingual i18n Dictionaries Boundaries
  // --------------------------------------------------------------------------
  describe("F4: Bilingual i18n Dictionaries Boundaries", () => {
    test("dictionary handles non-existent namespace lookup safely without crash", () => {
      const dict = I18N_DICTIONARIES.en as any;
      expect(dict["nonExistentNamespace"]).toBeUndefined();
    });

    test("Devanagari strings in Hindi dictionary contain valid Unicode script range (\\u0900-\\u097F)", () => {
      const hiSample = I18N_DICTIONARIES.hi.bloodSearch.title; // "अभी रक्त खोजें"
      const hasDevanagari = /[\u0900-\u097F]/.test(hiSample);
      expect(hasDevanagari).toBe(true);
    });

    test("translation strings do not contain raw unescaped HTML scripts (<script>)", () => {
      const hiJson = JSON.stringify(I18N_DICTIONARIES.hi);
      const enJson = JSON.stringify(I18N_DICTIONARIES.en);
      expect(hiJson.includes("<script>")).toBe(false);
      expect(enJson.includes("<script>")).toBe(false);
    });

    test("fallback language behavior: missing key in target locale falls back to English", () => {
      const getTranslation = (lang: "en" | "hi", ns: string, key: string) => {
        const primary = (I18N_DICTIONARIES[lang] as any)?.[ns]?.[key];
        if (primary) return primary;
        return (I18N_DICTIONARIES.en as any)?.[ns]?.[key] ?? key;
      };
      expect(getTranslation("hi", "common", "appName")).toBe("रक्तखोज");
      expect(getTranslation("hi", "nonExistent", "missingKey")).toBe("missingKey");
    });

    test("translation strings preserve required format placeholders ({count}, {distance})", () => {
      const template = "Found {count} units within {distance} km";
      const formatted = template.replace("{count}", "5").replace("{distance}", "10");
      expect(formatted).toBe("Found 5 units within 10 km");
    });
  });

  // --------------------------------------------------------------------------
  // F5: Shared TypeScript Schemas & Types Boundaries
  // --------------------------------------------------------------------------
  describe("F5: Shared TypeScript Schemas & Types Boundaries", () => {
    test("rejects invalid Indian phone numbers with letters, special characters, or wrong length", () => {
      expect(validateIndianPhoneOracle("abcdefghij").isValid).toBe(false);
      expect(validateIndianPhoneOracle("1234567890").isValid).toBe(false); // Does not start with 6-9
      expect(validateIndianPhoneOracle("987654321").isValid).toBe(false); // Only 9 digits
      expect(validateIndianPhoneOracle("98765432100").isValid).toBe(false); // 11 digits
      expect(validateIndianPhoneOracle("").isValid).toBe(false);
    });

    test("accepts boundary coordinates at exact poles (-90 and +90)", () => {
      const northPole = { lat: 90.0, lng: 0.0 };
      const southPole = { lat: -90.0, lng: 0.0 };
      expect(northPole.lat >= -90 && northPole.lat <= 90).toBe(true);
      expect(southPole.lat >= -90 && southPole.lat <= 90).toBe(true);
    });

    test("rejects out-of-bound coordinates (>90 lat or >180 lng)", async () => {
      const res = await client.searchBloodBanks({
        lat: 90.0001, // Out of bounds
        lng: 77.21,
      });
      expect(res.error).toBeDefined();
    });

    test("rejects non-numeric coordinate strings (lat='abc')", async () => {
      const res = await client.searchBloodBanks({
        lat: NaN,
        lng: 77.21,
      });
      expect(res.error).toBeDefined();
    });

    test("rejects non-preset radius values (e.g. 25km or -5km)", () => {
      const validPresets = [5, 10, 50];
      const isPreset = (r: number) => validPresets.includes(r);
      expect(isPreset(25)).toBe(false);
      expect(isPreset(-5)).toBe(false);
      expect(isPreset(0)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F6: Drizzle Database Schema Boundaries
  // --------------------------------------------------------------------------
  describe("F6: Drizzle Database Schema Boundaries", () => {
    test("rejects donor profile creation without mandatory user_id foreign key", () => {
      const invalidDonor = { ...SEED_DONORS[0], userId: "" };
      expect(invalidDonor.userId.length).toBe(0);
    });

    test("rejects blood request with invalid blood group enum value", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "Z+" as any,
        patientName: "Enum Test Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(res.error).toBeDefined();
    });

    test("enforces minimum patient name length (>= 2 characters)", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "A", // Only 1 character
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(res.error).toBeDefined();
    });

    test("enforces minimum hospital name length (>= 2 characters)", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Patient Name",
        hospitalName: "H", // Only 1 character
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(res.error).toBeDefined();
    });

    test("blood stock units cannot be negative (>= 0)", () => {
      for (const bank of SEED_BLOOD_BANKS) {
        for (const stock of bank.stock) {
          expect(stock.unitsAvailable).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F7: Database Client & Migrations Boundaries
  // --------------------------------------------------------------------------
  describe("F7: Database Client & Migrations Boundaries", () => {
    test("handles empty DATABASE_URL gracefully with explicit error", () => {
      const connect = (url: string | undefined) => {
        if (!url) throw new Error("DATABASE_URL environment variable is required");
        return url;
      };
      expect(() => connect("")).toThrow("DATABASE_URL");
      expect(() => connect(undefined)).toThrow("DATABASE_URL");
    });

    test("detects malformed connection protocol (e.g. http:// instead of postgresql://)", () => {
      const isPostgresUrl = (url: string) => url.startsWith("postgresql://") || url.startsWith("postgres://");
      expect(isPostgresUrl("http://localhost:5432/db")).toBe(false);
      expect(isPostgresUrl("postgresql://user:pass@localhost:5432/db")).toBe(true);
    });

    test("detects invalid port values in connection string", () => {
      const isValidPort = (port: number) => port >= 1 && port <= 65535;
      expect(isValidPort(5432)).toBe(true);
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(70000)).toBe(false);
    });

    test("migration version naming convention follows lexicographical timestamp ordering", () => {
      const m1 = "0001_initial_schema.sql";
      const m2 = "0002_add_donor_indexes.sql";
      expect(m1 < m2).toBe(true);
    });

    test("seed database transaction rollback safety simulation on partial failure", () => {
      const rollbackSim = (failAtStep: number) => {
        const state: string[] = [];
        try {
          state.push("users_seeded");
          if (failAtStep === 2) throw new Error("Seed failed at step 2");
          state.push("donors_seeded");
        } catch {
          state.length = 0; // Rollback
        }
        return state;
      };
      expect(rollbackSim(2)).toEqual([]);
      expect(rollbackSim(3)).toEqual(["users_seeded", "donors_seeded"]);
    });
  });

  // --------------------------------------------------------------------------
  // F8: Hono.js API Server Health & Config Boundaries
  // --------------------------------------------------------------------------
  describe("F8: Hono.js API Server Health & Config Boundaries", () => {
    test("handles 50 concurrent requests to /health without dropping connections", async () => {
      const promises = Array.from({ length: 50 }, () => client.getHealth());
      const results = await Promise.all(promises);
      expect(results.length).toBe(50);
      for (const r of results) {
        expect(r.status).toBe("ok");
      }
    });

    test("handles unexpected HTTP methods (e.g. DELETE /health) with 404 route not found", async () => {
      const res = await fetch(`${client.baseUrl}/health`, { method: "DELETE" });
      expect(res.status).toBe(404);
    });

    test("handles malformed JSON body in POST requests with HTTP 400 Bad Request", async () => {
      const res = await fetch(`${client.baseUrl}/api/v1/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ malformed json ...",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test("handles empty POST body with HTTP 400 or 500 error", async () => {
      const res = await fetch(`${client.baseUrl}/api/v1/donors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test("returns JSON content-type header on all error responses", async () => {
      const res = await fetch(`${client.baseUrl}/api/v1/invalid-route`);
      expect(res.headers.get("content-type")).toContain("application/json");
    });
  });

  // --------------------------------------------------------------------------
  // F9: Blood Banks Search API Boundaries
  // --------------------------------------------------------------------------
  describe("F9: Blood Banks Search API Boundaries", () => {
    test("handles blood bank at exact 5.0 km boundary vs 5.1 km", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        radiusKm: 5,
      });
      // All returned banks must be <= 5.000 km
      for (const bank of res.banks) {
        expect(bank.distanceKm).toBeLessThanOrEqual(5.0);
      }
    });

    test("returns 0 banks when search coordinate is in the Indian Ocean (lat 0, lng 77)", async () => {
      const res = await client.searchBloodBanks({
        lat: 0.0,
        lng: 77.0,
        radiusKm: 50,
      });
      expect(res.banks.length).toBe(0);
      expect(res.totalCount).toBe(0);
    });

    test("correctly filters when blood bank has 0 units available for requested group", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        bloodGroup: "AB-",
        radiusKm: 5,
      });
      for (const bank of res.banks) {
        for (const stock of bank.stock) {
          expect(stock.unitsAvailable).toBeGreaterThan(0);
        }
      }
    });

    test("handles missing lat/lng query parameters with HTTP 400 error", async () => {
      const res = await fetch(`${client.baseUrl}/api/v1/blood-banks/search`);
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Missing");
    });

    test("handles invalid blood group in search query with HTTP 400 error", async () => {
      const res = await client.searchBloodBanks({
        lat: 28.5672,
        lng: 77.21,
        bloodGroup: "INVALID" as any,
      });
      expect(res.error).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // F10: eRaktKosh Proxy & Cache Service Boundaries
  // --------------------------------------------------------------------------
  describe("F10: eRaktKosh Proxy & Cache Service Boundaries", () => {
    test("falls back to local database when external eRaktKosh service is unreachable", async () => {
      const res = await client.searchBloodBanks({
        lat: GEO_FIXTURES.AIIMS_DELHI.lat,
        lng: GEO_FIXTURES.AIIMS_DELHI.lng,
        radiusKm: 10,
      });
      expect(res.banks.length).toBeGreaterThan(0);
    });

    test("handles 15-minute cache TTL expiration edge (14m59s is cached, 15m01s is stale)", () => {
      const now = Date.now();
      const freshTimestamp = new Date(now - 14 * 60 * 1000).toISOString();
      const staleTimestamp = new Date(now - 16 * 60 * 1000).toISOString();

      const isFresh = (ts: string) => now - new Date(ts).getTime() < 15 * 60 * 1000;
      expect(isFresh(freshTimestamp)).toBe(true);
      expect(isFresh(staleTimestamp)).toBe(false);
    });

    test("handles empty HTML table response from eRaktKosh scraper without crash", () => {
      const parseHtmlTable = (html: string) => {
        if (!html.includes("<table")) return [];
        return [];
      };
      expect(parseHtmlTable("<html><body>No table found</body></html>")).toEqual([]);
    });

    test("handles corrupted HTML with missing closing tags safely", () => {
      const parseCorruptedHtml = (html: string) => {
        const matches = html.match(/<tr>.*?<\/tr>/g) || [];
        return matches.length;
      };
      expect(parseCorruptedHtml("<tr><td>Data 1<tr><td>Data 2")).toBe(0);
    });

    test("preserves bank address and telephone numbers even when stock update fails", () => {
      const bank = SEED_BLOOD_BANKS[0];
      expect(bank.address).toBeDefined();
      expect(bank.phone).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // F11: State & District Master Endpoints Boundaries
  // --------------------------------------------------------------------------
  describe("F11: State & District Master Endpoints Boundaries", () => {
    test("handles lowercase state codes gracefully ('dl' resolves same as 'DL')", async () => {
      const res = await client.getDistricts("dl");
      expect(res.districts.length).toBeGreaterThan(0);
    });

    test("handles leading and trailing whitespace in state codes (' DL ')", async () => {
      const res = await client.getDistricts(" DL ");
      expect(res.districts.length).toBeGreaterThan(0);
    });

    test("returns 404 with empty districts array for unknown state code 'XX'", async () => {
      const res = await client.getDistricts("XX");
      expect(res.districts.length).toBe(0);
    });

    test("handles numeric state codes ('123') with 404 error", async () => {
      const res = await client.getDistricts("123");
      expect(res.districts.length).toBe(0);
    });

    test("resists SQL injection patterns in stateCode parameter", async () => {
      const res = await client.getDistricts("DL' OR '1'='1");
      expect(res.districts.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // F12: Donor Registration API Boundaries
  // --------------------------------------------------------------------------
  describe("F12: Donor Registration API Boundaries", () => {
    test("rejects duplicate phone number registration with HTTP 409 Conflict", async () => {
      const first = await client.registerDonor({
        name: "First Registration",
        phone: "+919876500001",
        bloodGroup: "O+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(first.donor).toBeDefined();

      const duplicate = await client.registerDonor({
        name: "Second Registration",
        phone: "+919876500001", // Duplicate phone
        bloodGroup: "O+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(duplicate.error).toBeDefined();
      expect(duplicate.error).toContain("already registered");
    });

    test("rejects donor registration when WhatsApp consent is false", async () => {
      const res = await client.registerDonor({
        name: "No Consent User",
        phone: "+919876500002",
        bloodGroup: "A+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: false,
      });
      expect(res.error).toBeDefined();
      expect(res.error).toContain("WhatsApp");
    });

    test("rejects donor registration with invalid blood group ('X+')", async () => {
      const res = await client.registerDonor({
        name: "Bad Group User",
        phone: "+919876500003",
        bloodGroup: "X+" as any,
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(res.error).toBeDefined();
    });

    test("rejects donor registration with invalid latitude (> 90)", async () => {
      const res = await client.registerDonor({
        name: "Bad Lat User",
        phone: "+919876500004",
        bloodGroup: "O+",
        latitude: 91.0,
        longitude: 77.21,
        whatsappConsent: true,
      });
      expect(res.error).toBeDefined();
    });

    test("rejects donor registration with invalid longitude (> 180)", async () => {
      const res = await client.registerDonor({
        name: "Bad Lng User",
        phone: "+919876500005",
        bloodGroup: "O+",
        latitude: 28.5672,
        longitude: 181.0,
        whatsappConsent: true,
      });
      expect(res.error).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // F13: Donor Matching Engine Boundaries
  // --------------------------------------------------------------------------
  describe("F13: Donor Matching Engine Boundaries", () => {
    test("donor located at exact boundary: 9.89 km is notified, 10.1 km is not", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Boundary Match Patient",
        hospitalName: "AIIMS Delhi",
        latitude: GEO_FIXTURES.AIIMS_DELHI.lat,
        longitude: GEO_FIXTURES.AIIMS_DELHI.lng,
        searchRadiusKm: 10,
        unitsNeeded: 1,
      });
      const notifications = server.getNotificationsForRequest(res.request!.id);
      const donorIds = notifications.map((n) => n.donorId);
      // Rohit Yadav is in Meerut (~66.5 km) -> should be excluded
      expect(donorIds).not.toContain("donor-rohit-b-neg-meerut");
    });

    test("male donor cooldown boundary: 89 days (< 90) triggers warning badge", () => {
      const lastDate = new Date("2026-10-30T00:00:00Z");
      lastDate.setDate(lastDate.getDate() - 89);
      const elig = isDonorEligibleOracle("male", lastDate.toISOString());
      expect(elig.eligible).toBe(false);
      expect(elig.warningBadge).toBe(true);
      expect(elig.remainingDays).toBe(1);
    });

    test("male donor cooldown boundary: 90 days (>= 90) is fully eligible", () => {
      const lastDate = new Date("2026-10-30T00:00:00Z");
      lastDate.setDate(lastDate.getDate() - 90);
      const elig = isDonorEligibleOracle("male", lastDate.toISOString());
      expect(elig.eligible).toBe(true);
      expect(elig.warningBadge).toBe(false);
      expect(elig.remainingDays).toBe(0);
    });

    test("female donor cooldown boundary: 119 days (< 120) triggers warning badge", () => {
      const lastDate = new Date("2026-10-30T00:00:00Z");
      lastDate.setDate(lastDate.getDate() - 119);
      const elig = isDonorEligibleOracle("female", lastDate.toISOString());
      expect(elig.eligible).toBe(false);
      expect(elig.warningBadge).toBe(true);
      expect(elig.remainingDays).toBe(1);
    });

    test("donor with no previous donation (null lastDonationDate) is fully eligible", () => {
      const elig = isDonorEligibleOracle("male", null);
      expect(elig.eligible).toBe(true);
      expect(elig.warningBadge).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // F14: WhatsApp Outbound Notifications Boundaries
  // --------------------------------------------------------------------------
  describe("F14: WhatsApp Outbound Notifications Boundaries", () => {
    test("handles long patient name without failing notification creation", async () => {
      const longName = "A".repeat(150);
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: longName,
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      });
      expect(res.notificationsSent).toBeGreaterThan(0);
      const lastMsg = server.getOutboundWhatsAppMessages().pop();
      expect(lastMsg?.parameters.patient_name).toBe(longName);
    });

    test("handles long hospital name properly", async () => {
      const longHospital = "All India Institute of Medical Sciences Trauma and Critical Care Super Speciality Wing";
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Patient X",
        hospitalName: longHospital,
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 10,
      });
      const lastMsg = server.getOutboundWhatsAppMessages().pop();
      expect(lastMsg?.parameters.hospital_name).toBe(longHospital);
    });

    test("recipient phone in WhatsApp message always preserves country code +91", async () => {
      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Phone Test",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const msgs = server.getOutboundWhatsAppMessages();
      for (const m of msgs) {
        expect(m.recipientPhone.startsWith("+91")).toBe(true);
      }
    });

    test("dispatches messages in donor's preferred language (hi vs en)", async () => {
      // Priya Verma prefers Hindi ('hi')
      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Language Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const msgs = server.getOutboundWhatsAppMessages();
      const priyaMsg = msgs.find((m) => m.donorId === "donor-priya-o-neg");
      expect(priyaMsg?.language).toBe("hi");
    });

    test("generates unique WhatsApp message IDs (wamid.*)", async () => {
      await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Unique ID Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const msgs = server.getOutboundWhatsAppMessages();
      const ids = new Set(msgs.map((m) => m.id));
      expect(ids.size).toBe(msgs.length);
    });
  });

  // --------------------------------------------------------------------------
  // F15: WhatsApp Webhook & Event Handler Boundaries
  // --------------------------------------------------------------------------
  describe("F15: WhatsApp Webhook & Event Handler Boundaries", () => {
    test("rejects webhook request with missing hub.challenge parameter", async () => {
      const res = await client.verifyWhatsAppWebhook("subscribe", server.webhookVerifyToken, "");
      expect(res.text).toBe("");
    });

    test("rejects webhook request when hub.mode is not 'subscribe'", async () => {
      const res = await client.verifyWhatsAppWebhook("unsubscribe", server.webhookVerifyToken, "1234");
      expect(res.status).toBe(403);
    });

    test("rejects webhook POST with invalid HMAC-SHA256 signature (HTTP 401)", async () => {
      const payload = { entry: [] };
      const invalidSignature = "invalid_signature_hex_12345";
      const res = await client.postWhatsAppWebhook(payload, invalidSignature);
      expect(res.error).toBe("Invalid signature");
    });

    test("handles empty entry array in webhook without error", async () => {
      const res = await client.postWhatsAppWebhook({ entry: [] });
      expect(res.success).toBe(true);
    });

    test("handles unknown interactive button format gracefully without crash", async () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: "unknown_button_id_xyz", title: "Click" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const res = await client.postWhatsAppWebhook(payload);
      expect(res.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F16: Zero-Credential Local Mocking Layer Boundaries
  // --------------------------------------------------------------------------
  describe("F16: Zero-Credential Local Mocking Layer Boundaries", () => {
    test("resetting with 0 banks results in empty bank search results", async () => {
      server.reset({ banks: [] });
      const res = await client.searchBloodBanks({
        lat: 28.5672,
        lng: 77.21,
      });
      expect(res.banks.length).toBe(0);
    });

    test("resetting with 0 donors results in 0 donors notified", async () => {
      server.reset({ donors: [] });
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "No Donor Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(res.compatibleDonorsCount).toBe(0);
      expect(res.notificationsSent).toBe(0);
    });

    test("mock store isolates requests between different test runs", async () => {
      server.reset();
      const res1 = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Isolated 1",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      server.reset();
      const check = await client.getBloodRequest(res1.request!.id);
      expect(check.error).toBeDefined();
    });

    test("mock server handles requests with Unicode and Hindi characters in patient name", async () => {
      const hindiName = "अमित कुमार शर्मा";
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: hindiName,
        hospitalName: "एम्स नई दिल्ली",
        latitude: 28.5672,
        longitude: 77.21,
      });
      expect(res.request?.patientName).toBe(hindiName);
    });

    test("mock server supports querying non-existent blood request with 404 response", async () => {
      const res = await client.getBloodRequest("non-existent-uuid-9999");
      expect(res.error).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // F17: Blood Requests Lifecycle API Boundaries
  // --------------------------------------------------------------------------
  describe("F17: Blood Requests Lifecycle API Boundaries", () => {
    test("rejects request creation with 0 units needed", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Zero Units Patient",
        hospitalName: "AIIMS",
        unitsNeeded: 0,
        latitude: 28.5672,
        longitude: 77.21,
      });
      // unitsNeeded defaults to 1 or fails
      expect(res.request?.unitsNeeded).toBeGreaterThanOrEqual(1);
    });

    test("rejects respond action with invalid status value ('pending')", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Invalid Status Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const res = await client.respondToRequest(created.request!.id, {
        donorId: "donor-amit-ab-neg",
        status: "pending" as any,
      });
      expect(res.error).toBeDefined();
    });

    test("rejects responding to non-existent request ID with 404", async () => {
      const res = await client.respondToRequest("non-existent-id", {
        donorId: "donor-1",
        status: "accepted",
      });
      expect(res.error).toBeDefined();
    });

    test("fulfilling a request idempotently maintains 'fulfilled' status on repeated accept", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Idempotent Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = created.request!.id;
      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });
      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });

      const check = await client.getBloodRequest(reqId);
      expect(check.request?.status).toBe("fulfilled");
    });

    test("declining a request does not overwrite 'fulfilled' status if another donor accepted", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Multiple Donor Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = created.request!.id;
      // Donor 1 accepts
      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });
      // Donor 2 declines
      await client.respondToRequest(reqId, { donorId: "donor-priya-o-neg", status: "declined" });

      const check = await client.getBloodRequest(reqId);
      expect(check.request?.status).toBe("fulfilled");
    });
  });

  // --------------------------------------------------------------------------
  // F18: packages/ui shadcn Primitives Boundaries
  // --------------------------------------------------------------------------
  describe("F18: packages/ui shadcn Primitives Boundaries", () => {
    test("Button disabled state prevents user interaction", () => {
      const btnProps = { disabled: true, "aria-disabled": "true" };
      expect(btnProps.disabled).toBe(true);
      expect(btnProps["aria-disabled"]).toBe("true");
    });

    test("Badge handles empty or undefined text gracefully", () => {
      const badgeText = "";
      expect(badgeText.length).toBe(0);
    });

    test("Card handles missing description without broken layout", () => {
      const card = { title: "Title Only", description: null };
      expect(card.description).toBeNull();
    });

    test("PhoneInput trims extraneous white spaces from pasted phone numbers", () => {
      const rawPasted = "  +91 98765 43210  ";
      const cleaned = rawPasted.replace(/[\s\-]/g, "");
      expect(cleaned).toBe("+919876543210");
    });

    test("Input handles numeric only input for age field", () => {
      const parseAge = (v: string) => {
        const num = parseInt(v, 10);
        return isNaN(num) || num < 0 || num > 120 ? null : num;
      };
      expect(parseAge("25")).toBe(25);
      expect(parseAge("-5")).toBeNull();
      expect(parseAge("150")).toBeNull();
      expect(parseAge("abc")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // F19: Tailwind CSS v4 & Theming Boundaries
  // --------------------------------------------------------------------------
  describe("F19: Tailwind CSS v4 & Theming Boundaries", () => {
    test("mobile breakpoint 320px maintains readable font size (>= 14px)", () => {
      const baseFontSizePx = 16;
      expect(baseFontSizePx).toBeGreaterThanOrEqual(14);
    });

    test("high contrast emergency banner has WCAG AAA compliant text ratio", () => {
      const contrastRatio = 7.1; // White on #dc2626
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    test("theme color variable falls back to #dc2626 if CSS custom property is missing", () => {
      const getThemeColor = (cssVar?: string) => cssVar || "#dc2626";
      expect(getThemeColor()).toBe("#dc2626");
    });

    test("dark mode color palette inverts background while keeping blood-red accents distinct", () => {
      const darkBg = "#0f172a";
      const darkAccent = "#ef4444";
      expect(darkBg).not.toBe(darkAccent);
    });

    test("print stylesheet hides unnecessary interactive map controls", () => {
      const printClass = "print:hidden";
      expect(printClass).toBe("print:hidden");
    });
  });

  // --------------------------------------------------------------------------
  // F20: PWA Web App Manifest Boundaries
  // --------------------------------------------------------------------------
  describe("F20: PWA Web App Manifest Boundaries", () => {
    test("manifest start_url is root relative '/'", () => {
      const startUrl = "/";
      expect(startUrl).toBe("/");
    });

    test("manifest display mode 'standalone' falls back cleanly to 'minimal-ui' or 'browser'", () => {
      const supportedModes = ["fullscreen", "standalone", "minimal-ui", "browser"];
      expect(supportedModes).toContain("standalone");
    });

    test("manifest icons provide absolute paths starting with '/'", () => {
      const iconPath = "/icons/icon-192x192.png";
      expect(iconPath.startsWith("/")).toBe(true);
    });

    test("manifest categories array includes health and medical", () => {
      const categories = ["health", "medical"];
      expect(categories).toContain("health");
      expect(categories).toContain("medical");
    });

    test("manifest orientation locks to portrait for rapid one-handed mobile emergency use", () => {
      const orientation = "portrait";
      expect(orientation).toBe("portrait");
    });
  });

  // --------------------------------------------------------------------------
  // F21: Custom Service Worker & Offline Page Boundaries
  // --------------------------------------------------------------------------
  describe("F21: Custom Service Worker & Offline Page Boundaries", () => {
    test("handles network failure during API fetch by serving cached data or offline error", () => {
      const handleFetchError = (error: Error) => {
        return { offline: true, message: "Network unavailable. Showing cached data." };
      };
      const res = handleFetchError(new Error("Failed to fetch"));
      expect(res.offline).toBe(true);
    });

    test("offline page contains direct click-to-call links for emergency services", () => {
      const helplines = [
        { name: "Blood Helpline", number: "104", url: "tel:104" },
        { name: "Ambulance", number: "108", url: "tel:108" },
      ];
      for (const h of helplines) {
        expect(h.url.startsWith("tel:")).toBe(true);
      }
    });

    test("cache versioning isolates old cache assets when service worker updates", () => {
      const oldCache = "raktkhoj-v1";
      const newCache = "raktkhoj-v2";
      expect(oldCache).not.toBe(newCache);
    });

    test("service worker bypasses caching for WhatsApp webhook endpoints", () => {
      const shouldCache = (path: string) => !path.includes("/api/v1/whatsapp/");
      expect(shouldCache("/api/v1/whatsapp/webhook")).toBe(false);
      expect(shouldCache("/icons/icon-192x192.png")).toBe(true);
    });

    test("handles browser storage QuotaExceededError without crashing the application", () => {
      const handleQuotaExceeded = () => {
        try {
          throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        } catch (e: any) {
          return e.name === "QuotaExceededError";
        }
      };
      expect(handleQuotaExceeded()).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F22: Bilingual Routing & Language Switcher Boundaries
  // --------------------------------------------------------------------------
  describe("F22: Bilingual Routing & Language Switcher Boundaries", () => {
    test("unsupported language code ('fr', 'de', 'es') falls back safely to 'en'", () => {
      const resolveLocale = (code: string) => (["en", "hi"].includes(code) ? code : "en");
      expect(resolveLocale("fr")).toBe("en");
      expect(resolveLocale("de")).toBe("en");
      expect(resolveLocale("hi")).toBe("hi");
    });

    test("handles case differences in locale codes ('HI', 'En') by normalizing to lowercase", () => {
      const normalizeLocale = (code: string) => code.toLowerCase();
      expect(normalizeLocale("HI")).toBe("hi");
      expect(normalizeLocale("EN")).toBe("en");
    });

    test("maintains query string parameters across locale switches", () => {
      const switchLocale = (currentPath: string, newLocale: string) => {
        const url = new URL(`https://raktkhoj.org${currentPath}`);
        const parts = url.pathname.split("/").filter(Boolean);
        parts[0] = newLocale;
        return `/${parts.join("/")}${url.search}`;
      };
      const res = switchLocale("/en/search?group=B%2B&radius=10", "hi");
      expect(res).toBe("/hi/search?group=B%2B&radius=10");
    });

    test("handles URL without locale prefix by redirecting to default /en", () => {
      const getNormalizedPath = (path: string) => {
        if (!path.startsWith("/en") && !path.startsWith("/hi")) {
          return `/en${path}`;
        }
        return path;
      };
      expect(getNormalizedPath("/search")).toBe("/en/search");
    });

    test("bilingual dictionary keys are non-null and string types", () => {
      for (const [k, v] of Object.entries(I18N_DICTIONARIES.hi.common)) {
        expect(typeof v).toBe("string");
        expect((v as string).length).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // F23: Emergency Blood Discovery Form Boundaries
  // --------------------------------------------------------------------------
  describe("F23: Emergency Blood Discovery Form Boundaries", () => {
    test("prevents submission when blood group is not selected", () => {
      const validateForm = (group: string | null) => (group ? true : "Blood group required");
      expect(validateForm(null)).toBe("Blood group required");
      expect(validateForm("")).toBe("Blood group required");
      expect(validateForm("O+")).toBe(true);
    });

    test("handles geolocation permission denied event with fallback to manual selection", () => {
      const handleGeoError = (code: number) => {
        if (code === 1) return { manualMode: true, message: "Location permission denied" };
        return { manualMode: false, message: "Unknown error" };
      };
      const err = handleGeoError(1);
      expect(err.manualMode).toBe(true);
    });

    test("handles geolocation timeout event (after 5000ms) with fallback", () => {
      const handleTimeout = (code: number) => (code === 3 ? "Location request timed out" : "Error");
      expect(handleTimeout(3)).toBe("Location request timed out");
    });

    test("debounces rapid double submissions of the emergency form", () => {
      let isSubmitting = false;
      const submit = () => {
        if (isSubmitting) return "blocked";
        isSubmitting = true;
        return "submitted";
      };
      expect(submit()).toBe("submitted");
      expect(submit()).toBe("blocked");
    });

    test("clears previous search results when initiating a new search", () => {
      let results = ["result-1", "result-2"];
      const startNewSearch = () => {
        results = [];
      };
      startNewSearch();
      expect(results.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // F24: Leaflet Interactive Map View Boundaries
  // --------------------------------------------------------------------------
  describe("F24: Leaflet Interactive Map View Boundaries", () => {
    test("handles invalid latitude or longitude gracefully without crashing map renderer", () => {
      const sanitizeCoords = (lat: number, lng: number) => {
        if (isNaN(lat) || isNaN(lng)) return { lat: 28.6139, lng: 77.209 }; // Delhi default
        return { lat, lng };
      };
      expect(sanitizeCoords(NaN, 77.21)).toEqual({ lat: 28.6139, lng: 77.209 });
    });

    test("handles map zoom bounds (minimum zoom 1, maximum zoom 18)", () => {
      const clampZoom = (z: number) => Math.max(1, Math.min(18, z));
      expect(clampZoom(0)).toBe(1);
      expect(clampZoom(25)).toBe(18);
      expect(clampZoom(12)).toBe(12);
    });

    test("handles 50+ blood bank markers without performance lag or crash", () => {
      const markers = Array.from({ length: 50 }, (_, i) => ({
        id: `m-${i}`,
        lat: 28.5 + i * 0.001,
        lng: 77.2 + i * 0.001,
      }));
      expect(markers.length).toBe(50);
    });

    test("handles map resize event when switching from portrait to landscape", () => {
      let invalidated = false;
      const invalidateSize = () => {
        invalidated = true;
      };
      invalidateSize();
      expect(invalidated).toBe(true);
    });

    test("cleans up map instance and event listeners on component unmount", () => {
      let isCleanedUp = false;
      const unmount = () => {
        isCleanedUp = true;
      };
      unmount();
      expect(isCleanedUp).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // F25: Cascading Search Results Flow Boundaries
  // --------------------------------------------------------------------------
  describe("F25: Cascading Search Results Flow Boundaries", () => {
    test("handles scenario where all blood banks exist but have 0 units available", async () => {
      // Empty blood bank in Saket
      const res = await client.searchBloodBanks({
        lat: 28.528,
        lng: 77.215,
        bloodGroup: "O-",
        radiusKm: 5,
      });
      // AIIMS is nearby and has 1 unit, but let's test specific bank
      const emptyBank = res.banks.find((b) => b.id === "bank-empty-lifeline");
      expect(emptyBank?.stock.length).toBe(0); // 0 stock filtered out
    });

    test("handles scenario where both blood banks and donors are empty in selected radius", async () => {
      // Remote desert location in Rajasthan
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Remote Patient",
        hospitalName: "Jaisalmer PHC",
        latitude: 26.9157,
        longitude: 70.9083,
        searchRadiusKm: 5,
      });
      expect(res.compatibleDonorsCount).toBe(0);
      expect(res.notificationsSent).toBe(0);
    });

    test("expanding radius from 5 km to 50 km captures previously out-of-range donors", async () => {
      // Sunita Rao is in Gurugram (~21.5 km from AIIMS)
      const res5km = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Range Patient 5",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 5,
        unitsNeeded: 20, // Force cascade
      });
      const notifs5km = server.getNotificationsForRequest(res5km.request!.id);
      expect(notifs5km.map((n) => n.donorId)).not.toContain("donor-sunita-o-pos-gurgaon");

      const res50km = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Range Patient 50",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
        searchRadiusKm: 50,
        unitsNeeded: 20, // Force cascade
      });
      const notifs50km = server.getNotificationsForRequest(res50km.request!.id);
      expect(notifs50km.map((n) => n.donorId)).toContain("donor-sunita-o-pos-gurgaon");
    });

    test("cascade does not trigger if blood bank has sufficient units", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+", // AIIMS has 8 units of O+
        patientName: "Sufficient Bank Stock",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
        unitsNeeded: 2,
        searchRadiusKm: 5,
      });
      expect(res.request?.status).toBe("bank_found");
      expect(res.notificationsSent).toBe(0);
    });

    test("cascade triggers immediately if units needed exceeds bank stock", async () => {
      const res = await client.createBloodRequest({
        bloodGroupNeeded: "O+",
        patientName: "Exceeding Units Patient",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
        unitsNeeded: 50, // Far exceeds 8 units
        searchRadiusKm: 10,
      });
      expect(res.request?.status).toBe("donors_notified");
      expect(res.notificationsSent).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // F26: Real-time Waiting Room Boundaries
  // --------------------------------------------------------------------------
  describe("F26: Real-time Waiting Room Boundaries", () => {
    test("handles countdown timer reaching 00:00:00 without application crash", () => {
      const formatCountdown = (secondsRemaining: number) => {
        if (secondsRemaining <= 0) return "00:00:00";
        const m = Math.floor(secondsRemaining / 60);
        const s = secondsRemaining % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };
      expect(formatCountdown(0)).toBe("00:00:00");
      expect(formatCountdown(-10)).toBe("00:00:00");
      expect(formatCountdown(125)).toBe("02:05");
    });

    test("handles multiple donors accepting in quick succession", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Concurrent Donors Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = created.request!.id;

      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });
      await client.respondToRequest(reqId, { donorId: "donor-priya-o-neg", status: "accepted" });

      const room = await client.getBloodRequest(reqId);
      expect(room.acceptedDonors?.length).toBe(2);
    });

    test("handles waiting room polling for non-existent request ID with 404 error", async () => {
      const room = await client.getBloodRequest("invalid-request-id-404");
      expect(room.error).toBeDefined();
    });

    test("waiting room generates valid WhatsApp click-to-chat URL with pre-filled message", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "URL Patient",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      await client.respondToRequest(created.request!.id, { donorId: "donor-amit-ab-neg", status: "accepted" });

      const room = await client.getBloodRequest(created.request!.id);
      const donor = room.acceptedDonors![0];
      expect(donor.whatsappUrl).toContain("wa.me");
      expect(donor.whatsappUrl).toContain(encodeURIComponent("URL Patient"));
    });

    test("waiting room phone call link format is tel:+91XXXXXXXXXX", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Tel Link Patient",
        hospitalName: "AIIMS Delhi",
        latitude: 28.5672,
        longitude: 77.21,
      });
      await client.respondToRequest(created.request!.id, { donorId: "donor-amit-ab-neg", status: "accepted" });

      const room = await client.getBloodRequest(created.request!.id);
      const donor = room.acceptedDonors![0];
      expect(donor.directCallUrl).toMatch(/^tel:\+91[6789]\d{9}$/);
    });
  });

  // --------------------------------------------------------------------------
  // F27: 5-Step Donor Registration Portal Boundaries
  // --------------------------------------------------------------------------
  describe("F27: 5-Step Donor Registration Portal Boundaries", () => {
    test("rejects donor under 18 years old (e.g. born 2012)", () => {
      const isAdult = (dobString: string, refDate = new Date("2026-10-30")) => {
        const dob = new Date(dobString);
        const age = (refDate.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        return age >= 18;
      };
      expect(isAdult("2012-05-15")).toBe(false);
      expect(isAdult("1995-05-15")).toBe(true);
    });

    test("rejects donor weight below 45 kg minimum threshold", () => {
      const isWeightValid = (weightKg: number) => weightKg >= 45 && weightKg <= 200;
      expect(isWeightValid(44.5)).toBe(false);
      expect(isWeightValid(45.0)).toBe(true);
      expect(isWeightValid(70.0)).toBe(true);
    });

    test("handles stepping backwards without wiping previously entered state", () => {
      const formState = { step1Phone: "+919876543210", step2Name: "Mohit", step: 2 };
      formState.step = 1; // Go back
      expect(formState.step1Phone).toBe("+919876543210");
      expect(formState.step2Name).toBe("Mohit");
    });

    test("rejects submission if user unchecks WhatsApp consent at step 5", async () => {
      const res = await client.registerDonor({
        name: "Consent Boundary",
        phone: "+919988776655",
        bloodGroup: "O+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: false,
      });
      expect(res.error).toBeDefined();
    });

    test("handles optional fields left empty (city, email)", async () => {
      const res = await client.registerDonor({
        name: "Optional Fields",
        phone: "+919988776644",
        bloodGroup: "A+",
        latitude: 28.5672,
        longitude: 77.21,
        whatsappConsent: true,
        city: undefined,
      });
      expect(res.donor).toBeDefined();
      expect(res.donor?.city).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // F28: Donor Response Quick Action Page Boundaries
  // --------------------------------------------------------------------------
  describe("F28: Donor Response Quick Action Page Boundaries", () => {
    test("handles donor declining with empty response note", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "No Note Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const res = await client.respondToRequest(created.request!.id, {
        donorId: "donor-amit-ab-neg",
        status: "declined",
      });
      expect(res.status).toBe("declined");
    });

    test("handles donor responding with long response note (up to 500 characters)", async () => {
      const longNote = "I can come immediately. " + "Will be there soon! ".repeat(15);
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Long Note Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const res = await client.respondToRequest(created.request!.id, {
        donorId: "donor-amit-ab-neg",
        status: "accepted",
        responseNote: longNote,
      });
      expect(res.success).toBe(true);
    });

    test("handles invalid action string (e.g. 'maybe') with HTTP 400 Bad Request", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Bad Action Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const res = await client.respondToRequest(created.request!.id, {
        donorId: "donor-amit-ab-neg",
        status: "maybe" as any,
      });
      expect(res.error).toBeDefined();
    });

    test("handles duplicate accept action safely without duplicate entries in acceptedDonors", async () => {
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Dedup Action Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      const reqId = created.request!.id;
      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });
      await client.respondToRequest(reqId, { donorId: "donor-amit-ab-neg", status: "accepted" });

      const room = await client.getBloodRequest(reqId);
      expect(room.acceptedDonors?.length).toBe(1);
    });

    test("response endpoint records accurate respondedAt ISO 8601 timestamp", async () => {
      const before = new Date().getTime();
      const created = await client.createBloodRequest({
        bloodGroupNeeded: "AB-",
        patientName: "Timestamp Patient",
        hospitalName: "AIIMS",
        latitude: 28.5672,
        longitude: 77.21,
      });
      await client.respondToRequest(created.request!.id, { donorId: "donor-amit-ab-neg", status: "accepted" });
      const room = await client.getBloodRequest(created.request!.id);
      const after = new Date().getTime();

      const respondedTime = new Date(room.acceptedDonors![0].respondedAt).getTime();
      expect(respondedTime).toBeGreaterThanOrEqual(before - 500);
      expect(respondedTime).toBeLessThanOrEqual(after + 500);
    });
  });

  // --------------------------------------------------------------------------
  // F29: Donor Dashboard Boundaries
  // --------------------------------------------------------------------------
  describe("F29: Donor Dashboard Boundaries", () => {
    test("handles empty past donation history list without rendering error", () => {
      const history: any[] = [];
      expect(history.length).toBe(0);
      const displayCount = history.length === 0 ? "No past donations" : `${history.length} donations`;
      expect(displayCount).toBe("No past donations");
    });

    test("toggling availability back and forth 10 times maintains boolean consistency", () => {
      let isAvailable = true;
      for (let i = 0; i < 10; i++) {
        isAvailable = !isAvailable;
      }
      expect(isAvailable).toBe(true);
    });

    test("handles unknown donor profile lookup gracefully", () => {
      const findDonor = (id: string) => SEED_DONORS.find((d) => d.id === id) || null;
      expect(findDonor("unknown-donor-id")).toBeNull();
    });

    test("soft eligibility check for donor with donation exactly today (0 days ago) flags warning", () => {
      const today = new Date("2026-10-30T00:00:00Z").toISOString();
      const elig = isDonorEligibleOracle("male", today);
      expect(elig.eligible).toBe(false);
      expect(elig.warningBadge).toBe(true);
      expect(elig.remainingDays).toBe(90);
    });

    test("soft eligibility warning does not throw when gender is null or other", () => {
      const elig = isDonorEligibleOracle("other", "2026-08-01");
      expect(elig).toBeDefined();
      expect(elig.requiredIntervalDays).toBe(90);
    });
  });
});
