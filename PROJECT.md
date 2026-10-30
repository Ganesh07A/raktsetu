# Project: RaktKhoj (रक्तखोज) — Emergency Blood Discovery & Routing Engine

## Architecture Overview
RaktKhoj is an emergency blood discovery and routing Progressive Web App (PWA) designed for medical emergencies in India. It operates a two-stage active routing engine:
1. **Stage 1 (Institutional)**: Queries nearby blood banks with real-time stock inventory (via local database + eRaktKosh proxy), sorted by distance.
2. **Stage 2 (Community Fallback)**: If no blood banks or available stock exist within the selected radius (5 km, 10 km, 50 km), dynamically cascades to nearby compatible volunteer donors (enforcing ABO/Rh red blood cell compatibility matrix), triggers WhatsApp notifications with interactive quick-reply buttons (Accept/Decline), and displays accepted donor contact details in a real-time waiting room.

### Monorepo Structure (Turborepo + Bun)
```
d:\MEGA PROJECTS\raktsetu\
├── apps/
│   ├── web/        # Next.js 16 App Router PWA (Tailwind CSS v4, shadcn/ui, Leaflet, next-intl)
│   ├── api/        # Hono.js REST API on Bun (Blood bank search, eRaktKosh proxy, donor matcher, WhatsApp webhook)
│   └── docs/       # Next.js 16 landing / documentation site
├── packages/
│   ├── shared/     # Domain logic (RBC compatibility matrix, Haversine geo distance, i18n dictionaries, types)
│   ├── db/         # Drizzle ORM + PostgreSQL / Supabase schema (users, donor_profiles, blood_requests, etc.)
│   ├── ui/         # Modernized shadcn/ui component library with Tailwind v4 support
│   ├── eslint-config/      # Shared ESLint flat configurations
│   └── typescript-config/  # Shared TypeScript configurations
```

---

## Feature Inventory
Every feature from the approved implementation plan is enumerated and assigned to a milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Monorepo ESLint & Workspace Fix | Fix `@babel/preset-typescript` resolution, link workspaces with Bun | M1 | Survey |
| 2 | Blood Compatibility Matrix Engine | Exact RBC ABO/Rh donor-recipient compatibility rules & helper functions | M1 | Plan §Phase 1 |
| 3 | Haversine Geo Calculation & Bounding Box | Distance calculation in km and bounding box filtering for radius queries | M1 | Plan §Phase 1 |
| 4 | Bilingual Dictionary (EN & HI) | Complete English and Hindi medical & emergency terminology dictionaries | M1 | Plan §Phase 1 |
| 5 | Shared TypeScript Types & Schemas | Zod validation schemas and TypeScript types for all entities and API payloads | M1 | Plan §Phase 1 |
| 6 | Drizzle Database Schema (6 tables) | `users`, `donor_profiles`, `blood_requests`, `donor_notifications`, `blood_banks`, `blood_stock` | M1 | Plan §DB Schema |
| 7 | Database Client & Migrations Setup | Drizzle ORM client with postgres-js, migration generator, and seed capability | M1 | Plan §Phase 1 |
| 8 | Hono.js API Server Skeleton | Hono app running on Bun with CORS, logging, error handling, health endpoint | M1 | Plan §Phase 1 |
| 9 | Blood Banks Search API | `GET /api/v1/blood-banks/search` with distance sorting and stock info | M2 | Plan §Phase 3 |
| 10 | eRaktKosh Proxy & Cache Service | Scraper for `eraktkosh.mohfw.gov.in` with 15-min cache and local DB fallback | M2 | Plan §Phase 3 |
| 11 | State & District Master Endpoints | `GET /api/v1/blood-banks/states` & `GET /districts/:stateCode` | M2 | Plan §Phase 3 |
| 12 | Donor Registration API | `POST /api/v1/donors/register` with zod validation and profile creation | M2 | Plan §Phase 4 |
| 13 | Donor Matching Engine | Geographic radius query + RBC compatibility + soft eligibility (90/120 days) | M2 | Plan §Phase 4 |
| 14 | WhatsApp Cloud API Integration | Outbound template notifications with interactive quick-reply buttons | M2 | Plan §Phase 4 |
| 15 | WhatsApp Webhook & Event Handler | Signature verification, message delivery receipts, interactive button response handling | M2 | Plan §Phase 4 |
| 16 | Zero-Credential Local Mocking Layer | Mock WhatsApp service & seed database for testing without third-party keys | M2 | Survey & Plan |
| 17 | Blood Requests Lifecycle API | Create request, track status, record responses, cancel/fulfill request | M2 | Plan §Phase 4 |
| 18 | `packages/ui` shadcn/ui Primitives | 10 accessible components: Button, Card, Input, Select, Badge, Dialog, Toast, Skeleton, Stepper, PhoneInput | M3 | Plan §Phase 6 |
| 19 | Tailwind CSS v4 & Monorepo Theming | `@import "tailwindcss";`, `@source` scanning of `packages/ui`, blood-red theme | M3 | Survey & Plan |
| 20 | PWA Web App Manifest | `apps/web/app/manifest.ts` with standalone display, blood-red theme, app icons | M3 | Plan §Phase 2 |
| 21 | Custom Service Worker & Offline Fallback | `public/sw.js` with Cache-First static shell, map tile caching, `/offline` page | M3 | Plan §Phase 2 |
| 22 | Bilingual Routing & Engine | `next-intl` configuration for Hindi (`hi`) and English (`en`), language switcher | M3 | Plan §Phase 2 |
| 23 | Emergency Blood Discovery Form | Blood group selector (8 groups), GPS auto-detect, manual State/District, 5/10/50km presets | M4 | Plan §Phase 2 |
| 24 | Leaflet Interactive Map View | SSR-safe map rendering, user pin, blood bank markers, radius circle | M4 | Plan §Phase 2 |
| 25 | Cascading Search Results Flow | Stage 1 Blood Bank cards with stock indicators → Stage 2 automatic donor fallback | M4 | Plan §Phase 2 |
| 26 | Real-time Waiting Room | Live status tracking of donor notifications, countdown timer, donor contact unlock | M4 | Plan §Phase 2 |
| 27 | 5-Step Donor Registration Portal | Phone/OTP step, personal details, blood group, location picker, WhatsApp consent | M4 | Plan §Phase 5 |
| 28 | Donor Response Quick Action Page | `/donor/respond/[requestId]` deep-link response handler from WhatsApp | M4 | Plan §Phase 2 |
| 29 | Donor Dashboard | History of requests responded to, availability toggle, profile management | M4 | Plan §Phase 2 |
| 30 | Full Monorepo Build & E2E Test Suite Pass | 100% passing E2E test suite (Tiers 1-4) across monorepo build, API, and PWA | M5 | Protocol |
| 31 | Adversarial Coverage Hardening | Tier 5 white-box coverage audit, edge-case probing, zero regressions | M5 | Protocol |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation & Core Domain | Features 1–8: `@repo/shared`, `@repo/db`, `@repo/eslint-config` fix, API skeleton | none | DONE |
| M2 | Backend Services & API Layer | Features 9–17: eRaktKosh proxy, Donor Matcher, WhatsApp service/mock, Hono routes | M1 | DONE |
| M3 | UI System & Frontend Foundation | Features 18–22: `packages/ui` shadcn components, Tailwind v4, PWA manifest/SW, next-intl | M1 | DONE |
| M4 | Emergency Discovery & Donor Flow | Features 23–29: `apps/web` search, Leaflet map, cascading results, waiting room, donor portal | M2, M3 | DONE |
| M5 | Full Integration & E2E Verification | Features 30–31: Pass 100% E2E test suite (Tiers 1-4) + Tier 5 adversarial hardening | M4 | DONE |

---

## Interface Contracts

### 1. `@repo/shared` ↔ All Workspaces
- `getCompatibleDonorGroups(recipientBloodGroup: string): string[]`
- `isDonorCompatible(donorGroup: string, recipientGroup: string): boolean`
- `haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number`
- `getBoundingBox(lat: number, lon: number, radiusKm: number): { minLat, maxLat, minLon, maxLon }`
- `en` and `hi` dictionary objects containing namespaces: `common`, `bloodSearch`, `donor`, `request`, `status`

### 2. `apps/api` ↔ `apps/web` (HTTP REST)
- `GET /health` -> `{ status: "ok", timestamp: string }`
- `GET /api/v1/blood-banks/search?lat=&lng=&bloodGroup=&radiusKm=&state=&district=`
  -> `{ banks: BloodBankCardData[], totalCount: number, source: "database" | "eraktkosh" | "combined" }`
- `GET /api/v1/blood-banks/states` -> `{ states: { code: string, name: string }[] }`
- `GET /api/v1/blood-banks/districts/:stateCode` -> `{ districts: { code: string, name: string }[] }`
- `POST /api/v1/donors/register` -> `{ donor: DonorProfile, token?: string }`
- `POST /api/v1/requests` -> `{ request: BloodRequest, compatibleDonorsCount: number, notificationsSent: number }`
- `GET /api/v1/requests/:id` -> `{ request: BloodRequest, notifications: DonorNotificationSummary[], acceptedDonors: AcceptedDonorContact[] }`
- `POST /api/v1/requests/:id/respond` -> `{ success: boolean, status: "accepted" | "declined" }`
- `GET /api/v1/whatsapp/webhook` -> Hub challenge verification
- `POST /api/v1/whatsapp/webhook` -> Inbound WhatsApp payload handling

### 3. `packages/ui` ↔ `apps/web`
- Exported components: `Button`, `Card`, `Input`, `Select`, `Badge`, `Dialog`, `Toast`, `Skeleton`, `Stepper`, `PhoneInput`
- Utility: `cn(...inputs: ClassValue[]): string`

---

## Code Layout
- `apps/web/`
  - `app/[locale]/layout.tsx`, `page.tsx`, `search/page.tsx`, `search/results/page.tsx`
  - `app/[locale]/request/new/page.tsx`, `app/[locale]/request/[id]/page.tsx`
  - `app/[locale]/donor/register/page.tsx`, `app/[locale]/donor/respond/[id]/page.tsx`, `app/[locale]/donor/dashboard/page.tsx`
  - `app/[locale]/offline/page.tsx`
  - `app/manifest.ts`
  - `components/` (Leaflet map, search form, waiting room, blood bank card, donor card)
  - `public/sw.js`, `public/icons/`
- `apps/api/`
  - `src/index.ts`
  - `src/routes/` (`blood-banks.ts`, `donors.ts`, `requests.ts`, `whatsapp-webhook.ts`)
  - `src/services/` (`eraktkosh-proxy.ts`, `donor-matcher.ts`, `whatsapp.ts`, `mock-store.ts`)
- `packages/shared/`
  - `src/index.ts`
  - `src/blood-compatibility.ts`
  - `src/geo-utils.ts`
  - `src/types.ts`
  - `src/constants.ts`
  - `src/i18n/` (`en.ts`, `hi.ts`)
- `packages/db/`
  - `src/index.ts`
  - `src/schema/` (`users.ts`, `donor-profiles.ts`, `blood-requests.ts`, `donor-notifications.ts`, `blood-banks.ts`, `blood-stock.ts`, `index.ts`)
  - `drizzle.config.ts`
- `packages/ui/`
  - `src/button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `dialog.tsx`, `toast.tsx`, `skeleton.tsx`, `stepper.tsx`, `phone-input.tsx`
  - `src/lib/utils.ts`
