# Handoff Report: Monorepo & Infrastructure Survey

**Investigator**: Survey Explorer 1 (`teamwork_explorer_survey_1`)  
**Parent Agent**: 9c9197d0-fd6d-4bbf-8faa-7bae79786334  
**Date**: 2026-10-30  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Monorepo Configuration & Tooling**:
   - `d:\MEGA PROJECTS\raktsetu\package.json`: Configured with `"workspaces": ["apps/*", "packages/*"]`, `"turbo": "^2.11.10"`, `"engines": { "node": ">=24" }`, `"devEngines": { "packageManager": { "name": "bun", "version": "1.4.2" } }`.
   - `d:\MEGA PROJECTS\raktsetu\turbo.json`: Turborepo 2.x format with tasks `build`, `lint`, `check-types`, `dev`, `db:generate`, `db:migrate`, `db:push`.
   - `d:\MEGA PROJECTS\raktsetu\bun.lock`: Version 2 lockfile present.
   - Installed tool versions verified in shell:
     - Node: `v22.18.0`
     - Bun: `1.4.2`
     - Turborepo: `2.11.10`
     - TypeScript: `7.0.2`
   - `bun run check-types` ran across all packages and succeeded (`3 successful, 3 total, Time: 8.915s`).

2. **Current Codebase Contents**:
   - `apps/web`: Boilerplate Next.js `16.3.8` (React `19.2.8`) App Router application. Uses plain CSS modules (`page.module.css`), no Tailwind CSS, no PostCSS, no PWA manifest or service worker, no bilingual routes, no Leaflet.
   - `apps/docs`: Boilerplate Next.js `16.3.8` documentation/marketing application on port 3001.
   - `packages/ui`: 3 skeletal component files (`button.tsx`, `card.tsx`, `code.tsx`). No Tailwind styling, no Radix UI primitives, no utility helpers (`cn`).
   - `packages/typescript-config`: Functional configurations (`base.json`, `nextjs.json`, `react-library.json`).
   - `packages/eslint-config`: Flat configuration (`base.js`, `next.js`, `react-internal.js`).

3. **Current Defects / Blockers**:
   - `bun run lint` failed on `@repo/ui` with:
     ```
     D:\MEGA PROJECTS\raktsetu\packages\ui\eslint.config.mjs
       0:0  error  Parsing error: Cannot find package '@babel/preset-typescript' imported from D:\MEGA PROJECTS\raktsetu\packages\ui\babel-virtual-resolve-base.js
     ```
     This occurs because `packages/eslint-config/base.js` specifies `presets: ["@babel/preset-typescript"]`, but `@babel/preset-typescript` is only a devDependency inside `packages/eslint-config` and is not accessible when ESLint runs in `@repo/ui`.

4. **Missing Architectural Components (per implementation plan)**:
   - `packages/shared`: Missing (needs RBC compatibility matrix, Haversine formula, bilingual i18n dictionaries, shared types).
   - `packages/db`: Missing (needs Drizzle ORM schema for `users`, `donor_profiles`, `blood_requests`, `donor_notifications`, `blood_banks`, `blood_stock`, and client connection).
   - `apps/api`: Missing (needs Hono.js REST API running on Bun, endpoints for blood-banks, donors, requests, and WhatsApp webhook/mock).

---

## 2. Logic Chain

1. **Workspaces & Monorepo Readiness**:
   - Because `package.json` already defines `"workspaces": ["apps/*", "packages/*"]`, any newly created directory under `apps/` or `packages/` that includes a valid `package.json` will automatically be resolved as a workspace package by Bun upon running `bun install`.
   - Because `turbo.json` already defines `db:generate`, `db:migrate`, `db:push`, `build`, `lint`, and `check-types`, the build system is already wired for the database package.

2. **Runtime & Environment Compatibility**:
   - Bun `1.4.2` is installed and operates natively in Windows PowerShell.
   - Root `package.json` specifies `"node": ">=24"`, while the host Node version is `v22.18.0`. Running tasks via Bun (`bun run turbo ...` or `bun run dev`) executes without engine errors.
   - Next.js `16.3.8` and React `19.2.8` are in use. Any UI packages added (e.g. Radix UI primitives for shadcn) must support React 19.

3. **Lint Failure Diagnosis**:
   - In Turborepo monorepos using flat ESLint configs, parser plugins referenced by string name (like `"@babel/preset-typescript"`) in an inherited config require explicit resolution or hoisting so that child packages executing `eslint` can find them.
   - Fixing `packages/eslint-config/base.js` by using `import.meta.resolve` / `createRequire` or moving `@babel/preset-typescript` to `dependencies` will immediately resolve the lint error across the monorepo.

4. **Implementation Sequencing**:
   - Phase 1 (Foundation: `packages/shared`, `packages/db`, `apps/api` skeleton) has zero external code dependencies and unblocks all downstream tasks.
   - Once Phase 1 is scaffolded and linked with `bun install`, `apps/web` (Phase 2) and API services (Phase 3 & 4) can proceed in parallel.

---

## 3. Caveats

1. **Database Access**: Supabase PostgreSQL credentials (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be supplied via `.env` in `apps/api` and `packages/db` for live migrations. For offline development and testing, Drizzle schemas can generate migration SQL files without connecting to a live instance.
2. **WhatsApp Cloud API**: Requires pre-registered test recipient phone numbers in Meta Developer Console or a mock WhatsApp service for local development.

---

## 4. Conclusion

The repository is clean, functional, and ready for Phase 1 implementation. Wildcard workspaces and Turborepo 2 tasks are already configured. The concrete next actions are:
1. Fix the `@babel/preset-typescript` resolution in `@repo/eslint-config`.
2. Scaffold `packages/shared` (`blood-compatibility.ts`, `geo-utils.ts`, `i18n`, `types.ts`).
3. Scaffold `packages/db` (Drizzle schema for 6 tables, Drizzle client, drizzle.config.ts).
4. Scaffold `apps/api` (Hono.js server on Bun with route skeletons).
5. Run `bun install` to update `bun.lock` and link workspaces.

---

## 5. Verification Method

To independently verify the survey observations:
```powershell
# 1. Verify Node and Bun versions
node --version
bun --version

# 2. Verify workspace package resolution
bun pm ls

# 3. Verify TypeScript check passes
bun run check-types

# 4. Reproduce current ESLint resolution issue
bun run lint
```
Detailed findings are recorded in `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_1\survey_report.md`.
