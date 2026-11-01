# AGENTS.md — Espasyo Frontend (`espasyo/`)

**Audience:** AI coding agents. Human setup steps live in `README.md` (per-project, not duplicated here). This file governs **agent behavior, constraints, and required initial reads**.

---

## Repo shape

- The **app** lives in `nextjs-auth-app/` (Next.js 16 App Router, Turbopack dev, TypeScript). All runtime work happens there.
- The **repo root is documentation**: `architecture.md`, `espasyo-action-plan.md`, `espasyo-review-plan.md`, `Feedback.md`, `forecast-methodology-gaps.md`, `manpower-api-documentation.md`. Consult these before changing analytics behavior or API integration — they carry review decisions that override "common sense".
- `db.json` + `json-server` is a **legacy mock**, not the data source. Never reintroduce it as a runtime path; on API failure, surface the error.

## Commands (run inside `nextjs-auth-app/`)

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server (Turbopack, port 3000) | `npm run dev` |
| Production build | `npm run build` |
| Serve production build | `npm run start` |
| Lint | `npm run lint` |

## Environment

`.env.local` (in `nextjs-auth-app/`) must define:

- `NEXT_PUBLIC_API_URL` — backend base; expected `http://127.0.0.1:5041/api`. **Required**: `src/app/api/utils/apiConfig.ts` falls back to a stale `https://localhost:7007/api` when unset.
- `NEXTAUTH_URL` — `http://localhost:3000`
- `NEXTAUTH_SECRET` — must match the backend's secret. **Never commit it**; the value printed in `README.md` is a placeholder for documentation.

## Constraints (enforced)

1. **API calls go through `src/app/api/utils/apiService.ts` only** (get/post/put) against `API_BASE_URL` from `apiConfig.ts`. No raw `fetch` to backend URLs, no hardcoded base URLs.
2. **Auth header is session-driven.** `apiService` reads `session.user.token` via NextAuth and attaches `Authorization: Bearer <JWT>`. Do not fetch tokens elsewhere or hand-roll auth.
3. **Backend DTOs are mirrored by hand** in `src/types/`. When the API contract changes (backend repo), update the matching type here the same day — there is no shared contract package.
4. **No local analytics engine.** Forecasting/clustering/anomalies live in the backend (`MachineLearningService`). No client-side regression, no fallback forecaster, no silent mock substitution — deleted once per `Feedback.md`; do not resurrect.
5. **Route structure is fixed:** pages under `src/app/`, guards in `src/app/hoc/withAuth.tsx`, auth flow in `src/app/api/auth/[...nextauth]/route.ts`. Match the existing conventions when adding routes.
6. **Secrets:** never commit `.env.local`, `NEXTAUTH_SECRET`, or generated credentials.
7. **Spec first.** Review existing code and generate its counterpart spec before modifying it; carry out new specs once reviewed. See root `AGENTS.md` §"Agent operating rules".
8. **Off-limits (user decision 2026-10-18):** `.bak` files and auth-related code — login route (`src/app/api/auth/[...nextauth]/route.ts`), `withAuth` HOC, `apiService` Bearer handling, `forecastApi` auth header. Leave alone unless the user explicitly asks for a change.

## Initial reads (before any code change)

1. `README.md` (setup/env expectations)
2. `architecture.md` (frontend architecture + route map)
3. `nextjs-auth-app/src/app/api/utils/apiConfig.ts` and `apiService.ts` (API surface + auth header)
4. `nextjs-auth-app/src/app/api/auth/[...nextauth]/route.ts` (credential flow, token placement)
5. `nextjs-auth-app/src/types/` (DTO mirrors — always cross-check against the backend repo's DTOs)
6. `Feedback.md` and `forecast-methodology-gaps.md` when touching analytics/forecasting/incident features
