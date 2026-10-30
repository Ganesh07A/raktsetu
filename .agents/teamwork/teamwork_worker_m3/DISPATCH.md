## 2026-10-30T05:47:37Z
You are Milestone 3 Worker (teamwork_worker).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m3\

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
- `packages/ui/**`
- `apps/web/**`

OBJECTIVE & DELIVERABLES:
Implement Milestone 3 (UI System & Frontend Foundation):

1. **`packages/ui` shadcn/ui Component Modernization**:
   - Update `packages/ui/package.json` dependencies: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`.
   - Update `packages/ui/package.json` export mappings:
     ```json
     "exports": {
       ".": "./src/index.ts",
       "./lib/utils": "./src/lib/utils.ts",
       "./*": "./src/*.tsx"
     }
     ```
   - Implement `packages/ui/src/lib/utils.ts` with standard `cn(...inputs: ClassValue[])`.
   - Implement 10 accessible, Tailwind-styled components in `packages/ui/src/`:
     * `button.tsx`: Variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), sizes (`default`, `sm`, `lg`, `icon`), loading spinner support.
     * `card.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
     * `input.tsx`: HTML input with focus ring, error border state.
     * `select.tsx`: Select component with trigger, content, item, label.
     * `badge.tsx`: Variants (`default`, `secondary`, `destructive`, `outline`, `success`, `warning`), blood group styling.
     * `dialog.tsx`: Accessible modal dialog with overlay, header, footer, close trigger.
     * `toast.tsx`: Toast notifications.
     * `skeleton.tsx`: Shimmer loading placeholder.
     * `stepper.tsx`: Multi-step form progress indicator (for 5-step donor registration).
     * `phone-input.tsx`: Indian mobile number input with `+91` badge and 10-digit validation indicator.
     * `index.ts`: Re-export all components and `cn`.

2. **Tailwind CSS v4 & Theming in `apps/web`**:
   - Update `apps/web/package.json` to include `@repo/ui`, `@repo/shared`, `tailwindcss@^4.0.0`, `@tailwindcss/postcss@^4.0.0`, `next-intl`, `lucide-react`.
   - Create `apps/web/postcss.config.mjs`:
     ```js
     export default {
       plugins: {
         "@tailwindcss/postcss": {},
       },
     };
     ```
   - Update `apps/web/next.config.js`:
     ```js
     import createNextIntlPlugin from 'next-intl/plugin';
     const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
     const nextConfig = {
       transpilePackages: ["@repo/ui", "@repo/shared"],
     };
     export default withNextIntl(nextConfig);
     ```
   - Update `apps/web/app/globals.css`:
     ```css
     @import "tailwindcss";
     @source "../../../packages/ui/src";
     ```
     Include custom blood-red theme CSS variables (`--color-blood-red: #dc2626;`, crimson, emergency status badges, dark mode variables).

3. **PWA Web App Manifest & Service Worker**:
   - `apps/web/app/manifest.ts`: Return Next.js `MetadataRoute.Manifest` with `name: 'RaktKhoj — Emergency Blood Discovery (रक्तखोज)'`, `short_name: 'RaktKhoj'`, `theme_color: '#dc2626'`, icons (`192x192`, `512x512`, `apple-touch-icon`).
   - Create icons in `apps/web/public/icons/` (valid PNG / SVG icons).
   - `apps/web/public/sw.js`: Custom Service Worker implementing:
     * Cache-First for static shell (`/`, fonts, CSS)
     * Stale-While-Revalidate for OSM map tiles (`tile.openstreetmap.org`)
     * Network-First for navigation routes, falling back to `/offline` if network is unavailable.
   - `apps/web/app/components/register-sw.tsx`: Client component to register `sw.js` in browser.

4. **Bilingual Routing & Engine (`next-intl`)**:
   - Create `apps/web/src/routing.ts`: Define `locales = ['en', 'hi']`, `defaultLocale = 'en'`.
   - Create `apps/web/src/i18n/request.ts`: Load messages from `@repo/shared/i18n`.
   - Create `apps/web/middleware.ts`: Next-intl middleware for locale negotiation.
   - Setup `apps/web/app/[locale]/layout.tsx`: Root bilingual layout with NextIntlClientProvider, register-sw, header, footer.
   - Setup `apps/web/app/[locale]/offline/page.tsx`: Emergency helpline directory (104 National Blood Helpline, 108 Ambulance, eRaktKosh toll-free).
   - Setup `apps/web/app/components/language-switcher.tsx`: Switch between English and Hindi.
   - Create basic home landing page in `apps/web/app/[locale]/page.tsx` displaying the bilingual hero, emergency CTA button ("Find Blood Now" / "अभी रक्त खोजें"), and donor CTA ("Register as Donor" / "रक्तदाता बनें").

5. **Monorepo Linking & Verification**:
   - Run `bun install` to link packages.
   - Run `bun run check-types` across all workspaces.
   - Run `bun run lint` across all workspaces.
   - Run `bun run build` across all workspaces (specifically verifying `apps/web` builds cleanly with Next.js 16 App Router, Turbopack, and `next-intl`).
   - Run `bun test` and `bun test tests/e2e` (must stay 100% passing).
