import type {
  BloodGroup,
  ComponentType,
  EmergencyType,
  UserRole,
  SupportedLanguage,
  RadiusPreset,
  RequestStatus,
  NotificationStatus,
  FulfillmentSource,
  BloodBankSource,
  Gender,
} from './constants';

export type {
  BloodGroup,
  ComponentType,
  EmergencyType,
  UserRole,
  SupportedLanguage,
  RadiusPreset,
  RequestStatus,
  NotificationStatus,
  FulfillmentSource,  
  BloodBankSource,
  Gender,
};

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  preferredLanguage: SupportedLanguage;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DonorProfile {
  id: string;
  userId: string;
  bloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  city: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  weightKg: number | null;
  lastDonationDate: string | null;
  isAvailable: boolean;
  searchRadiusKm: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BloodRequest {
  id: string;
  requesterId: string | null;
  bloodGroupNeeded: BloodGroup;
  componentType: ComponentType;
  unitsNeeded: number;
  patientName: string;
  patientAge: number | null;
  emergencyType: EmergencyType | null;
  hospitalName: string;
  latitude: number;
  longitude: number;
  state: string | null;
  district: string | null;
  searchRadiusKm: number;
  status: RequestStatus;
  fulfillmentSource: FulfillmentSource | null;
  createdAt: Date | string;
  expiresAt: Date | string | null;
}

export interface DonorNotification {
  id: string;
  requestId: string;
  donorId: string;
  pushMessageId: string | null;
  status: NotificationStatus;
  sentAt: Date | string | null;
  respondedAt: Date | string | null;
  responseNote: string | null;
}

export interface BloodBank {
  id: string;
  name: string;
  licenseNumber: string | null;
  state: string;
  district: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  source: BloodBankSource;
  isVerified: boolean;
  lastStockUpdate: Date | string | null;
  createdAt: Date | string;
}

export interface BloodStock {
  id: string;
  bankId: string;
  bloodGroup: BloodGroup;
  componentType: ComponentType;
  unitsAvailable: number;
  earliestExpiry: string | null;
  lastUpdated: Date | string;
}

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
  distanceKm: number | null;
  stock: StockItem[];
  isVerified: boolean;
  source: BloodBankSource;
  lastStockUpdate: string | null;
}

export interface AcceptedDonorContact {
  donorId: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  distanceKm: number;
  respondedAt: string;
  directCallUrl?: string;
}

export interface DonorNotificationSummary {
  id: string;
  donorId: string;
  status: NotificationStatus;
  sentAt: string | null;
  respondedAt: string | null;
  donorName?: string;
  donorBloodGroup?: BloodGroup;
  donorPhoneMasked?: string;
}

export interface BloodSearchQuery {
  lat: number;
  lng: number;
  bloodGroup: BloodGroup;
  radiusKm?: RadiusPreset;
  componentType?: ComponentType;
  state?: string;
  district?: string;
}

export interface DonorRegistrationInput {
  phone: string;
  name: string;
  email?: string;
  bloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  city?: string;
  dateOfBirth?: string;
  gender?: Gender;
  weightKg?: number;
  lastDonationDate?: string;
  isAvailable?: boolean;
  searchRadiusKm?: number;
  preferredLanguage?: SupportedLanguage;
}

export interface CreateBloodRequestInput {
  bloodGroupNeeded: BloodGroup;
  componentType?: ComponentType;
  unitsNeeded?: number;
  patientName: string;
  patientAge?: number;
  emergencyType?: EmergencyType;
  hospitalName: string;
  latitude: number;
  longitude: number;
  state?: string;
  district?: string;
  searchRadiusKm?: RadiusPreset;
  requesterPhone?: string;
  requesterName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
