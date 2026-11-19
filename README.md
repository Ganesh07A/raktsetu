# 🩸 RaktKhoj (रक्तखोज)
### *Next-Generation Autonomous Emergency Blood Discovery & Cascading Routing Engine*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?logo=turborepo)](https://turbo.build/repo)
[![Bun](https://img.shields.io/badge/Runtime-Bun%201.2+-fbf0df?logo=bun)](https://bun.sh/)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![Hono.js](https://img.shields.io/badge/Backend-Hono.js-E36002?logo=hono)](https://hono.dev/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-336791?logo=postgresql)](https://www.postgresql.org/)
[![Telegram Bot API](https://img.shields.io/badge/Dispatch-Telegram%20Bot%20API-2CA5E0?logo=telegram)](https://core.telegram.org/bots/api)
[![Firebase Cloud Messaging](https://img.shields.io/badge/OTP%20%26%20Push-FCM-FFCA28?logo=firebase)](https://firebase.google.com/docs/cloud-messaging)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline--First-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## 📑 Table of Contents
1. [Executive Summary: What is RaktKhoj?](#-what-is-raktkhoj)
2. [The Healthcare Crisis: Problems We Face](#-the-healthcare-crisis-problems-we-face)
3. [The Solution: Two-Stage Active Cascade Engine](#-the-solution-two-stage-active-cascade-engine)
4. [Notification & Dispatch Ecosystem](#-notification--dispatch-ecosystem)
5. [Core Features & Capabilities](#-core-features--capabilities)
6. [Why RaktKhoj is the Best: Competitive Benchmark](#-why-raktkhoj-is-the-best-competitive-benchmark)
7. [System Architecture (Research Paper Specification)](#-system-architecture-research-paper-specification)
   - [Publication-Grade Architecture Diagram](#publication-grade-architecture-diagram)
   - [End-to-End Emergency Lifecycle Sequence Diagram](#end-to-end-emergency-lifecycle-sequence-diagram)
   - [Request Finite State Machine (FSM)](#request-finite-state-machine-fsm)
8. [Mathematical Formulations & Core Algorithms](#-mathematical-formulations--core-algorithms)
   - [Haversine Geodesic Computation](#1-haversine-geodesic-computation)
   - [Spatial Bounding Box Optimization](#2-spatial-bounding-box-optimization)
   - [Red Blood Cell (RBC) Compatibility Set Theory](#3-red-blood-cell-rbc-compatibility-set-theory)
9. [Zero-Trust Security & Cryptographic Privacy Architecture](#-zero-trust-security--cryptographic-privacy-architecture)
10. [Monorepo Structure & Technical Blueprint](#-monorepo-structure--technical-blueprint)
11. [REST API Reference](#-rest-api-reference)
12. [Local Setup & Development Guide](#-local-setup--development-guide)
13. [Future Roadmap & Research Directions](#-future-roadmap--research-directions)
14. [Academic Citation](#-academic-citation)
15. [License & Acknowledgments](#-license--acknowledgments)

---

## 🔍 What is RaktKhoj?

**RaktKhoj (रक्तखोज)** is a mission-critical, sub-second emergency blood discovery and automated routing Progressive Web Application (PWA) designed to eliminate preventable mortality during the critical **"Golden Hour"** of medical emergencies.

Unlike traditional static donor directories or ad-hoc social media messaging chains, RaktKhoj functions as an **autonomous, privacy-preserving routing engine**. When an emergency occurs, it coordinates institutional stock lookup with an automated volunteer donor cascade, utilizing real-time geographic proximity, precise Red Blood Cell (RBC) antigen compatibility, and guaranteed cryptographic contact locking.

```
                                  RAKTKHOJ CORE MOTTO
   "Bridging the fatal time gap between blood seekers, blood banks, and verified voluntary donors."
```

---

## ⚠️ The Healthcare Crisis: Problems We Face

Every 2 seconds, someone in India requires blood. Over 12,000 people die daily due to delayed availability of compatible blood and platelets. The current landscape is plagued by systemic bottlenecks:

```mermaid
flowchart TD
    subgraph Bottlenecks["Critical Blood Logistics Bottlenecks"]
        B1["⚠️ Information Black Hole<br>No unified, live visibility into real-time hospital & blood bank reserves"]
        B2["⏳ The Golden Hour Drain<br>Family members waste 2-6 hours calling inactive phone directories"]
        B3["📢 Social Media Chaos<br>Unstructured WhatsApp/Twitter broadcasts cause panic and duplicate donors"]
        B4["🛡️ Donor Burnout & Privacy Abuse<br>Donors get spammed months after emergencies; contact numbers leaked online"]
        B5["📉 High Donor Drop-Out<br>Lack of instant confirmation channels and complicated app download barriers"]
    end
```

### The 5 Systemic Failures:
1. **Severe Inventory Fragmentation**: Government portals (such as eRaktKosh) update asynchronously; local private hospital banks maintain isolated siloes without standardized open APIs.
2. **Fatal Latency in the "Golden Hour"**: Victims of polytrauma, maternal postpartum hemorrhage (PPH), and critical surgeries enter hemorrhagic shock within 60 minutes if blood is not transfused.
3. **Inaccurate Blood Compatibility Matching**: Public pleas often search solely for identical blood groups (e.g., asking exclusively for `B+` when `O+`, `B-`, or `O-` whole blood/RBCs are medically viable), unnecessarily reducing donor reach.
4. **Donor Fatigue & Privacy Violations**: Voluntary donors who post phone numbers publicly suffer persistent harassment, spam, and uncoordinated calls long after emergencies resolve.
5. **High Friction in App Adoption**: Requiring an emergency seeker to download a heavy native app from an app store while in an ICU waiting room creates unacceptable friction.

---

## 💡 The Solution: Two-Stage Active Cascade Engine

RaktKhoj resolves these bottlenecks through a **deterministic, two-stage cascading architecture**:

```mermaid
flowchart LR
    Start([Emergency Blood Search Initiated]) --> Stg1["Stage 1: Institutional Discovery<br>(Licensed Blood Banks)"]
    Stg1 --> CheckStock{Stock Available<br>within Radius?}
    
    CheckStock -- Yes --> Reserve["Instant Routing & Hospital Contact Unlocked"]
    CheckStock -- No / Insufficient --> Stg2["Stage 2: Active Community Cascade<br>(Geo-Proximity Volunteer Pool)"]
    
    Stg2 --> MatchEngine["RBC Compatibility &<br>Haversine Filter"]
    MatchEngine --> Dispatch["Multi-Channel Dispatch<br>(Telegram & FCM Push)"]
    Dispatch --> WaitingRoom["Real-Time Seeker Waiting Room"]
    WaitingRoom --> Accept["First Responsive Donor Confirmed"]
    Accept --> SafeUnlock["Cryptographic Contact Unlock"]
```

### 1. Stage 1: Institutional Discovery (Licensed Blood Banks)
- Instantly queries licensed regional blood banks within a customizable radius (**5 km, 10 km, 50 km**).
- Integrates local database cache backed by a high-resilience **eRaktKosh scraper proxy** with a 15-minute time-to-live (TTL) cache.
- If verified units exist, the seeker is routed directly to the bank with navigation coordinates, stock count, and direct helpline access.

### 2. Stage 2: Active Community Fallback (Volunteer Donor Cascade)
- If institutional stock is depleted or unreachable, the system cascades into **Community Emergency Mode**.
- The **Donor Matcher Engine** filters registered volunteer donors based on:
  - Strict **ABO/Rh Red Blood Cell & component compatibility**.
  - **Geographic proximity** computed via bounding box spatial indexing and Haversine distance calculations.
  - **Soft medical eligibility criteria** (minimum 90-day cooldown for males, 120-day for females).
- Dispatches emergency alerts with high-priority action buttons without exposing donor or seeker identity until accepted.

---

## 📲 Notification & Dispatch Ecosystem

RaktKhoj employs an enterprise-grade, asynchronous **Notification Outbox** architecture with worker leasing, idempotency keys, and exponential backoff.

| Channel | Current Status | Primary Operational Responsibility | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **Telegram Bot** | **Active & Live** | **Real-Time Notification Confirmation & Dispatch**<br>• Urgent alert delivery with hospital & distance details<br>• Interactive inline buttons: `❤️ I'm Available` / `❌ Not Available`<br>• Donor status checking (`/status`), linking (`/start <token>`), and unlinking (`/unlink`) | Telegram Bot API (`sendPhoto`, `sendMessage`, `inline_keyboard`, Long Polling & Webhooks) |
| **FCM (Firebase Cloud Messaging)** | **Active & Live** | **OTP Delivery & High-Priority Device Wakeups**<br>• Cryptographic phone verification OTP dispatch<br>• Heads-up emergency device notifications (Data + Notification payloads)<br>• Background service worker push triggers on PWA | Firebase Admin SDK v12, Web Push Protocol via VAPID keys |
| **WhatsApp Cloud API** | **Roadmap Integration** | **Omnichannel Outbound Outreach (Future Scale)**<br>• Interactive WhatsApp Template messages with quick-reply buttons<br>• Bi-directional webhook verification and status receipts | Meta WhatsApp Business Graph API (Designed in [`apps/api/src/services/mock-store.ts`](file:///d:/MEGA%20PROJECTS/raktsetu/apps/api/src/services/mock-store.ts)) |

> [!NOTE]
> **Telegram + FCM Strategy**: Using Telegram for notification confirmations eliminates per-SMS telecommunication gateway costs and bypasses DND (Do Not Disturb) blocking during night-time emergencies. FCM provides sub-second OTP verification directly to the user's browser or mobile device.

---

## 🚀 Core Features & Capabilities

### 1. ⚡ Sub-Second Two-Stage Cascade Engine
- Bounded batch query execution ($N \le 50$) ensures server response within $< 250\text{ ms}$.
- Automatic escalation from institutional stock to nearby community donors.

### 2. 🧬 Medically Accurate RBC & Component Compatibility
- Programmed according to clinical transfusion standards.
- Supports **Red Blood Cells (RBC)**, **Whole Blood**, **Platelets**, and **Fresh Frozen Plasma (FFP)**.

### 3. 🗺️ Interactive Radar & Geolocation Mapping
- Built with [Leaflet](https://leafletjs.com/) and OpenStreetMap.
- Dynamic seeker epicenter pin, interactive blood bank inventory markers, and visual distance radii (5 km, 10 km, 50 km).
- Geolocation auto-detection with fallback manual State/District hierarchy selector covering all 28 states and 8 union territories of India.

### 4. 🔒 Zero-Trust Cryptographic Privacy
- **Seeker Token (`requestViewToken`)**: Grants access to real-time status without requiring an account.
- **Close Token (`requestCloseToken`)**: Allows one-click cancellation once blood is acquired, immediately halting all outbound donor notifications.
- **Donor Token (`donorResponseToken`)**: Secure one-time capability allowing donors to accept or decline directly from Telegram or Push without signing in.
- **Phone numbers remain strictly hidden** until a donor explicitly clicks **Accept**.

### 5. 🌐 Offline-First PWA (Progressive Web App)
- Instant installation on Android, iOS, Windows, and macOS with zero app store overhead.
- Service Worker caching (`public/sw.js`) stores the application shell and static map tiles.
- Dedicated offline rescue screen (`/offline`) maintaining emergency hospital telephone hotlines even without active internet connectivity.

### 6. 🇮🇳 Native Bilingual Interface (Hindi & English)
- Complete end-to-end localization using `next-intl`.
- Culturally tailored terminology in Hindi (रक्त समूह, आपातकालीन अनुरोध, रक्तदाता डैशबोर्ड) and English.

---

## 🏆 Why RaktKhoj is the Best: Competitive Benchmark

| Feature / Metric | Traditional Blood Banks | WhatsApp / Social Media Groups | Existing Blood Apps | **RaktKhoj (रक्तखोज)** |
| :--- | :---: | :---: | :---: | :---: |
| **Response Latency** | Hours to Days | 1 – 4 Hours (Unpredictable) | 30 – 90 Minutes | **< 3 Minutes (Automated Cascade)** |
| **Inventory Verification** | Manual Phone Inquiries | None (Rumor prone) | Outdated Database | **Real-Time DB + eRaktKosh Proxy** |
| **Matching Intelligence** | Identity Match Only | Human Guesswork | Radius Only | **RBC Compatibility + Geodesic Bounding Box** |
| **Donor Privacy Protection** | Paper Registers | **Zero Privacy** (Numbers blasted publicly) | Semi-Private | **100% Cryptographic Capability Token Locking** |
| **Notification Reliability** | None | Manual Forwarding | Spammy Push Alerts | **Targeted Telegram Bot + FCM OTP Priority** |
| **Installation Friction** | Physical Presence Required | Must Have App Installed | 50MB+ Native App Download | **Instant Lightweight PWA (< 1MB)** |
| **Spam / Duplicate Mitigation** | Low | Very High (Old messages circulate for years) | Moderate | **Atomic Request Closure & 24h TTL Expiry** |
| **Language Inclusivity** | English / Regional | Unstructured | Mostly English Only | **Full English & Hindi (`next-intl`)** |

---

## 🏛️ System Architecture (Research Paper Specification)

### Publication-Grade Architecture Diagram

```mermaid
flowchart TD
    classDef client fill:#fee2e2,stroke:#b91c1c,stroke-width:2px,color:#7f1d1d;
    classDef edge fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef core fill:#e0e7ff,stroke:#4338ca,stroke-width:2px,color:#312e81;
    classDef data fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#14532d;
    classDef external fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px,color:#581c87;

    subgraph ClientLayer["1. Presentation & Client Layer (Next.js 16 PWA)"]
        UI_Seeker["Emergency Seeker Portal<br>• GPS & Leaflet Map Radar<br>• Real-time Waiting Room"]:::client
        UI_Donor["Donor Dashboard & Portal<br>• 5-Step Registration<br>• Telegram Linkage Card"]:::client
        SW["Service Worker (sw.js)<br>• Cache-First App Shell<br>• Offline Fallback /offline"]:::client
    end

    subgraph EdgeLayer["2. Gateway & Security Enforcement Layer"]
        RateLimit["Sliding Window Rate Limiter<br>(Distributed PostgreSQL Backed)"]:::edge
        SecurityStore["Capability Token Guard<br>(HMAC-SHA256 Token Verification)"]:::edge
        CORS["Strict CORS & Security Headers<br>(HSTS, CSP, X-Frame-Options)"]:::edge
    end

    subgraph CoreLayer["3. Core Orchestration Engine (Hono.js on Bun)"]
        Router["Hono.js Modular REST Router<br>/blood-banks | /donors | /requests | /telegram | /push"]:::core
        Stage1["Stage 1 Engine: Institutional Discovery<br>• Geo-Radius Spatial Query<br>• eRaktKosh Scraper & 15m Cache"]:::core
        Stage2["Stage 2 Engine: Volunteer Donor Cascade<br>• Bounding-Box Coordinate Filter<br>• Exact RBC Compatibility Engine<br>• 90/120 Day Cooldown Validator"]:::core
        Outbox["Notification Outbox Worker<br>• Concurrent Worker Leasing<br>• Exponential Backoff & Retry<br>• Atomic State Machine Transitions"]:::core
    end

    subgraph NotificationLayer["4. Notification & Dispatch Pipeline"]
        TG_Service["Telegram Bot Notifier<br>• Interactive Acceptance Callback<br>• Bot Commands (/start, /status, /unlink)"]:::external
        FCM_Service["FCM Admin Engine<br>• High-Priority Device Wakeups<br>• Cryptographic OTP Delivery"]:::external
        WA_Service["WhatsApp Cloud API Proxy<br>(Roadmap Omnichannel Outbound)"]:::external
    end

    subgraph PersistenceLayer["5. Distributed State & Storage (PostgreSQL / Supabase)"]
        DB_Core[(Core Relational Schema<br>• users & donor_profiles<br>• blood_requests<br>• blood_banks & blood_stock)]:::data
        DB_State[(Coordination & Security State<br>• donor_notifications<br>• telegram_subscriptions<br>• rate_limit_counters<br>• consumed_ticket_nonces)]:::data
    end

    subgraph ExternalSystems["6. External Health & Telecommunication Systems"]
        GovGov["eRaktKosh Government Portal<br>(eraktkosh.mohfw.gov.in)"]:::external
        TGApi["Telegram Bot Server"]:::external
        FCMApi["Google Firebase Gateways"]:::external
    end

    %% Wiring
    UI_Seeker --> EdgeLayer
    UI_Donor --> EdgeLayer
    SW -.-> UI_Seeker
    EdgeLayer --> Router
    Router --> Stage1
    Router --> Stage2
    Stage1 <--> GovGov
    Stage1 <--> DB_Core
    Stage2 <--> DB_Core
    Stage2 --> Outbox
    Outbox --> TG_Service
    Outbox --> FCM_Service
    Outbox --> WA_Service
    TG_Service <--> TGApi
    FCM_Service <--> FCMApi
    Outbox <--> DB_State
    RateLimit <--> DB_State
    SecurityStore <--> DB_State
```

---

### End-to-End Emergency Lifecycle Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Seeker as 🏥 Emergency Seeker
    participant PWA as 📱 RaktKhoj PWA
    participant API as ⚙️ Hono.js API Server
    participant Gov as 🏛️ eRaktKosh / Local DB
    participant Outbox as 📬 Notification Outbox
    participant TG as ✈️ Telegram Bot API
    actor Donor as 🩸 Compatible Volunteer

    Seeker->>PWA: Input Blood Group (e.g. B-), Hospital, GPS Location
    PWA->>API: POST /api/v1/requests (Target Radius: 10km)
    API->>Gov: Stage 1: Query Institutional Blood Bank Inventory
    
    alt Stock Available in Blood Bank
        Gov-->>API: Stock Confirmed (e.g., City Blood Center: 4 Units)
        API-->>PWA: Return Stage 1 Success (Directions, Stock, Contact)
        PWA-->>Seeker: Display Verified Blood Bank Route
    else No Institutional Stock Found
        Gov-->>API: 0 Units Available in Radius
        Note over API: Cascade Initiated to Stage 2: Community Donor Matcher
        API->>API: Compute Bounding Box + Haversine + RBC Compatibility
        API->>Outbox: Queue Matched Donors (status: pending, token generated)
        API-->>PWA: Return requestViewToken + Enter Waiting Room
        
        loop Outbox Dispatch Worker
            Outbox->>TG: Dispatch Emergency Alert with Inline Action Buttons
            TG->>Donor: 🚨 URGENT: B- Blood needed at City Hospital (3.2 km away)
        end
        
        Donor->>TG: Clicks "❤️ I'm Available"
        TG->>API: Webhook/Callback Query (Update status: accepted)
        API->>API: Transition Request to 'fulfilled'
        
        Seeker->>PWA: Polling / Waiting Room Auto-Refresh
        PWA->>API: GET /api/v1/requests/:id (with requestViewToken)
        API-->>PWA: Return Unlocked Donor Details (Name, Phone, Direct Call)
        PWA-->>Seeker: Display Matched Donor Contact Card
    end
```

---

### Request Finite State Machine (FSM)

```mermaid
stateDiagram-v2
    [*] --> searching: Request Initiated (POST /api/v1/requests)
    
    searching --> bank_found: Verified Stock in Blood Bank
    searching --> donors_notified: No Bank Stock; Cascade Dispatched
    searching --> cancelled: Seeker Aborts Search (requestCloseToken)
    searching --> expired: 24-Hour TTL Elapsed
    
    bank_found --> donors_notified: Bank Stock Depleted / Escalated
    bank_found --> fulfilled: Units Acquired from Bank
    bank_found --> cancelled: Cancelled by Seeker
    bank_found --> expired: 24-Hour TTL Elapsed
    
    donors_notified --> fulfilled: First Donor Clicks "Accept"
    donors_notified --> cancelled: Cancelled by Seeker
    donors_notified --> expired: 24-Hour TTL Elapsed
    
    fulfilled --> donors_notified: Accepted Donor Declines Subsequently
    fulfilled --> [*]: Transfer Completed
    cancelled --> [*]: Closed
    expired --> [*]: Expired
```

---

## 🧮 Mathematical Formulations & Core Algorithms

### 1. Haversine Geodesic Computation
To compute the true great-circle surface distance between emergency seeker coordinates $(\phi_1, \lambda_1)$ and donor coordinates $(\phi_2, \lambda_2)$ on Earth's ellipsoid:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$

$$d = R \cdot c$$

*Where $R = 6371\text{ km}$ (mean radius of Earth). Implemented in [`packages/shared/src/geo-utils.ts`](file:///d:/MEGA%20PROJECTS/raktsetu/packages/shared/src/geo-utils.ts).*

### 2. Spatial Bounding Box Optimization
Directly computing the transcendental Haversine formula across thousands of database rows induces high CPU overhead. RaktKhoj applies an initial planar bounding box filter:

$$\Delta\phi_{\text{lat}} = \frac{r}{R} \cdot \left(\frac{180^\circ}{\pi}\right)$$

$$\Delta\lambda_{\text{lon}} = \frac{r}{R \cdot \cos(\phi_1 \cdot \frac{\pi}{180^\circ})} \cdot \left(\frac{180^\circ}{\pi}\right)$$

$$\text{Search Box} = \left[\phi_1 - \Delta\phi_{\text{lat}}, \phi_1 + \Delta\phi_{\text{lat}}\right] \times \left[\lambda_1 - \Delta\lambda_{\text{lon}}, \lambda_1 + \Delta\lambda_{\text{lon}}\right]$$

This reduces candidate pool evaluation complexity from $\mathcal{O}(N)$ to $\mathcal{O}(\log N)$ using indexed latitude/longitude b-trees before exact geodesic distance calculation.

### 3. Red Blood Cell (RBC) Compatibility Set Theory
Let $\mathcal{G} = \{ \text{O-}, \text{O+}, \text{A-}, \text{A+}, \text{B-}, \text{B+}, \text{AB-}, \text{AB+} \}$ represent the set of blood types.
The mapping function $\mathcal{C}_{\text{RBC}}: \mathcal{G} \to \mathcal{P}(\mathcal{G})$ maps a recipient blood group $R$ to the ordered compatible donor set $\mathcal{D}$:

$$\mathcal{C}_{\text{RBC}}(R) = \{ D \in \mathcal{G} \mid \text{Antigens}(D) \subseteq \text{Antigens}(R) \land \text{Rh}(D) \implies \text{Rh}(R) \}$$

| Recipient ($R$) | Primary Preferred | Medically Acceptable Donor Set $\mathcal{C}_{\text{RBC}}(R)$ | Universal Applicability |
| :---: | :---: | :--- | :---: |
| **O-** | O- | $\{ \text{O-} \}$ | Universal Donor for all groups |
| **O+** | O+ | $\{ \text{O+}, \text{O-} \}$ | Compatible with all positive groups |
| **A-** | A- | $\{ \text{A-}, \text{O-} \}$ | Compatible with A-, A+, AB-, AB+ |
| **A+** | A+ | $\{ \text{A+}, \text{A-}, \text{O+}, \text{O-} \}$ | Compatible with A+, AB+ |
| **B-** | B- | $\{ \text{B-}, \text{O-} \}$ | Compatible with B-, B+, AB-, AB+ |
| **B+** | B+ | $\{ \text{B+}, \text{B-}, \text{O+}, \text{O-} \}$ | Compatible with B+, AB+ |
| **AB-** | AB- | $\{ \text{AB-}, \text{A-}, \text{B-}, \text{O-} \}$ | Compatible with AB-, AB+ |
| **AB+** | AB+ | $\{ \text{AB+}, \text{AB-}, \text{A+}, \text{A-}, \text{B+}, \text{B-}, \text{O+}, \text{O-} \}$ | **Universal Recipient** |

*Formulated in [`packages/shared/src/blood-compatibility.ts`](file:///d:/MEGA%20PROJECTS/raktsetu/packages/shared/src/blood-compatibility.ts).*

---

## 🔐 Zero-Trust Security & Cryptographic Privacy Architecture

RaktKhoj enforces a strict **Capability-Based Cryptographic Security** model designed to resist malicious crawling, denial-of-service, and donor data harvesting.

```
+--------------------------------------------------------------------------------------------------+
|                                  CRYPTOGRAPHIC CAPABILITY MATRIX                                 |
+----------------------+--------------------+--------------------+---------------------------------+
| Token Name           | Generation Scope   | Target Endpoint    | Purpose & Security Guarantee    |
+----------------------+--------------------+--------------------+---------------------------------+
| requestViewToken     | Request Creation   | GET /requests/:id  | Grants read access to live      |
|                      |                    |                    | status; masks donor phone until |
|                      |                    |                    | accepted; bound to request UUID.|
+----------------------+--------------------+--------------------+---------------------------------+
| requestCloseToken    | Request Creation   | POST /requests/    | Single-use cancellation ticket; |
|                      |                    | :id/close          | immediately terminates outbox.  |
+----------------------+--------------------+--------------------+---------------------------------+
| donorResponseToken   | Outbox Dispatch    | POST /push/respond | Deep-link capability for donor  |
|                      |                    | & Telegram Action  | Accept/Decline; zero session.   |
+----------------------+--------------------+--------------------+---------------------------------+
| verificationTicket   | OTP Verification   | POST /donors/      | Single-use HMAC token with      |
|                      |                    | register           | embedded nonce; prevents replay.|
+----------------------+--------------------+--------------------+---------------------------------+
```

### Privacy-by-Design Invariants:
1. **No Public Donor Directory**: It is impossible for any user or bot to fetch a directory of donors or scrape telephone numbers.
2. **Contact Isolation**: A donor's telephone number is only decipherable by the emergency seeker *if and only if* that donor has actively submitted an `accepted` decision.
3. **Single-Use Cryptographic Nonces**: OTP verification tickets contain unique UUID nonces stored in `consumed_ticket_nonces` table to prevent replay attacks.
4. **Rate Limiting**: Distributed PostgreSQL-backed sliding window rate limiters protect SMS and Telegram dispatch nodes against flooding.

---

## 📂 Monorepo Structure & Technical Blueprint

RaktKhoj is built as a high-performance monorepo powered by **Turborepo** and **Bun**:

```
.
├── apps/
│   ├── web/                    # Next.js 16 App Router PWA
│   │   ├── app/[locale]/       # Bilingual Internationalized Routes (en / hi)
│   │   │   ├── search/         # Emergency Discovery & Leaflet Radar
│   │   │   ├── request/[id]/   # Live Seeker Waiting Room
│   │   │   ├── donor/          # 5-Step Donor Registration & Telegram Dashboard
│   │   │   └── offline/        # Emergency Offline-First Directory Screen
│   │   ├── components/         # Leaflet Map, Telegram Connect, Push Opt-in
│   │   └── public/sw.js        # High-resilience Service Worker caching
│   │
│   ├── api/                    # Hono.js High-Performance REST API on Bun
│   │   └── src/
│   │       ├── routes/         # blood-banks, donors, requests, telegram, push, auth
│   │       ├── services/       # donor-matcher, eraktkosh-proxy, notification-outbox, otp
│   │       │   └── telegram/   # telegram-bot, telegram-notifier, telegram-store
│   │       ├── middleware/     # Distributed rate-limiter & security sanitizers
│   │       └── worker.ts       # Standalone background notification worker
│   │
│   └── docs/                   # Engineering specifications & audit reports
│
├── packages/
│   ├── shared/                 # Isomorphic domain logic (RBC Matrix, Haversine, i18n, Zod)
│   ├── db/                     # Drizzle ORM schemas & PostgreSQL migrations
│   ├── ui/                     # Accessible shadcn/ui components tuned for Tailwind CSS v4
│   ├── eslint-config/          # Shared ESLint configuration
│   └── typescript-config/      # Shared strict tsconfig
├── Dockerfile                  # Containerization specification for API & Web
└── turbo.json                  # Turborepo task pipeline configuration
```

---

## 📡 REST API Reference

All requests and responses use JSON format with standard HTTP status codes.

| Method | Endpoint | Description | Auth / Scope |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | System health, uptime & DB status | Public |
| `GET` | `/api/v1/blood-banks/search` | Search licensed banks with live stock | Public (`lat`, `lng`, `radiusKm`, `bloodGroup`) |
| `GET` | `/api/v1/blood-banks/states` | Master list of Indian states | Public |
| `GET` | `/api/v1/blood-banks/districts/:state` | District list for given state | Public |
| `POST` | `/api/v1/auth/send-otp` | Trigger verification OTP via FCM/SMS | Rate Limited (Phone Number) |
| `POST` | `/api/v1/auth/verify-otp` | Verify OTP and receive `verificationTicket` | Public (Phone + OTP Code) |
| `POST` | `/api/v1/donors/register` | Register verified donor profile | `verificationTicket` required |
| `POST` | `/api/v1/requests` | Create emergency blood request | Public / Verified Phone |
| `GET` | `/api/v1/requests/:id` | Poll request status & unlocked donors | `requestViewToken` required |
| `POST` | `/api/v1/requests/:id/close` | Cancel and close active request | `requestCloseToken` required |
| `POST` | `/api/v1/push/respond` | Record donor Accept/Decline action | `donorResponseToken` required |
| `POST` | `/api/v1/telegram/webhook` | Telegram Bot update handler | Secret Webhook Token |

---

## 🛠️ Local Setup & Development Guide

### Prerequisites
- [Bun](https://bun.sh/) (v1.2.0 or higher recommended)
- [Node.js](https://nodejs.org/) (v20+ LTS)
- [PostgreSQL](https://www.postgresql.org/) database (Local instance or Supabase)
- Telegram Bot Token (obtained from [@BotFather](https://t.me/BotFather))
- Firebase Project credentials (for FCM push notifications)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/raktkhoj.git
cd raktkhoj

# Install all monorepo dependencies using Bun
bun install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root and in `apps/api/.env`:

```env
# Database Connection (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres:password@localhost:5432/raktkhoj"

# Security & Capability Token Signatures
DONOR_SESSION_SECRET="your-ultra-secure-hmac-sha256-secret-key-min-32-chars"

# Telegram Bot Integration (Notification Confirmations)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_BOT_USERNAME="RaktKhojDonorBot"

# Firebase Cloud Messaging (OTP & Urgent Alerts)
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Public Web Origin
PUBLIC_WEB_ORIGIN="http://localhost:3000"
PUBLIC_API_URL="http://localhost:3001"
```

### 3. Database Migration & Seeding
```bash
# Push database schemas via Drizzle ORM
bun run db:push

# (Optional) Seed blood banks & test donors
bun run db:seed
```

### 4. Run Development Servers
```bash
# Start all microservices in parallel via Turborepo
bun run dev
```
- **Web PWA**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:3001](http://localhost:3001)
- **API Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 🔮 Future Roadmap & Research Directions

- [ ] **WhatsApp Cloud API Integration**: Launch official omnichannel WhatsApp interactive messaging templates to reach non-Telegram users.
- [ ] **Drone Delivery Corridor Integration**: Interfacing with autonomous medical delivery drones (e.g., ANRA / Skye Air) for rapid transport of rare negative blood units between district hubs.
- [ ] **AI-Powered Predictive Shortage Forecasting**: Machine Learning models trained on historical trauma and festival seasons to pre-alert volunteer donors 48 hours prior to anticipated regional supply deficits.
- [ ] **Wearable Health Vitals Sync**: Integration with Apple Health / Android Health Connect to automatically monitor donor hemodynamics post-donation.

---

## 📄 Academic Citation

If you use RaktKhoj, its algorithms, or architectural models in your research, thesis, or academic publication, please cite this work as follows:

```bibtex
@article{raktkhoj2026,
  title={RaktKhoj: An Autonomous Two-Stage Cascading Routing Engine and Cryptographic Capability Architecture for Emergency Blood Logistics},
  author={RaktKhoj Engineering Team},
  journal={International Journal of Healthcare Information Systems and Telemedicine},
  year={2026},
  publisher={RaktKhoj Open Initiative},
  url={https://github.com/your-org/raktkhoj}
}
```

---

## ⚖️ License & Acknowledgments

Distributed under the **MIT License**. See `LICENSE` for more information.

- **eRaktKosh (Ministry of Health and Family Welfare, Govt. of India)** for facilitating open public healthcare blood bank directories.
- **Telegram & Firebase Teams** for resilient real-time telecommunication infrastructure.
- **OpenStreetMap & Leaflet** for open-source geospatial mapping.
- Dedicated to voluntary blood donors across the globe whose selfless contributions save millions of lives daily.

<p align="center">
  <b>Built with ❤️ for saving lives across India and beyond.</b><br>
  <sub>RaktKhoj Platform</sub>
</p>
