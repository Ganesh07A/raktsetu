import { haversineDistance } from '@repo/shared';

export interface NearbyHospital {
  id: string;
  name: string;
  distanceKm: number | null;
  city: string;
  lat: number;
  lng: number;
  type: 'Charitable/Vol' | 'Private' | 'Government';
}

// Curated verified hospitals directory for key districts across India
const CURATED_DISTRICT_HOSPITALS: Record<string, Omit<NearbyHospital, 'distanceKm'>[]> = {
  // --- Maharashtra ---
  'Mumbai': [
    { id: 'mh-kem', name: 'KEM Hospital & Seth G.S. Medical College', city: 'Parel, Mumbai', lat: 19.0028, lng: 72.8427, type: 'Government' },
    { id: 'mh-lilavati', name: 'Lilavati Hospital & Research Centre', city: 'Bandra West, Mumbai', lat: 19.0514, lng: 72.8291, type: 'Charitable/Vol' },
    { id: 'mh-sion', name: 'Lokmanya Tilak Municipal General Hospital (Sion)', city: 'Sion, Mumbai', lat: 19.0381, lng: 72.8601, type: 'Government' },
    { id: 'mh-tata', name: 'Tata Memorial Centre & Hospital', city: 'Parel, Mumbai', lat: 19.0049, lng: 72.8434, type: 'Government' },
    { id: 'mh-hinduja', name: 'P.D. Hinduja National Hospital', city: 'Mahim, Mumbai', lat: 19.033, lng: 72.8398, type: 'Charitable/Vol' },
    { id: 'mh-bombay', name: 'Bombay Hospital & Medical Research Centre', city: 'Marine Lines, Mumbai', lat: 18.9405, lng: 72.8286, type: 'Charitable/Vol' },
    { id: 'mh-reliance', name: 'Sir H.N. Reliance Foundation Hospital', city: 'Girgaon, Mumbai', lat: 18.9568, lng: 72.8184, type: 'Private' },
  ],
  'Mumbai Suburban': [
    { id: 'mh-kokilaben', name: 'Kokilaben Dhirubhai Ambani Hospital', city: 'Andheri West, Mumbai', lat: 19.1317, lng: 72.8252, type: 'Private' },
    { id: 'mh-lilavati-sub', name: 'Lilavati Hospital & Research Centre', city: 'Bandra West, Mumbai', lat: 19.0514, lng: 72.8291, type: 'Charitable/Vol' },
    { id: 'mh-nanavati', name: 'Nanavati Max Super Speciality Hospital', city: 'Vile Parle, Mumbai', lat: 19.0988, lng: 72.8423, type: 'Private' },
    { id: 'mh-hiranandani', name: 'Dr L H Hiranandani Hospital', city: 'Powai, Mumbai', lat: 19.1197, lng: 72.9051, type: 'Private' },
    { id: 'mh-bhabha', name: 'K.B. Bhabha Municipal Hospital', city: 'Bandra West, Mumbai', lat: 19.0573, lng: 72.8329, type: 'Government' },
    { id: 'mh-cooper', name: 'R.N. Cooper Municipal General Hospital', city: 'Juhu, Mumbai', lat: 19.1084, lng: 72.8361, type: 'Government' },
  ],
  'Pune': [
    { id: 'mh-sassoon', name: 'Sassoon General Hospital & B.J. Medical College', city: 'Station Road, Pune', lat: 18.5256, lng: 73.8742, type: 'Government' },
    { id: 'mh-ruby', name: 'Ruby Hall Clinic Pune', city: 'Sassoon Road, Pune', lat: 18.5323, lng: 73.8776, type: 'Charitable/Vol' },
    { id: 'mh-jehangir', name: 'Jehangir Hospital', city: 'Sasoon Road, Pune', lat: 18.5284, lng: 73.8759, type: 'Charitable/Vol' },
    { id: 'mh-deenanath', name: 'Deenanath Mangeshkar Hospital & Research Center', city: 'Erandwane, Pune', lat: 18.4998, lng: 73.8315, type: 'Charitable/Vol' },
    { id: 'mh-sahyadri', name: 'Sahyadri Super Speciality Hospital', city: 'Deccan Gymkhana, Pune', lat: 18.5147, lng: 73.8407, type: 'Private' },
    { id: 'mh-ycm', name: 'Yashwantrao Chavan Memorial (YCM) Hospital', city: 'Pimpri, Pune', lat: 18.6253, lng: 73.8184, type: 'Government' },
  ],
  'Thane': [
    { id: 'mh-thane-civil', name: 'Thane District Civil Hospital', city: 'Court Naka, Thane', lat: 19.1982, lng: 72.9781, type: 'Government' },
    { id: 'mh-jupiter', name: 'Jupiter Hospital Thane', city: 'Eastern Express Hwy, Thane', lat: 19.2064, lng: 72.9735, type: 'Private' },
    { id: 'mh-bethany', name: 'Bethany Hospital', city: 'Pokhran Road, Thane', lat: 19.2195, lng: 72.9691, type: 'Charitable/Vol' },
  ],
  'Nagpur': [
    { id: 'mh-gmch-nagpur', name: 'Government Medical College & Hospital (GMCH)', city: 'Medical Square, Nagpur', lat: 21.1278, lng: 79.0965, type: 'Government' },
    { id: 'mh-aiims-nagpur', name: 'AIIMS Nagpur', city: 'MIHAN, Nagpur', lat: 21.0543, lng: 79.0287, type: 'Government' },
    { id: 'mh-kingsway', name: 'Kingsway Hospitals', city: 'Near Railway Station, Nagpur', lat: 21.1534, lng: 79.0886, type: 'Private' },
  ],
  'Nashik': [
    { id: 'mh-nashik-civil', name: 'Nashik Civil Hospital', city: 'Trimbak Road, Nashik', lat: 19.9975, lng: 73.7898, type: 'Government' },
    { id: 'mh-apollo-nashik', name: 'Apollo Hospitals Nashik', city: 'Panchavati, Nashik', lat: 20.0135, lng: 73.8052, type: 'Private' },
  ],

  // --- Delhi NCR ---
  'Delhi': [
    { id: 'dl-aiims', name: 'AIIMS Main Hospital & Blood Centre', city: 'Ansari Nagar, New Delhi', lat: 28.5672, lng: 77.21, type: 'Government' },
    { id: 'dl-safdarjung', name: 'Safdarjung Hospital Regional Blood Centre', city: 'Ring Road, New Delhi', lat: 28.57, lng: 77.208, type: 'Government' },
    { id: 'dl-max-saket', name: 'Max Super Speciality Hospital Saket', city: 'Saket, New Delhi', lat: 28.5273, lng: 77.2144, type: 'Private' },
    { id: 'dl-redcross', name: 'Indian Red Cross Society National HQ Blood Bank', city: 'Red Cross Road, New Delhi', lat: 28.6219, lng: 77.2114, type: 'Charitable/Vol' },
    { id: 'dl-gangaram', name: 'Sir Ganga Ram Hospital', city: 'Rajinder Nagar, New Delhi', lat: 28.6385, lng: 77.1895, type: 'Charitable/Vol' },
    { id: 'dl-apollo', name: 'Indraprastha Apollo Hospitals', city: 'Sarita Vihar, New Delhi', lat: 28.5412, lng: 77.2831, type: 'Private' },
  ],
  'South Delhi': [
    { id: 'dl-aiims-south', name: 'AIIMS Main Hospital & Blood Centre', city: 'Ansari Nagar, New Delhi', lat: 28.5672, lng: 77.21, type: 'Government' },
    { id: 'dl-safdarjung-south', name: 'Safdarjung Hospital Regional Blood Centre', city: 'Ring Road, New Delhi', lat: 28.57, lng: 77.208, type: 'Government' },
    { id: 'dl-max-saket-south', name: 'Max Super Speciality Hospital Saket', city: 'Saket, New Delhi', lat: 28.5273, lng: 77.2144, type: 'Private' },
    { id: 'dl-psri', name: 'PSRI Multi-Speciality Hospital', city: 'Sheikh Sarai, New Delhi', lat: 28.5352, lng: 77.2285, type: 'Private' },
  ],
  'New Delhi': [
    { id: 'dl-rml', name: 'Dr. Ram Manohar Lohia (RML) Hospital', city: 'Baba Kharak Singh Marg, New Delhi', lat: 28.6247, lng: 77.2014, type: 'Government' },
    { id: 'dl-lhMC', name: 'Lady Hardinge Medical College & Hospital', city: 'Connaught Place, New Delhi', lat: 28.6331, lng: 77.2143, type: 'Government' },
  ],

  // --- Karnataka ---
  'Bengaluru Urban': [
    { id: 'ka-victoria', name: 'Victoria Hospital & BMCRI Blood Bank', city: 'Fort, Bengaluru', lat: 12.9634, lng: 77.5753, type: 'Government' },
    { id: 'ka-manipal', name: 'Manipal Hospital Blood Centre', city: 'HAL Old Airport Road, Bengaluru', lat: 12.9592, lng: 77.6477, type: 'Private' },
    { id: 'ka-narayana', name: 'Narayana Health City Blood Bank', city: 'Bommasandra, Bengaluru', lat: 12.8091, lng: 77.6974, type: 'Private' },
    { id: 'ka-bowring', name: 'Bowring & Lady Curzon Hospital', city: 'Shivajinagar, Bengaluru', lat: 12.9833, lng: 77.6042, type: 'Government' },
    { id: 'ka-stjohn', name: "St. John's Medical College Hospital", city: 'Koramangala, Bengaluru', lat: 12.9341, lng: 77.6186, type: 'Charitable/Vol' },
  ],
  'Mysuru': [
    { id: 'ka-kr-hosp', name: 'K.R. Hospital & Mysore Medical College', city: 'Irwin Road, Mysuru', lat: 12.3168, lng: 76.6508, type: 'Government' },
    { id: 'ka-apollo-mys', name: 'Apollo BGS Hospitals Mysuru', city: 'Kuvempunagar, Mysuru', lat: 12.2921, lng: 76.6294, type: 'Private' },
  ],

  // --- Uttar Pradesh ---
  'Lucknow': [
    { id: 'up-kgmu', name: 'KGMU Shatabdi Hospital Blood Bank', city: 'Chowk, Lucknow', lat: 26.8688, lng: 80.9161, type: 'Government' },
    { id: 'up-pgi', name: 'SGPGIMS Blood Transfusion Medicine', city: 'Raebareli Road, Lucknow', lat: 26.7578, lng: 80.9423, type: 'Government' },
    { id: 'up-medanta', name: 'Medanta Hospital Lucknow', city: 'Sultanpur Road, Lucknow', lat: 26.7915, lng: 80.9982, type: 'Private' },
    { id: 'up-ram-manohar', name: 'Dr. Ram Manohar Lohia Institute (RMLIMS)', city: 'Gomti Nagar, Lucknow', lat: 26.8584, lng: 80.9951, type: 'Government' },
  ],
  'Gautam Buddha Nagar': [
    { id: 'up-jaypee', name: 'Jaypee Hospital', city: 'Sector 128, Noida', lat: 28.5173, lng: 77.3698, type: 'Private' },
    { id: 'up-fortis-noida', name: 'Fortis Hospital Noida', city: 'Sector 62, Noida', lat: 28.6187, lng: 77.3724, type: 'Private' },
    { id: 'up-noida-dist', name: 'District Government Combined Hospital', city: 'Sector 39, Noida', lat: 28.5632, lng: 77.3541, type: 'Government' },
  ],
  'Kanpur Nagar': [
    { id: 'up-gsvm', name: 'GSVM Medical College & Hallet Hospital', city: 'Swaroop Nagar, Kanpur', lat: 26.4831, lng: 80.3154, type: 'Government' },
    { id: 'up-regency', name: 'Regency Hospital Kanpur', city: 'Sarvodaya Nagar, Kanpur', lat: 26.4764, lng: 80.3012, type: 'Private' },
  ],
  'Varanasi': [
    { id: 'up-bhu', name: 'Sir Sunderlal Hospital (BHU)', city: 'BHU Campus, Varanasi', lat: 25.2755, lng: 82.9989, type: 'Government' },
    { id: 'up-heritage', name: 'Heritage Hospitals Varanasi', city: 'Lanka, Varanasi', lat: 25.2812, lng: 82.9961, type: 'Private' },
  ],

  // --- Gujarat ---
  'Ahmedabad': [
    { id: 'gj-civil-ahm', name: 'Ahmedabad Civil Hospital (Asarwa)', city: 'Asarwa, Ahmedabad', lat: 23.0531, lng: 72.6034, type: 'Government' },
    { id: 'gj-zydus', name: 'Zydus Hospital Ahmedabad', city: 'Thaltej, Ahmedabad', lat: 23.0645, lng: 72.5187, type: 'Private' },
    { id: 'gj-apollo-ahm', name: 'Apollo Hospitals International', city: 'Bhat, Gandhinagar/Ahmedabad', lat: 23.1118, lng: 72.6163, type: 'Private' },
    { id: 'gj-sal', name: 'SAL Hospital & Medical Institute', city: 'Thaltej, Ahmedabad', lat: 23.0514, lng: 72.5241, type: 'Charitable/Vol' },
  ],
  'Surat': [
    { id: 'gj-surat-civil', name: 'New Civil Hospital Surat', city: 'Majura Gate, Surat', lat: 21.1738, lng: 72.8194, type: 'Government' },
    { id: 'gj-kiran', name: 'Kiran Multi Super Speciality Hospital', city: 'Katargam, Surat', lat: 21.2291, lng: 72.8335, type: 'Charitable/Vol' },
  ],
  'Vadodara': [
    { id: 'gj-ssg', name: 'SSG Hospital (Sir Sayajirao General)', city: 'Jail Road, Vadodara', lat: 22.3081, lng: 73.1894, type: 'Government' },
    { id: 'gj-sterling-vad', name: 'Sterling Hospital Vadodara', city: 'Race Course, Vadodara', lat: 22.3162, lng: 73.1673, type: 'Private' },
  ],

  // --- Rajasthan ---
  'Jaipur': [
    { id: 'rj-sms', name: 'Sawai Man Singh (SMS) Medical College & Hospital', city: 'JLN Marg, Jaipur', lat: 26.8967, lng: 75.8164, type: 'Government' },
    { id: 'rj-fortis-jpr', name: 'Fortis Escorts Hospital Jaipur', city: 'Malviya Nagar, Jaipur', lat: 26.8456, lng: 75.8087, type: 'Private' },
    { id: 'rj-ehcc', name: 'Eternal Heart Care Centre (EHCC)', city: 'Jawahar Circle, Jaipur', lat: 26.8281, lng: 75.7994, type: 'Private' },
    { id: 'rj-santokba', name: 'Santokba Durlabhji Memorial Hospital (SDMH)', city: 'Bhawani Singh Rd, Jaipur', lat: 26.8921, lng: 75.8051, type: 'Charitable/Vol' },
  ],
  'Jodhpur': [
    { id: 'rj-aiims-jod', name: 'AIIMS Jodhpur', city: 'Basni Industrial Area, Jodhpur', lat: 26.2483, lng: 73.0039, type: 'Government' },
    { id: 'rj-mdm', name: 'Mathura Das Mathur (MDM) Hospital', city: 'Shastri Nagar, Jodhpur', lat: 26.2694, lng: 73.0182, type: 'Government' },
  ],

  // --- Tamil Nadu ---
  'Chennai': [
    { id: 'tn-rggh', name: 'Rajiv Gandhi Government General Hospital (RGGGH)', city: 'Park Town, Chennai', lat: 13.0805, lng: 80.2789, type: 'Government' },
    { id: 'tn-apollo-greams', name: 'Apollo Hospitals Greams Road', city: 'Thousand Lights, Chennai', lat: 13.0601, lng: 80.2524, type: 'Private' },
    { id: 'tn-stanley', name: 'Government Stanley Medical College Hospital', city: 'Old Washermanpet, Chennai', lat: 13.1074, lng: 80.2882, type: 'Government' },
    { id: 'tn-fortis-malar', name: 'Fortis Malar Hospital', city: 'Adyar, Chennai', lat: 13.0064, lng: 80.2575, type: 'Private' },
  ],

  // --- West Bengal ---
  'Kolkata': [
    { id: 'wb-sskm', name: 'SSKM Hospital & IPGMER', city: 'Bhowanipore, Kolkata', lat: 22.5398, lng: 88.3444, type: 'Government' },
    { id: 'wb-mc-kol', name: 'Medical College & Hospital Kolkata', city: 'College Street, Kolkata', lat: 22.5739, lng: 88.3615, type: 'Government' },
    { id: 'wb-amri', name: 'AMRI Hospital Dhakuria', city: 'Dhakuria, Kolkata', lat: 22.5112, lng: 88.3671, type: 'Private' },
    { id: 'wb-fortis-kol', name: 'Fortis Hospital Anandapur', city: 'Anandapur, Kolkata', lat: 22.5195, lng: 88.4068, type: 'Private' },
  ],

  // --- Telangana ---
  'Hyderabad': [
    { id: 'ts-osmania', name: 'Osmania General Hospital', city: 'Afzal Gunj, Hyderabad', lat: 17.3789, lng: 78.4746, type: 'Government' },
    { id: 'ts-nims', name: "Nizam's Institute of Medical Sciences (NIMS)", city: 'Punjagutta, Hyderabad', lat: 17.4223, lng: 78.4532, type: 'Government' },
    { id: 'ts-apollo-hyd', name: 'Apollo Hospitals Jubilee Hills', city: 'Jubilee Hills, Hyderabad', lat: 17.4168, lng: 78.4115, type: 'Private' },
    { id: 'ts-yashoda', name: 'Yashoda Hospitals Somajiguda', city: 'Somajiguda, Hyderabad', lat: 17.4261, lng: 78.4578, type: 'Private' },
  ],

  // --- Chhattisgarh ---
  'Raipur': [
    { id: 'cg-aiims-rpr', name: 'AIIMS Raipur Blood Centre', city: 'Tatibandh, Raipur', lat: 21.2568, lng: 81.5794, type: 'Government' },
    { id: 'cg-mekahara', name: 'Dr. B.R. Ambedkar Memorial Hospital (Mekahara)', city: 'Jail Road, Raipur', lat: 21.2514, lng: 81.6421, type: 'Government' },
    { id: 'cg-ramkrishna', name: 'Ramkrishna Care Medical Centre', city: 'Aurobindo Enclave, Raipur', lat: 21.2389, lng: 81.6598, type: 'Private' },
    { id: 'cg-sanjeevani', name: 'Sri Sathya Sai Sanjeevani Hospital', city: 'Naya Raipur', lat: 21.1684, lng: 81.7825, type: 'Charitable/Vol' },
  ],
  'Baloda Bazaar': [
    { id: 'cg-bb-dh', name: 'District Civil Hospital Baloda Bazaar', city: 'Baloda Bazaar', lat: 21.6588, lng: 82.1553, type: 'Government' },
    { id: 'cg-bb-arogya', name: 'Arogya Blood Center & Hospital', city: 'Baloda Bazaar', lat: 21.6608, lng: 82.1627, type: 'Charitable/Vol' },
    { id: 'cg-bb-bhatapara', name: 'Aashirwad Hospital & Blood Centre', city: 'Bhatapara', lat: 21.7334, lng: 81.9366, type: 'Charitable/Vol' },
  ],

  // --- Bihar ---
  'Patna': [
    { id: 'br-pmch', name: 'Patna Medical College Hospital (PMCH)', city: 'Ashok Rajpath, Patna', lat: 25.6208, lng: 85.1661, type: 'Government' },
    { id: 'br-aiims-patna', name: 'AIIMS Patna', city: 'Phulwari Sharif, Patna', lat: 25.5612, lng: 85.0441, type: 'Government' },
    { id: 'br-paras-patna', name: 'Paras HMRI Hospital Patna', city: 'Raja Bazar, Patna', lat: 25.6084, lng: 85.0892, type: 'Private' },
  ],

  // --- Madhya Pradesh ---
  'Bhopal': [
    { id: 'mp-aiims-bpl', name: 'AIIMS Bhopal Main Hospital', city: 'Saket Nagar, Bhopal', lat: 23.2081, lng: 77.4612, type: 'Government' },
    { id: 'mp-hamidia', name: 'Hamidia Hospital & Gandhi Medical College', city: 'Royal Market, Bhopal', lat: 23.2621, lng: 77.3914, type: 'Government' },
  ],
  'Indore': [
    { id: 'mp-my-hosp', name: 'Maharaja Yeshwantrao (MY) Hospital', city: 'Sanyogitaganj, Indore', lat: 22.7182, lng: 75.8745, type: 'Government' },
    { id: 'mp-bombay-ind', name: 'Bombay Hospital Indore', city: 'Ring Road, Indore', lat: 22.7561, lng: 75.8943, type: 'Charitable/Vol' },
  ],

  // --- Punjab & Chandigarh ---
  'Chandigarh': [
    { id: 'ch-pgimer', name: 'PGIMER Chandigarh (Post Graduate Institute)', city: 'Sector 12, Chandigarh', lat: 30.7645, lng: 76.7761, type: 'Government' },
    { id: 'ch-gmch32', name: 'GMCH Government Medical College Sector 32', city: 'Sector 32, Chandigarh', lat: 30.7092, lng: 76.7794, type: 'Government' },
    { id: 'ch-fortis-mohali', name: 'Fortis Hospital Mohali', city: 'Sector 62, Mohali', lat: 30.7011, lng: 76.7289, type: 'Private' },
  ],
};

/**
 * Returns only curated facilities for supported districts.
 * Unknown districts return an empty list rather than fabricated hospitals or coordinates.
 */
export function getHospitalsForDistrict(
  stateName: string,
  districtName: string,
  userLat: number,
  userLng: number
): NearbyHospital[] {
  const cleanDistrict = districtName.trim();
  const cleanState = stateName.trim();

  // Try direct lookup
  let found = CURATED_DISTRICT_HOSPITALS[cleanDistrict];

  // Try case-insensitive matching
  if (!found) {
    const lower = cleanDistrict.toLowerCase();
    for (const [key, list] of Object.entries(CURATED_DISTRICT_HOSPITALS)) {
      if (key.toLowerCase() === lower || lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        found = list;
        break;
      }
    }
  }

  // If curated hospitals exist, calculate real Haversine distance from user's coordinates
  if (found && found.length > 0) {
    return found.map((h) => {
      let dist = 1.5;
      if (userLat && userLng && h.lat && h.lng) {
        dist = parseFloat(haversineDistance(userLat, userLng, h.lat, h.lng).toFixed(1));
      }
      return {
        ...h,
        distanceKm: dist,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // Do not invent hospitals for districts without a curated directory entry.
  return [];
}

