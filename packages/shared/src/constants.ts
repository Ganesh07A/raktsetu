export const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const COMPONENT_TYPES = [
  'whole_blood',
  'prbc',
  'ffp',
  'platelets',
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const EMERGENCY_TYPES = [
  'surgery',
  'accident',
  'thalassemia',
  'delivery',
  'dengue',
  'other',
] as const;
export type EmergencyType = (typeof EMERGENCY_TYPES)[number];

export const USER_ROLES = ['seeker', 'donor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const RADIUS_PRESETS = [5, 10, 50] as const;
export type RadiusPreset = (typeof RADIUS_PRESETS)[number];

export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const ELIGIBILITY_MALE_DAYS = 90;
export const ELIGIBILITY_FEMALE_DAYS = 120;

export const REQUEST_STATUSES = [
  'searching',
  'bank_found',
  'donors_notified',
  'fulfilled',
  'expired',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const NOTIFICATION_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'read',
  'accepted',
  'declined',
  'expired',
  'failed',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const FULFILLMENT_SOURCES = ['blood_bank', 'donor'] as const;
export type FulfillmentSource = (typeof FULFILLMENT_SOURCES)[number];

export const BLOOD_BANK_SOURCES = ['eraktkosh', 'manual', 'partner'] as const;
export type BloodBankSource = (typeof BLOOD_BANK_SOURCES)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Standard donation intervals (in days) according to medical norms in India:
 * - Men: minimum 90 days (approx. 3 months)
 * - Women: minimum 120 days (approx. 4 months)
 * - Other: defaulted to 90 days
 */
export const DONATION_INTERVAL_DAYS: Record<Gender, number> = {
  male: ELIGIBILITY_MALE_DAYS,
  female: ELIGIBILITY_FEMALE_DAYS,
  other: ELIGIBILITY_MALE_DAYS,
};
