## 2026-10-30T04:54:34Z
You are Survey Explorer 3 (teamwork_explorer).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md

OBJECTIVE:
Investigate the full frontend PWA architecture, UX flows, and UI component specifications for RaktKhoj:
1. Inspect existing apps/web (Next.js config, package.json, app directory, styles) and packages/ui.
2. Detail the PWA setup: manifest.ts, custom service worker (caching strategy, offline fallback), app icons, responsive mobile viewport.
3. Detail the next-intl bilingual setup (English 'en' and Hindi 'hi'), locale routing, language switcher, message hydration.
4. Detail the UI components in packages/ui needed for shadcn/ui integration: button, card, input, select, badge, dialog, toast, skeleton, stepper, phone-input, and utils (cn).
5. Detail all application routes and interactive components in apps/web:
   - Emergency blood discovery search: blood group picker (8 groups), location picker (GPS auto-detect + manual State/District), radius selector (5km, 10km, 50km).
   - Search results page: Stage 1 blood bank cards with stock indicators, distance, and eRaktKosh freshness; Stage 2 dynamic fallback to compatible donors.
   - Real-time waiting room: request tracking, donor notification statuses, countdown/expiry, and donor acceptance contact display (phone call / WhatsApp direct link).
   - Donor registration portal: 5-step form (Phone/OTP, Personal Details, Blood Group, Location, Consent).
   - Donor response page: Quick accept/decline action from WhatsApp deep link.
   - Leaflet/React-Leaflet map view: marker rendering, radius circle, user location marker, interactive popup.
6. Identify key dependencies, styling conflicts (Tailwind CSS v4 with Next.js 16), Leaflet SSR requirements (dynamic import with ssr: false), and state management (Zustand or React state).

CONSTRAINTS:
- You are READ-ONLY. Do NOT modify source code or run build commands that alter code.
- Write your comprehensive findings to:
  d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\survey_report.md
- Write your final handoff to:
  d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_3\handoff.md
- When finished, send a brief message to your parent reporting your completion and report path.
