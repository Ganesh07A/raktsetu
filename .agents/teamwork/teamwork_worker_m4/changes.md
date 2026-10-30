# Milestone 4 Changes Log

## Overview
Implemented Milestone 4 (Emergency Discovery & Donor Flow) in `apps/web` with bilingual support (Hindi & English), Leaflet interactive maps with SSR-safety and custom SVG DivIcons, cascading search results with dynamic community fallback, real-time polling waiting room with donor contact unmasking, 5-step donor registration wizard, donor response quick action page, and donor dashboard.

## Modified & Created Files

### 1. Configuration & Dependencies
- `apps/web/package.json`:
  * Added `leaflet: "^1.9.4"`, `react-leaflet: "^5.0.0"`, `zod: "^3.23.8"`, and devDependency `@types/leaflet: "^1.9.16"`.
- `apps/web/app/globals.css`:
  * Added `@import "leaflet/dist/leaflet.css";` for proper tile, popup, and circle rendering.
- `apps/web/tsconfig.json`:
  * Updated `"exclude"` to ignore test files from Next.js route typegen.

### 2. Map Components
- `apps/web/components/map-view-inner.tsx` (NEW):
  * Pure client component rendering `MapContainer`, `TileLayer`, `Circle`, `Marker`, `Popup`, and `MapRecenter`.
  * OpenStreetMap raster tiles (no external API keys required).
  * Custom `L.divIcon` implementations for user location (pulsing blue dot), blood banks (red hospital cross teardrop), and volunteer donors (emerald green blood-drop pin) to prevent missing PNG 404s.
  * Radius circle rendering in meters (`radiusKm * 1000`) with semi-transparent red styling.
- `apps/web/components/map-view.tsx` (NEW):
  * SSR-safe dynamic wrapper using `next/dynamic` with `ssr: false` and a skeleton fallback.
- `apps/web/app/components/map-view.tsx` (NEW):
  * Re-export wrapper providing route-relative access.

### 3. Emergency Discovery Search Form
- `apps/web/app/[locale]/search/page.tsx` (NEW):
  * 8 ABO/Rh blood groups grid with prominent active selection styling, checkmark badge, and universal donor/recipient tags.
  * Dual-mode location picker: 1-click GPS auto-detection (`navigator.geolocation`) with radar spinner, and cascading State & District dropdowns with fallback master data.
  * Preset radius buttons: 5 km (Metro), 10 km (Default), 50 km (Wide).
  * Component selector (Whole Blood, PRBC, Platelets, FFP) and units needed counter.
  * Search CTA button navigating to `/search/results` with query parameters.

### 4. Cascading Search Results Flow
- `apps/web/app/[locale]/search/results/page.tsx` (NEW):
  * Embedded interactive Leaflet map displaying user epicenter, radius boundary, and facility pins.
  * **Stage 1 (Institutional)**: Queries `GET /api/v1/blood-banks/search`, displaying cards sorted by proximity with distance badge, stock badge, eRaktKosh verified badge, address, click-to-call link, and Google Maps directions link.
  * **Stage 2 (Dynamic Volunteer Donor Fallback)**: Automatically activates when blood banks have 0 stock. Displays emergency alert banner, queries `GET /api/v1/donors/compatible`, shows compatible group list and matching donor count, and provides 1-click modal to broadcast emergency WhatsApp alerts (`POST /api/v1/requests`) and transition to the waiting room.

### 5. Real-Time Waiting Room
- `apps/web/components/waiting-room.tsx` (NEW):
  * Automatic polling engine querying `GET /api/v1/requests/:id` every 3 seconds.
  * Urgency header with patient name, hospital, blood group, and units needed.
  * 3-step visual status stepper: "Donors Notified" -> "Awaiting Acceptance" -> "Donor Accepted!".
  * Real-time metrics counters: Sent, Delivered, Accepted.
  * **Privacy Unmasking Feature**: Donor phone numbers are masked (`+91 98****3210`) while pending. The moment a donor accepts, the screen dynamically unlocks the donor's full name, unmasked mobile number, 1-tap call button (`tel:+91...`), and direct WhatsApp chat link (`https://wa.me/91...`).
  * Deep-link share button and test simulator action.
- `apps/web/app/[locale]/request/[id]/page.tsx` (NEW):
  * Async page wrapper loading `WaitingRoom`.

### 6. 5-Step Donor Registration Portal
- `apps/web/app/[locale]/donor/register/page.tsx` (NEW):
  * Integrated with `Stepper` component for visual step progression.
  * Step 1: Phone number with `+91` flag badge and OTP verification (pre-filled test code `123456`).
  * Step 2: Personal details (name, date of birth, gender, weight in kg with NBTC $\ge 45$ kg check).
  * Step 3: Blood group selector (8 groups) and optional last donation date.
  * Step 4: Location picker (GPS auto-detect or manual State/District) and response radius (5, 10, 25 km).
  * Step 5: Mandatory WhatsApp emergency consent checkbox and active availability toggle.
  * On submission, calls `POST /api/v1/donors/register` and presents a celebratory Digital Donor ID Card.

### 7. Donor Quick Response Action Page
- `apps/web/app/[locale]/donor/respond/[id]/page.tsx` (NEW):
  * Target of WhatsApp deep links (`/donor/respond/:id`).
  * Displays emergency request summary (patient, blood group, hospital).
  * Two giant interactive buttons:
    * `[✅ I Can Donate / मैं रक्तदान के लिए तैयार हूँ]` -> calls `POST /api/v1/requests/:id/respond` with `status: 'accepted'`.
    * `[❌ Not Available / अभी उपलब्ध नहीं]` -> calls `POST /api/v1/requests/:id/respond` with `status: 'declined'`.
  * Thank you screen with hospital navigation directions and family contact options.

### 8. Donor Dashboard
- `apps/web/app/[locale]/donor/dashboard/page.tsx` (NEW):
  * Displays donor profile, blood group, registered district/state, and mobile number.
  * Interactive Availability toggle with live API updates via `PATCH /api/v1/donors/profile/:id/availability`.
  * Contribution statistics (Total Donations, Lives Impacted, Response Radius, Tier).
  * Emergency donation history records.

### 9. Test Suite Verification
- `tests/milestone4-web.test.ts` (NEW):
  * 17 behavior and contract tests covering all Milestone 4 deliverables.
  * Passes 100% alongside the 328-test E2E test suite (total 513 passing tests across the monorepo).
