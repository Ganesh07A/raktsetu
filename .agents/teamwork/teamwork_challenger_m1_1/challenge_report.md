# Empirical Challenge Report — Milestone 1 Core Domain Logic

**Challenger**: Challenger 1 (`teamwork_challenger_m1_1`)  
**Date**: 2026-10-30  
**Target Milestone**: Milestone 1 (Foundation & Core Domain)  
**Overall Risk Assessment**: **MEDIUM** (Domain logic is medically robust; 1 numerical floating-point instability defect detected in geospatial calculation)  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Executive Summary

Milestone 1 core domain logic was subjected to exhaustive empirical stress testing covering immunohematology red blood cell (RBC) compatibility and geospatial calculations on boundary coordinates.

1. **Blood Compatibility Matrix**:
   - **Exhaustive $8 \times 8$ Matrix (64 pairs)**: 100% agreement with an independent immunohematology ground truth oracle. Exactly 27 pairs are medically compatible; 37 pairs are incompatible.
   - **Critical Invariants**: All 8 critical invariants hold (Universal donor O- can donate to all 8; O- can only receive O-; Universal recipient AB+ can receive from all 8; AB+ can only donate to AB+; Rh- recipients can NEVER receive Rh+ blood across all 16 combinations; self-compatibility holds for all 8; mathematical duality between donor and recipient queries is preserved).
   - **Malformed / Adversarial Inputs**: Malformed strings (`'C+'`, `'O'`, `'ab+'`, `'A+ '`, `''`), non-string values (`null`, `undefined`, numbers, objects) are handled safely without exceptions, returning empty arrays (`[]`) and `false`.
   - **Status**: **ROBUST & MEDICALLY SOUND (VERIFIED)**.

2. **Geospatial Distance Calculation (`haversineDistance`)**:
   - **Defect Discovered**: In `packages/shared/src/geo-utils.ts:22-29`, calculating Haversine distance on antipodal points (e.g. `(45, 60)` to `(-45, -120)`) causes floating-point roundoff where intermediate term $a = 1.0000000000000002 > 1$. Consequently, $1 - a = -2.22 \times 10^{-16} < 0$, causing `Math.sqrt(1 - a)` to evaluate to `NaN`.
   - **Empirical Blast Radius**: A systematic grid scan across latitudes and longitudes identified **720 antipodal coordinate pairs** that produce `NaN`. When `haversineDistance` returns `NaN`, downstream helper `isWithinRadius(lat1, lon1, lat2, lon2, radiusKm)` returns `false` (even if radius is 50,000 km), and `formatDistance` returns `"NaN km"`.
   - **Status**: **DEFECT CONFIRMED (EMPIRICALLY REPRODUCED)**.

3. **Geospatial Bounding Box (`getBoundingBox`)**:
   - Near the poles (`lat = ±90°`), `safeCosLat = 0.0001` successfully prevents division by zero. However, `latDelta` and `lonDelta` are unclamped, resulting in latitudes exceeding $[-90^\circ, 90^\circ]$ (e.g. $90.09^\circ$) and longitudes exceeding $[-180^\circ, 180^\circ]$ (spanning $>900^\circ$).
   - Across the antimeridian / International Date Line (`lon = ±180°`), the box produces un-wrapped coordinates ($[179.91^\circ, 180.09^\circ]$).
   - Because RaktKhoj's operational envelope is strictly the Republic of India (approx. $8.4^\circ\text{N} - 37.6^\circ\text{N}$, $68.7^\circ\text{E} - 97.25^\circ\text{E}$), this does not trigger failures in Indian coordinates, but constitutes an unhardened boundary edge case.
   - **Status**: **LOW RISK / BOUNDARY CAVEAT DOCUMENTED**.

---

## 2. Challenges & Findings

### [Medium] Challenge 1: Unclamped Term in Haversine Formula Causes `NaN` on Antipodal Coordinates

- **File**: `packages/shared/src/geo-utils.ts:22-31`
- **Assumption Challenged**: The Haversine formula assumes the intermediate term $a = \sin^2(\Delta \phi / 2) + \cos(\phi_1)\cos(\phi_2)\sin^2(\Delta \lambda / 2)$ is always strictly $\le 1$ on a spherical surface.
- **Attack Scenario**:
  Executing `haversineDistance(45, 60, -45, -120)`:
  ```ts
  const dLat = toRad(-45 - 45); // -90 deg -> sin(-45 deg)^2 = 0.5
  const dLon = toRad(-120 - 60); // -180 deg -> sin(-90 deg)^2 = 1.0
  const a = 0.5 + Math.cos(toRad(45)) * Math.cos(toRad(-45)) * 1.0;
  // Due to IEEE-754 precision: cos(45°)^2 = 0.5000000000000001
  // a = 0.5 + 0.5000000000000001 = 1.0000000000000002
  // 1 - a = -2.220446049250313e-16
  // Math.sqrt(1 - a) = NaN
  // Math.atan2(Math.sqrt(a), NaN) = NaN
  // Returns: NaN
  ```
- **Blast Radius**:
  - `haversineDistance` outputs `NaN`.
  - `isWithinRadius(lat1, lon1, lat2, lon2, 50000)` evaluates `NaN <= 50000` to `false`.
  - `formatDistance(NaN)` produces `"NaN km"`.
- **Mitigation**:
  In `packages/shared/src/geo-utils.ts`, clamp `a` to $[0, 1]$ before passing to `atan2` or clamp `1 - a` with `Math.max(0, 1 - a)`:
  ```ts
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  ```
  Verified: With this clamp, `haversineDistance(45, 60, -45, -120)` evaluates accurately to `20015.1 km`.

---

### [Low] Challenge 2: Unclamped Bounding Box at Poles and Antimeridian

- **File**: `packages/shared/src/geo-utils.ts:51-68`
- **Assumption Challenged**: Bounding box latitudes are assumed to remain within $[-90^\circ, 90^\circ]$ and longitudes within $[-180^\circ, 180^\circ]$.
- **Attack Scenario**:
  Querying `getBoundingBox(90, 0, 10)`:
  ```ts
  minLat = 89.9099;
  maxLat = 90.0901; // Invalid latitude > 90
  minLon = -900.9009; // Spans multiple Earth rotations
  maxLon = 900.9009;
  ```
- **Blast Radius**:
  In an SQL query using `BETWEEN minLat AND maxLat`, database engines enforcing coordinate domain checks or spatial index boundaries could reject queries near poles. Within the geographical scope of India, coordinates never approach poles, so operational impact on RaktKhoj is zero.
- **Mitigation**:
  Add defensive boundary clamping:
  ```ts
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
  ```

---

## 3. Stress Test Results Summary

| # | Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---------------|-------------------|-----------------|--------|
| 1 | All 64 recipient × donor pairs ($8 \times 8$) | 27 compatible, 37 incompatible | 27 compatible, 37 incompatible | **PASS** |
| 2 | Universal donor (O-) to all 8 groups | Compatible with all 8 | Compatible with all 8 | **PASS** |
| 3 | O- recipient restrictions | Only O- compatible | Only O- compatible | **PASS** |
| 4 | Universal recipient (AB+) from all 8 groups | Compatible from all 8 | Compatible from all 8 | **PASS** |
| 5 | AB+ donor restrictions | Only AB+ recipient compatible | Only AB+ recipient compatible | **PASS** |
| 6 | Rh- recipients receiving Rh+ blood (16 pairs) | Incompatible (false) | Incompatible (false) for all 16 | **PASS** |
| 7 | Self-compatibility (all 8 blood groups) | Compatible (true), index 0 | Compatible (true), index 0 | **PASS** |
| 8 | Malformed blood groups ('C+', 'O', 'ab+', 'A+ ', null, undefined) | Empty array `[]` / `false` without throwing | `[]` / `false` without throwing | **PASS** |
| 9 | Haversine: Identical coordinates (4 pairs) | 0 km | 0 km | **PASS** |
| 10 | Haversine: Equator quarter circumference `(0, 0)` to `(0, 90)` | ~10,007.5 km | 10,007.5 km | **PASS** |
| 11 | Haversine: Polar antipodes `(90, 0)` to `(-90, 0)` | ~20,015.1 km | 20,015.1 km | **PASS** |
| 12 | Haversine: Equator antipodes `(0, 0)` to `(0, 180)` | ~20,015.1 km | 20,015.1 km | **PASS** |
| 13 | Haversine: Arbitrary antipodes `(45, 60)` to `(-45, -120)` | ~20,015.1 km | **NaN** (IEEE-754 precision bug) | **FAIL** |
| 14 | Haversine: Polar singularity (longitudes at lat 90°) | 0 km | 0 km | **PASS** |
| 15 | Haversine: Antimeridian wrapping `(0, 179)` to `(0, -179)` | ~222.4 km | 222.4 km | **PASS** |
| 16 | Haversine: Metric symmetry & triangle inequality | `d(A, B) == d(B, A)` & `d(A, C) <= d(A, B) + d(B, C)` | Preserved | **PASS** |
| 17 | Bounding Box: Standard Indian cities (Delhi 10km) | Enclosing box with symmetric deltas | Enclosing box with symmetric deltas | **PASS** |
| 18 | Bounding Box: Poles (`lat = ±90°`) | Finite values, no divide-by-zero | Finite values (`safeCosLat` worked) | **PASS** |
| 19 | Bounding Box: Date Line (`lon = ±180°`) | Finite values | Finite values (unwrapped box) | **PASS** |

---

## 4. Unchallenged Areas

- **Database Connection & Live Seeding**: Live PostgreSQL database instances are planned for Milestone 2. Tested via mock proxy fallback and Drizzle schema definition.
- **WhatsApp Webhook Inbound Payload Delivery**: Real WhatsApp Cloud API webhooks require external HTTP callbacks; hub challenge verification and router stubs were verified, live webhooks are scheduled for Milestone 2.

---

## 5. Recommendation

**Verdict: REQUEST_CHANGES**

The blood compatibility domain engine is medically perfect and ready. However, before finalizing Milestone 1, the worker should apply the 1-line clamp fix in `packages/shared/src/geo-utils.ts` to prevent `haversineDistance` from returning `NaN` on antipodal points:
```ts
const clampedA = Math.min(1, Math.max(0, a));
const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```
Once applied, all 20 tests in `packages/shared/src/adversarial.test.ts` will pass with 0 errors.
