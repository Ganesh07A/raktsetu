# BRIEFING — 2026-10-30T05:01:00Z

## Mission
Investigate current monorepo and infrastructure state at d:\MEGA PROJECTS\raktsetu for RaktSetu / RaktKhoj project implementation.

## 🔒 My Identity
- Archetype: teamwork_explorer
- Roles: explorer, survey
- Working directory: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_1\
- Original parent: 9c9197d0-fd6d-4bbf-8faa-7bae79786334
- Milestone: Survey & Infrastructure Assessment

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify source code or run build/install commands that alter code
- Output comprehensive findings to survey_report.md and handoff.md

## Current Parent
- Conversation ID: 9c9197d0-fd6d-4bbf-8faa-7bae79786334
- Updated: 2026-10-30T04:54:30Z

## Investigation State
- **Explored paths**:
  - `package.json`, `turbo.json`, `AGENTS.md`, `bun.lock`, `.npmrc`
  - `apps/web` (Next.js 16.3.8, React 19.2.8, App router, default starter code)
  - `apps/docs` (Next.js 16.3.8, React 19.2.8, default starter code)
  - `packages/ui` (React 19 library, button, card, code)
  - `packages/eslint-config` (Flat config, Babel parser referencing @babel/preset-typescript)
  - `packages/typescript-config` (base.json, nextjs.json, react-library.json)
  - Environment: Node v22.18.0, Bun 1.4.2, Turbo 2.11.10, TypeScript 7.0.2
- **Key findings**:
  - Monorepo uses Bun 1.4.2 as package manager (`bun.lock`, lockfileVersion 2). Node is v22.18.0 (root engines specify `"node": ">=24"` which gives engine warnings under standard Node, but Bun ignores or executes smoothly).
  - Turborepo version is 2.11.10. `turbo.json` already contains tasks: build, lint, check-types, dev, db:generate, db:migrate, db:push.
  - Workspaces wildcard `apps/*` and `packages/*` is already configured in root `package.json`.
  - Type checking (`bun run check-types`) passes across all 3 existing TypeScript packages/apps.
  - Linting (`bun run lint`) currently fails in `@repo/ui`: `@repo/eslint-config/base.js` configures `@babel/eslint-parser` with `presets: ["@babel/preset-typescript"]`. Because `@babel/preset-typescript` is only in `@repo/eslint-config/devDependencies` and not hoisted or peer-dependent in child packages, `@repo/ui` cannot resolve it when executing `eslint .`.
  - Missing apps/packages required by implementation plan: `apps/api` (Hono on Bun), `packages/db` (Drizzle ORM + Postgres), `packages/shared` (compatibility matrix, geo-utils, i18n).
  - `apps/web` is currently standard create-next-app boilerplate without Tailwind CSS, shadcn, PWA manifest, service worker, next-intl, or Leaflet.
  - `packages/ui` is a basic 3-component package, not yet set up for shadcn/ui.
- **Unexplored areas**: None for survey scope. Compiling reports now.

## Key Decisions Made
- Fully documented all infrastructure differences and actionable prerequisites.

## Artifact Index
- DISPATCH.md — Received dispatch message
- BRIEFING.md — Persistent context & state
- progress.md — Liveness heartbeat & task tracking
- survey_report.md — Comprehensive findings report
- handoff.md — 5-component handoff report
