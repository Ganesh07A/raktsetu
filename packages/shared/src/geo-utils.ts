/**
 * Converts degrees to radians.
 */
export function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * @returns Distance in kilometers, rounded to 1 decimal place.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

/**
 * Returns true if two coordinates are within `radiusKm` kilometers of each other.
 */
export function isWithinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusKm: number
): boolean {
  return haversineDistance(lat1, lon1, lat2, lon2) <= radiusKm;
}

/**
 * Calculates a bounding box around a center coordinate to allow fast preliminary SQL index filtering.
 * 1 degree latitude ≈ 111 km.
 * 1 degree longitude ≈ 111 km * cos(latitude).
 */
export function getBoundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111.0;
  const cosLat = Math.cos(toRad(lat));
  // Prevent division by zero near the poles
  const safeCosLat = Math.abs(cosLat) < 0.0001 ? 0.0001 : Math.abs(cosLat);
  const lonDelta = radiusKm / (111.0 * safeCosLat);

  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Formats distance with localized units.
 */
export function formatDistance(
  distanceKm: number,
  locale: 'en' | 'hi' = 'en'
): string {
  if (locale === 'hi') {
    return `${distanceKm} कि.मी.`;
  }
  return `${distanceKm} km`;
}
