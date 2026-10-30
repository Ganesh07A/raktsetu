# RaktKhoj (रक्तखोज) — Frontend PWA Architecture & UI/UX Technical Survey Report

**Author**: Survey Explorer 3 (`teamwork_explorer_survey_3`)  
**Date**: October 30, 2026  
**Scope**: `apps/web`, `packages/ui`, PWA Configuration, `next-intl` Bilingual Engine, UX Flows, and Component Specifications  
**Status**: Complete Investigation & Architecture Specification

---

## 1. Executive Summary & Existing State Assessment

### 1.1 Context & Objectives
RaktKhoj (रक्तखोज) is an emergency blood discovery and routing Progressive Web App (PWA) tailored for the Indian healthcare ecosystem. It provides an immediate two-stage life-saving pathway during medical emergencies:
1. **Stage 1 (Institutional)**: Queries nearby blood banks with real-time inventory from eRaktKosh, sorted by proximity.
2. **Stage 2 (Community Fallback)**: Automatically cascades to nearby compatible volunteer donors (enforcing the red blood cell ABO/Rh compatibility matrix) when blood bank inventory is exhausted, triggering WhatsApp Business notifications with interactive quick-reply buttons and real-time response tracking.

This survey establishes the complete frontend architecture, component specifications, PWA offline capabilities, and bilingual UX flows for `apps/web` and `packages/ui`.

---

### 1.2 Inspection of Existing Codebase

#### Existing Workspace Inventory:
* **Root Monorepo**: Turborepo `v2.11.10` powered by Bun `1.4.2` (`package.json`, `turbo.json`).
* **`apps/web`**:
  - `package.json`: Next.js `16.3.8`, React `19.2.8`, React DOM `19.2.8`, `@repo/ui: "*"`.
  - `next.config.js`: Empty configuration (`const nextConfig = {}; export default nextConfig;`).
  - `tsconfig.json`: Extends `@repo/typescript-config/nextjs.json`.
  - `app/layout.tsx`: Basic Create-Next-App layout utilizing local Geist fonts (`GeistVF.woff`). Missing viewport metadata, i18n locale routing, and service worker registration.
  - `app/globals.css`: Plain CSS containing default dark-mode variables. **Tailwind CSS is not yet installed or configured.**
  - `app/page.tsx` & `app/page.module.css`: Default boilerplate starter page.
  - `public/`: Basic Turborepo and Vercel SVGs. **No PWA icons, manifest, or service worker present.**
* **`packages/ui`**:
  - `package.json`: Contains `react: "19.2.8"`, `react-dom: "19.2.8"`. Export mapping: `"./*": "./src/*.tsx"`.
  - `src/`: Contains placeholder components (`button.tsx`, `card.tsx`, `code.tsx`) from the Turborepo template.
  - Missing utility functions (`cn`), `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui` primitives, and `lucide-react`.
* **Missing Packages to be Added**:
  - `packages/shared`: Shared types, blood compatibility matrix (`getCompatibleDonorGroups`, `isDonorCompatible`), Haversine distance calculator, and translation dictionaries.
  - `packages/db`: Drizzle ORM schema for Supabase PostgreSQL.

---

## 2. Progressive Web App (PWA) Architecture & Offline Strategy

In emergency scenarios in India, network connectivity can be spotty or fluctuating (in transit, hospital basements, rural corridors). The PWA architecture ensures that the application shell, emergency directory, and compatibility tools operate reliably offline.

```
apps/web/
├── app/
│   ├── manifest.ts          # Built-in Next.js Web App Manifest
│   ├── [locale]/
│   │   └── offline/page.tsx # Offline Fallback & Emergency Helpline Directory
│   └── components/
│       └── register-sw.tsx  # Service Worker Registration Client Component
└── public/
    ├── sw.js                # Custom Service Worker (Vanilla JS / TS)
    └── icons/
        ├── icon-192x192.png # Standard PWA Icon
        ├── icon-512x512.png # High-res PWA Icon
        ├── maskable-512.png # Adaptive / Maskable Icon
        └── apple-touch-icon.png (180x180)
```

### 2.1 Web App Manifest (`apps/web/app/manifest.ts`)
Next.js 16 App Router provides native manifest generation through `app/manifest.ts` returning `MetadataRoute.Manifest`:

```typescript
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RaktKhoj — Emergency Blood Discovery (रक्तखोज)',
    short_name: 'RaktKhoj',
    description: 'Find blood banks and connect with voluntary blood donors instantly in medical emergencies.',
    start_url: '/',
    id: 'raktkhoj-pwa',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#ffffff',
    theme_color: '#dc2626', // Blood-red branding
    orientation: 'portrait-primary',
    categories: ['medical', 'health', 'lifestyle'],
    lang: 'en-IN',
    dir: 'ltr',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Emergency Search',
        short_name: 'Find Blood',
        url: '/search',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Register as Donor',
        short_name: 'Donate Blood',
        url: '/donor/register',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
```

---

### 2.2 Custom Service Worker (`apps/web/public/sw.js`)
Instead of relying on brittle Webpack-dependent plugins like `next-pwa`, RaktKhoj implements a clean, native Service Worker placed in `public/sw.js`. This guarantees zero-friction compatibility with Next.js 16 and Turbopack.

#### Caching Tiers & Strategies:
1. **Cache-First (Static Shell & Assets)**:
   - Cache Name: `raktkhoj-static-v1`
   - Assets: `/`, `/offline`, `/manifest.webmanifest`, CSS bundles, JS static chunks, fonts (`Geist`, `Noto Sans Devanagari`), app icons.
2. **Stale-While-Revalidate (Map Tiles & Static Reference Data)**:
   - Cache Name: `raktkhoj-runtime-v1`
   - Assets: OpenStreetMap raster tiles (`tile.openstreetmap.org/*`), state/district JSON datasets. Max limit: 300 cached tiles.
3. **Network-First with Offline Fallback (HTML Navigation Requests)**:
   - For all `request.mode === 'navigate'`, the service worker attempts a network fetch with a 3.5s timeout. If the network is unavailable or times out, it serves the cached page or redirects to `/offline`.
4. **Network-Only (Bypass Cache for Real-Time & Mutations)**:
   - URLs matching `/api/*`, Supabase REST / WebSocket endpoints, and WhatsApp webhook queries are strictly `Network-Only`. Emergency stock and donor waiting room states must never show stale cached data!

#### Service Worker Implementation Outline:
```javascript
// apps/web/public/sw.js
const STATIC_CACHE = 'raktkhoj-static-v1';
const RUNTIME_CACHE = 'raktkhoj-runtime-v1';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass API and Supabase Realtime requests
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    return;
  }

  // Navigation requests: Network-first with /offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/offline');
      })
    );
    return;
  }

  // Map tiles: Cache-first with Stale-While-Revalidate
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkRes) => {
          if (networkRes.status === 200) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets: Cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
```

---

### 2.3 Offline Fallback Page (`apps/web/app/[locale]/offline/page.tsx`)
When internet connectivity drops, the user is presented with a pre-rendered, high-utility emergency fallback screen:
1. **Prominent Offline Status**: "You are currently offline / आप वर्तमान में ऑफ़लाइन हैं".
2. **Direct Emergency Helpline Click-to-Call Buttons**:
   - `112`: National Emergency Number (राष्ट्रीय आपातकालीन नंबर)
   - `108`: Emergency Ambulance Services (एम्बुलेंस सेवा)
   - `104`: National Health Helpline & Blood Availability (स्वास्थ्य एवं रक्त हेल्पलाइन)
   - `1800-180-1104`: National Blood Transfusion Council (NBTC) Toll-Free
   - `011-23711551`: Indian Red Cross Society (IRCS) Blood Bank, New Delhi
3. **Offline Blood Compatibility Matrix**: Interactive SVG table illustrating RBC compatibility (who can receive from whom) so medical attendants can make immediate compatibility decisions.
4. **"Retry Connection" Button**: Evaluates `navigator.onLine` and reloads search when network is restored.

---

### 2.4 Responsive Mobile Viewport & Ergonomics
To ensure a native-like PWA experience on iOS and Android devices:
* Viewport configuration in `apps/web/app/layout.tsx`:
  ```typescript
  import type { Viewport } from 'next';

  export const viewport: Viewport = {
    themeColor: '#dc2626',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover', // iOS notch integration
  };
  ```
* Safe-area padding utility classes: `pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`.
* Mobile touch target minimum: 48px height for all buttons and inputs.
* Text inputs set to `font-size: 16px` to prevent iOS Safari auto-zooming on focus.

---

## 3. Bilingual Internationalization (`next-intl`) Architecture

India has 22 scheduled languages; Hindi and English cover over 70% of digital users. In life-or-death emergencies, clarity in a user's native tongue prevents panic and costly delays.

### 3.1 Next.js 16 App Router Dynamic Route Setup

Next.js 16 requires asynchronous request-handling APIs (`params: Promise<{ locale: string }>` and async `requestLocale` in `getRequestConfig`).

#### Directory Structure:
```
apps/web/
├── i18n/
│   ├── routing.ts          # Supported locales and navigation utilities
│   └── request.ts          # getRequestConfig loader
├── messages/
│   ├── en.json             # English UI copy
│   └── hi.json             # Hindi UI copy (हिंदी अनुवाद)
├── middleware.ts           # Locale routing middleware
└── app/
    ├── layout.tsx          # Root fallback layout
    └── [locale]/
        ├── layout.tsx      # NextIntlClientProvider locale layout
        ├── page.tsx        # Localized landing page
        └── search/page.tsx # Localized search page
```

#### Routing Configuration (`apps/web/i18n/routing.ts`):
```typescript
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'as-needed', // Keeps '/' for default English, '/hi' for Hindi
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

#### Request Configuration (`apps/web/i18n/request.ts`):
```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let requested = await requestLocale;
  let locale = requested;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

#### Next.js Config Plugin (`apps/web/next.config.js`):
```javascript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/shared'],
};

export default withNextIntl(nextConfig);
```

#### Next.js Middleware (`apps/web/middleware.ts`):
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(en|hi)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

#### Root Locale Layout (`apps/web/app/[locale]/layout.tsx`):
```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Noto_Sans_Devanagari, Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-hindi',
  weight: ['400', '500', '600', '700'],
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} dir="ltr" className={`${inter.variable} ${notoDevanagari.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 3.2 Language Switcher Component (`components/language-switcher.tsx`)
A persistent header/floating control allowing one-tap switching between English and Hindi. It retains the user's active route, search query parameters (`?bloodGroup=O%2B&radiusKm=10`), and scroll state:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'hi' : 'en';
    const params = searchParams.toString();
    const query = params ? `?${params}` : '';
    router.replace(`${pathname}${query}`, { locale: nextLocale });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLocale}
      className="font-medium px-3 py-1.5 h-8 text-xs border-red-200 hover:bg-red-50 text-red-700"
      aria-label="Toggle language"
    >
      {locale === 'en' ? '🇮🇳 हिन्दी' : '🌐 English'}
    </Button>
  );
}
```

---

## 4. Shared UI Component Library (`packages/ui`) & shadcn/ui Monorepo Integration

### 4.1 Monorepo Package Setup
`packages/ui` houses reusable, accessible component primitives powered by Radix UI and Tailwind CSS v4.

#### Dependencies in `packages/ui/package.json`:
```json
{
  "name": "@repo/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.tsx",
    "./lib/*": "./src/lib/*.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "lucide-react": "^0.500.0",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-toast": "^1.2.6"
  },
  "devDependencies": {
    "@repo/eslint-config": "*",
    "@repo/typescript-config": "*",
    "typescript": "7.0.2"
  }
}
```

#### Shared Utility (`packages/ui/src/lib/utils.ts`):
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

---

### 4.2 Component Specifications

| Component | Key Variants / Features | Purpose in RaktKhoj |
|-----------|-------------------------|---------------------|
| **`Button`** | `default` (red-600), `destructive`, `outline`, `secondary`, `ghost`, `success` (green-600), `sizes: sm, default, lg, icon`, `loading` state | Primary search CTAs, "Call Bank", "I Can Donate" WhatsApp quick response buttons |
| **`Card`** | Compound: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Blood bank listings, donor profile cards, stock inventory summary |
| **`Input`** | Accessible text/number input, focus-visible red ring, icon prepend/append | Patient name, hospital name, units needed, age |
| **`Select`** | Radix UI Select with customizable scroll viewport and trigger | State and District selector dropdowns, emergency type |
| **`Badge`** | `default`, `secondary`, `destructive`, `outline`, `success`, `warning`; Blood group badges (`O-`, `A+`, `B+`, etc.) | Unit count badges ("5 Units Available"), eRaktKosh Verified badge, Donor soft eligibility badge ("Recently donated") |
| **`Dialog`** | Radix UI Dialog with backdrop blur (`bg-black/50 backdrop-blur-sm`), accessible title/close | Confirmation dialogs, radius expansion prompt, donor consent terms |
| **`Toast`** | Animated toast notifications (Sonner or Radix Toast) | GPS detection feedback, WhatsApp dispatch confirmation, copy-to-clipboard alerts |
| **`Skeleton`** | Shimmer pulse placeholders with responsive dimensions | Loading states for blood bank search cards and waiting room donor list |
| **`Stepper`** | Visual step numbers (1-5), connecting progress lines, active/complete/upcoming states | 5-step Donor Registration Portal progress tracker |
| **`PhoneInput`** | Fixed Indian `+91` flag badge, 10-digit numeric constraint, auto-formatting (`XXXXX XXXXX`), validation for numbers starting with 6, 7, 8, or 9 | Donor mobile OTP input, Seeker emergency contact input |

---

## 5. Application Routes & Interactive UX Flows (`apps/web`)

```
apps/web/app/[locale]/
├── page.tsx                     # Landing Page: Hero with immediate search widget & donor CTA
├── search/
│   ├── page.tsx                 # Emergency Blood Discovery Form (Blood group, GPS, Radius)
│   └── results/page.tsx         # Results View: Stage 1 Blood Banks -> Stage 2 Donor Fallback
├── request/
│   ├── new/page.tsx             # Create detailed request (Patient name, hospital, units)
│   └── [id]/page.tsx            # Real-Time Waiting Room (Donor response tracker & direct contact)
├── donor/
│   ├── register/page.tsx        # 5-Step Donor Registration Portal
│   ├── respond/[requestId]/page.tsx # Quick WhatsApp Deep-Link Response Page
│   └── dashboard/page.tsx       # Donor profile, availability toggle & donation history
├── offline/page.tsx             # Offline emergency directory
└── about/page.tsx               # About RaktKhoj, mission, CDAC/eRaktKosh attribution
```

---

### 5.1 Emergency Blood Discovery Search (`/search`)

The search interface is designed for extreme speed and zero friction under panic conditions.

#### 1. Blood Group Picker (8 Groups):
* Large, touch-friendly 4x2 grid of cards: `O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`.
* Clear visual distinction: Active item highlighted in bold red (`border-2 border-red-600 bg-red-50 text-red-700 font-bold shadow-md`).
* Informative micro-badges:
  - `O-`: Marked with a small "Universal Donor" (सर्वदाता) badge.
  - `AB+`: Marked with a small "Universal Recipient" (सर्वग्राही) badge.

#### 2. Location Picker (Dual-Mode):
* **Mode A: GPS Auto-Detection (Primary CTA)**:
  - Big button: `📍 Detect My Location (जीपीएस से स्थान प्राप्त करें)`.
  - Triggers `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })`.
  - While fetching, displays a smooth spinning radar pulse.
  - On success: reverse geocodes coordinates to display `Near AIIMS, New Delhi` and populates `latitude` and `longitude`.
  - On failure (permission denied or timeout): smoothly falls back to Mode B with an inline error banner ("Could not retrieve GPS location. Please select State and District below.").
* **Mode B: Manual State & District Dropdowns**:
  - Cascading selects: Select State (e.g. `Delhi`, `Maharashtra`, `Uttar Pradesh`) $\to$ Select District (e.g. `South Delhi`, `Pune`, `Lucknow`).
  - Pre-populated from standard Indian administrative database (36 States & UTs, 760+ Districts).

#### 3. Radius Selector:
* Segmented button group: `5 km` | `10 km` | `50 km`.
  - `5 km`: Ideal for high-density metropolitan areas (Delhi NCR, Mumbai, Bengaluru).
  - `10 km`: Default suburban recommendation.
  - `50 km`: For rural or inter-district critical hospital transfers.
* Prominent Search Action: "Find Blood Banks Now (अभी रक्त खोजें)" pulsating button.

---

### 5.2 Search Results Page (`/search/results`): The Two-Stage Cascading Engine

```
User Query: Blood Group + Lat/Lng + Radius
     │
     ▼
[Stage 1: Query Blood Banks via API]
     │
     ├── Stocks Available? ──► YES ──► Display Blood Bank Cards sorted by distance
     │                                 - Stock count per component (PRBC, Platelets)
     │                                 - eRaktKosh verification & freshness badge
     │                                 - One-tap "Call Blood Bank" & "Directions"
     │
     └── NO (0 banks or 0 units)
          │
          ▼
[Stage 2: Automatic Fallback to Real Compatible Donors]
     │
     ├── Calculate RBC Compatibility (e.g. B+ -> B+, B-, O+, O-)
     ├── Display compatible donor count: "14 donors found within 10 km"
     └── Trigger Emergency Broadcast:
          - Creates Blood Request in DB
          - Dispatches WhatsApp interactive messages to compatible donors
          - Automatically transitions user into Real-Time Waiting Room
```

#### Stage 1 Card Structure:
* Bank Name (e.g. `Safdarjung Hospital Blood Bank`)
* Proximity Tag: `1.8 km away` (calculated via Haversine)
* Stock Badges:
  - `Whole Blood: 4 units` (Green badge)
  - `Packed Red Blood Cells (PRBC): 12 units` (Green badge)
  - `Platelets: 0 units` (Red badge)
* Data Freshness: "Updated 45 mins ago via eRaktKosh"
* Direct Actions:
  - Phone: `tel:+911126165060` (Instant call)
  - Navigate: `https://www.google.com/maps/dir/?api=1&destination=28.5702,77.2081`

#### Stage 2 Fallback Transition:
If blood banks return zero inventory, the page avoids displaying a dead-end error. Instead, it transitions smoothly:
* High-urgency alert: "⚠️ No local blood banks currently have {group} in stock. Activating Community Donor Network..."
* Shows the list of compatible blood groups being queried.
* CTA: "Send Emergency WhatsApp Alerts to 14 Donors (रक्तदाताओं को व्हाट्सएप संदेश भेजें)".

---

### 5.3 Real-Time Waiting Room (`/request/[id]`)

When emergency notifications are broadcast, the seeker's family enters the live Waiting Room.

#### Key UI Elements:
1. **Urgency Header**:
   - Patient Name, Hospital Name, Blood Group Needed, Units Requested.
   - Live Countdown Timer: 45:00 countdown clock showing remaining emergency response window before system suggests expanding radius to 50 km.
2. **Real-Time Donor Broadcast Feed**:
   - Visual breakdown: `Total Notified: 8` | `Delivered: 7` | `Read: 5` | `Accepted: 1`.
   - Real-time status list updated live via Supabase Realtime channel (`postgres_changes` on `donor_notifications` filtered by `request_id`).
3. **The "Moment of Relief" (Donor Acceptance Card)**:
   - When a donor clicks **"✅ I Can Donate"** on WhatsApp or the response page:
     * Screen emits a subtle celebratory haptic feedback/visual pulse.
     * High-contrast emerald-green card appears at the top:
       - Donor Name: `Rahul S.`
       - Blood Group: `O+ (Compatible)`
       - Distance: `2.4 km away`
       - Status: `On the way to hospital`
     * Instant Communication Triggers:
       - **Call Donor**: `<a href="tel:+919876543210">` (Big green button with phone icon)
       - **WhatsApp Direct**: `<a href="https://wa.me/919876543210?text=Hi%20Rahul,%20thank%20you%20for%20accepting%20our%20blood%20request%20for%20AIIMS...">`
4. **Resilience & Polling Fallback**:
   - If Supabase WebSocket disconnects (e.g., poor hospital cell service), the client automatically falls back to HTTP polling every 4 seconds.

---

### 5.4 Donor Registration Portal (`/donor/register`)

A 5-step onboarding wizard with persistent state (Zustand + `localStorage`) so progress is not lost if the user switches apps.

```
Step 1: Mobile & OTP ──► Step 2: Personal Info ──► Step 3: Blood Group ──► Step 4: Location ──► Step 5: Consent
```

1. **Step 1: Mobile Number & OTP Verification**:
   - Indian `PhoneInput` (+91) with 6-digit OTP verification via Supabase Auth.
2. **Step 2: Personal Details**:
   - Full Name, Date of Birth (validates age 18–65), Gender.
   - **Weight in kg**: Validation enforces $\ge 45$ kg (Indian National Blood Transfusion Council guideline). If $< 45$ kg, an educational disclaimer explains the donor safety requirement.
3. **Step 3: Blood Group Selection**:
   - Grid of 8 blood groups. Optional field for "Last Donation Date" to calculate soft eligibility (90 days for males, 120 days for females).
4. **Step 4: Location & Availability Radius**:
   - "Pin My Home/Work Location" using GPS or manual district selection.
   - Maximum willingness travel radius: `5 km`, `10 km`, or `25 km`.
5. **Step 5: WhatsApp Emergency Consent & Terms**:
   - Checkbox: "I agree to receive urgent blood request notifications via WhatsApp when a patient near me is in critical need."
   - Toggle: "I am currently available to donate".
   - Submit: Saves record to `users` and `donor_profiles` tables.
6. **Completion**: Displays a shareable Digital Donor ID Card ("I am a registered RaktKhoj Life Saver 🩸").

---

### 5.5 Donor Quick Response Page (`/donor/respond/[requestId]`)

Target of deep links sent in WhatsApp messages (e.g., `https://raktkhoj.org/donor/respond/{requestId}?token={signedToken}`).

* **Urgency Context**:
  - "URGENT: Patient at Apollo Hospital, Sarita Vihar needs 2 units of B+ blood."
  - "Distance from your registered location: 3.8 km."
* **Two Giant Action Buttons**:
  1. `✅ I Can Donate (मैं रक्तदान के लिए आ रहा हूँ)`:
     - Prompts estimated arrival time (e.g. "30 mins", "1 hour").
     - Records response in `donor_notifications` (`status = 'accepted'`).
     - Reveals hospital location, GPS map routing, and family contact number.
  2. `❌ Not Available Right Now (अभी असमर्थ हूँ)`:
     - Updates status to `'declined'`.
     - Displays: "Thank you for letting us know! We will only notify you for future emergencies."

---

### 5.6 Leaflet / React-Leaflet Map View (`components/map-view.tsx`)

Visualizes the search epicenter, search radius boundary, and blood bank / donor locations.

#### Map Specifications:
* **Base Map**: OpenStreetMap standard tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`). Free, no proprietary API keys required.
* **Radius Circle**: Leaflet `Circle` component centered on search coordinates with radius in meters ($5000$, $10000$, or $50000$ m), styled with red border (`#dc2626`) and semi-transparent red fill (`fillColor: '#ef4444', fillOpacity: 0.08`).
* **Custom Markers (Zero Asset Failures)**:
  - Instead of default Leaflet PNGs which often fail to load in bundled Next.js apps, all markers use `L.divIcon()` with inline SVG and Tailwind CSS:
    * **User Location Marker**: Pulsing blue dot (`animate-ping` inner circle + solid blue core).
    * **Blood Bank Marker**: Red teardrop pin containing a white hospital cross SVG.
    * **Compatible Donor Marker**: Emerald green pin containing a blood drop SVG.
* **Interactive Popup**:
  - Clicking any marker opens a card with the facility name, address, current stock count, and a direct Google Maps navigation button.

---

## 6. Critical Technical Pitfalls & Architectural Solutions

### 6.1 Tailwind CSS v4 & Next.js 16 Integration

#### The Challenge:
Tailwind CSS v4 introduces a new engine where `tailwind.config.js` is replaced by CSS-first configuration. In a monorepo setup, Tailwind's automatic file scanner inside `apps/web` will **not** scan files located in external workspace packages (such as `packages/ui/src/**/*.tsx`) by default, causing utility classes inside shared components to be stripped from the final CSS output.

#### The Solution:
1. **Explicit `@source` Directive in `apps/web/app/globals.css`**:
   ```css
   @import "tailwindcss";

   /* Tell Tailwind v4 to scan shared packages */
   @source "../../../packages/ui/src";

   @theme inline {
     --color-primary: #dc2626;
     --color-primary-foreground: #ffffff;
   }
   ```
2. **Next.js Package Transpilation in `apps/web/next.config.js`**:
   ```javascript
   const nextConfig = {
     transpilePackages: ['@repo/ui', '@repo/shared'],
   };
   ```
3. **PostCSS Configuration (`apps/web/postcss.config.mjs`)**:
   ```javascript
   export default {
     plugins: {
       '@tailwindcss/postcss': {},
     },
   };
   ```

---

### 6.2 Leaflet SSR Isolation (`window is not defined`)

#### The Challenge:
Leaflet immediately accesses `window` and `document` upon import. Even if a component has `"use client"`, Next.js 16 App Router still pre-renders the initial HTML on the server. Directly importing `react-leaflet` causes `ReferenceError: window is not defined` during SSR and build time.

#### The Solution:
Create a two-file architecture:
1. **`components/map-view-inner.tsx`**: Contains the actual `react-leaflet` components (`MapContainer`, `TileLayer`, `Marker`, `Circle`, `Popup`) with `"use client"`.
2. **`components/map-view.tsx`**: Dynamic import wrapper disabling SSR:
   ```tsx
   'use client';

   import dynamic from 'next/dynamic';
   import { Skeleton } from '@repo/ui/skeleton';

   export const MapView = dynamic(
     () => import('./map-view-inner').then((mod) => mod.MapViewInner),
     {
       ssr: false,
       loading: () => (
         <div className="w-full h-[350px] md:h-[450px] rounded-xl overflow-hidden border border-slate-200">
           <Skeleton className="w-full h-full" />
         </div>
       ),
     }
   );
   ```
3. **CSS Inclusion**: Import `leaflet/dist/leaflet.css` inside `map-view-inner.tsx` or `globals.css`.

---

### 6.3 State Management Architecture (Zustand + React Server Components)

RaktKhoj separates server-driven data fetching from client-side transient state:

```
┌────────────────────────────────────────────────────────┐
│                      Client State                      │
├────────────────────────────┬───────────────────────────┤
│ `useSearchStore` (Zustand) │ `useDonorStore` (Zustand) │
│ - Selected blood group     │ - Step index (1-5)        │
│ - User coordinates         │ - Phone & OTP verification│
│ - Selected radius (5/10/50)│ - Form draft (persisted)  │
│ - Stage ('banks'|'donors') │ - Consent checkboxes      │
└────────────────────────────┴───────────────────────────┘
```

1. **`useSearchStore`**: Maintains active search query parameters across the search form, map view, and results page.
2. **`useDonorRegistrationStore`**: Multi-step wizard state with `zustand/middleware/persist` using `sessionStorage` to guard against accidental mobile page reloads.
3. **Supabase Realtime Hook (`useWaitingRoomRealtime`)**:
   - Manages WebSocket connection to Supabase for the waiting room.
   - Tracks channel state (`SUBSCRIBED`, `CLOSED`, `CHANNEL_ERROR`).
   - Automatically kicks off HTTP polling if the WebSocket enters an error state.

---

## 7. Implementation Checklist & File Map

| File Path | Status | Action Required |
|-----------|--------|-----------------|
| `apps/web/package.json` | Modify | Add `next-intl`, `react-leaflet`, `leaflet`, `lucide-react`, `zustand`, `@tailwindcss/postcss`, `tailwindcss` |
| `apps/web/next.config.js` | Modify | Wrap with `createNextIntlPlugin`, add `transpilePackages: ['@repo/ui', '@repo/shared']` |
| `apps/web/postcss.config.mjs` | New | Configure `@tailwindcss/postcss` |
| `apps/web/app/globals.css` | Modify | Add `@import "tailwindcss";`, `@source "../../../packages/ui/src";`, theme variables |
| `apps/web/app/manifest.ts` | New | Implement PWA Web App Manifest |
| `apps/web/public/sw.js` | New | Implement custom service worker with navigation fallback & tile caching |
| `apps/web/i18n/routing.ts` | New | Define locales `['en', 'hi']` and navigation helpers |
| `apps/web/i18n/request.ts` | New | Implement `getRequestConfig` for Next.js 16 |
| `apps/web/middleware.ts` | New | Implement locale routing middleware |
| `apps/web/messages/en.json` | New | Complete English i18n dictionary |
| `apps/web/messages/hi.json` | New | Complete Hindi i18n dictionary |
| `packages/ui/package.json` | Modify | Add CVA, clsx, tailwind-merge, Radix UI primitives, lucide-react |
| `packages/ui/src/lib/utils.ts` | New | Implement `cn()` helper |
| `packages/ui/src/button.tsx` | Modify | Upgrade to CVA button with loading state and success variant |
| `packages/ui/src/card.tsx` | Modify | Upgrade to shadcn/ui compound Card component |
| `packages/ui/src/badge.tsx` | New | Implement Badge with blood-group variants |
| `packages/ui/src/input.tsx` | New | Accessible Input component |
| `packages/ui/src/select.tsx` | New | Radix Select wrapper |
| `packages/ui/src/dialog.tsx` | New | Radix Dialog wrapper |
| `packages/ui/src/stepper.tsx` | New | 5-step registration progress stepper |
| `packages/ui/src/phone-input.tsx` | New | Indian mobile (+91) formatted input |
| `apps/web/app/[locale]/search/page.tsx` | New | Blood group picker, GPS location picker, radius selector |
| `apps/web/app/[locale]/search/results/page.tsx` | New | Stage 1 Blood Banks + Stage 2 Donor Fallback cascade |
| `apps/web/app/[locale]/request/[id]/page.tsx` | New | Real-time waiting room with Supabase Realtime |
| `apps/web/app/[locale]/donor/register/page.tsx` | New | 5-step donor registration wizard |
| `apps/web/app/[locale]/donor/respond/[requestId]/page.tsx` | New | WhatsApp deep link 1-click response page |
| `apps/web/app/components/map-view.tsx` | New | Leaflet map with dynamic SSR-free wrapper |

---

## 8. Conclusion

The frontend architecture specified above fulfills all criteria of the approved RaktKhoj implementation plan. It delivers a fast, resilient, bilingual PWA capable of serving Indian citizens during critical medical emergencies, with seamless fallback from institutional blood banks to community donors and full offline continuity.
