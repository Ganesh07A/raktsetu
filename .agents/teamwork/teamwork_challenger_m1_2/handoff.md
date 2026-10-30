# Milestone 1 Handoff Report: Empirical Challenge (Schema, API & Validation)

**Agent**: Challenger 2 (`teamwork_challenger_m1_2`)  
**Parent Conversation ID**: `9c9197d0-fd6d-4bbf-8faa-7bae79786334`  
**Date**: 2026-10-30  
**Verdict**: **REQUEST_CHANGES**  
**Handoff Type**: Hard Handoff  

---

## 1. Observation

1. **`coordinatesSchema` and `bloodSearchQuerySchema` Coercion**:
   - In `packages/shared/src/validation.ts:24-27`:
     ```ts
     export const coordinatesSchema = z.object({
       latitude: z.coerce.number().min(-90).max(90),
       longitude: z.coerce.number().min(-180).max(180),
     });
     ```
   - Running verification command:
     ```powershell
     bun -e "import { coordinatesSchema } from './packages/shared/src/validation'; console.log(coordinatesSchema.safeParse({ latitude: null, longitude: null }));"
     ```
     Verbatim output:
     ```json
     {
       "success": true,
       "data": {
         "latitude": 0,
         "longitude": 0
       }
     }
     ```
   - Running verification command on empty query string parameters:
     ```powershell
     bun -e "import { bloodSearchQuerySchema } from './packages/shared/src/validation'; console.log(bloodSearchQuerySchema.safeParse({ lat: '', lng: '', bloodGroup: 'O+' }));"
     ```
     Verbatim output:
     ```json
     {
       "success": true,
       "data": {
         "lat": 0,
         "lng": 0,
         "bloodGroup": "O+",
         "radiusKm": 10,
         "componentType": "whole_blood"
       }
     }
     ```

2. **`phoneSchema` Premature Regex Rejection**:
   - In `packages/shared/src/validation.ts:9-22`:
     ```ts
     export const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;

     export const phoneSchema = z
       .string()
       .trim()
       .regex(phoneRegex, {
         message: 'Invalid Indian mobile number (+91 or 10 digits starting with 6-9)',
       })
       .transform((val) => {
         const cleaned = val.replace(/[\s\-]/g, '');
         if (cleaned.startsWith('+91')) return cleaned;
         if (cleaned.length === 10) return `+91${cleaned}`;
         return cleaned;
       });
     ```
   - Running verification commands:
     ```powershell
     bun -e "import { phoneSchema } from './packages/shared/src/validation'; console.log('+91 98765 43210:', phoneSchema.safeParse('+91 98765 43210').success); console.log('98765 43210:', phoneSchema.safeParse('98765 43210').success); console.log('919876543210:', phoneSchema.safeParse('919876543210').success);"
     ```
     Verbatim output:
     ```
     +91 98765 43210: false
     98765 43210: false
     919876543210: false
     ```

3. **Missing Global Error Handler & 404 Handler in `apps/api/src/index.ts`**:
   - In `apps/api/src/index.ts:9-20`, only `logger()` and `cors()` are registered. There is no `app.onError` or `app.notFound`.
   - Running verification commands:
     ```powershell
     bun -e "import { app } from './apps/api/src/index'; const res = await app.request('/unknown'); console.log('status:', res.status, 'body:', await res.text(), 'type:', res.headers.get('content-type'));"
     ```
     Verbatim output:
     ```
     status: 404 body: 404 Not Found type: text/plain; charset=UTF-8
     ```
     And for unhandled errors:
     ```powershell
     bun -e "import { app } from './apps/api/src/index'; app.get('/test-error', () => { throw new Error('Boom'); }); const res = await app.request('/test-error'); console.log('status:', res.status, 'body:', await res.text(), 'type:', res.headers.get('content-type'));"
     ```
     Verbatim output:
     ```
     status: 500 body: Internal Server Error type: text/plain; charset=UTF-8
     ```

4. **Untrimmed Name Strings**:
   - In `packages/shared/src/validation.ts:44, 78, 81`:
     `name: z.string().min(2, 'Name must be at least 2 characters')`
   - Running verification command:
     ```powershell
     bun -e "import { donorRegistrationSchema } from './packages/shared/src/validation'; const base = { phone: '9876543210', name: '   ', bloodGroup: 'B+', latitude: 28.6, longitude: 77.2, state: 'Delhi', district: 'New Delhi', whatsappConsent: true }; console.log('whitespace name:', donorRegistrationSchema.safeParse(base).success);"
     ```
     Verbatim output:
     ```
     whitespace name: true
     ```

5. **Test Suite Execution**:
   - Running `bun test tests/adversarial-milestone1.test.ts`:
     Verbatim output:
     ```
     39 pass
     0 fail
     192 expect() calls
     Ran 39 tests across 1 file. [138.00ms]
     ```

---

## 2. Logic Chain

1. **Reasoning from Observation 1 (Null Island Coercion)**:
   - In JavaScript, `Number(null)` and `Number("")` equal `0`.
   - In `packages/shared/src/validation.ts:25-26, 30-31`, `latitude` and `lat` use `z.coerce.number().min(-90).max(90)`.
   - Since $0 \in [-90, 90]$ and $0 \in [-180, 180]$, passing `null` or empty string `""` succeeds and transforms coordinates to $(0^\circ, 0^\circ)$.
   - In an emergency application, searching for blood banks at $(0, 0)$ (Gulf of Guinea) returns 0 results silently, preventing patients in India from receiving emergency blood assistance when geolocation fails.
   - Therefore, `z.coerce.number()` without null/empty preprocessing is a critical flaw.

2. **Reasoning from Observation 2 (Phone Validation)**:
   - In `packages/shared/src/validation.ts:11-22`, `.regex(phoneRegex)` is chained prior to `.transform()`.
   - `phoneRegex` does not permit spaces or dashes within the 10-digit mobile sequence (`\d{9}`).
   - Furthermore, Meta WhatsApp Cloud API sends inbound sender IDs in standard E.164 without `+` (e.g. `919876543210`). Because `phoneRegex` requires `(\+91[\-\s]?)?`, `919876543210` is evaluated as 12 digits against a 10-digit matcher and rejected.
   - In Milestone 2, WhatsApp webhook message routing and donor matching will fail on inbound messages.
   - Therefore, sanitization must occur before regex evaluation.

3. **Reasoning from Observation 3 (API Error Handling)**:
   - Feature 8 in `PROJECT.md` mandates "Hono app running on Bun with CORS, logging, error handling, health endpoint".
   - Without `app.onError` and `app.notFound`, errors emit `text/plain`.
   - Client applications using `await res.json()` will throw `SyntaxError`, obscuring error details.
   - Therefore, global JSON error handlers must be added to `apps/api/src/index.ts`.

4. **Reasoning from Observation 4 (Untrimmed Strings)**:
   - `z.string().min(2)` without `.trim()` counts whitespace characters.
   - `"   "` has length 3 and passes validation.
   - Therefore, `.trim()` is required to prevent blank records in the database.

---

## 3. Caveats

- **Scope Boundary**: This evaluation focuses strictly on Milestone 1 schemas and API skeleton. Downstream features (eRaktKosh scraper proxy, live WhatsApp API, Supabase database migrations) belong to Milestone 2.
- **Antipodal Haversine Flaw**: As established by Challenger 1 (`teamwork_challenger_m1_1`), `haversineDistance(45, 60, -45, -120)` in `packages/shared/src/geo-utils.ts` also requires clamping to prevent `NaN` due to floating-point rounding.

---

## 4. Conclusion

Milestone 1 implements solid architectural foundations, but contains four empirical validation defects:
1. `coordinatesSchema` & `bloodSearchQuerySchema` silently coerce null and empty coordinates to $(0, 0)$.
2. `phoneSchema` prematurely rejects spaced/dashed phone numbers and WhatsApp E.164 webhook numbers.
3. `apps/api/src/index.ts` is missing global JSON error and 404 handlers.
4. Name fields accept whitespace-only strings.

**Final Verdict**: **REQUEST_CHANGES**

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Coercion Flaw**:
   ```powershell
   bun -e "import { coordinatesSchema } from './packages/shared/src/validation'; console.log(coordinatesSchema.safeParse({ latitude: null, longitude: null }));"
   ```
   *Expected defect*: Returns `{ success: true, data: { latitude: 0, longitude: 0 } }`.

2. **Verify Phone Regex Flaw**:
   ```powershell
   bun -e "import { phoneSchema } from './packages/shared/src/validation'; console.log(phoneSchema.safeParse('919876543210').success); console.log(phoneSchema.safeParse('98765 43210').success);"
   ```
   *Expected defect*: Both output `false`.

3. **Verify API Error Format Flaw**:
   ```powershell
   bun -e "import { app } from './apps/api/src/index'; const res = await app.request('/unknown'); console.log(res.headers.get('content-type'));"
   ```
   *Expected defect*: Outputs `text/plain; charset=UTF-8`.

4. **Run Adversarial Suite**:
   ```powershell
   bun test tests/adversarial-milestone1.test.ts
   ```
   *Expected*: Runs 39 adversarial assertions across schemas and API server.

5. **Invalidation Condition**:
   - Applying `z.preprocess()` to sanitize phone numbers and validate coordinates, adding `app.onError` and `app.notFound` to `apps/api/src/index.ts`, and adding `.trim()` to string schemas resolves all four issues.
