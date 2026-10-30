# Milestone 3 Changes Log — UI System & Frontend Foundation

**Date**: 2026-10-30  
**Author**: Milestone 3 Worker (`teamwork_worker`)  
**Scope**: `packages/ui/**`, `apps/web/**`

---

## 1. `packages/ui` — Modernized shadcn/ui Component System

### 1.1 `packages/ui/package.json`
- **Dependencies Added**:
  - `class-variance-authority`: `^0.7.1`
  - `clsx`: `^2.1.1`
  - `tailwind-merge`: `^3.0.0`
  - `lucide-react`: `^0.500.0`
  - `@radix-ui/react-slot`: `^1.1.2`
  - `@radix-ui/react-dialog`: `^1.1.6`
  - `@radix-ui/react-select`: `^2.1.6`
  - `@radix-ui/react-tabs`: `^1.1.3`
  - `@radix-ui/react-toast`: `^1.2.6`
  - `react`: `19.2.8`
  - `react-dom`: `19.2.8`
- **Export Mappings Configured**:
  - `"."`: `"./src/index.ts"`
  - `"./lib/utils"`: `"./src/lib/utils.ts"`
  - `"./*"`: `"./src/*.tsx"`

### 1.2 `packages/ui/tsconfig.json`
- Configured with `"module": "ESNext"` and `"moduleResolution": "Bundler"` for seamless Next.js App Router and Turborepo compilation.

### 1.3 `packages/ui/src/lib/utils.ts`
- Implemented standard `cn(...inputs: ClassValue[]): string` combining `clsx` and `twMerge`.

### 1.4 Core Accessible UI Components Implemented in `packages/ui/src/`:
1. **`button.tsx`**:
   - Variants: `default` (blood-red), `destructive` (dark red), `outline`, `secondary`, `ghost`, `link`, `success` (emerald).
   - Sizes: `default`, `sm`, `lg`, `icon`.
   - Accessible features: `Slot` (via `asChild`), `loading` state with Lucide `Loader2` animated spinner, native `disabled` and `aria-disabled` synchronization, backwards-compatible `appName` prop.
2. **`card.tsx`**:
   - Compound components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
3. **`input.tsx`**:
   - Accessible text/number input with focus-visible blood-red ring and `aria-invalid="true"` error styling.
4. **`select.tsx`**:
   - Radix UI Select wrapper with `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`.
5. **`badge.tsx`**:
   - Variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `bloodGroup`.
   - Handles empty/undefined children gracefully.
6. **`dialog.tsx`**:
   - Accessible modal dialog wrapper with backdrop blur (`backdrop-blur-xs`), `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, and close trigger with `X` icon.
7. **`toast.tsx`**:
   - Radix UI Toast notification primitive wrapper with `ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle`, `ToastDescription`, `ToastClose`, `ToastAction`.
   - Variants: `default`, `destructive`, `success`.
8. **`skeleton.tsx`**:
   - Shimmer / pulse placeholder with `animate-pulse rounded-md bg-slate-200/80`.
9. **`stepper.tsx`**:
   - Accessible multi-step progress indicator for the 5-step donor registration wizard. Supports completed (checkmark), active (`aria-current="step"`), and upcoming states.
10. **`phone-input.tsx`**:
    - Indian mobile input component with fixed `+91` flag badge.
    - Normalizes raw input (`normalizeIndianMobile`), strips trunk `0` / country code `+91`, trims spaces and dashes.
    - Validates 10-digit Indian numbers starting with 6, 7, 8, 9 (`isValidIndianMobile`) with real-time green checkmark indicator.
11. **`index.ts`**:
    - Centralized re-exports of all 10 component primitives, helper types, and `cn`.
12. **`components.test.ts`**:
    - Comprehensive 20-test unit suite covering `cn`, `buttonVariants`, `badgeVariants`, `toastVariants`, `normalizeIndianMobile`, `isValidIndianMobile`, and module re-exports.

---

## 2. Tailwind CSS v4 & Theming in `apps/web`

### 2.1 `apps/web/package.json`
- Added dependencies: `@repo/ui`, `@repo/shared`, `tailwindcss@^4.0.0`, `@tailwindcss/postcss@^4.0.0`, `next-intl@^4.0.0`, `lucide-react@^0.500.0`, `clsx`, `tailwind-merge`, `class-variance-authority`.

### 2.2 `apps/web/postcss.config.mjs`
- Created PostCSS configuration integrating `@tailwindcss/postcss`.

### 2.3 `apps/web/next.config.js`
- Integrated `createNextIntlPlugin('./src/i18n/request.ts')` with `transpilePackages: ['@repo/ui', '@repo/shared']`.

### 2.4 `apps/web/app/globals.css`
- Modernized to Tailwind CSS v4 syntax:
  - `@import "tailwindcss";`
  - `@source "../../../packages/ui/src";` (enables cross-package utility scanning)
  - Blood-red primary palette CSS variables: `--color-blood-red: #dc2626;`, crimson, emergency status badges, dark mode variables.

---

## 3. PWA Web App Manifest & Service Worker

### 3.1 `apps/web/app/manifest.ts`
- Implemented Next.js `MetadataRoute.Manifest` with:
  - Name: `'RaktKhoj — Emergency Blood Discovery (रक्तखोज)'`
  - Short Name: `'RaktKhoj'`
  - Display: `'standalone'`
  - Theme Color: `'#dc2626'`
  - Start URL: `'/'`
  - Categories: `['medical', 'health']`
  - Shortcuts: Emergency Search (`/search`), Register as Donor (`/donor/register`).
  - Icons: `icon-192x192.png`, `icon-512x512.png`, `apple-touch-icon.png`.

### 3.2 `apps/web/public/icons/`
- Generated valid PNG icons:
  - `icon-192x192.png` (192x192 PNG)
  - `icon-512x512.png` (512x512 PNG)
  - `apple-touch-icon.png` (180x180 PNG)

### 3.3 `apps/web/public/sw.js`
- Implemented custom Service Worker with 4 caching strategies:
  1. **Cache-First**: Pre-cached static shell (`/`, `/offline`, icons, CSS, fonts, JS).
  2. **Stale-While-Revalidate**: OpenStreetMap map tiles (`tile.openstreetmap.org`).
  3. **Network-First**: HTML navigation requests (`mode === 'navigate'`), falling back to cached `/offline` screen.
  4. **Network-Only**: Bypass for API routes (`/api/*`), Supabase Realtime, and third-party notifications.
  5. **Lifecycle**: Standard `install` (skipWaiting), `activate` (cache pruning, claim clients), `fetch`.

### 3.4 `apps/web/app/components/register-sw.tsx`
- Client component that safely registers `/sw.js` in supported browsers.

---

## 4. Bilingual Routing & Engine (`next-intl`)

### 4.1 `apps/web/src/routing.ts`
- Configured `defineRouting` with `locales: ['en', 'hi']`, `defaultLocale: 'en'`, `localePrefix: 'as-needed'`.
- Exported navigation helpers: `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`.

### 4.2 `apps/web/src/i18n/request.ts`
- Configured Next.js 16 App Router `getRequestConfig` loading typed dictionaries directly from `@repo/shared/i18n`.

### 4.3 `apps/web/middleware.ts`
- Configured next-intl middleware for locale negotiation, excluding static assets and `/api` routes.

### 4.4 `apps/web/app/components/language-switcher.tsx`
- One-tap language toggle between English and Hindi, retaining active route, query parameters, and scroll position.

### 4.5 `apps/web/app/[locale]/layout.tsx`
- Root bilingual layout with Next.js 16 async params (`params: Promise<{ locale: string }>`), `NextIntlClientProvider`, service worker registration, top emergency helpline ticker (104 / 108), accessible sticky header, language switcher, and comprehensive footer.

### 4.6 `apps/web/app/[locale]/offline/page.tsx`
- Emergency helpline directory:
  - 104 National Blood & Health Helpline
  - 108 Emergency Ambulance Services
  - 112 National Emergency Number
  - 1800-180-1104 eRaktKosh Toll-Free
  - 011-23711551 Indian Red Cross Society (IRCS)
- Offline red blood cell (RBC) compatibility clinical reference table.
- Direct click-to-call links (`tel:`) and connection retry button.

### 4.7 `apps/web/app/[locale]/page.tsx`
- High-urgency bilingual landing page:
  - Hero banner with emergency CTA ("Find Blood Now" / "अभी रक्त खोजें") and donor onboarding CTA ("Register as Donor" / "रक्तदाता बनें").
  - 8-blood-group interactive quick navigator.
  - Three-stage active routing explanation cards.
  - Emergency helpline quick callout section.

---

## 5. Verification Results

- `bun install`: Clean package linking and lockfile generation.
- `bun run --cwd packages/ui check-types`: Pass (0 errors).
- `bun run --cwd apps/web check-types`: Pass (0 errors).
- `bun run lint`: 6/6 packages passing (0 warnings, 0 errors).
- `bun run build`: 3/3 packages passing (`apps/web` compiled cleanly with Next.js 16 App Router Turbopack).
- `bun test`: 496 pass, 0 fail across 17 files.
- `bun test tests/e2e`: 328 pass, 0 fail across 4 files (Tiers 1-4).
