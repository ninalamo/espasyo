# Drift & Gap Analysis — Espasyo Data and Flow

**Purpose:** Document process drifts (implementation diverges from intended thesis design) and gaps (missing data/flow/behavior) across the full incident → analysis → forecast → manpower pipeline. This is analysis only — no implementation files are touched.  
**Proof standard:** Every claim cites file path + line range; behavior is traced from caller to callee in each direction.  
**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`

---

## 1. Executive summary

The system has a recognizable end-to-end flow (incidents → K-Means clustering → SSA forecast → forecast results → precinct manpower suggestions), but multiple process drifts and gaps exist between the intended thesis design and the current implementation:

| Category | Count | Examples |
|----------|-------|----------|
| Auth gap | 2 | `forecastApi.ts`, `manpowerApi.ts` send raw `fetch` without Bearer token |
| Config drift | 3 | Stale `https://localhost:7007/api` fallback in `apiConfig.ts`, `forecastApi.ts`, `manpowerApi.ts` |
| Filter flow gap | 5 | Motives, weather, precincts captured in UI but never sent to backend (`buildFilters()` drops them) |
| Model identity drift | 4 | All backend runs labeled `Linear`; `getById()` hardcodes SSA params; `save()` submits `Linear` |
| Persistence gap | 1 | Silent localStorage fallback when snapshot endpoint fails |
| Hardcoded constants | 6 | `OFFICERS_PER_SQKM`, `PATROL_DEMAND`, `HARDCODED_SHIFT`, severity weights, risk baselines (precincts page) |
| Missing features | 6 | Geocoding UI, time-of-day distribution chart, temporal attributes table, preprocessing visualization, hotspots→recommendations screen, high-risk periods+action plan screen |
| Data provenance | 1 | SQLite sample unverified; synthetic fixtures not thesis evidence |

GA-01 (thesis evaluation protocol) is pending owner/adviser sign-off, so GA-01-gated items (F-09, F-10, G-03 through G-07) cannot be implemented yet. Unblocked calibration items (F-01 through F-08, G-08, G-09) can proceed after this analysis is reviewed.

---

## 2. Auth gap — Bearer token not attached on two of three API clients

### Intended behavior
Per root `AGENTS.md` §"System map": the browser attaches `Authorization: Bearer <JWT>` from the NextAuth session via `apiService.ts`. Backend auth endpoints live behind `UserController`. Both sides share `NEXTAUTH_SECRET`.

### Current implementation — drift
`apiService.ts` correctly attaches the token:
- `D:\loa\sir_regie\espasyo\nextjs-auth-app\src\app\api\utils\apiService.ts`, lines 25–34 (`get`): reads `session?.user?.token`, sets `Authorization: Bearer ${token}`.
- Same pattern in `post` (lines 36–48), `put` (lines 51–63), `delete` (lines 65–76).

However, `forecastApi.ts` and `manpowerApi.ts` bypass `apiService` entirely and use raw `fetch` with **no Authorization header**:
- `D:\loa\sir_regie\espasyo\nextjs-auth-app\src\app\api\utils\forecastApi.ts`, lines 137–156 (`fetchApi`): constructs `headers` with only `Content-Type`; no `Authorization`. Used by `list()` (line 158), `getById()` (line 191), `save()` (line 239), `delete()` (line 421), `evaluate()` (line 430).
- `D:\loa\sir_regie\espasyo\nextjs-auth-app\src\utils\manpowerApi.ts`, lines 59–81 (`fetchApi`): same pattern — `headers` only has `Content-Type`; no `Authorization`. Used by all manpower methods (`getAllManpower` line 86, `getPrecincts` line 110, `upsertManpower` line 134, etc.).

### Impact
Forecast and manpower endpoints are called without authentication even though the backend may require it (GA-08: backend authorization boundaries are undefined). This is an auth gap that must be closed before protected endpoints can be reliably called.

---

## 3. Config drift — stale API base URL fallback

### Intended behavior
Working base URL is `http://127.0.0.1:5041/api` (root `AGENTS.md` drift notes). `NEXT_PUBLIC_API_URL` must be set via `.env.local`.

### Current implementation — drift
All three clients define their own `API_BASE_URL` with a stale fallback:
- `apiConfig.ts`, line 1: `const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:7007/api").replace(/\/$/, "");`
- `forecastApi.ts`, line 94: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7007/api';`
- `manpowerApi.ts`, line 5: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7007/api';`

### Impact
If `NEXT_PUBLIC_API_URL` is unset, all three clients point to a non-existent `https://localhost:7007/api`. The frontend must surface missing configuration explicitly rather than silently failing against a stale URL.

---

## 4. Filter flow gap — UI captures filters that never reach the backend

### Intended behavior
Per GA-03: every visible filter (`crimeTypes`, `motives`, `severities`, `weathers`, `precincts`) must be sent through the request DTO to the backend query. A filter shown as active must be present in the request.

### Current implementation — drift
`buildFilters()` in `D:\loa\sir_regie\espasyo\nextjs-auth-app\src\app\analysis\page.tsx`, lines 85–94:
```tsx
const buildFilters = useCallback(() => {
    const filters: Record<string, string[]> = {};
    if (selectedFeatures.includes("CrimeType") && filterState.selectedCrimeTypes.length > 0) {
      filters.crimeTypes = filterState.selectedCrimeTypes;
    }
    if (selectedFeatures.includes("Severity") && filterState.selectedSeverity.length > 0) {
      filters.severities = filterState.selectedSeverity;
    }
    return filters;
}, [selectedFeatures, filterState]);
```
Only `crimeTypes` and `severities` are sent, and only when their feature is selected. The `FilterSection.tsx` component (lines 4–26) captures `selectedMotive`, `selectedPrecinct`, `selectedWeather` in state, but `buildFilters()` never reads them.

The full payload sent to `/incident/grouped-clusters` (lines 114–122) includes `dateFrom`, `dateTo`, `features`, `numberOfClusters`, `numberOfRuns`, `filters` — but `filters` contains at most two of five possible dimensions.

### Impact
Motives, weather, and precinct (barangay geography) filters are visible in the UI but have no effect on the analysis results. This is a flow gap: the user believes a filter is active when it is omitted from the request. Per GA-03 acceptance criterion #3: "A frontend request test verifies every selected filter arrives in the corresponding backend filter property."

### Related: forecast page has no date filter
`D:\loa\sir_regie\espasyo\nextjs-auth-app\src\app\forecast\new\page.tsx`, lines 40–46: `forecastParams` contains only `forecastPeriod`, `model`, `confidence`, `includeSeasonality`, `weightRecentData` — no `dateFrom`/`dateTo`. The historical date range is implicit from whatever cluster data is in localStorage (line 59: `localStorage.getItem('lastAnalysisClusters')`).

---

## 5. Model identity drift — SSA results labeled Linear; params hardcoded

### Intended behavior
The backend persists `ForecastModelTypeEnum.SSA` (per gap analysis). The frontend should reflect the actual model, horizon, and parameters from persisted data.

### Current implementation — drift
- `forecastApi.ts`, line 171: `list()` maps every backend run to `activeModel: 'Linear'` regardless of the actual persisted model type.
- `forecastApi.ts`, line 366: `save()` submits `modelType: 'Linear'` to the `/ForecastRun` ML endpoint, even when the user selected SSA.
- `forecastApi.ts`, lines 219–224: `getById()` hardcodes `forecastPeriod: 6`, `model: 'ssa'` instead of reading them from the backend response.
- `ForecastContext.tsx`, line 306: `activeModelLabel: 'Linear'` hardcoded in the context value.
- `ForecastContext.tsx`, lines 242–243: `saveCurrentForecast()` hardcodes `params: { forecastPeriod: 6, model: 'ssa' as const, ... }` instead of using the actual `forecastParams` state.

### Impact
The same forecast means different things on generation, storage, listing, and detail views. Per GA-07: "Use one shared API base URL configuration" and "Persist the actual model, horizon, confidence, filter set, feature/preprocessing parameters, data/source identifier, seed, generation timestamp, and evaluation protocol/version with each forecast."

---

## 6. Persistence gap — silent localStorage fallback

### Intended behavior
Per root `AGENTS.md`: "the frontend must not substitute local/mock data when the API fails — surface the error instead." Per GA-07 acceptance criterion #2: "A failed backend save is visibly reported as not server-persisted; a local-only draft is never mixed into authoritative server results without a clear marker."

### Current implementation — drift
`forecastApi.ts`, lines 315–341 (`save()` method): when `/ForecastRun/snapshot` throws, the catch block (line 316) logs a warning and then **saves to localStorage and returns the snapshot as if it were server-persisted**. The caller has no way to distinguish a server-saved forecast from a local-only draft.

`forecastApi.ts`, lines 413–427 (`delete()`): when `/ForecastRun/{id}` fails, the error is silently swallowed with comment "Local-only forecast; nothing to delete on backend."

### Impact
Users may believe a forecast is server-persisted when it only exists in browser localStorage. This violates the AGENTS.md rule against silent mock substitution.

---

## 7. Hardcoded constants — patrol allocation not owner-calibrated

### Intended behavior
Per GA-05: patrol allocation weights and thresholds must be calibrated by the operational owner/adviser, not derived from arbitrary constants or the seeder's random manpower.

### Current implementation — drift
`D:\loa\sir_regie\espasyo\nextjs-auth-app\src\app\precincts\page.tsx`:
- Line 20: `const OFFICERS_PER_SQKM = 1.5;` — arbitrary constant.
- Line 21: `const PATROL_DEMAND = 40;` — arbitrary constant.
- Line 41: `const HARDCODED_SHIFT = 'Morning';` — all precinct edits write to Morning shift only; no actual shift selection.
- Lines 23–28: `CRIME_SEVERITY_WEIGHTS` — hard-coded severity-to-weight mapping (0→5, 1→4, etc.).
- Lines 30–32: `RISK_BASELINE` — hard-coded risk thresholds (critical: 6, high: 4, medium: 3, low: 2).

The suggestion formula (lines 144–152) combines these constants: `weightedScore / PATROL_DEMAND` for patrol units, `areaSqKm * OFFICERS_PER_SQKM` for area units, then `Math.max(RISK_BASELINE[riskLevel], ...)`.

### Impact
Recommendations cannot be traced to an approved allocation model. Per GA-05 acceptance criterion #3: "Every displayed suggestion can be traced to one authoritative backend result and its input forecast; no separate client-only formula produces a conflicting answer." Currently the client-only formula IS the only formula — the backend `/manpower/analyze` sends an empty `PredictedCaseCounts` dictionary (per gap analysis evidence/status).

---

## 8. Missing features vs. figure requirements

| Figure | Requirement | Current status | Gap detail |
|--------|-------------|---------------|------------|
| #1 | Secured login module | ⚠️ Partial | Login page exists (`login/page.tsx`), Bearer token attached by `apiService`, but **not** by `forecastApi.ts` or `manpowerApi.ts` (see §2). |
| #2 | Geocoding process (address → coordinates) | ❌ Missing | No geocoding UI/module found. `AddIncidentDto` has `latitude`/`longitude` fields but no address-input → coordinate conversion screen. Backend overview mentions `IncidentCreatedEventHandler → IGeocodeService` but no frontend counterpart. |
| #3 | Crime data upload module | ✅ Exists | `/crime-record/bulk-upload` page + `csvProcessingService.ts`. |
| #4 | Distribution of crime incidents by time of day | ⚠️ Partial | `ClusterItem.timeOfDay` field exists. `BarangayMonthlyChart` breaks down by Morning/Afternoon/Evening per barangay/month. `CrimeTrendChart` has time-of-day filter. But **no standalone time-of-day distribution chart** across the whole dataset. |
| #5 | Temporal filtering feature | ✅ Exists | Analysis page `QueryBar` has `dateFrom`/`dateTo` (default last 12 months). `CrimeTrendChart` and `BarangayMonthlyChart` have date/month/year filters. Map has month/year filters. |
| #6 | Crime incident dataset with temporal attributes | ⚠️ Partial | Analysis cluster items include month, day, year, timeOfDay, precinct, crimeType. `MapModal` shows per-cluster item table. But **no dedicated full dataset table view** with temporal attributes — only modal popups per cluster. |
| #7 | Temporal data preprocessing & transformation | ⚠️ Partial | `aggregateByMonth()` exists in forecast/new/page.tsx and ForecastContext. `ForecastTrendChart` lines 526–540 has a text explanation of SSA decomposition. But **no visual preprocessing/transformation UI** showing raw → aggregated → SSA input. |
| #8 | Crime hotspot map filtered by time period | ✅ Exists | `Map.tsx` has post-analysis filters for months/years/crime types (lines 407–445). Analysis page sends `dateFrom`/`dateTo` to `/incident/grouped-clusters` (line 115–121). |
| #9 | Generated temporal analysis report | ✅ Exists | `downloadAnalysisReport()` in analysis/page.tsx (lines 326–384) generates markdown with date range, clusters, precincts, time period, crime types, cluster details. |
| #10 | Hotspots summary → prevention recommendations | ⚠️ Partial | Analysis page shows cluster distribution. Forecast overview has `apiResponse.summary.recommendedActions` (overview/page.tsx lines 105–114). Precincts page shows officer suggestions. But **no dedicated screen** summarizing identified hotspots and generating prevention recommendations from them. |
| #11 | High-risk time periods + action plan | ⚠️ Partial | Dashboard has anomaly detection (`isAnomaly`, >50% change, page.tsx lines 32–38). Forecast has `riskLevel` per data point. Overview page has risk assessment logic. But **no dedicated screen** aggregating risk levels into time periods with an action plan. |
| #12 | Sample prediction / forecasted crime pattern | ✅ Exists | `forecast/new/page.tsx` generates predictions via `/incident/forecast/statistical` (line 146). Forecast overview shows predictions with trend, risk level, confidence, shift distribution. |

---

## 9. Data provenance gap

### Intended behavior
Per `DATA_PROVENANCE.md`: the checked-in SQLite sample is unverified (not inspected); generated fixtures are synthetic and labeled as development/demo only. Thesis validation must use only the approved dataset and protocol from GA-01.

### Current implementation — drift
- `nin-architecture/DATA_PROVENANCE.md`, lines 13–14: SQLite sample provenance unverified; suitability is "Development / demo only."
- `nin-architecture/espasyo_console/Program.cs`: seeder generates 5,000 random incidents with `--seed=42` default; coordinates are random points inside barangay polygons; manpower headcounts are random 15–40 per precinct.
- Root `AGENTS.md`: `db.json` / json-server is a legacy mock; frontend must not substitute local/mock data when the API fails.

### Impact
Any clustering, forecast, or allocation results computed on the current SQLite sample or seeder output are **not thesis evidence** — they are smoke-test fixtures only. This must be clearly communicated to users and recorded in the GA-01 protocol.

---

## 10. Frontend-backend DTO drift risk

### Intended behavior
Per root `AGENTS.md`: "DTOs are duplicated, not shared... Any API contract change requires updating both repos."

### Current implementation — drift
- `forecastApi.ts` (lines 97–135) defines its own `ForecastRunResult`, `GetForecastRunsResponse`, `SaveForecastSnapshotResponse`, `ForecastResultDto` interfaces that mirror backend DTOs by hand.
- `src/types/` contains manually maintained TypeScript types mirroring C# DTOs.
- No shared contract package or contract test exists to detect drift when a backend DTO or route changes.

### Impact
If a backend DTO changes without the matching frontend type update, the frontend will silently misparse responses. Per GA-10 acceptance criterion #3: "API contract tests fail if a backend DTO or route changes without the matching frontend update."

---

## 11. Classification summary

| ID | Type | Figure(s) | GA-01 gated? | Files involved |
|----|------|-----------|--------------|----------------|
| D-01 | Auth gap | #1 | No | `forecastApi.ts`, `manpowerApi.ts` |
| D-02 | Config drift | #1 | No | `apiConfig.ts`, `forecastApi.ts`, `manpowerApi.ts` |
| D-03 | Filter flow gap | #2, #3, #5, #8 | Partially (GA-03) | `analysis/page.tsx` `buildFilters()`, `FilterSection.tsx` |
| D-04 | Model identity drift | #12 | Partially (GA-07) | `forecastApi.ts`, `ForecastContext.tsx` |
| D-05 | Persistence gap | #12 | Partially (GA-07) | `forecastApi.ts` `save()` catch block |
| D-06 | Hardcoded constants | #10, #11 | Yes (GA-05) | `precincts/page.tsx` |
| D-07 | Missing feature: geocoding UI | #2 | No | — (new file) |
| D-08 | Missing feature: time-of-day distribution chart | #4 | No | — (new component) |
| D-09 | Missing feature: temporal attributes table | #6 | No | — (new component/page) |
| D-10 | Missing feature: preprocessing visualization | #7 | No | — (new component) |
| D-11 | Missing feature: hotspots→recommendations screen | #10 | Yes (GA-05) | — (new page) |
| D-12 | Missing feature: high-risk periods+action plan | #11 | Yes (GA-05) | — (new page) |
| D-13 | Data provenance | #3, #6 | Yes (GA-01, GA-02) | `DATA_PROVENANCE.md`, `espasyo_console/` |
| D-14 | DTO drift risk | All | Partially (GA-11) | `forecastApi.ts`, `src/types/` |

---

## 12. Recommendation on sequencing

**Unblocked (can start now, no GA-01 dependency):**
- D-01: Attach Bearer token to `forecastApi.ts` and `manpowerApi.ts`
- D-02: Fix stale API base URL fallbacks
- D-04/D-05: Correct model identity and persistence behavior in `forecastApi.ts`
- D-07/D-08/D-09/D-10: Build missing frontend features (geocoding, time-of-day chart, dataset table, preprocessing viz)

**Blocked on GA-01 sign-off (do not implement yet):**
- D-03 (filter flow): needs clustering semantics decision (area 3 of GA-01)
- D-06 (hardcoded constants): needs patrol allocation model approval (area 6 of GA-01)
- D-11/D-12 (recommendations screens): needs patrol allocation unit/constraints (area 6 of GA-01)
- D-13 (provenance): needs SQLite sample inspection + GA-01 sign-off
- D-14 (DTO drift): contract tests need GA-01-defined acceptance criteria

**Next step:** Review this drift/gap document. Once approved, select the first unblocked item (e.g., D-01) and activate it via `handoff-active.md`.
