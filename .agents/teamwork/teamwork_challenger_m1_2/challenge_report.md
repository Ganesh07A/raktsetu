# Empirical Challenge Report — Milestone 1 Schema, API & Validation

**Challenger**: Challenger 2 (`teamwork_challenger_m1_2`)  
**Date**: 2026-10-30  
**Target Milestone**: Milestone 1 (Foundation & Core Domain)  
**Overall Risk Assessment**: **MEDIUM-HIGH**  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Executive Summary

Milestone 1 schema validation (`packages/shared/src/validation.ts`) and API server infrastructure (`apps/api/src/index.ts`) were subjected to adversarial empirical stress testing. Verification harnesses were executed via Bun test runners and direct REPL invocations.

### Key Empirical Findings:
1. **Silent "Null Island" Coercion in `coordinatesSchema` and `bloodSearchQuerySchema` [HIGH SEVERITY]**:
   `z.coerce.number()` relies on JavaScript's `Number(...)` coercion. When a frontend or client passes `null`, empty string `""`, `false`, or `[]` (typical when GPS is denied or query parameters are empty `?lat=&lng=`), coordinates are silently coerced to `(0, 0)` (Null Island in the Gulf of Guinea off Africa). In an emergency blood app, queries execute against coordinate (0, 0) returning 0 results instead of rejecting with a validation error.
2. **Premature Regex Rejection in `phoneSchema` [MEDIUM-HIGH SEVERITY]**:
   In `packages/shared/src/validation.ts`, `.regex(phoneRegex)` is executed *before* `.transform(replace(/[\s\-]/g, ''))`. Consequently, common Indian phone formats with spaces or dashes (`98765 43210`, `+91 98765 43210`, `98765-43210`) and Meta WhatsApp Cloud API inbound webhook formats (`919876543210`, which omit the `+` sign) are prematurely rejected.
3. **Missing Global JSON Error and 404 Handlers in Hono Server [MEDIUM SEVERITY]**:
   `apps/api/src/index.ts` lacks `app.onError(...)` and `app.notFound(...)`. Unhandled errors and unknown routes return `text/plain` (`"Internal Server Error"`, `"404 Not Found"`), breaking downstream JSON clients (such as Next.js `apps/web`) with `SyntaxError: Unexpected token 'I', "Internal S"... is not valid JSON`.
4. **Untrimmed Whitespace-Only Name Inputs [LOW SEVERITY]**:
   `name: z.string().min(2)` without `.trim()` permits whitespace-only names (`"   "`) for donors, patients, and hospitals.
5. **Robust / Verified Behaviors**:
   - `/health` endpoint strictly returns HTTP 200 with ISO 8601 UTC timestamp and rejects non-GET methods with 404.
   - CORS middleware correctly whitelists `http://localhost:3000` and `https://raktkhoj.org`, properly handles `OPTIONS` preflight, and refuses unwhitelisted/adversarial origins.
   - Integer bounds for units `[1, 20]`, patient age `[0, 120]`, donor weight `[45, 200]`, and search radius presets strictly `[5, 10, 50]` are correctly enforced.

---

## 2. Challenges & Findings

### [High] Challenge 1: Silent Coercion of Null / Empty Coordinates to (0, 0) ("Null Island")

- **File**: `packages/shared/src/validation.ts:24-27, 29-40`
- **Assumption Challenged**: That `z.coerce.number().min(-90).max(90)` safely converts string coordinates into numbers while rejecting missing or null coordinate payloads.
- **Attack / Failure Scenario**:
  In JavaScript:
  ```js
  Number(null) === 0;
  Number('') === 0;
  Number(false) === 0;
  Number([]) === 0;
  ```
  When a browser or client fails to obtain geolocation (e.g. user denies permission, or state initial value `{ latitude: null, longitude: null }` is sent), or when an HTTP query string sends empty values `GET /api/v1/blood-banks/search?lat=&lng=&bloodGroup=O+`, Zod coercion turns `lat` and `lng` into `0`.
  Because `0` is within `[-90, 90]` and `[-180, 180]`, validation succeeds without error!
- **Blast Radius**:
  The application attempts to search for blood banks, donors, or hospital coordinates at latitude `0.000000`, longitude `0.000000` in the Atlantic Ocean. Users in Indian medical emergencies will see 0 blood banks found with no error message indicating that their GPS coordinates were null or missing.
- **Empirical Proof**:
  ```ts
  coordinatesSchema.safeParse({ latitude: null, longitude: null });
  // Output: { success: true, data: { latitude: 0, longitude: 0 } }

  bloodSearchQuerySchema.safeParse({ lat: '', lng: '', bloodGroup: 'O+' });
  // Output: { success: true, data: { lat: 0, lng: 0, bloodGroup: 'O+', radiusKm: 10, componentType: 'whole_blood' } }
  ```
- **Mitigation**:
  Do not use bare `z.coerce.number()` for coordinates. Use `z.preprocess()` to ensure values are non-empty and non-null before parsing as a number, or use `z.number().min(-90).max(90)`:
  ```ts
  const coordinateNumber = z.preprocess((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }, z.number().min(-90).max(90));

  export const coordinatesSchema = z.object({
    latitude: coordinateNumber,
    longitude: coordinateNumber.pipe(z.number().min(-180).max(180)),
  });
  ```

---

### [Medium-High] Challenge 2: `phoneSchema` Premature Regex Rejection of Spaced Numbers & WhatsApp Webhook Payloads

- **File**: `packages/shared/src/validation.ts:9-22`
- **Assumption Challenged**: That `.regex(phoneRegex)` followed by `.transform(cleaned)` accommodates standard user-entered Indian phone numbers with spaces or dashes, as well as inbound Meta WhatsApp Cloud API webhooks.
- **Attack / Failure Scenario**:
  1. The schema defines:
     ```ts
     export const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;
     export const phoneSchema = z.string().trim().regex(phoneRegex, ...).transform((val) => {
       const cleaned = val.replace(/[\s\-]/g, '');
       ...
     });
     ```
     Because `.regex()` runs *before* `.transform()`, and `phoneRegex` requires `\d{9}` (9 consecutive digits without spaces or dashes), any number containing spaces or dashes within the 10 digits (e.g. `98765 43210` or `+91 98765 43210` or `98765-43210`) fails validation.
  2. Meta WhatsApp Business Cloud API delivers inbound messages with sender phone in E.164 format without a leading `+` (e.g. `"919876543210"`).
     In `phoneRegex`, the prefix group `(\+91[\-\s]?)?` requires a literal `+` before `91`. If the `+` is absent, the string is evaluated as a 12-digit number against `[6789]\d{9}`, which rejects it.
- **Blast Radius**:
  - Inbound WhatsApp webhook message processing fails when validating donor phone numbers.
  - End-users pasting mobile numbers with standard Indian formatting (5-5 split) will be blocked from registering or requesting blood.
- **Empirical Proof**:
  ```ts
  phoneSchema.safeParse('919876543210').success === false; // WhatsApp Cloud API inbound format
  phoneSchema.safeParse('98765 43210').success === false;  // Standard 5-5 format
  phoneSchema.safeParse('98765-43210').success === false;  // Dashed format
  phoneSchema.safeParse('+91 98765 43210').success === false;
  ```
- **Mitigation**:
  Sanitize the input string using `z.preprocess()` *before* regex validation, and accept `91` prefix with or without `+`:
  ```ts
  export const phoneSchema = z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    let cleaned = val.replace(/[\s\-]/g, '');
    if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
    else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);
    return cleaned;
  }, z.string().regex(/^[6789]\d{9}$/, 'Invalid Indian mobile number (+91 or 10 digits starting with 6-9)').transform((val) => `+91${val}`));
  ```

---

### [Medium] Challenge 3: Missing Global JSON Error Handling and 404 Handlers in Hono API

- **File**: `apps/api/src/index.ts:1-43`
- **Assumption Challenged**: That the API skeleton meets the specification of Feature 8 in `PROJECT.md` ("Hono app running on Bun with CORS, logging, error handling, health endpoint").
- **Attack / Failure Scenario**:
  - Hono's default behavior when no custom error handler is provided is to emit `text/plain` responses on unhandled exceptions (`status: 500, "Internal Server Error"`) and unmatched routes (`status: 404, "404 Not Found"`).
  - When consumers (Next.js frontend, PWA client, or test suites) perform `const data = await response.json()`, the response body cannot be parsed as JSON, resulting in an unhandled `SyntaxError`.
- **Blast Radius**:
  Frontend client crashes or opaque JSON parse errors whenever API encounters 404 or internal server errors.
- **Empirical Proof**:
  ```ts
  const res = await app.request('/non-existent-route');
  expect(res.headers.get('content-type')).toBe('text/plain; charset=UTF-8');
  expect(await res.text()).toBe('404 Not Found');

  app.get('/test-error', () => { throw new Error('Boom'); });
  const errRes = await app.request('/test-error');
  expect(errRes.headers.get('content-type')).toBe('text/plain; charset=UTF-8');
  expect(await errRes.text()).toBe('Internal Server Error');
  ```
- **Mitigation**:
  Add `app.notFound(...)` and `app.onError(...)` handlers in `apps/api/src/index.ts`:
  ```ts
  app.notFound((c) => {
    return c.json({ error: 'Not Found', message: `Route ${c.req.path} not found` }, 404);
  });

  app.onError((err, c) => {
    console.error(`Error on ${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: 'Internal Server Error', message: err.message }, 500);
  });
  ```

---

### [Low] Challenge 4: Untrimmed Whitespace-Only String Fields

- **File**: `packages/shared/src/validation.ts:44, 78, 81`
- **Assumption Challenged**: That `z.string().min(2)` rejects blank strings.
- **Attack Scenario**:
  A payload containing `"   "` (spaces) has length 3, which satisfies `.min(2)` because `.trim()` is missing.
- **Blast Radius**:
  Donors can register with empty names, and blood requests can be created with blank patient and hospital names.
- **Empirical Proof**:
  ```ts
  donorRegistrationSchema.safeParse({ ...baseDonor, name: '   ' }).success === true;
  createBloodRequestSchema.safeParse({ ...baseRequest, patientName: '  ', hospitalName: '  ' }).success === true;
  ```
- **Mitigation**:
  Add `.trim()` to all name fields: `z.string().trim().min(2, ...)`.

---

## 3. Stress Test Results Summary

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | Standard 10-digit phone (`9876543210`) | Normalize to `+919876543210` | Normalized to `+919876543210` | **PASS** |
| 2 | Phone with `+91` prefix (`+919876543210`) | Normalize to `+919876543210` | Normalized to `+919876543210` | **PASS** |
| 3 | Phone with spaces inside (`98765 43210`) | Strip spaces and normalize | Rejected (`false`) | **FAIL (Defect)** |
| 4 | Phone in WhatsApp Cloud API format (`919876543210`) | Accept and normalize | Rejected (`false`) | **FAIL (Defect)** |
| 5 | Phone with leading 0 trunk prefix (`09876543210`) | Handle or reject cleanly | Rejected | **PASS** (Strict) |
| 6 | Non-numeric / malicious phone string | Reject | Rejected (`false`) | **PASS** |
| 7 | Boundary coordinates (`[-90, 90], [-180, 180]`) | Accepted | Accepted | **PASS** |
| 8 | Out of bounds coordinates (`lat > 90` or `lon > 180`) | Rejected | Rejected | **PASS** |
| 9 | Null coordinates (`{ latitude: null, longitude: null }`) | Reject validation | Coerced to `(0, 0)` | **FAIL (Defect)** |
| 10 | Empty query lat/lng (`?lat=&lng=&bloodGroup=O+`) | Reject validation | Coerced to `(0, 0)` | **FAIL (Defect)** |
| 11 | Donor weight boundary (`44.9kg` vs `45kg` vs `200kg` vs `200.1kg`) | Enforce [45, 200] | Correctly enforced | **PASS** |
| 12 | Mandatory WhatsApp consent (`false` or missing) | Reject | Correctly rejected | **PASS** |
| 13 | Units needed integer bounds (`0`, `1`, `20`, `21`, `2.5`) | Accept only 1-20 int | Correctly enforced | **PASS** |
| 14 | Patient age bounds (`-1`, `0`, `120`, `121`, `25.5`) | Accept only 0-120 int | Correctly enforced | **PASS** |
| 15 | Search radius presets (`5, 10, 50` vs `15, 20, 100`) | Strictly accept 5, 10, 50 | Correctly enforced | **PASS** |
| 16 | Whitespace-only names (`"   "`) | Reject | Accepted (`true`) | **FAIL (Defect)** |
| 17 | `GET /health` headers & ISO timestamp format | 200 JSON, valid ISO 8601 | 200 JSON, valid ISO 8601 | **PASS** |
| 18 | Non-GET methods on `/health` (`POST`, `PUT`, `DELETE`) | 404 | 404 | **PASS** |
| 19 | CORS whitelist (`http://localhost:3000`, `https://raktkhoj.org`) | Returned in header | Returned in header | **PASS** |
| 20 | Adversarial / unwhitelisted CORS origins | Omitted | Omitted | **PASS** |
| 21 | OPTIONS preflight request handling | 204 with headers | 204 with headers | **PASS** |
| 22 | Unmatched routes (404 response format) | JSON error response | `text/plain` | **FAIL (Defect)** |
| 23 | Unhandled route exceptions (500 response format) | JSON error response | `text/plain` | **FAIL (Defect)** |

---

## 4. Unchallenged Areas

- **Live PostgreSQL Database Connection**:
  Milestone 1 implements Drizzle ORM schema definitions and client proxying without active Supabase credentials (deferred to Milestone 2).
- **Meta WhatsApp Cloud API Live Delivery**:
  Real network requests to Meta's Graph API endpoints are stubbed for Milestone 2 implementation.

---

## 5. Final Recommendation & Verdict

**Verdict**: **REQUEST_CHANGES**

The foundation is well-structured and passes basic happy-path unit tests. However, before proceeding to Milestone 2, the worker must resolve:
1. `coordinatesSchema` and `bloodSearchQuerySchema` silent coercion to `(0, 0)`.
2. `phoneSchema` rejection of space-separated numbers and WhatsApp webhook formats.
3. Missing JSON error handler (`app.onError`) and 404 handler (`app.notFound`) in `apps/api/src/index.ts`.
4. Adding `.trim()` to name fields in donor and request validation schemas.
