# Survey Report: Monorepo & Infrastructure Assessment

**Project**: RaktKhoj / RaktSetu (`d:\MEGA PROJECTS\raktsetu`)  
**Investigator**: Survey Explorer 1 (`teamwork_explorer`)  
**Date**: 2026-10-30  
**References**:
- `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md`
- `C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md`

---

## 1. Executive Summary

The repository `d:\MEGA PROJECTS\raktsetu` is a freshly scaffolded **Turborepo** monorepo using **Bun** (`1.4.2`) as its package manager and runtime orchestrator. It currently contains boilerplate Next.js applications (`apps/web`, `apps/docs`) and core configuration packages (`packages/ui`, `packages/eslint-config`, `packages/typescript-config`).

All groundwork for wildcard workspaces (`apps/*`, `packages/*`) and Turbo 2.x task pipelines is already in place. However:
1. None of the domain packages or services for RaktKhoj exist yet (`packages/db`, `packages/shared`, `apps/api`).
2. `apps/web` is vanilla Next.js 16 with standard CSS modules, completely lacking Tailwind CSS, shadcn/ui, next-intl, Leaflet, and PWA capabilities.
3. `packages/ui` contains only 3 skeleton components and lacks Radix UI primitives and utility classes (`clsx`, `tailwind-merge`, `cva`).
4. An existing lint failure (`bun run lint`) was uncovered in `@repo/ui` due to ESLint Flat config attempting to resolve `@babel/preset-typescript` from consumer packages where it is not installed.
5. Bun is installed (`1.4.2`), but system Node.js is `v22.18.0`, whereas root `package.json` specifies `"engines": { "node": ">=24" }`. Bun runs without issues, but tools strictly checking Node engines will need awareness.

---

## 2. Monorepo Root & Infrastructure Inspection

### 2.1 File Catalog & Current Configuration

| File | Status | Current Content / Role | Needed Action |
|------|--------|------------------------|---------------|
| `package.json` | Present | Sets `"workspaces": ["apps/*", "packages/*"]`, scripts (`build`, `dev`, `lint`, `format`, `check-types`), `turbo@^2.11.10`, `prettier@3.9.6`, `typescript@7.0.2`, `engines.node: ">=24"`, `devEngines.packageManager: "bun@1.4.2"`. | Ready as-is for wildcard packages. No structural workspace edits needed, though root scripts can add convenience aliases if desired. |
| `turbo.json` | Present | Turbo 2 schema (`ui: "tui"`). Tasks: `build`, `lint`, `check-types`, `dev`, `db:generate`, `db:migrate`, `db:push`. | Already contains `db:*` tasks specified in the plan! Only verify environment variable passthrough (e.g. `DATABASE_URL`, `NEXT_PUBLIC_*`) when running tasks. |
| `AGENTS.md` | Present | Managed block for Turborepo CLI agent guidance. | Must remain untouched and committed. |
| `bun.lock` | Present | Text-format lockfile (`lockfileVersion: 2`, `configVersion: 1`). Lists workspaces `apps/docs`, `apps/web`. | Will update automatically when new packages (`apps/api`, `packages/db`, `packages/shared`) and dependencies are installed via `bun install`. |
| `.npmrc` | Present | Empty file (0 bytes). | Keep or configure if registry tokens are required. |
| `.gitignore` | Present | Standard monorepo ignore (.turbo, node_modules, dist, .next). | Add `.env`, `.env.local`, `.env*.local` if not already present. |

### 2.2 Turborepo Version & Rules

- **Turborepo Version**: `2.11.10`
- Matches installed package in `node_modules/turbo`.
- Per `AGENTS.md` instructions, configuration follows Turborepo 2.x standards (`tasks` map, `dependsOn`, `inputs`, `outputs`).

---

## 3. Existing Apps & Packages Analysis

### 3.1 Existing Applications

#### `apps/web`
- **Current State**:
  - Next.js `16.3.8`, React `19.2.8`, React DOM `19.2.8`.
  - Standard App Router starter (`app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/page.module.css`).
  - Font loading via `next/font/local` (GeistVF).
  - Vanilla CSS variables, NO Tailwind CSS, NO PostCSS setup.
  - Standard `public/` assets (`next.svg`, `vercel.svg`, etc.).
- **Delta vs Plan**:
  - Missing Tailwind CSS v4 / PostCSS setup (`@tailwindcss/postcss`, `tailwindcss`).
  - Missing dependencies: `@repo/shared`, `next-intl`, `react-leaflet`, `leaflet`, `@types/leaflet`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `zod`, `zustand`.
  - Missing PWA structure: `app/manifest.ts`, `public/sw.js`, `public/icons/` (192, 512, apple-touch).
  - Missing localized routing: `[locale]/layout.tsx`, `[locale]/page.tsx`, `[locale]/search/**`, `[locale]/donor/**`, `[locale]/request/**`, `[locale]/about/**`.
  - Missing emergency discovery UI components: `blood-group-selector.tsx`, `location-picker.tsx`, `blood-bank-card.tsx`, `donor-card.tsx`, `radius-selector.tsx`, `waiting-room.tsx`, `map-view.tsx`, `language-switcher.tsx`.

#### `apps/docs`
- **Current State**: Boilerplate Next.js 16 app on port 3001.
- **Delta vs Plan**: Plan designates this for future marketing/landing documentation. No blocking work required for Phase 1.

### 3.2 Existing Packages

#### `packages/ui`
- **Current State**:
  - Exports `./*` to `./src/*.tsx`.
  - Contains only 3 skeletal files: `button.tsx`, `card.tsx`, `code.tsx`.
  - No styling framework or utilities bundled.
- **Delta vs Plan**:
  - Must install `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, and `@radix-ui/react-*` components (`dialog`, `select`, `tabs`, `toast`, `slot`).
  - Needs `src/lib/utils.ts` defining `cn(...)`.
  - Needs shadcn-compatible components: `button.tsx` (re-engineered), `card.tsx` (re-engineered), `input.tsx`, `select.tsx`, `badge.tsx`, `dialog.tsx`, `toast.tsx`, `skeleton.tsx`, `stepper.tsx`, `phone-input.tsx`.

#### `packages/typescript-config`
- **Current State**:
  - `base.json` (`NodeNext` module/resolution, ES2022, strict mode, isolatedModules).
  - `nextjs.json` (extends `base.json`, `Bundler` module resolution, `jsx: "preserve"`, `noEmit: true`).
  - `react-library.json` (extends `base.json`, `jsx: "react-jsx"`).
- **Delta vs Plan**: Complete and functional. Ready to be extended by `packages/db`, `packages/shared`, and `apps/api`.

#### `packages/eslint-config`
- **Current State**: Flat config format (`base.js`, `next.js`, `react-internal.js`).
- **Defect Discovered**:
  - `base.js` configures `@babel/eslint-parser` with `presets: ["@babel/preset-typescript"]`.
  - `@babel/preset-typescript` is listed in `packages/eslint-config/package.json` devDependencies.
  - When `@repo/ui` runs `eslint .`, the ESLint engine running from `packages/ui` cannot resolve `@babel/preset-typescript`.
  - **Error observed**: `Parsing error: Cannot find package '@babel/preset-typescript' imported from D:\MEGA PROJECTS\raktsetu\packages\ui\babel-virtual-resolve-base.js`.
  - **Remediation**: In `packages/eslint-config/package.json`, `@babel/preset-typescript` and `@babel/eslint-parser` should either be in `dependencies` (or `peerDependencies`), or root/package installs should ensure resolution, or parser options should resolve preset path using `createRequire(import.meta.url).resolve('@babel/preset-typescript')`.

---

## 4. Missing Components Required by Implementation Plan

### 4.1 Missing Workspace Packages

#### 1. `packages/shared/` (Phase 1)
- **Role**: Common domain logic shared across `apps/web` and `apps/api`.
- **Files to create**:
  - `package.json` (`name: "@repo/shared"`, `exports: { ".": "./src/index.ts", "./blood-compatibility": "./src/blood-compatibility.ts", "./geo-utils": "./src/geo-utils.ts", "./i18n/*": "./src/i18n/*.ts" }`).
  - `tsconfig.json` (extends `@repo/typescript-config/base.json`).
  - `src/index.ts`
  - `src/blood-compatibility.ts` (ABO & Rh RBC compatibility matrix `RBC_COMPATIBILITY`, `getCompatibleDonorGroups`, `isDonorCompatible`).
  - `src/geo-utils.ts` (Haversine formula for distance in km between lat/lng coordinates).
  - `src/types.ts` & `src/constants.ts` (BloodGroup, RequestStatus, EmergencyType, preset radiuses 5/10/50 km).
  - `src/i18n/en.ts` & `src/i18n/hi.ts` (Bilingual UI strings for blood search, donor portal, emergency requests).

#### 2. `packages/db/` (Phase 1)
- **Role**: Data access layer with Drizzle ORM and PostgreSQL / Supabase.
- **Dependencies**: `drizzle-orm@^0.39.0`, `postgres@^3.4.0`, `@repo/shared@*`. Dev: `drizzle-kit@^0.30.0`.
- **Files to create**:
  - `package.json` (`name: "@repo/db"`, scripts for `db:generate`, `db:migrate`, `db:push`, `db:studio`).
  - `tsconfig.json` (extends `@repo/typescript-config/base.json`).
  - `drizzle.config.ts` (schema path `./src/schema`, dialect `postgresql`).
  - `src/index.ts` (Drizzle client instance exported as `db`).
  - `src/schema/index.ts` (Barrel export).
  - `src/schema/users.ts` ( seekers, donors, admins, phones, language preference ).
  - `src/schema/donor-profiles.ts` (blood group, lat/lng, state, district, city, DOB, gender, weight, last_donation_date, is_available, search_radius_km, whatsapp_consent).
  - `src/schema/blood-requests.ts` (requester_id, blood_group_needed, component_type, units_needed, patient info, hospital, lat/lng, radius, status, fulfillment_source).
  - `src/schema/donor-notifications.ts` (request_id, donor_id, whatsapp_message_id, status: pending/sent/delivered/read/accepted/declined/expired/failed).
  - `src/schema/blood-banks.ts` (name, license, state, district, address, phone, lat/lng, source: eraktkosh/manual/partner, is_verified).
  - `src/schema/blood-stock.ts` (bank_id, blood_group, component_type, units_available, earliest_expiry, last_updated).

#### 3. `apps/api/` (Phase 1 & 3 & 4)
- **Role**: Hono.js REST API server running on Bun runtime.
- **Dependencies**: `hono@^4.7.0`, `@hono/zod-validator@^0.5.0`, `zod@^3.23.0`, `@repo/db@*`, `@repo/shared@*`. Dev: `@types/bun@latest`.
- **Files to create**:
  - `package.json` (`name: "api"`, scripts for `dev`, `build`, `start`, `check-types`, `lint`).
  - `tsconfig.json` (extends `@repo/typescript-config/base.json` or bun tsconfig).
  - `src/index.ts` (Hono app instance, CORS middleware, logger, route mounting on port 3002).
  - `src/routes/blood-banks.ts` (GET `/search`, `/states`, `/districts/:stateCode`).
  - `src/routes/donors.ts` (POST `/register`, GET `/compatible`).
  - `src/routes/requests.ts` (POST `/`, GET `/:id`, PATCH `/:id/status`).
  - `src/routes/whatsapp-webhook.ts` (GET webhook verify, POST webhook event receiver).
  - `src/services/eraktkosh-proxy.ts` (Gov eRaktKosh scraper / cache layer).
  - `src/services/donor-matcher.ts` (Geospatial donor matching + compatibility filtering).
  - `src/services/whatsapp.ts` (WhatsApp Cloud API test-mode client + interactive templates).
  - `src/middleware/auth.ts` (Supabase JWT verification).

---

## 5. Runtime, Compatibility & Execution Nuances

### 5.1 Bun vs Node.js Environment
- **Bun Version**: `1.4.2` (located in PATH).
- **Node.js Version**: `v22.18.0`.
- **Root `engines.node`**: `"node": ">=24"`.
  - Running `node` scripts may emit engine warnings if package managers enforce engines strictly.
  - Using Bun as the package manager (`bun install`, `bun run build`, `bun run dev`) bypasses Node engine checks and works natively.
- **Type Checking**:
  - TypeScript `7.0.2` is installed and verified working across packages (`bun run check-types` passed in 8.9s).
- **Next.js & React Compatibility**:
  - Next.js `16.3.8` is running React `19.2.8`.
  - Any React UI libraries added to `packages/ui` (e.g. Radix UI primitives, Lucide React) must be compatible with React 19. (Radix UI modern releases support React 19, or `--legacy-peer-deps` semantics in Bun lockfile if needed).

### 5.2 Package Manager Nuances (Bun Workspaces)
- `bun pm ls` properly recognizes workspaces:
  - `@repo/eslint-config@workspace:packages\eslint-config`
  - `@repo/typescript-config@workspace:packages\typescript-config`
  - `@repo/ui@workspace:packages\ui`
  - `docs@workspace:apps\docs`
  - `web@workspace:apps\web`
- When adding new workspaces (`apps/api`, `packages/db`, `packages/shared`), creating their `package.json` with workspace wildcards `apps/*` and `packages/*` and running `bun install` will instantly link them into the monorepo graph.

---

## 6. Actionable Implementation Checklist for Subsequent Phases

### Prerequisite Fixes (Phase 1 Pre-Flight)
1. **Fix `@repo/eslint-config` resolution**:
   Update `packages/eslint-config/base.js` or `package.json` so `@babel/preset-typescript` can be resolved by consumer workspaces, ensuring `bun run lint` passes across all packages.

### Phase 1: Foundation
1. Create `packages/shared/` with:
   - RBC compatibility logic (`src/blood-compatibility.ts`)
   - Haversine distance calculator (`src/geo-utils.ts`)
   - Shared types and constants (`src/types.ts`, `src/constants.ts`)
   - Translation dictionaries (`src/i18n/en.ts`, `src/i18n/hi.ts`)
2. Create `packages/db/` with:
   - Drizzle schema definitions for all 6 tables (`users`, `donor_profiles`, `blood_requests`, `donor_notifications`, `blood_banks`, `blood_stock`)
   - Client export (`src/index.ts`) and `drizzle.config.ts`
3. Create `apps/api/` with:
   - Hono server entry (`src/index.ts`)
   - Skeleton route files (`blood-banks`, `donors`, `requests`, `whatsapp-webhook`)
4. Run `bun install` at monorepo root to link the 3 new workspaces into `bun.lock`.
5. Verify `bun run check-types`.

### Phase 2: Frontend PWA (`apps/web`) & UI (`packages/ui`)
1. Configure Tailwind CSS v4 in `apps/web` and `packages/ui`.
2. Upgrade `packages/ui` with `class-variance-authority`, `clsx`, `tailwind-merge`, Radix UI components, and shadcn component implementations.
3. Install dependencies in `apps/web` (`next-intl`, `react-leaflet`, `leaflet`, `lucide-react`, `zustand`).
4. Implement PWA manifest (`app/manifest.ts`), icons, and service worker registration (`public/sw.js`).
5. Build bilingual routes and core emergency search views.

### Phase 3 & 4: API Integrations
1. Build `eraktkosh-proxy.ts` and `blood-banks.ts` route.
2. Build `donor-matcher.ts` and `whatsapp.ts` (with mock mode fallback for local test execution).
3. Connect waiting room and status updates with Supabase Realtime.

---

## 7. Conclusion

The monorepo infrastructure is clean, fast, and properly aligned with Turborepo 2 and Bun 1.4. The existing codebase is ready to receive Phase 1 scaffolding. All findings and exact prerequisite requirements have been documented for downstream implementation agents.
