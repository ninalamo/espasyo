# Figure ↔ Objective Verification — Espasyo App

**Purpose:** Verify each of the 12 figure requirements against the current app implementation, centered on correctness vs. the study objectives (RQ1–RQ5).  
**Proof standard:** Every claim cites file path + line range; behavior is traced from caller to callee.  
**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`

---

## Study objectives (from "Objectives of the Study")

| ID | Objective |
|----|-----------|
| RQ1 | How can crime hotspots be identified and mapped using spatiotemporal analysis? |
| RQ2 | What temporal trends characterize crime incidents in Muntinlupa? |
| RQ3 | How can K-Means clustering be utilized to determine crime patterns and hotspot groupings? |
| RQ4 | What crime prevention recommendations can be generated from the results of the spatiotemporal analysis? |
| RQ5 | How effectively can a regression model predict crime occurrences based on historical crime data? |

**General objective:** develop a program that utilizes spatiotemporal analysis to evaluate and address crimes in Muntinlupa City.  
**Geographic scope:** Muntinlupa City (9 barangays).  
**Unit of analysis:** individual crime record, filtered by crime category and barangay geography.  
**Manpower scope:** roving/patrol personnel, not case-handling staff.

---

## Verification matrix

| # | Figure requirement | Serves objective | Exists? | Correct? | Evidence (file:lines) | Calibration needed for correctness |
|---|-------------------|------------------|---------|----------|----------------------|-----------------------------------|
| 1 | Secured login module — controlled access, protected crime data | All objectives (secured system) | PARTIAL | INCORRECT | Login page: `espasyo/nextjs-auth-app/src/app/login/page.tsx` (lines 7–74). Bearer token attached by `apiService.ts` lines 25–76. **Missing:** `forecastApi.ts` lines 137–156 and `manpowerApi.ts` lines 59–81 use raw `fetch` with **no Authorization header**. | Attach Bearer token from NextAuth session to `forecastApi.ts` and `manpowerApi.ts` (all fetch calls). |
| 2 | Geocoding process — addresses → coordinates via GIS | RQ1 (mapping), RQ3 (spatial grouping) | MISSING | — | No geocoding UI/module found in frontend. `AddIncidentDto` (`types/crime-record/AddIncidentDto.ts` lines 3–13) has `latitude`/`longitude` fields but no address-input → coordinate conversion screen. Backend overview mentions `IncidentCreatedEventHandler → IGeocodeService` but no frontend counterpart. | Build geocoding UI: address input → GIS service → lat/long, then pass to incident creation. |
| 3 | Crime data upload module — import police reports | RQ1 (data input) | EXISTS | CORRECT | `/crime-record/bulk-upload` page (`crime-record/bulk-upload/page.tsx`). `csvProcessingService.ts` (`src/services/csvProcessingService.ts` lines 1–8929). POST `/incident/bulk` endpoint. | None — built. Verify CSV column mapping matches incident schema. |
| 4 | Distribution of crime incidents by time of day | RQ2 (temporal trends) | PARTIAL | INCORRECT | `ClusterItem.timeOfDay` field (`types/analysis/ClusterDto.ts` lines 13–26). `BarangayMonthlyChart.tsx` breaks down by Morning/Afternoon/Evening per barangay/month (lines 13–17, 137–139). `CrimeTrendChart.tsx` has time-of-day filter (lines 31, 93, 341–346). **Gap:** no standalone time-of-day distribution chart across the whole dataset — time-of-day is only a filter/breakdown, not a primary distribution view. | Add a standalone time-of-day distribution chart (all incidents aggregated by Morning/Afternoon/Evening, optionally by crime type/precinct). |
| 5 | Temporal filtering — analyze trends across selected periods | RQ2 | EXISTS | CORRECT | Analysis page `QueryBar` has `dateFrom`/`dateTo` (default last 12 months up to yesterday) — `analysis/page.tsx` lines 23–24. `CrimeTrendChart.tsx` lines 96–104 (date filtering). `BarangayMonthlyChart.tsx` lines 82–86 (month/year filters). `Map.tsx` lines 89–93 (month/year filters). | None — built. |
| 6 | Crime incident dataset with temporal attributes | RQ2 (data transparency) | PARTIAL | INCORRECT | Analysis cluster items include month, day, year, timeOfDay, precinct, crimeType (`types/analysis/ClusterDto.ts` lines 13–26). `MapModal` shows per-cluster item table (`analysis/page.tsx` lines 457–505). **Gap:** no dedicated full dataset table view with temporal attributes — only modal popups per cluster. `CrimeTable.tsx` (`crime-record/CrimeTable.tsx`) is for record management, not analysis dataset. | Add a full dataset table view showing all incident records with temporal attributes (month, day, year, timeOfDay, precinct, crimeType). |
| 7 | Temporal data preprocessing & transformation | RQ2 (methodology transparency) | PARTIAL | INCORRECT | `aggregateByMonth()` in `forecast/new/page.tsx` lines 18–26 and `ForecastContext.tsx` lines 325–333. `ForecastTrendChart.tsx` lines 526–540 has text explanation of SSA decomposition (trend/seasonality/noise). **Gap:** no visual preprocessing/transformation UI showing raw → aggregated → SSA input. Only text explanation exists. | Add visual preprocessing UI showing raw incident data → monthly aggregation → SSA-ready series. |
| 8 | Crime hotspot map filtered by selected time period | RQ1 | EXISTS | CORRECT | `Map.tsx` has post-analysis filters for months/years/crime types (lines 407–445). Analysis page sends `dateFrom`/`dateTo` to `/incident/grouped-clusters` (lines 115–121). Map filters clusters by selected months/years (lines 89–93). | None — built. Verify that filtered clusters match the selected date range on the backend. |
| 9 | Generated temporal analysis report | RQ2 (reporting) | EXISTS | CORRECT | `downloadAnalysisReport()` in `analysis/page.tsx` lines 326–384 generates markdown with date range, clusters, precincts, time period, crime types, cluster details. | None — built. |
| 10 | Summary of identified hotspots → crime prevention recommendations | RQ4 | PARTIAL | INCORRECT | Analysis page shows cluster distribution (`analysis/page.tsx` lines 574–593). Forecast overview has `apiResponse.summary.recommendedActions` (`forecast/[id]/overview/page.tsx` lines 105–114). Precincts page shows officer suggestions (`precincts/page.tsx` lines 139–152). **Gap:** no dedicated screen summarizing identified hotspots and generating prevention recommendations from them. Recommendations are scattered. Precincts page uses hardcoded constants (lines 20–41) not tied to forecast output (backend `/manpower/analyze` sends empty `PredictedCaseCounts`). | Build dedicated hotspots→recommendations screen. Tie recommendations to forecast output, not hardcoded constants. GA-05 patrol allocation model must be owner-approved first. |
| 11 | High-risk time periods + action plan | RQ2, RQ4 | PARTIAL | INCORRECT | Dashboard has anomaly detection (`isAnomaly`, >50% change, `page.tsx` lines 32–38). Forecast has `riskLevel` per data point (`types/forecast/ForecastBaseTypes.ts` line 13). Overview page has risk assessment logic (`forecast/[id]/overview/page.tsx` lines 132–135, 308–318). **Gap:** no dedicated screen aggregating risk levels into time periods with an action plan. Risk levels exist per forecast point but not aggregated into high-risk time periods. | Build high-risk time periods screen: aggregate risk by month/time period, generate action plan. |
| 12 | Sample prediction / forecasted crime pattern | RQ5 | EXISTS | INCORRECT | `forecast/new/page.tsx` generates predictions via `/incident/forecast/statistical` (line 146). Forecast overview shows predictions with trend, risk level, confidence (`forecast/[id]/overview/page.tsx`). **Gap:** model-identity mismatch — objectives say "regression model" but implementation uses SSA (Singular Spectrum Analysis). `ForecastParams.model` is hardcoded `'ssa'` (`types/forecast/ForecastBaseTypes.ts` line 29). `forecastApi.ts` line 366 submits `modelType: 'Linear'` even when SSA selected. `list()` labels all runs `Linear` (line 171). | Reconcile: does RQ5 require a regression model or is SSA acceptable? If regression is required, implement regression model path. Fix model identity drift (SSA vs. Linear) throughout `forecastApi.ts` and `ForecastContext.tsx`. |

---

## Objective-level assessment

### RQ1 — Identify and map crime hotspots using spatiotemporal analysis
- **Hotspot mapping:** EXISTS + CORRECT (Map.tsx with clustering, heatmap, post-analysis filters).
- **Spatiotemporal filtering:** EXISTS + CORRECT (dateFrom/dateTo sent to backend; Map filters by month/year/crime type).
- **Geocoding:** MISSING (no address → coordinates UI).
- **Verdict:** Partially correct. Core hotspot map works, but geocoding input is missing.

### RQ2 — Temporal trends characterize crime incidents
- **Temporal filtering:** EXISTS + CORRECT (date range filters on Analysis, CrimeTrendChart, BarangayMonthlyChart, Map).
- **Time-of-day distribution:** PARTIAL + INCORRECT (only as filter/breakdown, not standalone distribution).
- **Temporal attributes dataset:** PARTIAL + INCORRECT (per-cluster modals only, no full dataset table).
- **Preprocessing visualization:** PARTIAL + INCORRECT (text explanation only, no visual raw→aggregated→SSA pipeline).
- **High-risk time periods + action plan:** PARTIAL + INCORRECT (risk levels per point exist, not aggregated into time periods with action plan).
- **Verdict:** Partially correct. Filtering works; distribution, dataset table, preprocessing viz, and risk aggregation are missing or incomplete.

### RQ3 — K-Means clustering for crime patterns and hotspot groupings
- **K-Means analysis:** EXISTS + CORRECT (Analysis page sends features/numberOfClusters/numberOfRuns to `/incident/grouped-clusters`; Map renders clusters).
- **Filter wiring:** PARTIAL + INCORRECT (`buildFilters()` drops motives/weather/precincts — `analysis/page.tsx` lines 85–94).
- **Verdict:** Partially correct. Clustering runs, but not all UI filters affect the results.

### RQ4 — Crime prevention recommendations from spatiotemporal analysis
- **Hotspots summary:** PARTIAL + INCORRECT (cluster distribution shown, but no dedicated recommendations screen).
- **Patrol allocation:** PARTIAL + INCORRECT (precincts page shows suggestions using hardcoded constants `OFFICERS_PER_SQKM=1.5`, `PATROL_DEMAND=40`, `HARDCODED_SHIFT='Morning'` — `precincts/page.tsx` lines 20–41; not tied to forecast output).
- **Verdict:** Partially correct. Recommendations are scattered and not owner-calibrated.

### RQ5 — Regression model predicts crime occurrences
- **Forecast generation:** EXISTS + INCORRECT (predictions generated via SSA, but objectives say "regression model").
- **Model identity:** INCORRECT (all backend runs labeled `Linear`; `getById()` hardcodes SSA params; `save()` submits `modelType: 'Linear'`).
- **Forecast metrics:** PARTIAL + UNCERTAIN (`ForecastMetrics` with MAE/RMSE/MAPE/modelAccuracy — `types/forecast/ForecastBaseTypes.ts` lines 65–70 — but MAPE treats zero actuals as zero error per gap analysis).
- **Verdict:** INCORRECT. Model-identity mismatch between "regression model" objective and SSA implementation; model labeling is inconsistent.

---

## GA-01 gate status

GA-01 (thesis evaluation protocol) is pending owner/adviser sign-off. The following verification items are **blocked on GA-01** because they require approved thresholds/methodology:
- Figure #4 time-of-day distribution: needs K-selection/evaluation criteria (GA-04)
- Figure #10 recommendations: needs patrol allocation model approval (GA-05)
- Figure #11 high-risk periods: needs patrol allocation unit/constraints (GA-05)
- Figure #12 regression model: needs SSA vs. regression decision (GA-01 area 5)

The following are **unblocked** (correctness fixes, no GA-01 dependency):
- Figure #1: fix Bearer token on forecastApi/manpowerApi
- Figure #2: build geocoding UI
- Figure #5: temporal filtering already correct
- Figure #6: build temporal attributes dataset table
- Figure #7: build preprocessing visualization
- Figure #8: already correct

---

## Next step

Review this verification document. Once approved, select the first unblocked item to activate via `handoff-active.md` (e.g., Figure #1 Bearer token fix, or Figure #2 geocoding UI).
