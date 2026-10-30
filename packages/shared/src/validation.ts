import { z } from 'zod';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  EMERGENCY_TYPES,
  SUPPORTED_LANGUAGES,
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
  email: z.string().trim().email().optional().or(z.literal('')),
  bloodGroup: z.enum(BLOOD_GROUPS),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().trim().min(1, 'State is required'),
  district: z.string().trim().min(1, 'District is required'),
  city: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  weightKg: z
    .number()
    .min(45, 'Minimum weight for donation is 45 kg')
    .max(200)
    .optional(),
  lastDonationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
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
  patientName: z.string().trim().min(2, 'Patient name is required'),
  patientAge: z.number().int().min(0).max(120).optional(),
  emergencyType: z.enum(EMERGENCY_TYPES).optional(),
  hospitalName: z.string().trim().min(2, 'Hospital name is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  state: z.string().trim().optional(),
  district: z.string().trim().optional(),
  searchRadiusKm: z
    .union([z.literal(5), z.literal(10), z.literal(50)])
    .default(10),
  requesterPhone: phoneSchema.optional(),
  requesterName: z.string().trim().optional(),
});
