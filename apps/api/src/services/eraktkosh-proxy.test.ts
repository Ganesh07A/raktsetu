import { describe, expect, it, beforeEach } from 'bun:test';
import { ERaktKoshProxyService } from './eraktkosh-proxy';

describe('ERaktKoshProxyService', () => {
  let proxy: ERaktKoshProxyService;

  beforeEach(() => {
    proxy = new ERaktKoshProxyService();
    proxy.clearCache();
  });

  it('provides comprehensive list of Indian states', () => {
    const states = proxy.getStateList();
    expect(states).toBeArray();
    expect(states.length).toBeGreaterThanOrEqual(8);

    const delhi = states.find((s) => s.code === 'DL');
    expect(delhi).toBeDefined();
    expect(delhi?.name).toBe('Delhi');

    const up = states.find((s) => s.code === 'UP');
    expect(up).toBeDefined();
    expect(up?.name).toBe('Uttar Pradesh');
  });

  it('provides districts for valid state code and handles case insensitivity', () => {
    const dlDistricts = proxy.getDistrictList('DL');
    expect(dlDistricts).toBeArray();
    expect(dlDistricts?.some((d) => d.name === 'South Delhi')).toBe(true);

    const dlLower = proxy.getDistrictList('dl');
    expect(dlLower).toEqual(dlDistricts);

    const upDistricts = proxy.getDistrictList('UP');
    expect(upDistricts).toBeArray();
    expect(upDistricts?.some((d) => d.name === 'Lucknow')).toBe(true);
  });

  it('returns null for nonexistent state code', () => {
    const invalid = proxy.getDistrictList('UNKNOWN_CODE');
    expect(invalid).toBeNull();
  });

  it('resolves state code to name and name to name correctly', () => {
    expect(proxy.resolveStateName('DL')).toBe('Delhi');
    expect(proxy.resolveStateName('dl')).toBe('Delhi');
    expect(proxy.resolveStateName('Delhi')).toBe('Delhi');
    expect(proxy.resolveStateName('Uttar Pradesh')).toBe('Uttar Pradesh');
    expect(proxy.resolveStateName('UP')).toBe('Uttar Pradesh');
    expect(proxy.resolveStateName('XYZ')).toBeNull();
  });

  it('searches stock with geographic distance sorting and graceful fallback', async () => {
    const res = await proxy.searchStock({
      lat: 28.5672,
      lng: 77.21,
      radiusKm: 10,
      bloodGroup: 'A+',
    });

    expect(res.banks).toBeArray();
    expect(res.banks.length).toBeGreaterThan(0);
    expect(res.cached).toBe(false);

    // Results with matching stock rank first. Within each stock group,
    // measured distances are ascending and unknown distances sort last.
    for (let i = 0; i < res.banks.length - 1; i++) {
      const current = res.banks[i]!;
      const next = res.banks[i + 1]!;
      const currentHasStock = current.stock.some((item) => item.unitsAvailable > 0);
      const nextHasStock = next.stock.some((item) => item.unitsAvailable > 0);

      if (currentHasStock !== nextHasStock) {
        expect(currentHasStock).toBe(true);
      } else if (current.distanceKm === null) {
        expect(next.distanceKm).toBeNull();
      } else if (next.distanceKm === null) {
        expect(current.distanceKm).not.toBeNull();
      } else {
        expect(current.distanceKm).toBeLessThanOrEqual(next.distanceKm);
      }
    }
  });

  it('caches search results for subsequent identical calls', async () => {
    const params = {
      lat: 28.5672,
      lng: 77.21,
      radiusKm: 5,
      bloodGroup: 'O+' as const,
    };

    const first = await proxy.searchStock(params);
    expect(first.cached).toBe(false);
    expect(proxy.getCacheSize()).toBe(1);

    const second = await proxy.searchStock(params);
    expect(second.cached).toBe(true);
    expect(second.banks.length).toBe(first.banks.length);
  });

  it('filters banks by state and district', async () => {
    const res = await proxy.searchStock({
      stateCode: 'UP',
      districtCode: 'Lucknow',
      bloodGroup: 'B+',
    });

    expect(res.banks).toBeArray();
    for (const bank of res.banks) {
      expect(bank.state).toBe('Uttar Pradesh');
      expect(bank.district).toBe('Lucknow');
    }
  });
});
