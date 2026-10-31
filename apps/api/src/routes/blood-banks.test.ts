import { describe, expect, it, beforeEach } from 'bun:test';
import { app } from '../index';
import { mockStore } from '../services/mock-store';
import { eraktkoshProxy } from '../services/eraktkosh-proxy';

describe('Blood Banks API Routes (/api/v1/blood-banks)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    mockStore.reset();
    eraktkoshProxy.clearCache();
  });

  describe('GET /search', () => {
    it('returns 400 when lat or lng is missing', async () => {
      const res = await app.request('/api/v1/blood-banks/search?radiusKm=10');
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Missing latitude or longitude');
    });

    it('returns 400 for out-of-range coordinates', async () => {
      const res = await app.request('/api/v1/blood-banks/search?lat=95&lng=77.21');
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid latitude or longitude coordinates');
    });

    it('returns 400 for malformed bloodGroup', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=28.5672&lng=77.21&bloodGroup=INVALID_GROUP'
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid blood group');
    });

    it('returns 400 for invalid radiusKm', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=28.5672&lng=77.21&radiusKm=-5'
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('Invalid radiusKm');
    });

    it('finds blood banks within 5 km of AIIMS Delhi', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=28.5672&lng=77.21&radiusKm=5'
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        banks: Array<{ name: string; distanceKm: number; licenseNumber: string }>;
        totalCount: number;
        source: string;
      };

      expect(json.banks).toBeArray();
      expect(json.totalCount).toBeGreaterThan(0);

      // AIIMS and Safdarjung should be within 5km
      const names = json.banks.map((b) => b.name);
      expect(names.some((n) => n.includes('AIIMS'))).toBe(true);
      expect(names.some((n) => n.includes('Safdarjung'))).toBe(true);

      // Matching stock is prioritized first; within each stock group, sort by distance.
      for (let i = 0; i < json.banks.length - 1; i++) {
        const current = json.banks[i]!;
        const next = json.banks[i + 1]!;
        const currentHasStock = current.stock.some((item: { unitsAvailable: number }) => item.unitsAvailable > 0);
        const nextHasStock = next.stock.some((item: { unitsAvailable: number }) => item.unitsAvailable > 0);

        if (currentHasStock !== nextHasStock) {
          expect(currentHasStock).toBe(true);
        } else {
          expect(current.distanceKm).toBeLessThanOrEqual(next.distanceKm);
        }
      }
    });

    it('filters blood banks by state and district', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=26.869&lng=80.916&radiusKm=50&state=Uttar%20Pradesh&district=Lucknow'
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        banks: Array<{ name: string; state: string; district: string }>;
      };

      for (const bank of json.banks) {
        expect(bank.state.toLowerCase()).toBe('uttar pradesh');
        expect(bank.district.toLowerCase()).toBe('lucknow');
      }
    });

    it('returns 0 banks when searching in mismatched state and district', async () => {
      const res = await app.request(
        '/api/v1/blood-banks/search?lat=28.5672&lng=77.21&radiusKm=10&state=Delhi&district=Lucknow'
      );
      expect(res.status).toBe(200);

      const json = (await res.json()) as { totalCount: number; banks: unknown[] };
      expect(json.totalCount).toBe(0);
      expect(json.banks.length).toBe(0);
    });
  });

  describe('GET /states and GET /districts/:stateCode', () => {
    it('returns list of Indian states', async () => {
      const res = await app.request('/api/v1/blood-banks/states');
      expect(res.status).toBe(200);

      const json = (await res.json()) as { states: Array<{ code: string; name: string }> };
      expect(json.states).toBeArray();
      expect(json.states.length).toBeGreaterThanOrEqual(4);
      expect(json.states.some((s) => s.code === 'DL' && s.name === 'Delhi')).toBe(true);
      expect(json.states.some((s) => s.code === 'UP' && s.name === 'Uttar Pradesh')).toBe(true);
    });

    it('returns districts for valid stateCode', async () => {
      const res = await app.request('/api/v1/blood-banks/districts/DL');
      expect(res.status).toBe(200);

      const json = (await res.json()) as { districts: Array<{ code: string; name: string }> };
      expect(json.districts).toBeArray();
      expect(json.districts.some((d) => d.name === 'Central Delhi')).toBe(true);
      expect(json.districts.some((d) => d.name === 'South Delhi')).toBe(true);
    });

    it('returns 404 for unknown stateCode', async () => {
      const res = await app.request('/api/v1/blood-banks/districts/NONEXISTENT');
      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain('State not found');
    });
  });

  describe('GET /:id', () => {
    it('returns blood bank details for existing id', async () => {
      const res = await app.request('/api/v1/blood-banks/bank-aiims-delhi');
      expect(res.status).toBe(200);

      const json = (await res.json()) as { bank: { id: string; name: string; licenseNumber: string } };
      expect(json.bank).toBeDefined();
      expect(json.bank.id).toBe('bank-aiims-delhi');
      expect(json.bank.name).toContain('AIIMS');
      expect(json.bank.licenseNumber).toBe('DL-BB-1001');
    });

    it('returns 404 for non-existent bank id', async () => {
      const res = await app.request('/api/v1/blood-banks/unknown-bank-id');
      expect(res.status).toBe(404);
    });
  });
});
