## 2026-10-30T06:10:36Z
You are Milestone 4 Worker (teamwork_worker).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m4\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md
4. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of:
- `apps/web/**` (routes, components, hooks, styles)

OBJECTIVE & DELIVERABLES:
Implement Milestone 4 (Emergency Discovery & Donor Flow) in `apps/web`:

1. **Leaflet Interactive Map View (`apps/web/components/map-view.tsx` or `apps/web/app/components/map-view.tsx`)**:
   - Install/ensure `leaflet` and `react-leaflet` are properly configured in `apps/web/package.json` with `@types/leaflet`.
   - SSR-safe: Wrap Leaflet map in dynamic import with `ssr: false` or provide safe client-side loading so it never crashes during Next.js SSR / Turbopack builds.
   - Support rendering: user location pin, radius circle (5km, 10km, 50km), blood bank markers with stock popups, donor markers (if applicable).
   - Use custom SVG / CSS marker icons (`L.divIcon`) to prevent missing marker PNG 404 errors.

2. **Emergency Blood Discovery Search Form (`apps/web/app/[locale]/search/page.tsx`)**:
   - Blood group selector: Grid of 8 buttons (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`) with prominent selection styling.
   - Location Picker:
     * GPS auto-detection button ("Use my current location" / "मेरा वर्तमान स्थान") with loading state and geolocation API.
     * Manual fallback: State dropdown (populated via `GET http://localhost:3002/api/v1/blood-banks/states` or fallback master list) and District dropdown (fetching `/api/v1/blood-banks/districts/:stateCode`).
   - Radius Selector: 3 fixed preset buttons (**5 km**, **10 km**, **50 km**).
   - Component type selector (Whole Blood, PRBC, FFP, Platelets) and units needed input (default 1).
   - Search CTA button leading to `/search/results` with query parameters.

3. **Cascading Search Results Flow (`apps/web/app/[locale]/search/results/page.tsx`)**:
   - Stage 1 (Institutional): Calls `GET /api/v1/blood-banks/search`. Displays blood bank cards sorted by proximity with:
     * Distance badge (e.g. `2.4 km`)
     * Available stock badge (e.g. `5 units available`)
     * eRaktKosh / verified badge
     * Hospital name, address, phone number, and direct click-to-call link (`tel:...`)
     * Embedded interactive map showing user pin, radius circle, and blood bank pins.
   - Stage 2 (Dynamic Donor Fallback):
     * If no blood banks found OR available stock is 0:
     * Prominently display: "No blood banks found with available stock within radius. Searching for compatible volunteer donors..."
     * Query compatible donors and show matching donor count.
     * Provide an emergency action: "Broadcast Emergency WhatsApp Alert to Compatible Donors" which calls `POST /api/v1/requests` and redirects family to the Real-Time Waiting Room (`/request/[id]`).

4. **Real-time Waiting Room (`apps/web/app/[locale]/request/[id]/page.tsx` + `components/waiting-room.tsx`)**:
   - Polling engine (every 3 seconds) querying `GET /api/v1/requests/:id`.
   - Displays live emergency status header: patient name, blood group needed, hospital.
   - Visual status progress: "Donors Notified" -> "Awaiting Acceptance" -> "Donor Accepted!".
   - Live notification counters: X sent, Y delivered, Z accepted.
   - **Crucial Feature**: While pending, donor phone numbers are masked for privacy. As soon as a donor accepts, the screen dynamically unlocks the donor's name, unmasked mobile number, click-to-call button (`tel:+91...`), and direct WhatsApp link (`https://wa.me/91...`).
   - "I Can Donate / Respond" direct action or shareable deep link for the donor.

5. **5-Step Donor Registration Portal (`apps/web/app/[locale]/donor/register/page.tsx`)**:
   - Step 1: Mobile phone input (with `+91`) + simulated/real OTP verification code.
   - Step 2: Personal details (full name, date of birth, gender, weight in kg).
   - Step 3: Blood group selector (8 blood groups).
   - Step 4: Location picker (GPS auto-detection or State/District selection).
   - Step 5: WhatsApp emergency notification consent checkbox + availability toggle.
   - Uses `Stepper` component for step progression.
   - On submission, calls `POST /api/v1/donors/register` and displays celebratory confirmation with blood drop animation and donor badge.

6. **Donor Response Quick Action Page (`apps/web/app/[locale]/donor/respond/[id]/page.tsx`)**:
   - Page opened from WhatsApp notification deep link.
   - Displays emergency request summary (patient name, blood group, hospital name, distance).
   - Two large interactive buttons:
     * [✅ I Can Donate / मैं रक्तदान के लिए तैयार हूँ] (calls `POST /api/v1/requests/:id/respond` with `status: 'accepted'`)
     * [❌ Not Available / अभी उपलब्ध नहीं] (calls `POST /api/v1/requests/:id/respond` with `status: 'declined'`)
   - Shows thank you screen with hospital directions and contact options after response.

7. **Donor Dashboard (`apps/web/app/[locale]/donor/dashboard/page.tsx`)**:
   - Shows donor profile, blood group, location.
   - Availability toggle switch.
   - Emergency donation requests history and contribution stats.

8. **Full Monorepo Linking & Verification**:
   - Run `bun install`.
   - Run `bun run check-types` across all workspaces.
   - Run `bun run lint` across all workspaces.
   - Run `bun run build` across all workspaces (specifically verifying `apps/web` compiles cleanly with Next.js 16 App Router, Turbopack, and SSR-safe Leaflet).
   - Run `bun test` and `bun test tests/e2e` (all 328+ tests must pass 100%).

REPORTING:
- Write your changes log to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m4\changes.md`
- Write your final handoff report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m4\handoff.md`
- When complete, send a message to parent reporting build & test verification results.
