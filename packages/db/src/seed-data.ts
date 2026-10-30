import {
  type BloodBankCardData,
  type DonorProfile,
  type BloodGroup,
  type ComponentType,
  INDIA_STATES_DATA,
  getDistrictsForState,
} from '@repo/shared';

export interface SeedUser {
  id: string;
  phone: string;
  name: string;
  email: string;
  role: 'seeker' | 'donor' | 'admin';
  preferredLanguage: 'en' | 'hi';
}

export interface SeedDonor {
  id: string;
  userId: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  city: string | null;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | 'other';
  weightKg: number | null;
  lastDonationDate: string | null;
  isAvailable: boolean;
  searchRadiusKm: number;
  whatsappConsent: boolean;
  preferredLanguage: 'en' | 'hi';
  createdAt: string;
}

export interface SeedBloodBank {
  id: string;
  name: string;
  licenseNumber: string;
  state: string;
  district: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  source: 'eraktkosh' | 'manual' | 'partner';
  isVerified: boolean;
  lastStockUpdate: string;
  stock: Array<{
    bloodGroup: BloodGroup;
    componentType: ComponentType;
    unitsAvailable: number;
    earliestExpiry?: string;
  }>;
}

export const SEED_BLOOD_BANKS: SeedBloodBank[] = [
  {
    id: 'bank-aiims-delhi',
    name: 'AIIMS Main Blood Bank',
    licenseNumber: 'DL-BB-1001',
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    address: 'Ansari Nagar, New Delhi 110029',
    phone: '+911126593201',
    email: 'bloodbank@aiims.edu',
    latitude: 28.5672,
    longitude: 77.21,
    source: 'eraktkosh',
    isVerified: true,
    lastStockUpdate: '2026-10-30T04:30:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 5 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 8 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 4 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'A+', componentType: 'prbc', unitsAvailable: 12 },
      { bloodGroup: 'O+', componentType: 'prbc', unitsAvailable: 15 },
      { bloodGroup: 'B+', componentType: 'platelets', unitsAvailable: 6 },
    ],
  },
  {
    id: 'bank-safdarjung-delhi',
    name: 'Safdarjung Hospital Regional Blood Centre',
    licenseNumber: 'DL-BB-1002',
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    address: 'Ring Road, opposite AIIMS, New Delhi 110029',
    phone: '+911126165060',
    email: 'blood@safdarjung.nic.in',
    latitude: 28.57,
    longitude: 77.208,
    source: 'eraktkosh',
    isVerified: true,
    lastStockUpdate: '2026-10-30T04:45:00Z',
    stock: [
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 3 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 5 },
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
    ],
  },
  {
    id: 'bank-max-saket',
    name: 'Max Super Speciality Hospital Blood Bank Saket',
    licenseNumber: 'DL-BB-1004',
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    address: '1, 2, Press Enclave Road, Mandir Marg, Saket, New Delhi 110017',
    phone: '+911126515050',
    email: 'bloodbank.saket@maxhealthcare.com',
    latitude: 28.5273,
    longitude: 77.2144,
    source: 'partner',
    isVerified: true,
    lastStockUpdate: '2026-10-30T05:15:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 7 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 9 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 11 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 4 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
    ],
  },
  {
    id: 'bank-fortis-vasant-kunj',
    name: 'Fortis Hospital Blood Bank Vasant Kunj',
    licenseNumber: 'DL-BB-1005',
    state: 'Delhi',
    district: 'South West Delhi',
    city: 'New Delhi',
    address: 'Sector B, Pocket 1, Aruna Asaf Ali Marg, Vasant Kunj, New Delhi 110070',
    phone: '+911142776222',
    email: 'bloodbank.vk@fortishealthcare.com',
    latitude: 28.519,
    longitude: 77.1578,
    source: 'partner',
    isVerified: true,
    lastStockUpdate: '2026-10-30T04:10:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 6 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 4 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 8 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
    ],
  },
  {
    id: 'bank-red-cross-delhi',
    name: 'Indian Red Cross Society National HQ Blood Bank',
    licenseNumber: 'DL-BB-1003',
    state: 'Delhi',
    district: 'Central Delhi',
    city: 'New Delhi',
    address: '1 Red Cross Road, New Delhi 110001',
    phone: '+911123716441',
    email: 'ircs@redcrossblood.in',
    latitude: 28.621,
    longitude: 77.208,
    source: 'eraktkosh',
    isVerified: true,
    lastStockUpdate: '2026-10-30T05:00:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 10 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 8 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 12 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 3 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
    ],
  },
  {
    id: 'bank-kgmu-lucknow',
    name: "King George's Medical University Blood Bank",
    licenseNumber: 'UP-BB-3001',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    city: 'Lucknow',
    address: 'Shah Mina Road, Chowk, Lucknow, Uttar Pradesh 226003',
    phone: '+915222257540',
    email: 'bloodbank@kgmcindia.edu',
    latitude: 26.869,
    longitude: 80.916,
    source: 'eraktkosh',
    isVerified: true,
    lastStockUpdate: '2026-10-30T04:00:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 8 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 14 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 10 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 3 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 1 },
    ],
  },
  {
    id: 'bank-rotary-noida',
    name: 'Rotary Blood Bank Noida',
    licenseNumber: 'UP-BB-2005',
    state: 'Uttar Pradesh',
    district: 'Gautam Buddha Nagar',
    city: 'Noida',
    address: 'Sector 31, Noida, Uttar Pradesh 201301',
    phone: '+911202456789',
    email: 'noida@rotarybloodbank.org',
    latitude: 28.583,
    longitude: 77.345,
    source: 'partner',
    isVerified: true,
    lastStockUpdate: '2026-10-30T03:00:00Z',
    stock: [
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 2 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 1 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 15 },
    ],
  },
  {
    id: 'bank-empty-lifeline',
    name: 'LifeLine Blood Bank Saket',
    licenseNumber: 'DL-BB-1099',
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    address: 'J-Block Saket, New Delhi 110017',
    phone: '+911141234567',
    email: 'info@lifelinesaket.in',
    latitude: 28.528,
    longitude: 77.215,
    source: 'manual',
    isVerified: false,
    lastStockUpdate: '2026-10-29T10:00:00Z',
    stock: [
      { bloodGroup: 'A+', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'O+', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'B+', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'AB+', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'O-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'A-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'B-', componentType: 'whole_blood', unitsAvailable: 0 },
      { bloodGroup: 'AB-', componentType: 'whole_blood', unitsAvailable: 0 },
    ],
  },
];

export const SEED_USERS: SeedUser[] = [
  {
    id: 'user-1',
    phone: '+919876543210',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-2',
    phone: '+919811122233',
    name: 'Priya Verma',
    email: 'priya.verma@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
  {
    id: 'user-3',
    phone: '+919822233344',
    name: 'Amit Patel',
    email: 'amit.patel@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-4',
    phone: '+919833344455',
    name: 'Vikram Singh',
    email: 'vikram.singh@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
  {
    id: 'user-5',
    phone: '+919844455566',
    name: 'Sunita Rao',
    email: 'sunita.rao@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-6',
    phone: '+919855566677',
    name: 'Neha Gupta',
    email: 'neha.gupta@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-7',
    phone: '+919866677788',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
  {
    id: 'user-8',
    phone: '+919877788899',
    name: 'Manish Joshi',
    email: 'manish.joshi@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-9',
    phone: '+919888899900',
    name: 'Rohit Yadav',
    email: 'rohit.yadav@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
  {
    id: 'user-10',
    phone: '+919899900011',
    name: 'Dr. Alok Tripathi',
    email: 'alok.tripathi@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
  {
    id: 'user-11',
    phone: '+919911223344',
    name: 'Ananya Mishra',
    email: 'ananya.mishra@example.com',
    role: 'donor',
    preferredLanguage: 'en',
  },
  {
    id: 'user-12',
    phone: '+919922334455',
    name: 'Deepak Choudhary',
    email: 'deepak.c@example.com',
    role: 'donor',
    preferredLanguage: 'hi',
  },
];

export const SEED_DONORS: SeedDonor[] = [
  {
    id: 'donor-rahul-a-pos',
    userId: 'user-1',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    bloodGroup: 'A+',
    latitude: 28.57,
    longitude: 77.208, // Near Safdarjung Hospital (~0.37km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '1994-05-15',
    gender: 'male',
    weightKg: 72,
    lastDonationDate: '2026-05-01', // ~180 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'en',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'donor-priya-o-neg',
    userId: 'user-2',
    name: 'Priya Verma',
    phone: '+919811122233',
    bloodGroup: 'O-', // Universal Donor
    latitude: 28.568,
    longitude: 77.211, // AIIMS Campus (~0.15km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '1998-08-20',
    gender: 'female',
    weightKg: 58,
    lastDonationDate: '2026-06-15', // ~137 days ago (>120 days female, eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'donor-amit-ab-neg',
    userId: 'user-3',
    name: 'Amit Patel',
    phone: '+919822233344',
    bloodGroup: 'AB-', // Rare Blood Group
    latitude: 28.53,
    longitude: 77.215, // Malviya Nagar (~4.1km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '1990-11-05',
    gender: 'male',
    weightKg: 68,
    lastDonationDate: '2026-04-10', // ~203 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'en',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'donor-vikram-b-pos',
    userId: 'user-4',
    name: 'Vikram Singh',
    phone: '+919833344455',
    bloodGroup: 'B+',
    latitude: 28.519,
    longitude: 77.1578, // Vasant Kunj (~7.35km from AIIMS)
    state: 'Delhi',
    district: 'South West Delhi',
    city: 'New Delhi',
    dateOfBirth: '1988-03-12',
    gender: 'male',
    weightKg: 80,
    lastDonationDate: '2026-07-01', // ~121 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'donor-sunita-o-pos-gurgaon',
    userId: 'user-5',
    name: 'Sunita Rao',
    phone: '+919844455566',
    bloodGroup: 'O+',
    latitude: 28.4395,
    longitude: 77.0423, // Gurugram (~21.5km from AIIMS)
    state: 'Haryana',
    district: 'Gurugram',
    city: 'Gurugram',
    dateOfBirth: '1992-09-18',
    gender: 'female',
    weightKg: 62,
    lastDonationDate: '2026-05-20', // ~163 days ago (eligible)
    isAvailable: true,
    searchRadiusKm: 50,
    whatsappConsent: true,
    preferredLanguage: 'en',
    createdAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'donor-neha-recent-warning',
    userId: 'user-6',
    name: 'Neha Gupta',
    phone: '+919855566677',
    bloodGroup: 'A+',
    latitude: 28.555,
    longitude: 77.205, // Green Park (~1.4km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '2000-01-25',
    gender: 'female',
    weightKg: 54,
    lastDonationDate: '2026-09-25', // 35 days ago (< 120 days female, soft warning)
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'en',
    createdAt: '2026-04-10T00:00:00Z',
  },
  {
    id: 'donor-rajesh-unavailable',
    userId: 'user-7',
    name: 'Rajesh Kumar',
    phone: '+919866677788',
    bloodGroup: 'A+',
    latitude: 28.545,
    longitude: 77.2, // Hauz Khas (~2.6km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '1985-07-30',
    gender: 'male',
    weightKg: 75,
    lastDonationDate: '2026-01-15',
    isAvailable: false, // UNAVAILABLE
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-01-20T00:00:00Z',
  },
  {
    id: 'donor-manish-no-consent',
    userId: 'user-8',
    name: 'Manish Joshi',
    phone: '+919877788899',
    bloodGroup: 'A+',
    latitude: 28.535,
    longitude: 77.21, // Saket (~3.6km from AIIMS)
    state: 'Delhi',
    district: 'South Delhi',
    city: 'New Delhi',
    dateOfBirth: '1996-12-04',
    gender: 'male',
    weightKg: 70,
    lastDonationDate: '2026-02-10',
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: false, // NO WHATSAPP CONSENT
    preferredLanguage: 'en',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'donor-rohit-b-neg-meerut',
    userId: 'user-9',
    name: 'Rohit Yadav',
    phone: '+919888899900',
    bloodGroup: 'B-',
    latitude: 28.9845,
    longitude: 77.7064, // Meerut (~66.5km from AIIMS)
    state: 'Uttar Pradesh',
    district: 'Meerut',
    city: 'Meerut',
    dateOfBirth: '1993-04-18',
    gender: 'male',
    weightKg: 74,
    lastDonationDate: '2026-03-01',
    isAvailable: true,
    searchRadiusKm: 50,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'donor-alok-ab-pos-lucknow',
    userId: 'user-10',
    name: 'Dr. Alok Tripathi',
    phone: '+919899900011',
    bloodGroup: 'AB+', // Universal Recipient group
    latitude: 26.869,
    longitude: 80.916, // KGMU Campus Lucknow
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    city: 'Lucknow',
    dateOfBirth: '1987-09-14',
    gender: 'male',
    weightKg: 78,
    lastDonationDate: '2026-05-10',
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-03-12T00:00:00Z',
  },
  {
    id: 'donor-ananya-o-neg-lucknow',
    userId: 'user-11',
    name: 'Ananya Mishra',
    phone: '+919911223344',
    bloodGroup: 'O-', // Universal Donor in Lucknow
    latitude: 26.858,
    longitude: 80.932, // Hazratganj Lucknow (~1.9km from KGMU)
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    city: 'Lucknow',
    dateOfBirth: '1997-02-28',
    gender: 'female',
    weightKg: 56,
    lastDonationDate: '2026-04-05',
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'en',
    createdAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'donor-deepak-b-pos-delhi',
    userId: 'user-12',
    name: 'Deepak Choudhary',
    phone: '+919922334455',
    bloodGroup: 'B+',
    latitude: 28.621,
    longitude: 77.208, // Connaught Place / Central Delhi (~5.98km from AIIMS)
    state: 'Delhi',
    district: 'Central Delhi',
    city: 'New Delhi',
    dateOfBirth: '1995-11-22',
    gender: 'male',
    weightKg: 73,
    lastDonationDate: '2026-06-20',
    isAvailable: true,
    searchRadiusKm: 10,
    whatsappConsent: true,
    preferredLanguage: 'hi',
    createdAt: '2026-03-20T00:00:00Z',
  },
];

const STATE_2LETTER_CODES: Record<string, string> = {
  'Andaman and Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chandigarh': 'CH',
  'Chhattisgarh': 'CG',
  'Dadra And Nagar Haveli And Daman And Diu': 'DH',
  'Delhi': 'DL',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OD',
  'Puducherry': 'PY',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TS',
  'Tripura': 'TR',
  'Uttarakhand': 'UK',
  'Uttar Pradesh': 'UP',
  'West Bengal': 'WB',
};

// Build comprehensive Pan-India master registry with both short codes & full state names
export const STATES_AND_DISTRICTS: Record<string, { name: string; districts: string[] }> = (() => {
  const result: Record<string, { name: string; districts: string[] }> = {};

  for (const [stateName, stateInfo] of Object.entries(INDIA_STATES_DATA)) {
    const districts = stateInfo.districts.map((d) => d.name);
    const entry = { name: stateName, districts };

    // Keyed by state name
    result[stateName] = entry;

    // Keyed by 2-letter abbreviation if available
    const twoLetter = STATE_2LETTER_CODES[stateName];
    if (twoLetter) {
      result[twoLetter] = entry;
    }

    // Keyed by eRaktKosh numeric code
    if (stateInfo.code) {
      result[stateInfo.code] = entry;
    }
  }

  return result;
})();

