# Orchestrator Dispatch Log

## 2026-10-30T04:52:41Z

proceed with iimplementation plan

Context:
The user has reviewed and approved the detailed implementation plan for "RaktKhoj" (रक्तखोज), an emergency blood discovery and routing Progressive Web App (PWA) in India.
The full approved implementation plan artifact is located at:
`C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md`

Summary of key requirements & decisions:
1. **Goal & Core Flow**:
   - Patient/family enters blood group needed and location (GPS or manual State/District).
   - Radius selection: 5 km, 10 km, 50 km preset options.
   - Stage 1: Query nearby blood banks with real-time stock inventory, sorted by distance.
   - Stage 2 (Fallback): If no banks or stock is empty, dynamically fall back to nearby compatible real volunteer donors (enforcing ABO/Rh red blood cell compatibility matrix).
   - Stage 3: Send WhatsApp notifications to compatible donors using WhatsApp Business Cloud API (Free Test Mode with test phone numbers and interactive Accept/Decline quick replies).
   - Stage 4: Real-time waiting room showing response status. When a donor accepts, display their contact information (phone call / WhatsApp direct link) to the family.
2. **Architecture**:
   - Monorepo using Turborepo and Bun in `d:\MEGA PROJECTS\raktsetu`.
   - `apps/web`: Next.js 16 App Router PWA (Tailwind CSS, shadcn/ui, Leaflet / react-leaflet maps, next-intl for Hindi + English bilingual support, custom service worker + Web App Manifest).
   - `apps/api`: Hono.js REST API server running on Bun (Blood bank search, eRaktKosh proxy/scraper, donor matching engine, WhatsApp webhook and message dispatcher).
   - `apps/docs`: Documentation / landing page.
   - `packages/db`: Drizzle ORM with PostgreSQL / Supabase schema (tables: `users`, `donor_profiles`, `blood_requests`, `donor_notifications`, `blood_banks`, `blood_stock`).
   - `packages/shared`: Shared types, constants, blood compatibility matrix (`getCompatibleDonorGroups`, `isDonorCompatible`), Haversine distance calculations, i18n dictionaries (English & Hindi).
   - `packages/ui`: Shared UI component library.
3. **Key Decisions**:
   - WhatsApp: Use WhatsApp Business Cloud API in test mode (supports up to 5 registered test recipients, pre-approved test templates, interactive buttons).
   - Database: Complete Drizzle schema for 6 tables.
   - Donor Eligibility: Soft enforcement (flag recent donations under 90/120 days with a badge, but do not block notifications).
   - Radius: 5 km, 10 km, 50 km presets.

Please coordinate the team to implement the phases specified in the plan.
