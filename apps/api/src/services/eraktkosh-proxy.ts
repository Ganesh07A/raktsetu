import {
  haversineDistance,
  type BloodBankCardData,
  type StockItem,
  type BloodGroup,
  type ComponentType,
  getEraktkoshStateCode,
  getEraktkoshDistrictCode,
} from '@repo/shared';
import {
  SEED_BLOOD_BANKS,
  STATES_AND_DISTRICTS,
} from '@repo/db';

export interface ERaktKoshSearchParams {
  stateCode?: string;
  districtCode?: string;
  bloodGroup?: BloodGroup;
  componentType?: ComponentType;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface ERaktKoshProxyResult {
  banks: BloodBankCardData[];
  source: 'eraktkosh' | 'database' | 'combined';
  cached: boolean;
}

interface CacheEntry {
  timestamp: number;
  data: BloodBankCardData[];
}

const ERAKTKOSH_BLOOD_GROUP_CODES: Record<BloodGroup, string> = {
  'A+': '11',
  'A-': '12',
  'B+': '13',
  'B-': '14',
  'O+': '15',
  'O-': '16',
  'AB+': '17',
  'AB-': '18',
};

const ERAKTKOSH_COMPONENT_CODES: Record<ComponentType, string> = {
  whole_blood: '11',
  prbc: '12',
  ffp: '13',
  platelets: '14',
};

export class ERaktKoshProxyService {
  private cache = new Map<string, CacheEntry>();
  // 24-hour daily cache TTL as requested by user
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly TIMEOUT_MS = 4000; // 4 seconds before fallback
  private readonly ERAKTKOSH_AJAX_URL =
    process.env.ERAKTKOSH_AJAX_URL ||
    'https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt?hmode=GETNEARBYSTOCKDETAILS';

  /**
   * Get list of Indian states
   */
  public getStateList(): Array<{ code: string; name: string }> {
    return Object.entries(STATES_AND_DISTRICTS).map(([code, data]) => ({
      code,
      name: data.name,
    }));
  }

  /**
   * Get list of districts for a given state code or state name
   */
  public getDistrictList(
    stateCode: string
  ): Array<{ code: string; name: string }> | null {
    const trimmed = (stateCode || '').trim();
    const upper = trimmed.toUpperCase();
    const stateData =
      STATES_AND_DISTRICTS[upper] ||
      STATES_AND_DISTRICTS[trimmed] ||
      Object.values(STATES_AND_DISTRICTS).find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase()
      );

    if (!stateData) {
      return null;
    }

    return stateData.districts.map((d, index) => ({
      code: `${upper}-${index + 1}`,
      name: d,
    }));
  }

  /**
   * Resolve state code or name
   */
  public resolveStateName(codeOrName: string): string | null {
    const trimmed = codeOrName.trim();
    const upper = trimmed.toUpperCase();
    if (STATES_AND_DISTRICTS[upper]) {
      return STATES_AND_DISTRICTS[upper].name;
    }
    for (const data of Object.values(STATES_AND_DISTRICTS)) {
      if (data.name.toLowerCase() === trimmed.toLowerCase()) {
        return data.name;
      }
    }
    return null;
  }

  /**
   * Query stock with 24-hour daily cache and resilient DB/seed fallback
   */
  public async searchStock(
    params: ERaktKoshSearchParams
  ): Promise<ERaktKoshProxyResult> {
    const cacheKey = this.generateCacheKey(params);
    const cached = this.cache.get(cacheKey);

    // Return instant cached data if within daily TTL
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return {
        banks: cached.data,
        source: 'combined',
        cached: true,
      };
    }

    let liveBanks: BloodBankCardData[] = [];
    let externalSuccess = false;

    // Fetch from official eRaktKosh live service if enabled
    if (process.env.NODE_ENV !== 'test' && process.env.MOCK_SERVICES !== 'true' && process.env.ERAKTKOSH_DISABLED !== 'true') {
      try {
        const resolvedStateName = params.stateCode
          ? this.resolveStateName(params.stateCode) || params.stateCode
          : '';

        const eStateCode =
          getEraktkoshStateCode(resolvedStateName) || params.stateCode || '-1';
        const eDistrictCode =
          (params.districtCode && resolvedStateName
            ? getEraktkoshDistrictCode(resolvedStateName, params.districtCode)
            : null) ||
          params.districtCode ||
          '-1';

        const eBloodGroup = params.bloodGroup
          ? ERAKTKOSH_BLOOD_GROUP_CODES[params.bloodGroup] || 'all'
          : 'all';
        const eComponent = params.componentType
          ? ERAKTKOSH_COMPONENT_CODES[params.componentType] || '11'
          : '11';

        const url = `${this.ERAKTKOSH_AJAX_URL}&stateCode=${encodeURIComponent(eStateCode)}&districtCode=${encodeURIComponent(eDistrictCode)}&bloodGroup=${encodeURIComponent(eBloodGroup)}&bloodComponent=${encodeURIComponent(eComponent)}&lang=0`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RaktKhoj/1.0',
            Accept: 'application/json, text/plain, */*',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('json') || url.includes('GETNEARBYSTOCKDETAILS')) {
            const json = (await res.json()) as { data?: Array<string[]> };
            if (json && Array.isArray(json.data) && json.data.length > 0) {
              liveBanks = this.parseERaktKoshJson(
                json.data,
                params,
                resolvedStateName
              );
              if (liveBanks.length > 0) {
                externalSuccess = true;
              }
            }
          }
        }
      } catch (err) {
        console.warn(
          '[@repo/api] eRaktKosh external live request timed out or unavailable. Falling back to local dataset:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // Seed blood banks are fixtures for automated tests only. Never expose them to live users.
    const fallbackBanks = process.env.NODE_ENV === 'test'
      ? this.queryLocalSeedBanks(params)
      : [];
    let finalBanks: BloodBankCardData[];
    let source: 'eraktkosh' | 'database' | 'combined';

    if (externalSuccess && liveBanks.length > 0) {
      const mergedMap = new Map<string, BloodBankCardData>();
      for (const b of liveBanks) mergedMap.set(b.name.toLowerCase(), b);
      for (const b of fallbackBanks) {
        if (!mergedMap.has(b.name.toLowerCase())) {
          mergedMap.set(b.name.toLowerCase(), b);
        }
      }
      finalBanks = Array.from(mergedMap.values());
      source = 'combined';
    } else {
      finalBanks = fallbackBanks;
      source = 'database';
    }

    // Prioritize records with the requested stock, then sort by measured distance.
    // Unknown distances are always placed after records with real coordinates.
    finalBanks.sort((a, b) => {
      const aHasStock = a.stock.some((item) => item.unitsAvailable > 0);
      const bHasStock = b.stock.some((item) => item.unitsAvailable > 0);
      if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
      if (a.distanceKm === null && b.distanceKm !== null) return 1;
      if (a.distanceKm !== null && b.distanceKm === null) return -1;
      if (a.distanceKm === null || b.distanceKm === null) return 0;
      return a.distanceKm - b.distanceKm;
    });

    // Store in daily cache (24 hours TTL)
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      data: finalBanks,
    });

    return {
      banks: finalBanks,
      source,
      cached: false,
    };
  }

  /**
   * Helper to filter seed blood banks by coordinates / radius and stock
   */
  private queryLocalSeedBanks(params: ERaktKoshSearchParams): BloodBankCardData[] {
    const results: BloodBankCardData[] = [];
    const resolvedState = params.stateCode
      ? this.resolveStateName(params.stateCode)
      : null;

    for (const bank of SEED_BLOOD_BANKS) {
      if (resolvedState && bank.state.toLowerCase() !== resolvedState.toLowerCase()) {
        continue;
      }

      if (
        params.districtCode &&
        !bank.district.toLowerCase().includes(params.districtCode.toLowerCase())
      ) {
        continue;
      }

      let distanceKm = 0;
      if (params.lat !== undefined && params.lng !== undefined) {
        if (bank.latitude === null || bank.longitude === null) continue;
        distanceKm = haversineDistance(
          params.lat,
          params.lng,
          bank.latitude,
          bank.longitude
        );

        if (params.radiusKm !== undefined && distanceKm > params.radiusKm) {
          continue;
        }
      }

      let matchingStock = bank.stock;
      if (params.bloodGroup) {
        matchingStock = bank.stock.filter((s) => s.bloodGroup === params.bloodGroup);
      }

      results.push({
        id: bank.id,
        name: bank.name,
        licenseNumber: bank.licenseNumber,
        state: bank.state,
        district: bank.district,
        city: bank.city,
        address: bank.address,
        phone: bank.phone,
        email: bank.email,
        latitude: bank.latitude,
        longitude: bank.longitude,
        distanceKm,
        stock: matchingStock,
        isVerified: bank.isVerified,
        source: bank.source,
        lastStockUpdate: bank.lastStockUpdate,
      });
    }

    return results;
  }

  /**
   * Parse rows from eRaktKosh live JSON API
   * Format of each row: [seq, name_and_addr, type, stock_info, updated, category]
   */
  private parseERaktKoshJson(
    rows: Array<string[]>,
    params: ERaktKoshSearchParams,
    stateName: string
  ): BloodBankCardData[] {
    const banks: BloodBankCardData[] = [];

    rows.forEach((row, index) => {
      if (!Array.isArray(row) || row.length < 5) return;

      const rawDetails = row[1] || '';
      const bankType = row[2] || 'Blood Bank';
      const stockHtml = row[3] || '';
      const updatedTimestamp = row[4] || new Date().toISOString();

      const parts = rawDetails.split(/<br\s*\/?>/i);
      const bankName = (parts[0] || `Blood Centre ${index + 1}`).trim();
      const address = (parts[1] || '').trim();
      const contactInfo = parts[2] || '';

      const phoneMatch = contactInfo.match(/Phone:\s*([0-9+\s\-]+)/i);
      const phone = phoneMatch ? phoneMatch[1]!.trim() : null;

      const emailMatch = contactInfo.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const email = emailMatch ? emailMatch[1]!.trim() : null;

      // Parse only stock quantities actually present in the upstream response.
      const parsedStock: StockItem[] = [];
      const isAvailable = stockHtml.includes('Available') && !stockHtml.includes('Not Available');

      if (isAvailable) {
        // e.g. "Available, O+Ve:27, A+Ve:9, B+Ve:3"
        const stockRegex = /([A-Za-z0-9+\-]+(?:Ve)?)\s*:\s*(\d+)/g;
        let sm: RegExpExecArray | null;
        while ((sm = stockRegex.exec(stockHtml)) !== null) {
          const bgRaw = sm[1]!.replace(/Ve/i, '').trim() as BloodGroup;
          const units = parseInt(sm[2]!, 10) || 0;
          if (units <= 0) continue;
          if (params.bloodGroup && bgRaw !== params.bloodGroup) continue;
          parsedStock.push({
            bloodGroup: bgRaw,
            componentType: params.componentType || 'whole_blood',
            unitsAvailable: units,
            lastUpdated: updatedTimestamp,
          });
        }
      }

      // The upstream row does not provide coordinates or a measured distance.
      // Do not pretend the bank is at the seeker's location or invent a km value.
      const stockItems = parsedStock;
      const distanceKm: number | null = null;

      banks.push({
        id: `eraktkosh-${stateName}-${index + 1}`,
        name: bankName,
        licenseNumber: null,
        state: stateName || 'India',
        district: params.districtCode || 'District',
        city: address.split(',')[0]?.trim() || null,
        address: address || null,
        phone,
        email,
        latitude: null,
        longitude: null,
        distanceKm,
        stock: stockItems,
        isVerified: true,
        source: 'eraktkosh',
        lastStockUpdate: updatedTimestamp,
      });
    });

    return banks;
  }

  private generateCacheKey(params: ERaktKoshSearchParams): string {
    const state = params.stateCode || 'all';
    const district = params.districtCode || 'all';
    const group = params.bloodGroup || 'all';
    const comp = params.componentType || 'whole_blood';
    const lat = params.lat !== undefined ? params.lat.toFixed(3) : 'none';
    const lng = params.lng !== undefined ? params.lng.toFixed(3) : 'none';
    const rad = params.radiusKm || 10;
    return `${state}:${district}:${group}:${comp}:${lat}:${lng}:${rad}`;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }
}

export const eraktkoshProxy = new ERaktKoshProxyService();
