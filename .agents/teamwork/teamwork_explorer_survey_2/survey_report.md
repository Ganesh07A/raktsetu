# RaktKhoj (रक्तखोज) — Backend Architecture, Database Schema & Services Survey Report

**Explorer**: Survey Explorer 2 (`teamwork_explorer_survey_2`)  
**Scope**: `packages/shared`, `packages/db`, `apps/api`, Database Schema, Domain Logic, External Services, Interface Contracts, and Mocking Strategy  
**Target Repository**: `d:\MEGA PROJECTS\raktsetu`  
**Date**: October 30, 2026  

---

## Executive Summary

RaktKhoj is an emergency blood discovery and routing engine designed for India. The backend architecture consists of three interconnected workspaces within the Bun + Turborepo monorepo:
1. **`packages/shared`**: The single source of truth for domain logic, blood compatibility matrices (ABO/Rh rules), geospatial calculations, shared validation schemas, and bilingual i18n dictionaries (English and Hindi).
2. **`packages/db`**: A robust PostgreSQL database layer managed by Drizzle ORM and Supabase, housing 6 core tables with relational integrity, foreign key cascades, and spatial/search indexing.
3. **`apps/api`**: A high-performance REST API powered by Hono.js on the Bun runtime, hosting specialized services for eRaktKosh proxy scraping, donor matching with soft-eligibility badges, and WhatsApp Business Cloud API communication (in free test mode with comprehensive zero-credential mocking).

---

## 1. `packages/shared` — Domain Logic, Types & Utilities

### 1.1 Directory Structure & Exports
```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     # Main barrel export
    ├── types.ts                     # Core TypeScript type definitions
    ├── constants.ts                 # Shared enum values and constants
    ├── blood-compatibility.ts       # RBC compatibility matrix and helper functions
    ├── geo-utils.ts                 # Haversine distance and bounding box calculations
    ├── validation.ts                # Shared Zod validation schemas
    └── i18n/
        ├── index.ts                 # i18n loader and dictionary type
        ├── en.ts                    # English dictionary
        └── hi.ts                    # Hindi dictionary (Devanagari)
```

### 1.2 Package Configuration (`packages/shared/package.json`)
```json
{
  "name": "@repo/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./constants": "./src/constants.ts",
    "./blood-compatibility": "./src/blood-compatibility.ts",
    "./geo-utils": "./src/geo-utils.ts",
    "./validation": "./src/validation.ts",
    "./i18n": "./src/i18n/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "typescript": "7.0.2"
  }
}
```

### 1.3 Core Constants (`packages/shared/src/constants.ts`)
```typescript
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = typeof BLOOD_GROUPS[number];

export const COMPONENT_TYPES = ['whole_blood', 'prbc', 'ffp', 'platelets'] as const;
export type ComponentType = typeof COMPONENT_TYPES[number];

export const EMERGENCY_TYPES = [
  'surgery',
  'accident',
  'thalassemia',
  'delivery',
  'dengue',
  'other'
] as const;
export type EmergencyType = typeof EMERGENCY_TYPES[number];

export const USER_ROLES = ['seeker', 'donor', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const RADIUS_PRESETS = [5, 10, 50] as const;
export type RadiusPreset = typeof RADIUS_PRESETS[number];

export const REQUEST_STATUSES = [
  'searching',
  'bank_found',
  'donors_notified',
  'fulfilled',
  'expired',
  'cancelled'
] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const NOTIFICATION_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'read',
  'accepted',
  'declined',
  'expired',
  'failed'
] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

export const FULFILLMENT_SOURCES = ['blood_bank', 'donor'] as const;
export type FulfillmentSource = typeof FULFILLMENT_SOURCES[number];

export const BLOOD_BANK_SOURCES = ['eraktkosh', 'manual', 'partner'] as const;
export type BloodBankSource = typeof BLOOD_BANK_SOURCES[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = typeof GENDERS[number];

/**
 * Standard donation intervals (in days) according to medical norms in India:
 * - Men: minimum 90 days (approx. 3 months)
 * - Women: minimum 120 days (approx. 4 months)
 * - Other: defaulted to 90 days
 */
export const DONATION_INTERVAL_DAYS: Record<Gender, number> = {
  male: 90,
  female: 120,
  other: 90,
};
```

### 1.4 Blood Compatibility Matrix Logic (`packages/shared/src/blood-compatibility.ts`)
In emergency medicine, Red Blood Cell (RBC) compatibility dictates who can safely receive blood from whom based on ABO antigens and Rh (+/-) factor:

| Recipient Blood Group | Compatible Donor Blood Groups (Ordered by Preference) |
|---|---|
| **O-** | O- (Exact match only) |
| **O+** | O+, O- |
| **A-** | A-, O- |
| **A+** | A+, A-, O+, O- |
| **B-** | B-, O- |
| **B+** | B+, B-, O+, O- |
| **AB-** | AB-, A-, B-, O- |
| **AB+** | AB+, AB-, A+, A-, B+, B-, O+, O- (Universal RBC Recipient) |

```typescript
import { BloodGroup } from './constants';

export const RBC_COMPATIBILITY_MATRIX: Record<BloodGroup, BloodGroup[]> = {
  'O-':  ['O-'],
  'O+':  ['O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/**
 * Returns list of compatible donor groups for a given recipient blood group,
 * sorted by medical preference (identical ABO/Rh first, then universal/compatible).
 */
export function getCompatibleDonorGroups(recipientBloodGroup: BloodGroup): BloodGroup[] {
  return RBC_COMPATIBILITY_MATRIX[recipientBloodGroup] ?? [];
}

/**
 * Returns boolean whether a specific donor group can safely donate to a recipient.
 */
export function isDonorCompatible(donorBloodGroup: BloodGroup, recipientBloodGroup: BloodGroup): boolean {
  const compatibleList = getCompatibleDonorGroups(recipientBloodGroup);
  return compatibleList.includes(donorBloodGroup);
}

/**
 * Inverse lookup: returns which recipient blood groups can receive from a given donor group.
 * Useful for donor awareness and notification campaigns.
 */
export function getCompatibleRecipientGroups(donorBloodGroup: BloodGroup): BloodGroup[] {
  const recipients: BloodGroup[] = [];
  for (const [recipient, donors] of Object.entries(RBC_COMPATIBILITY_MATRIX) as [BloodGroup, BloodGroup[]][]) {
    if (donors.includes(donorBloodGroup)) {
      recipients.push(recipient);
    }
  }
  return recipients;
}
```

### 1.5 Haversine Distance & Geospatial Utilities (`packages/shared/src/geo-utils.ts`)
```typescript
/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371; // Earth's mean radius
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((EARTH_RADIUS_KM * c) * 10) / 10; // Round to 1 decimal place
}

export function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates a bounding box around a center coordinate to allow high-speed index filtering in SQL.
 * (1 degree latitude ≈ 111 km; 1 degree longitude ≈ 111 * cos(lat) km)
 */
export function getBoundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos(toRad(lat)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Formats distance with localized units.
 */
export function formatDistance(distanceKm: number, locale: 'en' | 'hi' = 'en'): string {
  if (locale === 'hi') {
    return `${distanceKm} कि.मी.`;
  }
  return `${distanceKm} km`;
}
```

### 1.6 Shared Zod Schemas (`packages/shared/src/validation.ts`)
```typescript
import { z } from 'zod';
import { BLOOD_GROUPS, COMPONENT_TYPES, EMERGENCY_TYPES, RADIUS_PRESETS, SUPPORTED_LANGUAGES } from './constants';

export const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(phoneRegex, { message: 'Invalid Indian mobile number (+91 or 10 digits starting with 6-9)' })
  .transform((val) => {
    const cleaned = val.replace(/[\s\-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return cleaned;
  });

export const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export const bloodSearchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  bloodGroup: z.enum(BLOOD_GROUPS),
  radiusKm: z.coerce.number().pipe(z.union([z.literal(5), z.literal(10), z.literal(50)])).default(10),
  componentType: z.enum(COMPONENT_TYPES).default('whole_blood'),
  state: z.string().optional(),
  district: z.string().optional(),
});

export const donorRegistrationSchema = z.object({
  phone: phoneSchema,
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional().or(z.literal('')),
  bloodGroup: z.enum(BLOOD_GROUPS),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().min(1, 'State is required'),
  district: z.string().min(1, 'District is required'),
  city: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  weightKg: z.number().min(45, 'Minimum weight for donation is 45 kg').max(200).optional(),
  lastDonationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  isAvailable: z.boolean().default(true),
  searchRadiusKm: z.number().default(10),
  whatsappConsent: z.boolean().refine((val) => val === true, {
    message: 'Consent to receive WhatsApp notifications is required',
  }),
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES).default('en'),
});

export const createBloodRequestSchema = z.object({
  bloodGroupNeeded: z.enum(BLOOD_GROUPS),
  componentType: z.enum(COMPONENT_TYPES).default('whole_blood'),
  unitsNeeded: z.number().int().min(1).max(20).default(1),
  patientName: z.string().min(2, 'Patient name is required'),
  patientAge: z.number().int().min(0).max(120).optional(),
  emergencyType: z.enum(EMERGENCY_TYPES).optional(),
  hospitalName: z.string().min(2, 'Hospital name is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().optional(),
  district: z.string().optional(),
  searchRadiusKm: z.union([z.literal(5), z.literal(10), z.literal(50)]).default(10),
  requesterPhone: phoneSchema.optional(),
  requesterName: z.string().optional(),
});
```

### 1.7 i18n Bilingual Dictionaries (`packages/shared/src/i18n/`)
The application requires seamless bilingual switching (English & Hindi) across all search screens, donor flows, and WhatsApp messages:

```typescript
// packages/shared/src/i18n/en.ts
export const en = {
  common: {
    appName: 'RaktKhoj',
    tagline: 'Emergency Blood Discovery & Routing Engine',
    search: 'Search',
    cancel: 'Cancel',
    loading: 'Loading...',
    km: 'km',
    units: 'units',
    callNow: 'Call Now',
    chatWhatsApp: 'Chat on WhatsApp',
    directions: 'Get Directions',
  },
  bloodSearch: {
    title: 'Find Blood Immediately',
    subtitle: 'Search nearby verified blood banks with live inventory or connect with compatible donors',
    selectBloodGroup: 'Select Blood Group Needed',
    selectComponent: 'Select Component Type',
    enterLocation: 'Enter emergency location or hospital',
    useCurrentLocation: 'Use My Current Location',
    radiusLabel: 'Search Radius',
    radius5km: '5 km (Immediate)',
    radius10km: '10 km (Standard)',
    radius50km: '50 km (Extended)',
    searchBanksButton: 'Search Blood Banks',
    noBanksFound: 'No blood banks with available stock found in this radius.',
    triggeringDonorSearch: 'Falling back to nearby compatible volunteer donors...',
    bloodBankHeader: 'Available Blood Banks Nearby',
    lastUpdated: 'Stock updated',
  },
  donor: {
    registerTitle: 'Become a Life-Saving Donor',
    registerSubtitle: 'Register in under 2 minutes. Receive WhatsApp alerts only when someone nearby urgently needs your blood group.',
    stepPhone: 'Phone Verification',
    stepPersonal: 'Personal Details',
    stepBlood: 'Blood Group',
    stepLocation: 'Location & Radius',
    stepConsent: 'WhatsApp Consent',
    bloodGroupLabel: 'Your Blood Group',
    lastDonatedLabel: 'Last Donation Date',
    availabilityStatus: 'Available to Donate',
    whatsappConsentLabel: 'I consent to receive emergency blood requests via WhatsApp Business Cloud API',
    eligibilityWarning: 'Recently donated. Minimum recommended gap is 90 days for men and 120 days for women.',
    eligibleBadge: 'Eligible Donor',
    readyToDonate: 'I am ready to donate',
    cannotDonate: 'Cannot donate right now',
  },
  waitingRoom: {
    title: 'Emergency Waiting Room',
    requestActive: 'Request Broadcasted to Donors',
    donorsContacted: 'Compatible Donors Notified via WhatsApp',
    awaitingResponses: 'Awaiting donor confirmations in real time...',
    donorAccepted: 'Donor Found! Direct contact details unlocked:',
    allDeclined: 'No donors were able to accept within this radius. Would you like to expand radius to 50 km?',
    expandRadius: 'Expand Radius to 50 km',
  },
  whatsapp: {
    templateHeader: 'Emergency Blood Request — RaktKhoj',
    templateBody: 'Hello {{1}}, a patient urgently needs {{2}} blood at {{3}} ({{4}} away). Can you help save a life?',
    acceptButton: '✅ I Can Donate',
    declineButton: '❌ Not Available',
  },
};

// packages/shared/src/i18n/hi.ts
export const hi: typeof en = {
  common: {
    appName: 'रक्तखोज',
    tagline: 'आपातकालीन रक्त खोज और सहायता प्रणाली',
    search: 'खोजें',
    cancel: 'रद्द करें',
    loading: 'लोड हो रहा है...',
    km: 'कि.मी.',
    units: 'यूनिट',
    callNow: 'अभी कॉल करें',
    chatWhatsApp: 'व्हाट्सएप पर बात करें',
    directions: 'रास्ता देखें',
  },
  bloodSearch: {
    title: 'तत्काल रक्त खोजें',
    subtitle: 'लाइव स्टॉक वाले निकटतम सत्यापित ब्लड बैंक खोजें या संगत रक्तदाताओं से जुड़ें',
    selectBloodGroup: 'आवश्यक रक्त समूह चुनें',
    selectComponent: 'रक्त घटक चुनें',
    enterLocation: 'अस्पताल या आपातकालीन स्थान दर्ज करें',
    useCurrentLocation: 'मेरा वर्तमान स्थान उपयोग करें',
    radiusLabel: 'खोज दायरा',
    radius5km: '5 कि.मी. (नजदीकी)',
    radius10km: '10 कि.मी. (मानक)',
    radius50km: '50 कि.मी. (विस्तृत)',
    searchBanksButton: 'ब्लड बैंक खोजें',
    noBanksFound: 'इस दायरे में उपलब्ध स्टॉक वाला कोई ब्लड बैंक नहीं मिला।',
    triggeringDonorSearch: 'आस-पास के संगत रक्तदाताओं की खोज की जा रही है...',
    bloodBankHeader: 'निकटतम उपलब्ध ब्लड बैंक',
    lastUpdated: 'स्टॉक अपडेट',
  },
  donor: {
    registerTitle: 'जीवनरक्षक रक्तदाता बनें',
    registerSubtitle: '2 मिनट में पंजीकरण करें। केवल तब व्हाट्सएप सूचना पाएं जब आपके नजदीकी क्षेत्र में आपके रक्त समूह की आवश्यकता हो।',
    stepPhone: 'फोन सत्यापन',
    stepPersonal: 'व्यक्तिगत जानकारी',
    stepBlood: 'रक्त समूह',
    stepLocation: 'स्थान और दायरा',
    stepConsent: 'व्हाट्सएप सहमति',
    bloodGroupLabel: 'आपका रक्त समूह',
    lastDonatedLabel: 'अंतिम रक्तदान की तिथि',
    availabilityStatus: 'रक्तदान के लिए उपलब्ध',
    whatsappConsentLabel: 'मैं व्हाट्सएप द्वारा आपातकालीन रक्त अनुरोध प्राप्त करने की सहमति देता/देती हूँ',
    eligibilityWarning: 'हाल ही में रक्तदान किया गया। अनुशंसित अंतराल पुरुषों के लिए 90 दिन और महिलाओं के लिए 120 दिन है।',
    eligibleBadge: 'योग्य रक्तदाता',
    readyToDonate: 'मैं रक्तदान के लिए तैयार हूँ',
    cannotDonate: 'अभी रक्तदान नहीं कर सकता',
  },
  waitingRoom: {
    title: 'आपातकालीन प्रतीक्षा कक्ष',
    requestActive: 'अनुरोध रक्तदाताओं को भेज दिया गया है',
    donorsContacted: 'संगत रक्तदाताओं को व्हाट्सएप द्वारा सूचित किया गया',
    awaitingResponses: 'रक्तदाताओं के उत्तर की प्रतीक्षा हो रही है...',
    donorAccepted: 'रक्तदाता मिल गया! संपर्क विवरण:',
    allDeclined: 'इस दायरे में किसी दाता ने पुष्टि नहीं की। क्या आप 50 कि.मी. तक दायरा बढ़ाना चाहते हैं?',
    expandRadius: 'दायरा बढ़ाकर 50 कि.मी. करें',
  },
  whatsapp: {
    templateHeader: 'आपातकालीन रक्त अनुरोध — रक्तखोज',
    templateBody: 'नमस्ते {{1}}, {{3}} अस्पताल में मरीज को {{2}} रक्त की तत्काल आवश्यकता है (दूरी: {{4}})। क्या आप मदद कर सकते हैं?',
    acceptButton: '✅ मैं दान कर सकता/सकती हूँ',
    declineButton: '❌ अभी उपलब्ध नहीं',
  },
};
```

---

## 2. `packages/db` — Drizzle ORM Schema & Database Architecture

### 2.1 Package Configuration (`packages/db/package.json`)
```json
{
  "name": "@repo/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "check-types": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0"
  },
  "dependencies": {
    "drizzle-orm": "^0.39.0",
    "postgres": "^3.4.5",
    "@repo/shared": "*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.4",
    "@repo/typescript-config": "*",
    "typescript": "7.0.2"
  }
}
```

### 2.2 Drizzle Kit Configuration (`packages/db/drizzle.config.ts`)
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/raktkhoj',
  },
  strict: true,
  verbose: true,
});
```

### 2.3 Detailed 6 Core Table Schemas

#### 1. `users` Table (`packages/db/src/schema/users.ts`)
Stores account identity for seekers, volunteer donors, and administrators.
```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { donorProfiles } from './donor-profiles';
import { bloodRequests } from './blood-requests';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull().unique(), // +91XXXXXXXXXX format
    name: text('name'),
    email: text('email'),
    role: text('role', { enum: ['seeker', 'donor', 'admin'] }).notNull().default('seeker'),
    preferredLanguage: text('preferred_language', { enum: ['en', 'hi'] }).notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_phone_idx').on(table.phone),
    index('users_role_idx').on(table.role),
  ]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  donorProfile: one(donorProfiles, {
    fields: [users.id],
    references: [donorProfiles.userId],
  }),
  bloodRequests: many(bloodRequests),
}));
```

#### 2. `donor_profiles` Table (`packages/db/src/schema/donor-profiles.ts`)
Stores volunteer donor medical attributes, GPS location, and availability.
```typescript
import { pgTable, uuid, text, timestamp, boolean, doublePrecision, date, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { donorNotifications } from './donor-notifications';

export const donorProfiles = pgTable(
  'donor_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    bloodGroup: text('blood_group', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    state: text('state').notNull(),
    district: text('district').notNull(),
    city: text('city'),
    dateOfBirth: date('date_of_birth'),
    gender: text('gender', { enum: ['male', 'female', 'other'] }),
    weightKg: doublePrecision('weight_kg'),
    lastDonationDate: date('last_donation_date'),
    isAvailable: boolean('is_available').default(true).notNull(),
    searchRadiusKm: integer('search_radius_km').default(10).notNull(),
    whatsappConsent: boolean('whatsapp_consent').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('donor_blood_available_idx').on(table.bloodGroup, table.isAvailable, table.whatsappConsent),
    index('donor_location_idx').on(table.latitude, table.longitude),
    index('donor_state_district_idx').on(table.state, table.district),
  ]
);

export const donorProfilesRelations = relations(donorProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [donorProfiles.userId],
    references: [users.id],
  }),
  notifications: many(donorNotifications),
}));
```

#### 3. `blood_requests` Table (`packages/db/src/schema/blood-requests.ts`)
Stores emergency blood requests created by families/patients.
```typescript
import { pgTable, uuid, text, timestamp, integer, doublePrecision, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { donorNotifications } from './donor-notifications';

export const bloodRequests = pgTable(
  'blood_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requesterId: uuid('requester_id').references(() => users.id, { onDelete: 'set null' }),
    bloodGroupNeeded: text('blood_group_needed', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    componentType: text('component_type', {
      enum: ['whole_blood', 'prbc', 'ffp', 'platelets'],
    }).default('whole_blood').notNull(),
    unitsNeeded: integer('units_needed').default(1).notNull(),
    patientName: text('patient_name').notNull(),
    patientAge: integer('patient_age'),
    emergencyType: text('emergency_type', {
      enum: ['surgery', 'accident', 'thalassemia', 'delivery', 'dengue', 'other'],
    }),
    hospitalName: text('hospital_name').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    state: text('state'),
    district: text('district'),
    searchRadiusKm: integer('search_radius_km').default(10).notNull(),
    status: text('status', {
      enum: ['searching', 'bank_found', 'donors_notified', 'fulfilled', 'expired', 'cancelled'],
    }).notNull().default('searching'),
    fulfillmentSource: text('fulfillment_source', { enum: ['blood_bank', 'donor'] }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('requests_status_group_idx').on(table.status, table.bloodGroupNeeded),
    index('requests_location_idx').on(table.latitude, table.longitude),
    index('requests_requester_idx').on(table.requesterId),
  ]
);

export const bloodRequestsRelations = relations(bloodRequests, ({ one, many }) => ({
  requester: one(users, {
    fields: [bloodRequests.requesterId],
    references: [users.id],
  }),
  notifications: many(donorNotifications),
}));
```

#### 4. `donor_notifications` Table (`packages/db/src/schema/donor-notifications.ts`)
Tracks WhatsApp notification delivery and donor response state per request.
```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodRequests } from './blood-requests';
import { donorProfiles } from './donor-profiles';

export const donorNotifications = pgTable(
  'donor_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .references(() => bloodRequests.id, { onDelete: 'cascade' })
      .notNull(),
    donorId: uuid('donor_id')
      .references(() => donorProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    whatsappMessageId: text('whatsapp_message_id'),
    status: text('status', {
      enum: ['pending', 'sent', 'delivered', 'read', 'accepted', 'declined', 'expired', 'failed'],
    }).notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    responseNote: text('response_note'),
  },
  (table) => [
    index('notifications_request_status_idx').on(table.requestId, table.status),
    index('notifications_donor_idx').on(table.donorId),
    index('notifications_whatsapp_id_idx').on(table.whatsappMessageId),
  ]
);

export const donorNotificationsRelations = relations(donorNotifications, ({ one }) => ({
  request: one(bloodRequests, {
    fields: [donorNotifications.requestId],
    references: [bloodRequests.id],
  }),
  donor: one(donorProfiles, {
    fields: [donorNotifications.donorId],
    references: [donorProfiles.id],
  }),
}));
```

#### 5. `blood_banks` Table (`packages/db/src/schema/blood-banks.ts`)
Stores verified blood banks from eRaktKosh and local partner registrations.
```typescript
import { pgTable, uuid, text, timestamp, boolean, doublePrecision, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodStock } from './blood-stock';

export const bloodBanks = pgTable(
  'blood_banks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    licenseNumber: text('license_number'),
    state: text('state').notNull(),
    district: text('district').notNull(),
    city: text('city'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    source: text('source', { enum: ['eraktkosh', 'manual', 'partner'] }).default('manual').notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    lastStockUpdate: timestamp('last_stock_update', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('blood_banks_state_district_idx').on(table.state, table.district),
    index('blood_banks_location_idx').on(table.latitude, table.longitude),
    index('blood_banks_source_idx').on(table.source),
  ]
);

export const bloodBanksRelations = relations(bloodBanks, ({ many }) => ({
  stock: many(bloodStock),
}));
```

#### 6. `blood_stock` Table (`packages/db/src/schema/blood-stock.ts`)
Stores live inventory counts per blood group and component for each bank.
```typescript
import { pgTable, uuid, text, timestamp, integer, date, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { bloodBanks } from './blood-banks';

export const bloodStock = pgTable(
  'blood_stock',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bankId: uuid('bank_id')
      .references(() => bloodBanks.id, { onDelete: 'cascade' })
      .notNull(),
    bloodGroup: text('blood_group', {
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    }).notNull(),
    componentType: text('component_type', {
      enum: ['whole_blood', 'prbc', 'ffp', 'platelets'],
    }).default('whole_blood').notNull(),
    unitsAvailable: integer('units_available').default(0).notNull(),
    earliestExpiry: date('earliest_expiry'),
    lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('stock_bank_group_idx').on(table.bankId, table.bloodGroup, table.componentType),
    index('stock_group_units_idx').on(table.bloodGroup, table.unitsAvailable),
  ]
);

export const bloodStockRelations = relations(bloodStock, ({ one }) => ({
  bank: one(bloodBanks, {
    fields: [bloodStock.bankId],
    references: [bloodBanks.id],
  }),
}));
```

### 2.4 Database Connection Layer (`packages/db/src/index.ts`)
The connection layer provides resilient database access:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL;

// Graceful fallback during build / mock runs when DATABASE_URL is not provided
const client = connectionString
  ? postgres(connectionString, { max: 10, idle_timeout: 20 })
  : (null as unknown as postgres.Sql);

export const db = client ? drizzle(client, { schema }) : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);
export type Database = typeof db;
export * from './schema/index';
```

---

## 3. `apps/api` — Hono.js REST API Architecture & Endpoints

### 3.1 Project Layout
```
apps/api/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                      # Main server & middleware mounting
    ├── routes/
    │   ├── blood-banks.ts           # Blood bank discovery & eRaktKosh proxy
    │   ├── donors.ts                # Donor registration & matching
    │   ├── requests.ts              # Emergency blood requests & waiting room
    │   └── whatsapp-webhook.ts      # WhatsApp Meta webhook & status receipts
    ├── services/
    │   ├── eraktkosh-proxy.ts       # eRaktKosh scraper & cache
    │   ├── donor-matcher.ts         # Distance & compatibility matching engine
    │   ├── whatsapp.ts              # WhatsApp Business Cloud API dispatcher
    │   └── mock-store.ts            # Zero-credential in-memory fallback store
    └── middleware/
        ├── auth.ts                  # Optional Supabase JWT authenticator
        └── error-handler.ts         # Standardized JSON error response
```

### 3.2 Hono Application Entrypoint (`apps/api/src/index.ts`)
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bloodBankRoutes } from './routes/blood-banks';
import { donorRoutes } from './routes/donors';
import { requestRoutes } from './routes/requests';
import { whatsappWebhookRoutes } from './routes/whatsapp-webhook';

const app = new Hono();

// Global Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost dev servers and production domains
      if (!origin || origin.includes('localhost') || origin.includes('raktkhoj')) {
        return origin;
      }
      return 'http://localhost:3000';
    },
    credentials: true,
  })
);

// Global Error Handler
app.onError((err, c) => {
  console.error('[API Error]:', err);
  return c.json(
    {
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    },
    500
  );
});

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        code: 'NOT_FOUND',
      },
    },
    404
  );
});

// Liveness & Readiness Healthcheck
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    app: 'RaktKhoj API',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    features: {
      mockMode: process.env.MOCK_SERVICES === 'true' || !process.env.DATABASE_URL,
      whatsAppMode: process.env.WHATSAPP_ACCESS_TOKEN ? 'live' : 'mock',
    },
  });
});

// Route Mounts
app.route('/api/v1/blood-banks', bloodBankRoutes);
app.route('/api/v1/donors', donorRoutes);
app.route('/api/v1/requests', requestRoutes);
app.route('/api/v1/whatsapp', whatsappWebhookRoutes);

export default {
  port: Number(process.env.API_PORT || 3002),
  fetch: app.fetch,
};
```

### 3.3 Complete Endpoint Inventory

#### Module A: Blood Banks (`/api/v1/blood-banks`)
| Method | Path | Description | Query / Body Schema | Success Response Shape | Status |
|---|---|---|---|---|---|
| `GET` | `/search` | Search blood banks in radius with live stock | Query: `lat` (num), `lng` (num), `bloodGroup` (enum), `radiusKm` (5, 10, 50), `componentType` (optional) | `{ success: true, banks: BloodBankResult[], totalCount: number, source: 'db' \| 'eraktkosh' \| 'mock' }` | `200` |
| `GET` | `/states` | List all Indian states & state codes | None | `{ success: true, states: { code: string; name: string }[] }` | `200` |
| `GET` | `/districts/:stateCode` | List districts for given state code | Param: `stateCode` | `{ success: true, stateCode: string, districts: { code: string; name: string }[] }` | `200` |
| `GET` | `/:id` | Get detailed blood bank profile & stock | Param: `id` (UUID) | `{ success: true, bank: BloodBankDetails }` | `200` / `404` |
| `POST` | `/sync` | Force refresh cache from eRaktKosh | Body: `{ stateCode: string; districtCode: string }` | `{ success: true, syncedCount: number }` | `200` |

#### Module B: Donors (`/api/v1/donors`)
| Method | Path | Description | Query / Body Schema | Success Response Shape | Status |
|---|---|---|---|---|---|
| `POST` | `/register` | Register new volunteer donor | Body: `donorRegistrationSchema` (Zod) | `{ success: true, donorId: string, message: string }` | `201` |
| `GET` | `/profile/:userId` | Get donor profile & donation history | Param: `userId` (UUID) | `{ success: true, profile: DonorProfileData }` | `200` / `404` |
| `PATCH` | `/profile/:userId/availability` | Toggle donor active availability | Body: `{ isAvailable: boolean }` | `{ success: true, isAvailable: boolean }` | `200` |
| `POST` | `/match` | Query candidate donors for request | Body: `{ recipientBloodGroup, latitude, longitude, radiusKm, limit? }` | `{ success: true, matchedCount: number, donors: MatchedDonorSummary[] }` | `200` |
| `POST` | `/respond` | Donor accept/decline action (web fallback) | Body: `{ requestId: string; donorPhone: string; response: 'accept' \| 'decline'; note?: string }` | `{ success: true, status: string, message: string }` | `200` |

#### Module C: Blood Requests & Waiting Room (`/api/v1/requests`)
| Method | Path | Description | Query / Body Schema | Success Response Shape | Status |
|---|---|---|---|---|---|
| `POST` | `/` | Create an emergency blood request | Body: `createBloodRequestSchema` (Zod) | `{ success: true, request: BloodRequestRecord }` | `201` |
| `GET` | `/:id` | Get live request status & waiting room state | Param: `id` (UUID) | `{ success: true, request: RequestDetails, responses: DonorResponseSummary[] }` | `200` / `404` |
| `POST` | `/:id/notify-donors` | Dispatch WhatsApp messages to matched donors | Body: `{ maxDonors?: number; radiusKm?: number }` | `{ success: true, notifiedCount: number, messageIds: string[] }` | `200` |
| `PATCH` | `/:id/status` | Mark request fulfilled or cancelled | Body: `{ status: 'fulfilled' \| 'cancelled'; fulfillmentSource?: 'blood_bank' \| 'donor' }` | `{ success: true, updatedStatus: string }` | `200` |

#### Module D: WhatsApp Webhook (`/api/v1/whatsapp`)
| Method | Path | Description | Parameters / Payload | Success Response | Status |
|---|---|---|---|---|---|
| `GET` | `/webhook` | Meta Webhook Verification challenge | Query: `hub.mode`, `hub.verify_token`, `hub.challenge` | Plain text challenge string | `200` / `403` |
| `POST` | `/webhook` | Inbound WhatsApp status and button clicks | Body: Meta Webhook Event JSON | `{ status: 'EVENT_RECEIVED' }` | `200` |
| `POST` | `/mock-reply` | Dev-only simulated donor button click | Body: `{ requestId: string; donorPhone: string; action: 'accept' \| 'decline' }` | `{ success: true, simulatedAction: string }` | `200` |

---

## 4. Specialized Backend Services

### 4.1 eRaktKosh Proxy Service (`apps/api/src/services/eraktkosh-proxy.ts`)

#### Challenges with eRaktKosh:
1. eRaktKosh does not offer an open public REST API; its portal at `https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt` relies on server-rendered HTML and session state.
2. The proxy must guard against timeouts, website maintenance, and IP throttling.

#### Architecture of `ERaktKoshProxy`:
- **Timeout & Resilience**: HTTP requests timeout after 3500ms; failures trigger silent fallback to local database and mock data.
- **In-Memory TTL Caching**: Results cached for 15 minutes (`TTL = 900,000 ms`) keyed by `state-district-group-component`.
- **Parsing**: Extracts table records (`Blood Bank Name`, `Category` [Govt/Private], `Contact Number`, `Stock Count`, `Last Updated`).
- **Data Normalization**: Converts raw Hindi/English stock strings into standardized numbers and coordinates.

```typescript
export interface ERaktKoshBankItem {
  id: string;
  name: string;
  address: string;
  district: string;
  state: string;
  phone: string;
  bloodGroup: string;
  component: string;
  unitsAvailable: number;
  lastUpdated: string;
  type: 'Govt' | 'Private' | 'Charity';
  latitude?: number;
  longitude?: number;
}

export class ERaktKoshProxy {
  private cache = new Map<string, { timestamp: number; data: ERaktKoshBankItem[] }>();
  private CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  async searchStock(params: {
    stateCode: string;
    districtCode: string;
    bloodGroup: string;
    componentType?: string;
  }): Promise<ERaktKoshBankItem[]> {
    const cacheKey = `${params.stateCode}:${params.districtCode}:${params.bloodGroup}:${params.componentType || 'whole_blood'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(
        `https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RaktKhoj/1.0',
          },
          body: new URLSearchParams({
            stateCode: params.stateCode,
            districtCode: params.districtCode,
            bloodGroup: params.bloodGroup,
          }).toString(),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`eRaktKosh HTTP ${response.status}`);
      }

      const html = await response.text();
      const parsedItems = this.parseHtmlResponse(html, params);

      this.cache.set(cacheKey, { timestamp: Date.now(), data: parsedItems });
      return parsedItems;
    } catch (err) {
      console.warn('[ERaktKoshProxy] Failed or timed out. Falling back to local/mock store.', err);
      return [];
    }
  }

  private parseHtmlResponse(html: string, params: any): ERaktKoshBankItem[] {
    // Regex/Cheerio table extraction logic
    return [];
  }
}
```

### 4.2 Donor Matching Engine (`apps/api/src/services/donor-matcher.ts`)

#### Matching Rules:
1. **ABO/Rh Compatibility**: Calls `getCompatibleDonorGroups(recipientBloodGroup)` to determine allowed donor blood groups.
2. **Geographic Filtering**:
   - Step 1: Pre-filter donors in SQL using `getBoundingBox(lat, lng, radiusKm)`.
   - Step 2: Compute exact `haversineDistance` in application memory.
3. **Availability & Consent**: Donor must have `is_available = true` and `whatsapp_consent = true`.
4. **Soft Eligibility Check**:
   - Computes elapsed days since `last_donation_date`.
   - Thresholds: Men >= 90 days, Women >= 120 days.
   - **Crucial Feature**: Donors who donated recently are **NOT filtered out**; instead, they receive `isEligibleSoft: false` and a localized warning badge (`eligibilityWarning`), allowing the system or user to decide in critical life-or-death situations.
5. **Distance Sorting**: Sorts all candidate donors by ascending distance (`distanceKm`).

```typescript
export interface MatchedDonor {
  id: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  gender: Gender | null;
  distanceKm: number;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  isEligibleSoft: boolean;
  eligibilityWarning: string | null;
  lastDonationDate: string | null;
}

export class DonorMatcher {
  async findCompatibleDonors(params: {
    recipientBloodGroup: BloodGroup;
    latitude: number;
    longitude: number;
    radiusKm: number;
    limit?: number;
  }): Promise<MatchedDonor[]> {
    const compatibleGroups = getCompatibleDonorGroups(params.recipientBloodGroup);
    const box = getBoundingBox(params.latitude, params.longitude, params.radiusKm);

    // Query DB or Mock Store
    const candidates = await this.queryCandidates(compatibleGroups, box);

    const matches: MatchedDonor[] = [];

    for (const donor of candidates) {
      const distance = haversineDistance(
        params.latitude,
        params.longitude,
        donor.latitude,
        donor.longitude
      );

      if (distance <= params.radiusKm) {
        const { isEligibleSoft, warning } = this.evaluateSoftEligibility(
          donor.gender,
          donor.lastDonationDate
        );

        matches.push({
          id: donor.id,
          name: donor.name || 'Anonymous Donor',
          phone: donor.phone,
          bloodGroup: donor.bloodGroup as BloodGroup,
          gender: donor.gender as Gender | null,
          distanceKm: distance,
          latitude: donor.latitude,
          longitude: donor.longitude,
          isAvailable: donor.isAvailable,
          isEligibleSoft,
          eligibilityWarning: warning,
          lastDonationDate: donor.lastDonationDate,
        });
      }
    }

    // Sort nearest first
    matches.sort((a, b) => a.distanceKm - b.distanceKm);

    if (params.limit && matches.length > params.limit) {
      return matches.slice(0, params.limit);
    }

    return matches;
  }

  private evaluateSoftEligibility(
    gender: string | null,
    lastDonationDate: string | null
  ): { isEligibleSoft: boolean; warning: string | null } {
    if (!lastDonationDate) {
      return { isEligibleSoft: true, warning: null };
    }

    const lastDate = new Date(lastDonationDate);
    const diffTime = Math.abs(Date.now() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const requiredInterval = gender === 'female' ? 120 : 90;

    if (diffDays < requiredInterval) {
      return {
        isEligibleSoft: false,
        warning: `Donated ${diffDays} days ago. Medical guideline recommends at least ${requiredInterval} days between donations.`,
      };
    }

    return { isEligibleSoft: true, warning: null };
  }

  private async queryCandidates(groups: BloodGroup[], box: ReturnType<typeof getBoundingBox>) {
    // Queries database or fallback store
    return [];
  }
}
```

### 4.3 WhatsApp Business Cloud API Integration (`apps/api/src/services/whatsapp.ts`)

#### Meta Cloud API Free Test Mode Parameters:
- **Base Endpoint**: `https://graph.facebook.com/v21.0`
- **Phone Number ID**: `process.env.WHATSAPP_PHONE_NUMBER_ID`
- **Temporary Access Token**: Rotates every 24 hours in developer portal; can be replaced with a Permanent System User Token.
- **Free Limit**: Up to 5 registered test phone numbers in Meta Developer Console; 1,000 free service conversations per month.
- **Template Configuration**:
  - Name: `blood_donation_request`
  - Body parameters: `{{1}}` = Donor Name, `{{2}}` = Blood Group Needed, `{{3}}` = Hospital Name, `{{4}}` = Distance away
  - Interactive Quick Reply Buttons:
    - Button 1: "✅ I Can Donate" (`payload: "accept_{requestId}"`)
    - Button 2: "❌ Not Available" (`payload: "decline_{requestId}"`)

#### Inbound Webhook Processing (`POST /api/v1/whatsapp/webhook`):
When a donor taps an interactive button on WhatsApp, Meta sends:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "messages": [
              {
                "from": "919876543210",
                "type": "interactive",
                "interactive": {
                  "type": "button_reply",
                  "button_reply": {
                    "id": "accept_a1b2c3d4-e5f6-7890-abcd-1234567890ab",
                    "title": "✅ I Can Donate"
                  }
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

The service parses `interactive.button_reply.id`:
1. Splits into action (`accept` or `decline`) and `requestId`.
2. Matches donor by phone number `from`.
3. Updates `donor_notifications.status` to `'accepted'` or `'declined'` and sets `responded_at = NOW()`.
4. If `'accepted'`: sets `blood_requests.status = 'fulfilled'` or updates waiting room status so the family can immediately see the donor's contact phone number and WhatsApp direct link.

### 4.4 Comprehensive Mocking Strategy (Zero-Credential Local Development)
To guarantee that any engineer can run the system locally without active Meta developer credentials or live Supabase accounts:

1. **Environment Flag**: `MOCK_SERVICES=true` or automatically inferred if `DATABASE_URL` / `WHATSAPP_ACCESS_TOKEN` is missing.
2. **Mock Blood Banks**: Preloaded with real Delhi NCR, Mumbai, and Bengaluru hospital blood banks (e.g., AIIMS New Delhi, Safdarjung Hospital, Red Cross Blood Bank, KEM Mumbai).
3. **Mock Donors**: Seeded with diverse blood groups, coordinates within 1 km, 5 km, and 12 km of test coordinates, and varying eligibility dates.
4. **Mock WhatsApp Service**:
   - Prints formatted WhatsApp templates to terminal with ASCII blood drop icons.
   - Saves notification records to memory / DB.
   - **Auto-Reply Simulator**: Configurable delay (default 6 seconds). Automatically triggers a mock acceptance event for the request, firing the waiting room state change without requiring a real phone!
   - **Dev Simulation Endpoint**: `POST /api/v1/whatsapp/mock-reply` lets developers trigger explicit accepts/declines for automated testing.

---

## 5. Interface Contracts & API Response Shapes

### 5.1 Common API Response Structure
All Hono endpoints adhere to this envelope pattern:
```typescript
export type ApiResponse<T> =
  | { success: true; data: T; meta?: Record<string, any> }
  | { success: false; error: { message: string; code: string; details?: any } };
```

### 5.2 Specific Interface Contracts

#### Blood Bank Search
```typescript
export interface BloodStockItem {
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  unitsAvailable: number;
  lastUpdated: string;
}

export interface BloodBankSearchResult {
  id: string;
  name: string;
  licenseNumber?: string | null;
  state: string;
  district: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  source: 'eraktkosh' | 'manual' | 'partner';
  isVerified: boolean;
  stock: BloodStockItem[];
}

export interface BloodBankSearchResponse {
  banks: BloodBankSearchResult[];
  totalCount: number;
  searchRadiusKm: number;
  queryCoordinates: { lat: number; lng: number };
  dataSource: 'database' | 'eraktkosh_proxy' | 'mock_fallback';
}
```

#### Donor Profile & Matching
```typescript
export interface DonorProfileData {
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
  gender?: Gender | null;
  weightKg?: number | null;
  lastDonationDate?: string | null;
  isAvailable: boolean;
  searchRadiusKm: number;
  whatsappConsent: boolean;
  preferredLanguage: SupportedLanguage;
}

export interface MatchedDonorSummary {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  isEligibleSoft: boolean;
  eligibilityWarning: string | null;
}
```

#### Blood Request & Waiting Room
```typescript
export interface BloodRequestRecord {
  id: string;
  requesterId?: string | null;
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
  searchRadiusKm: number;
  status: RequestStatus;
  fulfillmentSource?: FulfillmentSource | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface NotifiedDonorStatus {
  notificationId: string;
  donorId: string;
  donorName: string;
  donorPhone: string | null; // Masked until donor accepts!
  bloodGroup: BloodGroup;
  distanceKm: number;
  status: NotificationStatus;
  sentAt?: string | null;
  respondedAt?: string | null;
  directCallUrl?: string | null; // e.g. "tel:+919876543210" (when accepted)
  directWhatsAppUrl?: string | null; // e.g. "https://wa.me/919876543210" (when accepted)
}

export interface WaitingRoomResponse {
  request: BloodRequestRecord;
  donorsNotifiedCount: number;
  acceptedDonors: NotifiedDonorStatus[];
  declinedCount: number;
  pendingCount: number;
}
```

---

## 6. Implementation Prerequisites & Action Items

1. **`packages/shared`**:
   - Create `packages/shared` with package.json, tsconfig.json extending `@repo/typescript-config/base.json`.
   - Implement `blood-compatibility.ts`, `geo-utils.ts`, `validation.ts`, `constants.ts`, and bilingual `i18n` dictionaries (`en.ts` and `hi.ts`).
   - Add unit tests for compatibility matrix edge cases (e.g. AB+ receives from all, O- receives only O-).

2. **`packages/db`**:
   - Create `packages/db` with package.json, drizzle.config.ts, and 6 table schemas.
   - Configure Drizzle ORM relations for seamless relational queries.
   - Generate initial migration files via `bun run db:generate`.

3. **`apps/api`**:
   - Create `apps/api` with Hono.js on Bun.
   - Implement routes (`blood-banks`, `donors`, `requests`, `whatsapp-webhook`).
   - Implement services (`ERaktKoshProxy`, `DonorMatcher`, `WhatsAppService`, `MockStore`).
   - Add graceful fallback mode when environment credentials are unset.

---

## 7. Conclusion
The proposed architecture provides a robust, decoupled, and highly performant backend for RaktKhoj. By placing domain logic in `packages/shared` and utilizing Drizzle ORM in `packages/db`, the system ensures end-to-end type safety. The combination of live eRaktKosh scraping with fallback to WhatsApp-notified volunteer donors directly fulfills the project's life-saving mission.
