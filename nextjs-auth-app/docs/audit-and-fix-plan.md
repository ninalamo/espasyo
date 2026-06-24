# Espasyo App Audit

## Verified Issues (source-confirmed)

### P1 — Affects thesis defensibility

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 1 | **No pipeline integration in UI** | `analysis/AnalysisTabs.tsx`, `forecast/TrendAnalysis.tsx` | Analysis page has no button to send clusters to forecasting. Forecast→Manpower has a link (`TrendAnalysis.tsx:346`) but Analysis→Forecast requires manual navigation. The data flow works (localStorage), but there's no visible "next step" button. |
| 2 | **Hardcoded manpower formula** | `manpower/page.tsx:36-51` | `PATROL_HOURS_PER_MONTH = 22*8`, `OFFICERS_PER_SQKM = 1.5`, `CRIME_SEVERITY_WEIGHTS` map, `DEFAULT_RULES` thresholds. Page has an amber disclaimer calling it "exploratory," but the thesis claim of ML-driven allocation relies on this. |
| 3 | **Zero tests** | whole project | No `.test.*` or `.spec.*` files anywhere. |

### P2 — Quality-of-life

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 4 | **No error boundaries** | whole project | No `error.tsx` at any route level. API errors bubble up as toast toasts only. |
| 5 | **No loading.tsx** | whole project | Pages use inline `loading` booleans instead of Next.js suspense boundaries. Works fine, but not idiomatic. |
| 6 | **fetchCachedData has no TTL** | `api/utils/fetchCachedData.ts` | Data stored in localStorage lives forever — no expiry or invalidation. |

### P3 — Minor / Design choices

| # | Issue | Location | Detail |
|---|-------|----------|--------|
| 7 | **Feature selection limited to one demographic** | `analysis/FeatureSelect.tsx` | Deliberate design (curse-of-dimensionality tooltip on line 55-63), but you cannot combine e.g. CrimeType + Severity. |
| 8 | **Dashboard fetches pageSize=500** | `page.tsx:107` | Fine for thesis demo; won't scale past low thousands. |

## What I initially reported incorrectly

| Claim | Verdict |
|-------|---------|
| Race condition in precincts page | **False.** Both fetches are fire-and-forget in useEffect, each sets its own state. Not buggy. |
| Dead code in forecast/new/page.tsx | **False.** No `if (false)` block exists in the current code. |
| localStorage SSR crash on dashboard | **False.** The page is `'use client'` and all localStorage access is inside useEffect. fetchCachedData.ts also only accesses localStorage inside function bodies, not at module scope. |
