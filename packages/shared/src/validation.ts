import { z } from 'zod';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  EMERGENCY_TYPES,
  SUPPORTED_LANGUAGES,
  MIN_DONOR_AGE,
  MAX_DONOR_AGE,
  MIN_DONOR_WEIGHT_KG,
  MAX_DONOR_WEIGHT_KG,
  DONATION_INTERVAL_DAYS,
  type Gender,
} from './constants';

export const phoneRegex = /^(\+?91[\-\s]?)?[6789]\d{9}$/;

export const phoneSchema = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    let cleaned = val.trim().replace(/[\s\-\(\)]/g, '');
    if (/^0[6789]\d{9}$/.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
    if (/^91[6789]\d{9}$/.test(cleaned)) {
      cleaned = `+${cleaned}`;
    } else if (/^[6789]\d{9}$/.test(cleaned)) {
      cleaned = `+91${cleaned}`;
    }
    return cleaned;
  },
  z
    .string()
    .regex(/^\+91[6789]\d{9}$/, {
      message: 'Invalid Indian mobile number (+91 or 10 digits starting with 6-9)',
    })
);

export function calculateAgeInYears(dateOfBirth: string, refDate = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = refDate.getFullYear() - dob.getFullYear();
  const m = refDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function evaluateDonorMedicalEligibility(input: {
  dateOfBirth?: string | null;
  gender?: Gender | string | null;
  weightKg?: number | null;
  lastDonationDate?: string | null;
  referenceDate?: Date;
}): { isEligible: boolean; failureReasons: string[]; daysRemainingOnCooldown: number } {
  const reasons: string[] = [];
  const refDate = input.referenceDate || new Date();
  let daysRemaining = 0;

  if (input.dateOfBirth) {
    const age = calculateAgeInYears(input.dateOfBirth, refDate);
    if (age < MIN_DONOR_AGE) {
      reasons.push(`Donor age (${age}) is below minimum required age of ${MIN_DONOR_AGE}`);
    } else if (age > MAX_DONOR_AGE) {
      reasons.push(`Donor age (${age}) exceeds maximum allowed donation age of ${MAX_DONOR_AGE}`);
    }
  }

  if (input.weightKg !== undefined && input.weightKg !== null) {
    if (input.weightKg < MIN_DONOR_WEIGHT_KG) {
      reasons.push(`Donor weight (${input.weightKg} kg) is below the minimum required ${MIN_DONOR_WEIGHT_KG} kg`);
    } else if (input.weightKg > MAX_DONOR_WEIGHT_KG) {
      reasons.push(`Donor weight (${input.weightKg} kg) exceeds acceptable limit of ${MAX_DONOR_WEIGHT_KG} kg`);
    }
  }

  if (input.lastDonationDate) {
    const lastDate = new Date(input.lastDonationDate);
    if (lastDate.getTime() > refDate.getTime()) {
      reasons.push('Last donation date cannot be in the future');
    } else {
      const normGender = ((input.gender || 'male').toLowerCase()) as Gender;
      const requiredInterval = DONATION_INTERVAL_DAYS[normGender] || 90;
      const diffTime = refDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < requiredInterval) {
        daysRemaining = requiredInterval - diffDays;
        reasons.push(
          `Cooldown active: donor donated ${diffDays} days ago (${daysRemaining} days remaining for ${normGender})`
        );
      }
    }
  }

  return {
    isEligible: reasons.length === 0,
    failureReasons: reasons,
    daysRemainingOnCooldown: daysRemaining,
  };
}

const coordinateField = (min: number, max: number, fieldName: string) =>
  z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (
      val === null ||
      typeof val === 'boolean' ||
      Array.isArray(val) ||
      (typeof val === 'object' && val !== null)
    ) {
      return NaN;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return NaN;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : NaN;
    }
    if (typeof val === 'number') {
      return Number.isFinite(val) ? val : NaN;
    }
    return NaN;
  }, z.number({ message: `${fieldName} must be a valid number between ${min} and ${max}` }).min(min).max(max));

export const coordinatesSchema = z.object({
  latitude: coordinateField(-90, 90, 'Latitude'),
  longitude: coordinateField(-180, 180, 'Longitude'),
});

export const bloodSearchQuerySchema = z.object({
  lat: coordinateField(-90, 90, 'Latitude'),
  lng: coordinateField(-180, 180, 'Longitude'),
  bloodGroup: z.enum(BLOOD_GROUPS),
  radiusKm: z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (
      val === null ||
      typeof val === 'boolean' ||
      Array.isArray(val) ||
      (typeof val === 'object' && val !== null)
    ) {
      return NaN;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return NaN;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : NaN;
    }
    return val;
  }, z.union([z.literal(5), z.literal(10), z.literal(50)]).default(10)),
  componentType: z.enum(COMPONENT_TYPES).default('whole_blood'),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
});

export const donorRegistrationSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Invalid blood group' }) }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().trim().min(1, 'State is required'),
  district: z.string().trim().min(1, 'District is required'),
  city: z.string().trim().optional().nullable(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .refine((dob) => {
      const age = calculateAgeInYears(dob);
      return age >= MIN_DONOR_AGE && age <= MAX_DONOR_AGE;
    }, {
      message: `Donor age must be between ${MIN_DONOR_AGE} and ${MAX_DONOR_AGE} years`,
    })
    .optional()
    .nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  weightKg: z
    .number()
    .min(MIN_DONOR_WEIGHT_KG, `Minimum weight for donation is ${MIN_DONOR_WEIGHT_KG} kg`)
    .max(MAX_DONOR_WEIGHT_KG)
    .optional()
    .nullable(),
  lastDonationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => new Date(d).getTime() <= Date.now(), {
      message: 'Last donation date cannot be in the future',
    })
    .optional()
    .nullable(),
  isAvailable: z.boolean().default(true),
  searchRadiusKm: z.number().min(1).max(50, 'Search radius cannot exceed 50 km').default(10),
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES).default('en'),
  verificationTicket: z.string().optional().nullable(),
});

export const createBloodRequestSchema = z.object({
  bloodGroupNeeded: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Invalid blood group needed' }) }),
  componentType: z.enum(COMPONENT_TYPES).default('whole_blood'),
  unitsNeeded: z.number().int().min(1).max(20).default(1),
  patientName: z.string().trim().min(2, 'Patient name must be at least 2 characters'),
  patientAge: z.number().int().min(0).max(120).optional(),
  emergencyType: z.enum(EMERGENCY_TYPES).optional(),
  hospitalName: z.string().trim().min(2, 'Hospital name must be at least 2 characters'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  searchRadiusKm: z
    .union([z.literal(5), z.literal(10), z.literal(50)])
    .default(10),
  requesterPhone: phoneSchema.optional(),
  requesterName: z.string().trim().optional(),
  verificationTicket: z.string().optional(),
});

export const authOtpSendSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['donor_registration', 'emergency_request']).default('donor_registration'),
});

export const authOtpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6-digit code'),
  purpose: z.enum(['donor_registration', 'emergency_request']).default('donor_registration'),
});
