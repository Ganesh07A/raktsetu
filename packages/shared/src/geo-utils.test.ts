import { describe, expect, it } from 'bun:test';
import {
  formatDistance,
  getBoundingBox,
  haversineDistance,
  isWithinRadius,
  toRad,
} from './geo-utils';

describe('Geospatial Utilities', () => {
  describe('toRad', () => {
    it('converts degrees to radians correctly', () => {
      expect(toRad(0)).toBe(0);
      expect(toRad(180)).toBeCloseTo(Math.PI, 6);
      expect(toRad(90)).toBeCloseTo(Math.PI / 2, 6);
    });
  });

  describe('haversineDistance', () => {
    it('returns 0 for identical points', () => {
      const lat = 28.6139;
      const lon = 77.209;
      expect(haversineDistance(lat, lon, lat, lon)).toBe(0);
    });

    it('calculates accurate distance between known Indian cities (Delhi to Mumbai ≈ 1140-1160 km)', () => {
      const delhi = { lat: 28.6139, lon: 77.209 };
      const mumbai = { lat: 19.076, lon: 72.8777 };
      const dist = haversineDistance(
        delhi.lat,
        delhi.lon,
        mumbai.lat,
        mumbai.lon
      );
      // Great circle distance between Delhi and Mumbai is ~1148 km
      expect(dist).toBeGreaterThan(1140);
      expect(dist).toBeLessThan(1160);
    });

    it('calculates accurate distance for short local distances (AIIMS Delhi to Safdarjung Hospital ≈ 0.5-1.0 km)', () => {
      const aiims = { lat: 28.5672, lon: 77.21 };
      const safdarjung = { lat: 28.5694, lon: 77.2072 };
      const dist = haversineDistance(
        aiims.lat,
        aiims.lon,
        safdarjung.lat,
        safdarjung.lon
      );
      expect(dist).toBeGreaterThan(0.2);
      expect(dist).toBeLessThan(1.5);
    });

    it('is symmetric (dist(A, B) === dist(B, A))', () => {
      const p1 = { lat: 28.5355, lon: 77.391 }; // Noida
      const p2 = { lat: 28.4595, lon: 77.0266 }; // Gurgaon
      const dist1 = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
      const dist2 = haversineDistance(p2.lat, p2.lon, p1.lat, p1.lon);
      expect(dist1).toBe(dist2);
    });
  });

  describe('isWithinRadius', () => {
    it('returns true when distance is less than or equal to radius', () => {
      const p1 = { lat: 28.6139, lon: 77.209 };
      const p2 = { lat: 28.62, lon: 77.215 };
      expect(isWithinRadius(p1.lat, p1.lon, p2.lat, p2.lon, 5)).toBe(true);
    });

    it('returns false when distance exceeds radius', () => {
      const delhi = { lat: 28.6139, lon: 77.209 };
      const jaipur = { lat: 26.9124, lon: 75.7873 }; // ~230 km
      expect(isWithinRadius(delhi.lat, delhi.lon, jaipur.lat, jaipur.lon, 50)).toBe(
        false
      );
    });
  });

  describe('getBoundingBox', () => {
    it('produces bounding box containing center coordinates and symmetric deltas', () => {
      const lat = 28.6139;
      const lon = 77.209;
      const radiusKm = 10;
      const box = getBoundingBox(lat, lon, radiusKm);

      expect(box.minLat).toBeLessThan(lat);
      expect(box.maxLat).toBeGreaterThan(lat);
      expect(box.minLon).toBeLessThan(lon);
      expect(box.maxLon).toBeGreaterThan(lon);

      // Symmetrical deltas
      expect(box.maxLat - lat).toBeCloseTo(lat - box.minLat, 5);
      expect(box.maxLon - lon).toBeCloseTo(lon - box.minLon, 5);
    });
  });

  describe('formatDistance', () => {
    it('formats distance in English', () => {
      expect(formatDistance(5.2, 'en')).toBe('5.2 km');
    });

    it('formats distance in Hindi', () => {
      expect(formatDistance(5.2, 'hi')).toBe('5.2 कि.मी.');
    });
  });
});
