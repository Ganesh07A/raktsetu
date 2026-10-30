# E2E Test Infra: RaktKhoj (रक्तखोज)

## Test Philosophy
- **Opaque-box & Requirement-Driven**: Tests derive directly from `ORIGINAL_REQUEST.md` and `PROJECT.md`, verifying system behavior as an end-user / client without depending on internal implementation details.
- **Progressive Testability**: Verification mechanisms must not depend on features more complex than what they verify. Early tiers verify foundational data structures and endpoints before end-to-end integration.
- **Methodology**: Systematic 4-tier approach (Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, Real-World Emergency Scenarios).

---

## Feature Inventory Coverage Map
Every feature in `PROJECT.md § Feature Inventory` is mapped to test tiers:

| # | Feature | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|:----------------:|:-----------------:|:----------------------:|:-----------------:|
| F1 | Monorepo Setup & Workspace Linking | >=5 | >=5 | ✓ | ✓ |
| F2 | Blood Compatibility Matrix Engine | >=5 | >=5 | ✓ | ✓ |
| F3 | Haversine Geo Calculation & Bounding Box | >=5 | >=5 | ✓ | ✓ |
| F4 | Bilingual i18n Dictionaries (EN & HI) | >=5 | >=5 | ✓ | ✓ |
| F5 | Shared TypeScript Schemas & Types | >=5 | >=5 | ✓ | ✓ |
| F6 | Drizzle Database Schema (6 tables) | >=5 | >=5 | ✓ | ✓ |
| F7 | Database Client & Migrations | >=5 | >=5 | ✓ | ✓ |
| F8 | Hono.js API Server Health & Config | >=5 | >=5 | ✓ | ✓ |
| F9 | Blood Bank Search Endpoint | >=5 | >=5 | ✓ | ✓ |
| F10 | eRaktKosh Proxy & Cache Service | >=5 | >=5 | ✓ | ✓ |
| F11 | States & Districts Endpoints | >=5 | >=5 | ✓ | ✓ |
| F12 | Donor Registration API | >=5 | >=5 | ✓ | ✓ |
| F13 | Donor Matching Engine | >=5 | >=5 | ✓ | ✓ |
| F14 | WhatsApp Outbound Notifications | >=5 | >=5 | ✓ | ✓ |
| F15 | WhatsApp Webhook Verification & Events | >=5 | >=5 | ✓ | ✓ |
| F16 | Zero-Credential Local Mocking Layer | >=5 | >=5 | ✓ | ✓ |
| F17 | Blood Requests Lifecycle API | >=5 | >=5 | ✓ | ✓ |
| F18 | `packages/ui` shadcn Components | >=5 | >=5 | ✓ | ✓ |
| F19 | Tailwind CSS v4 & Theming | >=5 | >=5 | ✓ | ✓ |
| F20 | PWA Web App Manifest | >=5 | >=5 | ✓ | ✓ |
| F21 | Custom Service Worker & Offline Page | >=5 | >=5 | ✓ | ✓ |
| F22 | Bilingual Routing & Language Switcher | >=5 | >=5 | ✓ | ✓ |
| F23 | Emergency Blood Discovery Form | >=5 | >=5 | ✓ | ✓ |
| F24 | Leaflet Interactive Map View | >=5 | >=5 | ✓ | ✓ |
| F25 | Cascading Search Results Flow | >=5 | >=5 | ✓ | ✓ |
| F26 | Real-time Waiting Room | >=5 | >=5 | ✓ | ✓ |
| F27 | 5-Step Donor Registration Portal | >=5 | >=5 | ✓ | ✓ |
| F28 | Donor Response Quick Action Page | >=5 | >=5 | ✓ | ✓ |
| F29 | Donor Dashboard | >=5 | >=5 | ✓ | ✓ |

---

## Test Architecture
- **Test Runner**: Node/Bun test runner executing automated test suites via `bun test` or dedicated test scripts.
- **Location**: `tests/e2e/` (opaque-box API and integration test suites) and package-level tests.
- **Execution**:
  - Full suite: `bun test`
  - Integration/E2E: `bun run test:e2e`
- **Output**: TAP / JUnit / Console pass-fail reports with 0 exit code on 100% pass.

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Emergency Surgery Request with Immediate Blood Bank Hit | F8, F9, F10, F23, F24, F25 | High |
| 2 | Rare Negative Blood Group (AB-) Dynamic Cascade to Donors | F2, F9, F13, F14, F17, F25, F26 | High |
| 3 | Donor Accepts via WhatsApp Quick-Reply; Contact Unlocked in Waiting Room | F14, F15, F17, F26, F28 | High |
| 4 | Offline Connectivity Loss: PWA Serves Offline Fallback & Helplines | F20, F21 | Medium |
| 5 | Bilingual Seeker & Donor Journey in Hindi (`hi`) | F4, F22, F23, F27 | Medium |
| 6 | Soft Eligibility Donors: Warning Badges Displayed for Recent Donors (<90 days) | F12, F13, F26, F27 | Medium |

---

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: >= 5 test cases per feature
- **Tier 2 (Boundary & Corner Cases)**: >= 5 test cases per feature
- **Tier 3 (Cross-Feature Combinations)**: >= 30 test cases covering pairwise feature interactions
- **Tier 4 (Real-World Scenarios)**: >= 6 realistic emergency workflow test cases
- **Total Minimum Target**: ~300 test cases
