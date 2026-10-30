/**
 * RaktKhoj (रक्तखोज) E2E Test Harness
 * 
 * Provides:
 * 1. Pure biological, mathematical, and schema validation oracles
 * 2. Realistic test fixtures (Geo coordinates in India, Donors, Blood Banks, Stock, i18n, Webhooks)
 * 3. In-memory Mock RaktKhoj Server running via Bun.serve (zero third-party dependencies)
 * 4. Strongly typed RaktKhojClient for opaque-box E2E testing
 */

import { createHmac } from "node:crypto";

// ============================================================================
// 1. CORE TYPES & CONTRACTS (derived from PROJECT.md & implementation plan)
// ============================================================================

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type ComponentType = "whole_blood" | "prbc" | "ffp" | "platelets";
export type EmergencyType = "surgery" | "accident" | "thalassemia" | "delivery" | "dengue" | "other";
export type RadiusPreset = 5 | 10 | 50;
export type RequestStatus = "searching" | "bank_found" | "donors_notified" | "fulfilled" | "expired" | "cancelled";
export type NotificationStatus = "pending" | "sent" | "delivered" | "read" | "accepted" | "declined" | "expired" | "failed";
export type FulfillmentSource = "blood_bank" | "donor";
export type BloodBankSource = "eraktkosh" | "manual" | "partner";
export type Gender = "male" | "female" | "other";
export type SupportedLanguage = "en" | "hi";

export interface StockItem {
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  unitsAvailable: number;
  earliestExpiry?: string | null;
  lastUpdated?: string | null;
}

export interface BloodBankCardData {
  id: string;
  name: string;
  licenseNumber: string | null;
  state: string;
  district: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email?: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number;
  stock: StockItem[];
  isVerified: boolean;
  source: BloodBankSource;
  lastStockUpdate: string | null;
}

export interface DonorProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  city?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  weightKg?: number | null;
  lastDonationDate?: string | null;
  isAvailable: boolean;
  searchRadiusKm: number;
  whatsappConsent: boolean;
  preferredLanguage?: SupportedLanguage;
  createdAt: string;
  distanceKm?: number;
  eligibleBadge?: {
    eligible: boolean;
    reason?: string;
  };
}

export interface BloodRequest {
  id: string;
  requesterId?: string | null;
  requesterPhone?: string | null;
  requesterName?: string | null;
  bloodGroupNeeded: BloodGroup;
  componentType: ComponentType;
  unitsNeeded: number;
  patientName: string;
  patientAge?: number | null;
  emergencyType?: EmergencyType | null;
  hospitalName: string;
  latitude: number;
  longitude: number;
  state?: string | null;
  district?: string | null;
  searchRadiusKm: RadiusPreset;
  status: RequestStatus;
  fulfillmentSource?: FulfillmentSource | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface DonorNotificationSummary {
  id: string;
  requestId: string;
  donorId: string;
  donorName?: string;
  donorBloodGroup?: BloodGroup;
  donorPhoneMasked?: string;
  status: NotificationStatus;
  sentAt: string | null;
  respondedAt: string | null;
  responseNote?: string | null;
}

export interface AcceptedDonorContact {
  donorId: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  respondedAt: string;
  directCallUrl: string;
  whatsappUrl: string;
}

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

// ============================================================================
// 2. DOMAIN LOGIC REFERENCE ORACLES
// ============================================================================

/**
 * RBC Compatibility Matrix Oracle
 * Standard medical blood transfusion compatibility for red blood cells.
 */
export const RBC_COMPATIBILITY_ORACLE: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
};

export function getCompatibleDonorGroupsOracle(recipientGroup: string): BloodGroup[] {
  return (RBC_COMPATIBILITY_ORACLE as Record<string, BloodGroup[]>)[recipientGroup] ?? [];
}

export function isDonorCompatibleOracle(donorGroup: string, recipientGroup: string): boolean {
  const compatible = getCompatibleDonorGroupsOracle(recipientGroup);
  return compatible.includes(donorGroup as BloodGroup);
}

/**
 * Haversine Distance Formula Oracle
 * Calculates great-circle distance between two points in kilometers.
 * Earth mean radius = 6371 km.
 */
export function haversineDistanceOracle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 1000) / 1000; // rounded to meters
}

/**
 * Bounding Box Calculation Oracle
 */
export function getBoundingBoxOracle(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const R = 6371;
  const latDelta = (radiusKm / R) * (180 / Math.PI);
  const lonDelta =
    (radiusKm / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Soft Donor Eligibility Oracle
 * - Male cooldown: 90 days
 * - Female cooldown: 120 days
 * - Other: 90 days
 * - Weight: >= 45 kg
 */
export function isDonorEligibleOracle(
  gender: Gender | string | null | undefined,
  lastDonationDate: string | null | undefined,
  referenceDate: Date = new Date("2026-10-30T00:00:00Z")
): {
  eligible: boolean;
  daysSinceLastDonation: number | null;
  requiredIntervalDays: number;
  remainingDays: number;
  warningBadge: boolean;
  reason?: string;
} {
  const requiredDays = gender === "female" ? 120 : 90;

  if (!lastDonationDate) {
    return {
      eligible: true,
      daysSinceLastDonation: null,
      requiredIntervalDays: requiredDays,
      remainingDays: 0,
      warningBadge: false,
    };
  }

  const lastDate = new Date(lastDonationDate);
  const diffTime = referenceDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < requiredDays) {
    const remaining = requiredDays - diffDays;
    return {
      eligible: false,
      daysSinceLastDonation: diffDays,
      requiredIntervalDays: requiredDays,
      remainingDays: remaining,
      warningBadge: true,
      reason: `Recent donation ${diffDays} days ago (< ${requiredDays} days required for ${gender ?? "donor"})`,
    };
  }

  return {
    eligible: true,
    daysSinceLastDonation: diffDays,
    requiredIntervalDays: requiredDays,
    remainingDays: 0,
    warningBadge: false,
  };
}

/**
 * Indian Mobile Phone Validation Oracle
 * Validates Indian 10-digit mobile numbers starting with 6, 7, 8, or 9.
 * Accepts prefixes +91, 91, or none.
 */
export function validateIndianPhoneOracle(phone: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  if (!phone || typeof phone !== "string") {
    return { isValid: false, normalized: "", error: "Phone number is required" };
  }

  const trimmed = phone.trim();
  const cleaned = trimmed.replace(/[\s\-]/g, "");

  // Match: +91XXXXXXXXXX, 91XXXXXXXXXX, or XXXXXXXXXX
  const regex = /^(?:\+91|91)?([6789]\d{9})$/;
  const match = cleaned.match(regex);

  if (!match) {
    return {
      isValid: false,
      normalized: "",
      error: "Invalid Indian mobile number (+91 followed by 10 digits starting with 6-9)",
    };
  }

  const tenDigits = match[1];
  return {
    isValid: true,
    normalized: `+91${tenDigits}`,
  };
}

/**
 * HMAC-SHA256 signature verification for WhatsApp Webhooks
 */
export function computeHmacSha256(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const parts = signatureHeader.split("=");
  const signature = parts.length === 2 ? parts[1] : signatureHeader;
  const expected = computeHmacSha256(rawBody, appSecret);
  return signature === expected;
}

// ============================================================================
// 3. REALISTIC TEST FIXTURES
// ============================================================================

export const GEO_FIXTURES = {
  // Central Delhi & Landmarks
  AIIMS_DELHI: { lat: 28.5672, lng: 77.21, name: "AIIMS New Delhi" },
  SAFDARJUNG_HOSPITAL: {
    lat: 28.57,
    lng: 77.208,
    name: "Safdarjung Hospital, New Delhi",
    distFromAiimsKm: 0.369,
  },
  MAX_SAKET: {
    lat: 28.5273,
    lng: 77.2144,
    name: "Max Super Speciality Hospital, Saket",
    distFromAiimsKm: 4.453,
  },
  FORTIS_VASANT_KUNJ: {
    lat: 28.519,
    lng: 77.1578,
    name: "Fortis Hospital, Vasant Kunj",
    distFromAiimsKm: 7.348,
  },
  APOLLO_SARITA_VIHAR: {
    lat: 28.5372,
    lng: 77.2882,
    name: "Indraprastha Apollo Hospital",
    distFromAiimsKm: 8.31,
  },
  MEDANTA_GURUGRAM: {
    lat: 28.4395,
    lng: 77.0423,
    name: "Medanta - The Medicity, Gurugram",
    distFromAiimsKm: 21.5,
  },
  JAYPEE_NOIDA: {
    lat: 28.5085,
    lng: 77.3712,
    name: "Jaypee Hospital, Sector 128 Noida",
    distFromAiimsKm: 16.85,
  },
  LLRM_MEERUT: {
    lat: 28.9845,
    lng: 77.7064,
    name: "LLRM Medical College, Meerut",
    distFromAiimsKm: 66.5,
  },

  // Other Major Cities
  KEM_MUMBAI: { lat: 18.9986, lng: 72.8427, name: "KEM Hospital Mumbai" },
  LILAVATI_MUMBAI: { lat: 19.0515, lng: 72.829, name: "Lilavati Hospital Bandra Mumbai" },
  VICTORIA_BENGALURU: { lat: 12.9634, lng: 77.575, name: "Victoria Hospital Bengaluru" },
  MANIPAL_BENGALURU: { lat: 12.9587, lng: 77.6485, name: "Manipal Hospital Bengaluru" },
  KGMU_LUCKNOW: { lat: 26.869, lng: 80.916, name: "KGMU Lucknow" },
  BALRAMPUR_LUCKNOW: { lat: 26.858, lng: 80.932, name: "Balrampur Hospital Lucknow" },

  // Exact Radius Boundary Points from AIIMS Delhi (28.5672, 77.2100)
  // Distance purely south along longitude 77.2100:
  // 1 deg latitude ≈ 111.195 km -> 1 km ≈ 0.008993 deg
  BOUNDARY_POINTS_AIIMS: {
    // 5 km boundary
    P_4_9KM: { lat: 28.5232, lng: 77.21, distKm: 4.892 },
    P_5_0KM: { lat: 28.5222, lng: 77.21, distKm: 5.003 },
    P_5_1KM: { lat: 28.5213, lng: 77.21, distKm: 5.103 },

    // 10 km boundary
    P_9_9KM: { lat: 28.4782, lng: 77.21, distKm: 9.896 },
    P_10_0KM: { lat: 28.4773, lng: 77.21, distKm: 9.996 },
    P_10_1KM: { lat: 28.4764, lng: 77.21, distKm: 10.096 },

    // 50 km boundary
    P_49_5KM: { lat: 28.122, lng: 77.21, distKm: 49.502 },
    P_50_0KM: { lat: 28.1175, lng: 77.21, distKm: 50.002 },
    P_50_5KM: { lat: 28.113, lng: 77.21, distKm: 50.503 },
  },

  // Extreme Coordinates
  EXTREME: {
    NORTH_POLE: { lat: 90.0, lng: 0.0 },
    SOUTH_POLE: { lat: -90.0, lng: 0.0 },
    NULL_ISLAND: { lat: 0.0, lng: 0.0 },
    DATE_LINE_EAST: { lat: 0.0, lng: 180.0 },
    DATE_LINE_WEST: { lat: 0.0, lng: -180.0 },
  },
};

export const STATES_DISTRICTS_FIXTURES: Record<string, { name: string; districts: string[] }> = {
  DL: {
    name: "Delhi",
    districts: [
      "Central Delhi",
      "East Delhi",
      "New Delhi",
      "North Delhi",
      "North East Delhi",
      "North West Delhi",
      "Shahdara",
      "South Delhi",
      "South East Delhi",
      "South West Delhi",
      "West Delhi",
    ],
  },
  MH: {
    name: "Maharashtra",
    districts: ["Mumbai City", "Mumbai Suburban", "Pune", "Thane", "Nagpur", "Nashik"],
  },
  KA: {
    name: "Karnataka",
    districts: ["Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru", "Hubballi"],
  },
  UP: {
    name: "Uttar Pradesh",
    districts: ["Lucknow", "Gautam Buddha Nagar", "Ghaziabad", "Kanpur Nagar", "Varanasi", "Meerut"],
  },
};

export const SEED_BLOOD_BANKS: BloodBankCardData[] = [
  {
    id: "bank-aiims-delhi",
    name: "AIIMS Main Blood Bank",
    licenseNumber: "DL-BB-1001",
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    address: "Ansari Nagar, New Delhi 110029",
    phone: "+911126593201",
    email: "bloodbank@aiims.edu",
    latitude: 28.5672,
    longitude: 77.21,
    distanceKm: 0,
    isVerified: true,
    source: "eraktkosh",
    lastStockUpdate: "2026-10-30T04:30:00Z",
    stock: [
      { bloodGroup: "A+", componentType: "whole_blood", unitsAvailable: 5 },
      { bloodGroup: "O+", componentType: "whole_blood", unitsAvailable: 8 },
      { bloodGroup: "B+", componentType: "whole_blood", unitsAvailable: 4 },
      { bloodGroup: "AB+", componentType: "whole_blood", unitsAvailable: 2 },
      { bloodGroup: "O-", componentType: "whole_blood", unitsAvailable: 1 },
      { bloodGroup: "A-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "B-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "AB-", componentType: "whole_blood", unitsAvailable: 0 },
    ],
  },
  {
    id: "bank-safdarjung-delhi",
    name: "Safdarjung Hospital Regional Blood Centre",
    licenseNumber: "DL-BB-1002",
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    address: "Ring Road, opposite AIIMS, New Delhi 110029",
    phone: "+911126165060",
    email: "blood@safdarjung.nic.in",
    latitude: 28.57,
    longitude: 77.208,
    distanceKm: 0.369,
    isVerified: true,
    source: "eraktkosh",
    lastStockUpdate: "2026-10-30T04:45:00Z",
    stock: [
      { bloodGroup: "O+", componentType: "whole_blood", unitsAvailable: 3 },
      { bloodGroup: "B+", componentType: "whole_blood", unitsAvailable: 5 },
      { bloodGroup: "A+", componentType: "whole_blood", unitsAvailable: 2 },
      { bloodGroup: "AB+", componentType: "whole_blood", unitsAvailable: 1 },
      { bloodGroup: "O-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "A-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "B-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "AB-", componentType: "whole_blood", unitsAvailable: 0 },
    ],
  },
  {
    id: "bank-red-cross-delhi",
    name: "Indian Red Cross Society National HQ Blood Bank",
    licenseNumber: "DL-BB-1003",
    state: "Delhi",
    district: "Central Delhi",
    city: "New Delhi",
    address: "1 Red Cross Road, New Delhi 110001",
    phone: "+911123716441",
    email: "ircs@redcrossblood.in",
    latitude: 28.621,
    longitude: 77.208,
    distanceKm: 5.98,
    isVerified: true,
    source: "eraktkosh",
    lastStockUpdate: "2026-10-30T05:00:00Z",
    stock: [
      { bloodGroup: "A+", componentType: "whole_blood", unitsAvailable: 10 },
      { bloodGroup: "B+", componentType: "whole_blood", unitsAvailable: 8 },
      { bloodGroup: "O+", componentType: "whole_blood", unitsAvailable: 12 },
      { bloodGroup: "AB+", componentType: "whole_blood", unitsAvailable: 3 },
      { bloodGroup: "O-", componentType: "whole_blood", unitsAvailable: 2 },
      { bloodGroup: "AB-", componentType: "whole_blood", unitsAvailable: 0 },
    ],
  },
  {
    id: "bank-rotary-noida",
    name: "Rotary Blood Bank Noida",
    licenseNumber: "UP-BB-2005",
    state: "Uttar Pradesh",
    district: "Gautam Buddha Nagar",
    city: "Noida",
    address: "Sector 31, Noida, Uttar Pradesh 201301",
    phone: "+911202456789",
    email: "noida@rotarybloodbank.org",
    latitude: 28.583,
    longitude: 77.345,
    distanceKm: 13.25,
    isVerified: true,
    source: "partner",
    lastStockUpdate: "2026-10-30T03:00:00Z",
    stock: [
      { bloodGroup: "AB-", componentType: "whole_blood", unitsAvailable: 2 },
      { bloodGroup: "A-", componentType: "whole_blood", unitsAvailable: 1 },
      { bloodGroup: "O+", componentType: "whole_blood", unitsAvailable: 15 },
    ],
  },
  {
    id: "bank-empty-lifeline",
    name: "LifeLine Blood Bank Saket",
    licenseNumber: "DL-BB-1099",
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    address: "J-Block Saket, New Delhi 110017",
    phone: "+911141234567",
    email: "info@lifelinesaket.in",
    latitude: 28.528,
    longitude: 77.215,
    distanceKm: 4.38,
    isVerified: false,
    source: "manual",
    lastStockUpdate: "2026-10-29T10:00:00Z",
    stock: [
      { bloodGroup: "A+", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "O+", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "B+", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "AB+", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "O-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "A-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "B-", componentType: "whole_blood", unitsAvailable: 0 },
      { bloodGroup: "AB-", componentType: "whole_blood", unitsAvailable: 0 },
    ],
  },
];

export const SEED_DONORS: DonorProfile[] = [
  {
    id: "donor-rahul-a-pos",
    userId: "user-1",
    name: "Rahul Sharma",
    phone: "+919876543210",
    bloodGroup: "A+",
    latitude: 28.57,
    longitude: 77.208, // Safdarjung (~0.37km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "1994-05-15",
    gender: "male",
    weightKg: 72,
    lastDonationDate: "2026-05-01", // ~180 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "en",
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "donor-priya-o-neg",
    userId: "user-2",
    name: "Priya Verma",
    phone: "+919811122233",
    bloodGroup: "O-", // Universal Donor
    latitude: 28.568,
    longitude: 77.211, // AIIMS Campus (~0.15km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "1998-08-20",
    gender: "female",
    weightKg: 58,
    lastDonationDate: "2026-06-15", // ~137 days ago (>120 days female, eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "hi",
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "donor-amit-ab-neg",
    userId: "user-3",
    name: "Amit Patel",
    phone: "+919822233344",
    bloodGroup: "AB-", // Rare Blood Group
    latitude: 28.53,
    longitude: 77.215, // Malviya Nagar (~4.1km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "1990-11-05",
    gender: "male",
    weightKg: 68,
    lastDonationDate: "2026-04-10", // ~203 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "en",
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "donor-vikram-b-pos",
    userId: "user-4",
    name: "Vikram Singh",
    phone: "+919833344455",
    bloodGroup: "B+",
    latitude: 28.519,
    longitude: 77.1578, // Vasant Kunj (~7.35km)
    state: "Delhi",
    district: "South West Delhi",
    city: "New Delhi",
    dateOfBirth: "1988-03-12",
    gender: "male",
    weightKg: 80,
    lastDonationDate: "2026-07-01", // ~121 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "hi",
    createdAt: "2026-03-15T00:00:00Z",
  },
  {
    id: "donor-sunita-o-pos-gurgaon",
    userId: "user-5",
    name: "Sunita Rao",
    phone: "+919844455566",
    bloodGroup: "O+",
    latitude: 28.4395,
    longitude: 77.0423, // Gurugram (~21.5km from AIIMS)
    state: "Haryana",
    district: "Gurugram",
    city: "Gurugram",
    dateOfBirth: "1992-09-18",
    gender: "female",
    weightKg: 62,
    lastDonationDate: "2026-05-20", // ~163 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 50,
    whatsappConsent: true,
    preferredLanguage: "en",
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "donor-neha-recent-warning",
    userId: "user-6",
    name: "Neha Gupta",
    phone: "+919855566677",
    bloodGroup: "A+",
    latitude: 28.555,
    longitude: 77.205, // Green Park (~1.4km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "2000-01-25",
    gender: "female",
    weightKg: 54,
    lastDonationDate: "2026-09-25", // 35 days ago (< 120 days female, soft warning)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "en",
    createdAt: "2026-04-10T00:00:00Z",
  },
  {
    id: "donor-rajesh-unavailable",
    userId: "user-7",
    name: "Rajesh Kumar",
    phone: "+919866677788",
    bloodGroup: "A+",
    latitude: 28.545,
    longitude: 77.2, // Hauz Khas (~2.6km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "1985-07-30",
    gender: "male",
    weightKg: 75,
    lastDonationDate: "2026-01-15",
    isAvailable: false, // UNAVAILABLE
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: "hi",
    createdAt: "2026-01-20T00:00:00Z",
  },
  {
    id: "donor-manish-no-consent",
    userId: "user-8",
    name: "Manish Joshi",
    phone: "+919877788899",
    bloodGroup: "A+",
    latitude: 28.535,
    longitude: 77.21, // Saket (~3.6km)
    state: "Delhi",
    district: "South Delhi",
    city: "New Delhi",
    dateOfBirth: "1996-12-04",
    gender: "male",
    weightKg: 70,
    lastDonationDate: "2026-02-10",
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: false, // NO WHATSAPP CONSENT
    preferredLanguage: "en",
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "donor-rohit-b-neg-meerut",
    userId: "user-9",
    name: "Rohit Yadav",
    phone: "+919888899900",
    bloodGroup: "B-",
    latitude: 28.9845,
    longitude: 77.7064, // Meerut (~66.5km from AIIMS)
    state: "Uttar Pradesh",
    district: "Meerut",
    city: "Meerut",
    dateOfBirth: "1993-04-18",
    gender: "male",
    weightKg: 74,
    lastDonationDate: "2026-03-01",
    isAvailable: true,
    searchRadiusKm: 50,
    whatsappConsent: true,
    preferredLanguage: "hi",
    createdAt: "2026-03-10T00:00:00Z",
  },
];

export const I18N_DICTIONARIES = {
  en: {
    common: {
      appName: "RaktKhoj",
      tagline: "Find blood when every second counts",
      search: "Search",
      cancel: "Cancel",
      loading: "Loading...",
      save: "Save",
      back: "Back",
      error: "An error occurred",
      retry: "Retry",
      phone: "Phone",
      name: "Name",
      distanceKm: "km away",
    },
    bloodSearch: {
      title: "Find Blood Now",
      selectBloodGroup: "Select Blood Group",
      enterLocation: "Enter your location",
      useCurrentLocation: "Use my current location",
      selectState: "Select State",
      selectDistrict: "Select District",
      searchRadius: "Search Radius",
      radius5km: "5 km",
      radius10km: "10 km",
      radius50km: "50 km",
      searchBloodBanks: "Search Blood Banks",
      noResults: "No blood banks found with available stock",
      fallbackToDonors: "Searching for compatible donors nearby...",
      unitsAvailable: "units available",
      lastUpdated: "Last updated",
      directions: "Get Directions",
      callBank: "Call Blood Bank",
    },
    donor: {
      registerTitle: "Register as a Donor",
      bloodGroup: "Your Blood Group",
      acceptDonation: "I am ready to donate",
      declineDonation: "Not available right now",
      thankYou: "Thank you for saving a life!",
      recentDonationWarning: "Recently donated (< 90 days) — please confirm eligibility",
      eligibleToDonate: "Eligible to donate",
      daysRemaining: "days remaining until eligible",
      readyToDonate: "Ready to Donate",
      notAvailableNow: "Not available now",
    },
    request: {
      createTitle: "Emergency Blood Request",
      patientName: "Patient Name",
      patientAge: "Patient Age",
      emergencyType: "Emergency Type",
      hospitalName: "Hospital Name",
      unitsNeeded: "Units Needed",
      searchingForBanks: "Searching nearby blood banks...",
      bankFound: "Blood bank with stock found!",
      donorsNotified: "Donors notified via WhatsApp",
      waitingRoomTitle: "Live Emergency Waiting Room",
      acceptedDonors: "Accepted Donors",
      contactDonorDirectly: "Contact Donor Directly",
      callNow: "Call Donor",
      whatsappChat: "Chat on WhatsApp",
    },
    status: {
      searching: "Searching",
      bank_found: "Bank Found",
      donors_notified: "Donors Notified",
      fulfilled: "Fulfilled",
      expired: "Expired",
      cancelled: "Cancelled",
    },
  },
  hi: {
    common: {
      appName: "रक्तखोज",
      tagline: "हर सेकंड मायने रखता है — रक्त खोजें",
      search: "खोजें",
      cancel: "रद्द करें",
      loading: "लोड हो रहा है...",
      save: "सुरक्षित करें",
      back: "पीछे जाएं",
      error: "एक त्रुटि हुई",
      retry: "पुनः प्रयास करें",
      phone: "फ़ोन",
      name: "नाम",
      distanceKm: "कि.मी. दूर",
    },
    bloodSearch: {
      title: "अभी रक्त खोजें",
      selectBloodGroup: "रक्त समूह चुनें",
      enterLocation: "अपना स्थान दर्ज करें",
      useCurrentLocation: "मेरा वर्तमान स्थान उपयोग करें",
      selectState: "राज्य चुनें",
      selectDistrict: "जिला चुनें",
      searchRadius: "खोज दायरा",
      radius5km: "5 कि.मी.",
      radius10km: "10 कि.मी.",
      radius50km: "50 कि.मी.",
      searchBloodBanks: "ब्लड बैंक खोजें",
      noResults: "उपलब्ध स्टॉक वाले ब्लड बैंक नहीं मिले",
      fallbackToDonors: "आस-पास संगत रक्तदाताओं की खोज हो रही है...",
      unitsAvailable: "यूनिट उपलब्ध",
      lastUpdated: "अंतिम अद्यतन",
      directions: "दिशा-निर्देश",
      callBank: "ब्लड बैंक को कॉल करें",
    },
    donor: {
      registerTitle: "रक्तदाता के रूप में पंजीकरण करें",
      bloodGroup: "आपका रक्त समूह",
      acceptDonation: "मैं रक्तदान के लिए तैयार हूँ",
      declineDonation: "अभी उपलब्ध नहीं",
      thankYou: "एक जीवन बचाने के लिए धन्यवाद!",
      recentDonationWarning: "हाल ही में रक्तदान किया (< 90 दिन) — पात्रता की पुष्टि करें",
      eligibleToDonate: "रक्तदान के लिए पात्र",
      daysRemaining: "पात्र होने में शेष दिन",
      readyToDonate: "रक्तदान के लिए तैयार",
      notAvailableNow: "अभी उपलब्ध नहीं",
    },
    request: {
      createTitle: "आपातकालीन रक्त अनुरोध",
      patientName: "रोगी का नाम",
      patientAge: "रोगी की आयु",
      emergencyType: "आपातकालीन प्रकार",
      hospitalName: "अस्पताल का नाम",
      unitsNeeded: "आवश्यक यूनिट",
      searchingForBanks: "आस-पास के ब्लड बैंकों की खोज हो रही है...",
      bankFound: "स्टॉक वाला ब्लड बैंक मिल गया!",
      donorsNotified: "रक्तदाताओं को व्हाट्सएप पर सूचित किया गया",
      waitingRoomTitle: "सजीव आपातकालीन प्रतीक्षा कक्ष",
      acceptedDonors: "स्वीकृत रक्तदाता",
      contactDonorDirectly: "रक्तदाता से सीधे संपर्क करें",
      callNow: "रक्तदाता को कॉल करें",
      whatsappChat: "व्हाट्सएप पर चैट करें",
    },
    status: {
      searching: "खोज जारी",
      bank_found: "बैंक मिल गया",
      donors_notified: "दाता सूचित",
      fulfilled: "सफल/पूर्ण",
      expired: "समाप्त",
      cancelled: "रद्द",
    },
  },
};

// ============================================================================
// 4. IN-MEMORY MOCK RAKTKHOJ SERVER
// ============================================================================

export class MockRaktKhojServer {
  private bloodBanks: BloodBankCardData[] = [];
  private donors: DonorProfile[] = [];
  private requests: Map<string, BloodRequest> = new Map();
  private notifications: Map<string, DonorNotificationSummary[]> = new Map();
  private outboundWhatsApp: OutboundWhatsAppMessage[] = [];
  private server: ReturnType<typeof Bun.serve> | null = null;
  public port: number = 0;
  public url: string = "";
  public webhookVerifyToken: string = "raktkhoj_webhook_test_token_2026";
  public appSecret: string = "raktkhoj_app_secret_test_xyz";

  constructor() {
    this.reset();
  }

  public reset(customState?: { banks?: BloodBankCardData[]; donors?: DonorProfile[] }): void {
    this.bloodBanks = customState?.banks ? JSON.parse(JSON.stringify(customState.banks)) : JSON.parse(JSON.stringify(SEED_BLOOD_BANKS));
    this.donors = customState?.donors ? JSON.parse(JSON.stringify(customState.donors)) : JSON.parse(JSON.stringify(SEED_DONORS));
    this.requests.clear();
    this.notifications.clear();
    this.outboundWhatsApp = [];
  }

  public getOutboundWhatsAppMessages(): OutboundWhatsAppMessage[] {
    return [...this.outboundWhatsApp];
  }

  public getStoredDonors(): DonorProfile[] {
    return [...this.donors];
  }

  public getStoredBloodBanks(): BloodBankCardData[] {
    return [...this.bloodBanks];
  }

  public getRequestById(id: string): BloodRequest | undefined {
    return this.requests.get(id);
  }

  public getNotificationsForRequest(requestId: string): DonorNotificationSummary[] {
    return this.notifications.get(requestId) || [];
  }

  /**
   * Start mock server on ephemeral OS port
   */
  public async start(): Promise<{ url: string; port: number }> {
    if (this.server) {
      return { url: this.url, port: this.port };
    }

    const self = this;

    this.server = Bun.serve({
      port: 0,
      fetch: (req) => self.handleRequest(req),
    });

    this.port = this.server.port;
    this.url = `http://localhost:${this.port}`;
    return { url: this.url, port: this.port };
  }

  public async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Internal Request Router matching PROJECT.md § Interface Contracts
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Hub-Signature-256",
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 1. Health check: GET /health
      if (path === "/health" && method === "GET") {
        return Response.json(
          { status: "ok", timestamp: new Date().toISOString() },
          { headers: corsHeaders }
        );
      }

      // 2. States: GET /api/v1/blood-banks/states
      if (path === "/api/v1/blood-banks/states" && method === "GET") {
        const statesList = Object.entries(STATES_DISTRICTS_FIXTURES).map(([code, s]) => ({
          code,
          name: s.name,
        }));
        return Response.json({ states: statesList }, { headers: corsHeaders });
      }

      // 3. Districts: GET /api/v1/blood-banks/districts/:stateCode
      if (path.startsWith("/api/v1/blood-banks/districts/") && method === "GET") {
        const rawCode = path.replace("/api/v1/blood-banks/districts/", "");
        const stateCode = decodeURIComponent(rawCode).trim().toUpperCase();
        const stateData = STATES_DISTRICTS_FIXTURES[stateCode];
        if (!stateData) {
          return Response.json({ error: `State not found: ${stateCode}`, districts: [] }, { status: 404, headers: corsHeaders });
        }
        const districtsList = stateData.districts.map((d, index) => ({
          code: `${stateCode}-${index + 1}`,
          name: d,
        }));
        return Response.json({ districts: districtsList }, { headers: corsHeaders });
      }

      // 4. Blood Banks Search: GET /api/v1/blood-banks/search
      if (path === "/api/v1/blood-banks/search" && method === "GET") {
        const latStr = url.searchParams.get("lat");
        const lngStr = url.searchParams.get("lng");
        const bloodGroup = url.searchParams.get("bloodGroup") as BloodGroup | null;
        const radiusKm = Number(url.searchParams.get("radiusKm") || 10);
        const state = url.searchParams.get("state");
        const district = url.searchParams.get("district");
        const componentType = url.searchParams.get("componentType") || "whole_blood";

        if (!latStr || !lngStr) {
          return Response.json({ error: "Missing latitude or longitude parameters" }, { status: 400, headers: corsHeaders });
        }

        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return Response.json({ error: "Invalid latitude or longitude coordinates" }, { status: 400, headers: corsHeaders });
        }

        if (bloodGroup && !RBC_COMPATIBILITY_ORACLE[bloodGroup]) {
          return Response.json({ error: `Invalid blood group: ${bloodGroup}` }, { status: 400, headers: corsHeaders });
        }

        // Calculate distances & filter
        const matchedBanks: BloodBankCardData[] = [];
        for (const bank of this.bloodBanks) {
          if (bank.latitude === null || bank.longitude === null) continue;

          // State / district filter if specified
          if (state && bank.state.toLowerCase() !== state.toLowerCase()) continue;
          if (district && bank.district.toLowerCase() !== district.toLowerCase()) continue;

          const dist = haversineDistanceOracle(lat, lng, bank.latitude, bank.longitude);
          if (dist <= radiusKm) {
            // Check stock if bloodGroup specified
            let matchingStock = bank.stock;
            if (bloodGroup) {
              matchingStock = bank.stock.filter((s) => s.bloodGroup === bloodGroup && s.unitsAvailable > 0);
            }

            matchedBanks.push({
              ...bank,
              distanceKm: dist,
              stock: matchingStock,
            });
          }
        }

        // Sort by distance ascending
        matchedBanks.sort((a, b) => a.distanceKm - b.distanceKm);

        return Response.json(
          {
            banks: matchedBanks,
            totalCount: matchedBanks.length,
            source: "combined",
          },
          { headers: corsHeaders }
        );
      }

      // 5. Donor Registration: POST /api/v1/donors/register
      if (path === "/api/v1/donors/register" && method === "POST") {
        const body = (await req.json()) as Partial<DonorProfile> & { phone?: string; preferredLanguage?: SupportedLanguage };

        // Validate phone
        const phoneValidation = validateIndianPhoneOracle(body.phone || "");
        if (!phoneValidation.isValid) {
          return Response.json({ error: phoneValidation.error }, { status: 400, headers: corsHeaders });
        }

        // Validate blood group
        if (!body.bloodGroup || !RBC_COMPATIBILITY_ORACLE[body.bloodGroup as BloodGroup]) {
          return Response.json({ error: `Invalid blood group: ${body.bloodGroup}` }, { status: 400, headers: corsHeaders });
        }

        // Validate mandatory consent
        if (body.whatsappConsent !== true) {
          return Response.json({ error: "Consent to receive WhatsApp notifications is required" }, { status: 400, headers: corsHeaders });
        }

        // Validate coordinates
        if (typeof body.latitude !== "number" || typeof body.longitude !== "number" ||
            body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
          return Response.json({ error: "Valid latitude and longitude required" }, { status: 400, headers: corsHeaders });
        }

        // Check for duplicate phone
        const existing = this.donors.find((d) => d.phone === phoneValidation.normalized);
        if (existing) {
          return Response.json({ error: "Donor with this phone number is already registered" }, { status: 409, headers: corsHeaders });
        }

        const newDonor: DonorProfile = {
          id: `donor-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          userId: `user-${Date.now()}`,
          name: body.name || "Anonymous Donor",
          phone: phoneValidation.normalized,
          bloodGroup: body.bloodGroup as BloodGroup,
          latitude: body.latitude,
          longitude: body.longitude,
          state: body.state || "Delhi",
          district: body.district || "South Delhi",
          city: body.city || null,
          dateOfBirth: body.dateOfBirth || null,
          gender: body.gender || "other",
          weightKg: body.weightKg || null,
          lastDonationDate: body.lastDonationDate || null,
          isAvailable: body.isAvailable ?? true,
          searchRadiusKm: body.searchRadiusKm || 10,
          whatsappConsent: true,
          preferredLanguage: body.preferredLanguage || "en",
          createdAt: new Date().toISOString(),
        };

        this.donors.push(newDonor);
        return Response.json({ donor: newDonor, token: `jwt-donor-token-${newDonor.id}` }, { status: 201, headers: corsHeaders });
      }

      // 6. Blood Requests Lifecycle: POST /api/v1/requests
      if (path === "/api/v1/requests" && method === "POST") {
        const body = (await req.json()) as Partial<BloodRequest>;

        if (!body.bloodGroupNeeded || !RBC_COMPATIBILITY_ORACLE[body.bloodGroupNeeded as BloodGroup]) {
          return Response.json({ error: `Invalid blood group needed: ${body.bloodGroupNeeded}` }, { status: 400, headers: corsHeaders });
        }

        if (!body.patientName || body.patientName.trim().length < 2) {
          return Response.json({ error: "Patient name must be at least 2 characters" }, { status: 400, headers: corsHeaders });
        }

        if (!body.hospitalName || body.hospitalName.trim().length < 2) {
          return Response.json({ error: "Hospital name must be at least 2 characters" }, { status: 400, headers: corsHeaders });
        }

        if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
          return Response.json({ error: "Latitude and longitude are required" }, { status: 400, headers: corsHeaders });
        }

        const radiusKm = (body.searchRadiusKm || 10) as RadiusPreset;
        const unitsNeeded = body.unitsNeeded || 1;
        const bloodGroup = body.bloodGroupNeeded as BloodGroup;

        // Check if blood banks have available stock
        let bankFound = false;
        for (const bank of this.bloodBanks) {
          if (bank.latitude === null || bank.longitude === null) continue;
          const dist = haversineDistanceOracle(body.latitude, body.longitude, bank.latitude, bank.longitude);
          if (dist <= radiusKm) {
            const hasStock = bank.stock.some((s) => s.bloodGroup === bloodGroup && s.unitsAvailable >= unitsNeeded);
            if (hasStock) {
              bankFound = true;
              break;
            }
          }
        }

        const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newRequest: BloodRequest = {
          id: requestId,
          requesterId: body.requesterId || null,
          requesterPhone: body.requesterPhone || null,
          requesterName: body.requesterName || null,
          bloodGroupNeeded: bloodGroup,
          componentType: body.componentType || "whole_blood",
          unitsNeeded,
          patientName: body.patientName,
          patientAge: body.patientAge || null,
          emergencyType: body.emergencyType || "surgery",
          hospitalName: body.hospitalName,
          latitude: body.latitude,
          longitude: body.longitude,
          state: body.state || null,
          district: body.district || null,
          searchRadiusKm: radiusKm,
          status: bankFound ? "bank_found" : "donors_notified",
          fulfillmentSource: bankFound ? "blood_bank" : null,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        this.requests.set(requestId, newRequest);

        let notificationsSent = 0;
        let compatibleDonorsCount = 0;

        // If not found in banks, cascade to compatible volunteer donors
        if (!bankFound) {
          const compatibleGroups = getCompatibleDonorGroupsOracle(bloodGroup);
          const reqNotifications: DonorNotificationSummary[] = [];

          for (const donor of this.donors) {
            if (!donor.isAvailable || !donor.whatsappConsent) continue;
            if (!compatibleGroups.includes(donor.bloodGroup)) continue;

            const dist = haversineDistanceOracle(body.latitude, body.longitude, donor.latitude, donor.longitude);
            if (dist <= radiusKm) {
              compatibleDonorsCount++;
              const notifId = `notif-${requestId}-${donor.id}`;
              const whatsappMsgId = `wamid.HBgM${Date.now()}${Math.floor(Math.random() * 10000)}`;

              // Dispatch WhatsApp notification
              const outboundMsg: OutboundWhatsAppMessage = {
                id: whatsappMsgId,
                recipientPhone: donor.phone,
                templateName: "emergency_blood_alert_v1",
                language: donor.preferredLanguage || "en",
                parameters: {
                  patient_name: newRequest.patientName,
                  hospital_name: newRequest.hospitalName,
                  blood_group: newRequest.bloodGroupNeeded,
                  units_needed: String(newRequest.unitsNeeded),
                  distance_km: dist.toFixed(1),
                },
                interactiveButtons: [
                  { id: `accept_${requestId}_${donor.id}`, title: "Accept & Donate" },
                  { id: `decline_${requestId}_${donor.id}`, title: "Cannot Donate" },
                ],
                timestamp: new Date().toISOString(),
                requestId,
                donorId: donor.id,
              };

              this.outboundWhatsApp.push(outboundMsg);
              notificationsSent++;

              reqNotifications.push({
                id: notifId,
                requestId,
                donorId: donor.id,
                donorName: donor.name,
                donorBloodGroup: donor.bloodGroup,
                donorPhoneMasked: donor.phone.replace(/(\+\d{2})(\d{2})\d{4}(\d{4})/, "$1 $2****$3"),
                status: "sent",
                sentAt: new Date().toISOString(),
                respondedAt: null,
              });
            }
          }

          this.notifications.set(requestId, reqNotifications);
        }

        return Response.json(
          {
            request: newRequest,
            compatibleDonorsCount,
            notificationsSent,
          },
          { status: 201, headers: corsHeaders }
        );
      }

      // 7. Blood Request Details & Waiting Room: GET /api/v1/requests/:id
      if (path.startsWith("/api/v1/requests/") && method === "GET" && !path.endsWith("/respond")) {
        const id = path.replace("/api/v1/requests/", "").trim();
        const request = this.requests.get(id);

        if (!request) {
          return Response.json({ error: `Request with ID ${id} not found` }, { status: 404, headers: corsHeaders });
        }

        const notifs = this.notifications.get(id) || [];
        const acceptedDonors: AcceptedDonorContact[] = [];

        for (const n of notifs) {
          if (n.status === "accepted") {
            const donor = this.donors.find((d) => d.id === n.donorId);
            if (donor) {
              const dist = haversineDistanceOracle(request.latitude, request.longitude, donor.latitude, donor.longitude);
              acceptedDonors.push({
                donorId: donor.id,
                name: donor.name,
                phone: donor.phone,
                bloodGroup: donor.bloodGroup,
                distanceKm: dist,
                respondedAt: n.respondedAt || new Date().toISOString(),
                directCallUrl: `tel:${donor.phone}`,
                whatsappUrl: `https://wa.me/${donor.phone.replace("+", "")}?text=${encodeURIComponent(
                  `Namaste ${donor.name}, thank you for accepting blood request for ${request.patientName} at ${request.hospitalName}.`
                )}`,
              });
            }
          }
        }

        return Response.json(
          {
            request,
            notifications: notifs,
            acceptedDonors,
          },
          { headers: corsHeaders }
        );
      }

      // 8. Donor Direct Respond: POST /api/v1/requests/:id/respond
      if (path.startsWith("/api/v1/requests/") && path.endsWith("/respond") && method === "POST") {
        const id = path.replace("/api/v1/requests/", "").replace("/respond", "").trim();
        const body = (await req.json()) as { donorId: string; status?: "accepted" | "declined"; action?: "accepted" | "declined"; responseNote?: string };

        const request = this.requests.get(id);
        if (!request) {
          return Response.json({ error: `Request ${id} not found` }, { status: 404, headers: corsHeaders });
        }

        const action = body.status || body.action;
        if (!action || !["accepted", "declined"].includes(action)) {
          return Response.json({ error: "Valid status ('accepted' or 'declined') is required" }, { status: 400, headers: corsHeaders });
        }

        const notifs = this.notifications.get(id) || [];
        const notif = notifs.find((n) => n.donorId === body.donorId);
        if (notif) {
          notif.status = action;
          notif.respondedAt = new Date().toISOString();
          notif.responseNote = body.responseNote || null;
        }

        if (action === "accepted") {
          request.status = "fulfilled";
          request.fulfillmentSource = "donor";
        }

        return Response.json({ success: true, status: action }, { headers: corsHeaders });
      }

      // 9. WhatsApp Webhook Verification: GET /api/v1/whatsapp/webhook
      if (path === "/api/v1/whatsapp/webhook" && method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode === "subscribe" && token === this.webhookVerifyToken) {
          return new Response(challenge || "", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
        }

        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      // 10. WhatsApp Inbound Webhook: POST /api/v1/whatsapp/webhook
      if (path === "/api/v1/whatsapp/webhook" && method === "POST") {
        const rawText = await req.text();
        const signatureHeader = req.headers.get("X-Hub-Signature-256");

        // Optional signature validation if header provided
        if (signatureHeader && !verifyWhatsAppWebhookSignature(rawText, signatureHeader, this.appSecret)) {
          return Response.json({ error: "Invalid signature" }, { status: 401, headers: corsHeaders });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawText);
        } catch {
          return Response.json({ error: "Malformed JSON payload" }, { status: 400, headers: corsHeaders });
        }

        // Process interactive button reply
        // Standard WhatsApp Cloud API payload format:
        // entry[].changes[].value.messages[].interactive.button_reply.id
        const entries = payload.entry || [];
        for (const entry of entries) {
          for (const change of entry.changes || []) {
            const val = change.value || {};
            for (const msg of val.messages || []) {
              if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
                const btnId = msg.interactive.button_reply.id as string;
                // Format: accept_{requestId}_{donorId} or decline_{requestId}_{donorId}
                const parts = btnId.split("_");
                if (parts.length >= 3) {
                  const action = parts[0] === "accept" ? "accepted" : "declined";
                  const requestId = parts[1];
                  const donorId = parts.slice(2).join("_");

                  const request = this.requests.get(requestId);
                  const notifs = this.notifications.get(requestId) || [];
                  const notif = notifs.find((n) => n.donorId === donorId);

                  if (notif) {
                    notif.status = action;
                    notif.respondedAt = new Date().toISOString();
                  }

                  if (action === "accepted" && request) {
                    request.status = "fulfilled";
                    request.fulfillmentSource = "donor";
                  }
                }
              }
            }
          }
        }

        return Response.json({ success: true, processed: true }, { headers: corsHeaders });
      }

      // Fallback 404
      return Response.json({ error: `Route not found: ${method} ${path}` }, { status: 404, headers: corsHeaders });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500, headers: corsHeaders });
    }
  }
}

// ============================================================================
// 5. STRONGLY TYPED RAKTKHOJ CLIENT FOR OPAQUE-BOX E2E TESTING
// ============================================================================

export class RaktKhojClient {
  public baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async getHealth(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`Health check failed with HTTP ${res.status}`);
    return res.json();
  }

  public async getStates(): Promise<{ states: Array<{ code: string; name: string }> }> {
    const res = await fetch(`${this.baseUrl}/api/v1/blood-banks/states`);
    if (!res.ok) throw new Error(`getStates failed with HTTP ${res.status}`);
    return res.json();
  }

  public async getDistricts(stateCode: string): Promise<{ districts: Array<{ code: string; name: string }> }> {
    const res = await fetch(`${this.baseUrl}/api/v1/blood-banks/districts/${encodeURIComponent(stateCode)}`);
    return res.json();
  }

  public async searchBloodBanks(params: {
    lat: number;
    lng: number;
    bloodGroup?: BloodGroup;
    radiusKm?: RadiusPreset | number;
    state?: string;
    district?: string;
    componentType?: ComponentType;
  }): Promise<{ banks: BloodBankCardData[]; totalCount: number; source: string; error?: string }> {
    const url = new URL(`${this.baseUrl}/api/v1/blood-banks/search`);
    url.searchParams.set("lat", String(params.lat));
    url.searchParams.set("lng", String(params.lng));
    if (params.bloodGroup) url.searchParams.set("bloodGroup", params.bloodGroup);
    if (params.radiusKm) url.searchParams.set("radiusKm", String(params.radiusKm));
    if (params.state) url.searchParams.set("state", params.state);
    if (params.district) url.searchParams.set("district", params.district);
    if (params.componentType) url.searchParams.set("componentType", params.componentType);

    const res = await fetch(url.toString());
    return res.json();
  }

  public async registerDonor(payload: Partial<DonorProfile>): Promise<{ donor?: DonorProfile; token?: string; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/donors/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async createBloodRequest(payload: Partial<BloodRequest>): Promise<{
    request?: BloodRequest;
    compatibleDonorsCount?: number;
    notificationsSent?: number;
    error?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/v1/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async getBloodRequest(id: string): Promise<{
    request?: BloodRequest;
    notifications?: DonorNotificationSummary[];
    acceptedDonors?: AcceptedDonorContact[];
    error?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/api/v1/requests/${encodeURIComponent(id)}`);
    return res.json();
  }

  public async respondToRequest(
    requestId: string,
    payload: { donorId: string; status: "accepted" | "declined"; responseNote?: string }
  ): Promise<{ success: boolean; status: "accepted" | "declined"; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/requests/${encodeURIComponent(requestId)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async verifyWhatsAppWebhook(hubMode: string, hubToken: string, hubChallenge: string): Promise<{ status: number; text: string }> {
    const url = new URL(`${this.baseUrl}/api/v1/whatsapp/webhook`);
    url.searchParams.set("hub.mode", hubMode);
    url.searchParams.set("hub.verify_token", hubToken);
    url.searchParams.set("hub.challenge", hubChallenge);

    const res = await fetch(url.toString());
    const text = await res.text();
    return { status: res.status, text };
  }

  public async postWhatsAppWebhook(payload: any, signature?: string): Promise<{ success?: boolean; error?: string }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (signature) {
      headers["X-Hub-Signature-256"] = `sha256=${signature}`;
    }

    const res = await fetch(`${this.baseUrl}/api/v1/whatsapp/webhook`, {
      method: "POST",
      headers,
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    });
    return res.json();
  }
}
