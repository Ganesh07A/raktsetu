import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  haversineDistance,
  type BloodGroup,
} from '@repo/shared';
import { eraktkoshProxy } from '../services/eraktkosh-proxy';
import { mockStore } from '../services/mock-store';

export const bloodBankRoutes = new Hono();

// GET /api/v1/blood-banks/states
bloodBankRoutes.get('/states', (c) => {
  const states = eraktkoshProxy.getStateList();
  return c.json({ states });
});

// GET /api/v1/blood-banks/districts/:stateCode
bloodBankRoutes.get('/districts/:stateCode', (c) => {
  const { stateCode } = c.req.param();
  const districts = eraktkoshProxy.getDistrictList(stateCode);

  if (!districts) {
    return c.json(
      {
        error: `State not found: ${stateCode}`,
        districts: [],
      },
      404
    );
  }

  return c.json({ districts });
});

// GET /api/v1/blood-banks/search
bloodBankRoutes.get('/search', async (c) => {
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const rawBloodGroup = c.req.query('bloodGroup');
  const bloodGroup = (
    rawBloodGroup
      ? rawBloodGroup.replace(/\s+$/, '+').trim()
      : undefined
  ) as BloodGroup | undefined;
  const radiusKmStr = c.req.query('radiusKm');
  const state = c.req.query('state');
  const district = c.req.query('district');
  const componentType = c.req.query('componentType') || 'whole_blood';

  if (!latStr || !lngStr) {
    return c.json(
      { error: 'Missing latitude or longitude parameters' },
      400
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return c.json(
      { error: 'Invalid latitude or longitude coordinates' },
      400
    );
  }

  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup)) {
    return c.json(
      { error: `Invalid blood group: ${bloodGroup}` },
      400
    );
  }

  const radiusKm = radiusKmStr ? parseFloat(radiusKmStr) : 10;
  if (isNaN(radiusKm) || radiusKm <= 0) {
    return c.json(
      { error: 'Invalid radiusKm parameter' },
      400
    );
  }

  // Query stock using resilient eRaktKosh proxy service (24h daily cache)
  const proxyResult = await eraktkoshProxy.searchStock({
    lat,
    lng,
    radiusKm,
    bloodGroup,
    componentType: componentType as any,
    stateCode: state,
    districtCode: district,
  });

  let matchedBanks = proxyResult.banks;

  // Seed/in-memory fixtures are test-only. Live users must never receive demo hospitals.
  if (process.env.NODE_ENV === 'test' && (!matchedBanks || matchedBanks.length === 0)) {
    const allBanks = mockStore.getBloodBanks();
    matchedBanks = [];

    for (const bank of allBanks) {
      if (bank.latitude === null || bank.longitude === null) continue;

      // State filter if specified
      if (state && bank.state.toLowerCase() !== state.toLowerCase()) {
        continue;
      }

      // District filter if specified
      if (district && bank.district.toLowerCase() !== district.toLowerCase()) {
        continue;
      }

      const dist = haversineDistance(lat, lng, bank.latitude, bank.longitude);
      if (dist <= radiusKm) {
        let matchingStock = bank.stock;
        if (bloodGroup) {
          matchingStock = bank.stock.filter(
            (s) => s.bloodGroup === bloodGroup &&
              s.componentType === componentType &&
              s.unitsAvailable > 0
          );
        }

        matchedBanks.push({
          ...bank,
          distanceKm: dist,
          stock: matchingStock,
        });
      }
    }

  }

  matchedBanks = [...(matchedBanks || [])].sort((a, b) => {
    const aHasStock = a.stock.some((item) => item.unitsAvailable > 0);
    const bHasStock = b.stock.some((item) => item.unitsAvailable > 0);
    if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
    if (a.distanceKm === null && b.distanceKm !== null) return 1;
    if (a.distanceKm !== null && b.distanceKm === null) return -1;
    if (a.distanceKm === null || b.distanceKm === null) return 0;
    return a.distanceKm - b.distanceKm;
  });

  return c.json({
    banks: matchedBanks,
    totalCount: matchedBanks.length,
    source: proxyResult.source,
    cached: proxyResult.cached,
  });
});

// GET /api/v1/blood-banks/:id
bloodBankRoutes.get('/:id', (c) => {
  const { id } = c.req.param();
  const bank = mockStore.getBloodBankById(id);

  if (!bank) {
    return c.json(
      { error: `Blood bank with ID ${id} not found` },
      404
    );
  }

  return c.json({ bank });
});
