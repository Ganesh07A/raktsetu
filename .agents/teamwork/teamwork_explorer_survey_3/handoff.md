# Handoff Report — Frontend PWA Architecture & UI/UX Specifications

**From**: Survey Explorer 3 (`teamwork_explorer_survey_3`)  
**To**: Orchestrator / Parent Agent (`9c9197d0-fd6d-4bbf-8faa-7bae79786334`)  
**Date**: October 30, 2026  
**Type**: Hard Handoff (Investigation Complete)  
**Deliverable Document**: `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md`

---

## 1. Observation

Direct observations from repository files and tool executions:

1. **Monorepo Structure**:
   - `d:\MEGA PROJECTS\raktsetu\package.json`: Lines 25–28 declare `"workspaces": ["apps/*", "packages/*"]`. Dev engines declare Bun `1.4.2` and Turbo `^2.11.10`.
   - `d:\MEGA PROJECTS\raktsetu\turbo.json`: Lines 5–19 declare the `build` task with `outputs: [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]`.

2. **Existing `apps/web`**:
   - `apps/web/package.json`: Lines 13–18 specify `"dependencies": { "@repo/ui": "*", "next": "16.3.8", "react": "19.2.8", "react-dom": "19.2.8" }`.
   - `apps/web/next.config.js`: Lines 1–4 contain only `const nextConfig = {}; export default nextConfig;`. There is no package transpilation (`transpilePackages`) and no `next-intl` plugin configured.
   - `apps/web/app/globals.css`: Lines 1–51 contain plain CSS variables for light/dark mode. No `@import "tailwindcss";` or `@source` directives exist.
   - `apps/web/app/layout.tsx`: Lines 19–30 implement a single root layout without locale dynamic segments, without viewport metadata, and without service worker registration.
   - `apps/web/public/`: Contains standard boilerplate SVGs (`next.svg`, `vercel.svg`, `globe.svg`, `file-text.svg`, `window.svg`). No PWA icons or service worker files exist.

3. **Existing `packages/ui`**:
   - `packages/ui/package.json`: Lines 5–7 define `"exports": { "./*": "./src/*.tsx" }`. Lines 22–25 list only `"react": "19.2.8"` and `"react-dom": "19.2.8"`.
   - `packages/ui/src/`: Contains only boilerplate files: `button.tsx` (Line 15: `onClick={() => alert(...) }`), `card.tsx`, and `code.tsx`.
   - No `cn()` utility, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui` primitives, or `lucide-react` exist in the workspace.

4. **Authoritative Implementation Plan**:
   - `C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md`:
     * Lines 53–68 specify Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, Leaflet + React-Leaflet, next-intl, custom service worker + `manifest.ts`.
     * Lines 98–104 resolve critical decisions: WhatsApp Business API in test mode, Drizzle schema, soft donor eligibility enforcement, and fixed radius presets (5 km, 10 km, 50 km).
     * Lines 713–753 define the complete page and component structure for `apps/web`.

5. **Tailwind CSS v4 & Next.js 16 Monorepo Constraints**:
   - Tailwind CSS v4 does not use `tailwind.config.js` or `content` arrays. Classes in external monorepo packages (`packages/ui`) are only scanned if explicitly linked via `@source "../../../packages/ui/src"` in the CSS file and declared in `transpilePackages` in `next.config.js`.

---

## 2. Logic Chain

1. **From Observation 1 & 2 to PWA Setup**:
   - Because `apps/web` currently has no manifest and no service worker, and because Next.js 16 App Router supports built-in manifest metadata, creating `apps/web/app/manifest.ts` returning `MetadataRoute.Manifest` provides native PWA installation across Chrome and Safari.
   - Because older webpack-based PWA plugins (`next-pwa`) conflict with Next.js 16 and Turbopack, a lightweight custom service worker in `apps/web/public/sw.js` with Cache-First (static shell), Stale-While-Revalidate (OSM map tiles), and Network-First (navigation with `/offline` fallback) provides robust, zero-dependency offline resilience.

2. **From Observation 2 & 4 to Bilingual `next-intl` Engine**:
   - In Next.js 16, request parameters and locale detection are asynchronous (`params: Promise<{ locale: string }>` and `requestLocale` in `getRequestConfig`).
   - Wrapping routes under `apps/web/app/[locale]/` with `middleware.ts` running `createMiddleware(routing)` enables seamless switching between English (`en`) and Hindi (`hi`), while preserving active search parameters and route state.

3. **From Observation 3 & 5 to `packages/ui` shadcn/ui Modernization**:
   - The current export mapping `"./*": "./src/*.tsx"` breaks for `.ts` files (such as `src/lib/utils.ts`). Updating exports to include `"."`, `"./*"`, and `"./lib/*"` allows consumers to import `@repo/ui/button` or utility `cn`.
   - Adding `clsx`, `tailwind-merge`, and `class-variance-authority` enables robust variants across 10 essential components: Button, Card, Input, Select, Badge, Dialog, Toast, Skeleton, Stepper, and PhoneInput (+91 Indian mobile).
   - In Tailwind v4, adding `@source "../../../packages/ui/src"` to `apps/web/app/globals.css` and `transpilePackages: ["@repo/ui"]` ensures all component classes compile correctly without tree-shaking failures.

4. **From Observation 4 to UX Cascading Flow**:
   - Emergency blood discovery requires two distinct stages: Stage 1 queries blood banks via API and displays proximity, stock counts, and eRaktKosh freshness.
   - If stock is empty or no bank is found, Stage 2 automatically triggers a fallback to compatible volunteer donors based on ABO/Rh compatibility, prompting an emergency broadcast to donors via WhatsApp and transitioning the requester to the real-time Waiting Room.
   - Leaflet components require dynamic loading (`next/dynamic` with `ssr: false`) and custom SVG `L.divIcon()` to eliminate `window is not defined` server crashes and 404 image errors.

---

## 3. Caveats

1. **Leaflet OpenStreetMap Tiles Under Heavy Load**: Standard OpenStreetMap raster tiles are subject to OSM tile usage policies. For production deployment, caching tiles via service worker or using a managed tile provider (e.g. Mapbox, Stadia Maps, or self-hosted vector tiles) should be planned post-MVP.
2. **Supabase Realtime vs Local Development**: The Waiting Room real-time engine requires a live Supabase connection with PostgreSQL replication enabled on the `donor_notifications` table. A fallback HTTP polling mechanism (every 4s) has been designed into the specification for environments without WebSocket access.
3. **WhatsApp Business Test Mode**: Test mode limits outbound notifications to up to 5 pre-registered recipient phone numbers in the Meta Developer Console.

---

## 4. Conclusion

The frontend PWA architecture, UX flows, and UI component specifications for RaktKhoj are completely documented and ready for implementation. The technical roadmap resolves all known Next.js 16, React 19, and Tailwind CSS v4 friction points, guaranteeing a fast, installable, bilingual emergency discovery interface.

All detailed technical specifications are recorded in:  
`d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md`

---

## 5. Verification Method

To independently verify the observations and architectural requirements:

1. **Inspect Existing Web Package Dependencies**:
   ```bash
   cat "d:\MEGA PROJECTS\raktsetu\apps\web\package.json"
   ```
   *Expected*: Verifies Next.js `16.3.8`, React `19.2.8`, and absence of Tailwind CSS or `next-intl`.

2. **Inspect Existing UI Package Exports**:
   ```bash
   cat "d:\MEGA PROJECTS\raktsetu\packages\ui\package.json"
   ```
   *Expected*: Verifies export pattern `"./*": "./src/*.tsx"` and lack of utility dependencies.

3. **Verify Survey Report Artifact**:
   ```bash
   cat "d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md"
   ```
   *Expected*: Contains the 8 sections detailing PWA, `next-intl`, UI components, interactive routes, and Tailwind v4 configuration.
