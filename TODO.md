# TODO — Espasyo Calibration Backlog

**Source:** Frontend code calibration vs. figure requirements (login, geocoding, upload, time-of-day distribution, temporal filtering, temporal attributes dataset, preprocessing visualization, hotspot map, temporal report, hotspots→recommendations, high-risk periods+action plan, forecast pattern).  
**Mirror:** `espasyo/TODO.md` and `nin-architecture/TODO.md` are identical copies.  
**GA-01 gate:** Items marked [GA-01] require thesis evaluation protocol sign-off before implementation thresholds can be set. Items without that tag have no GA-01 dependency.

***Implementation Module Strategy (4-step plan)***

| Step | Module | Core Figures | GA-01 Gated | GA-05 Gated | Description |
|------|--------|-------------|-------------|-------------|-------------|
| **1** | **Bulk Upload / Insert** | #3 (Data Input) | No | No | CSV import endpoint + frontend page; provides dataset for all downstream modules. Calibration: verify CSV column mapping. |
| **2** | **Analysis Module** | #4, #10, #11, #5, #6, #7, #8, #9 | **Yes** (decisions recorded: #11 high-risk=count+heinous weight; #10 output w/ manpower; #4 raw counts by barangay) | No | K-Means clustering, temporal filters, hotspot map, time-of-day distribution, analysis report, hotspots→recommendations, high-risk periods+action plan. |
| **3** | **Forecast Module** | #12 (deferred), #5, #11 (partial), #10 (partial) | **Yes** (#11 partial; #10 partial; #12 deferred to post-initial) | No | Statistical forecasting via SSA; prediction generation; risk levels; model-identity mismatch (SSA vs. regression) deferred. |
| **4** | **Manpower Allocation + Crime Prevention** | #10, #11 | **Yes** (decisions recorded) | **Yes** (patrol allocation model) | Precincts page + manpower allocation; action plan as one basis of manpower allocation; output together with manpower allocation model. Blocked on GA-05 sign-off. |

***Calibration items (frontend) — Step Assignment***

| ID | Item | Figures | Depends on | Step | Status |
|----|------|---------|------------|------|--------|
| F-01 | Attach Bearer token to `forecastApi.ts` and `manpowerApi.ts` (currently raw `fetch`, no auth header) | #1 | None | **3** | done |
| F-02 | Fix stale API base URL fallback `https://localhost:7007/api` in `apiConfig.ts`, `forecastApi.ts`, `manpowerApi.ts`; surface missing config explicitly | #1 | None | **1** | done |
| F-03 | Correct forecast model identity — `list()` labels all runs `Linear`, `getById()` hardcodes `forecastPeriod: 6` / `model: 'ssa'`, `save()` submits `modelType: 'Linear'`; read actual model/horizon/params from persisted data | #12 | None | **3** | done |
| F-04 | Remove silent localStorage fallback when snapshot endpoint fails; visibly report server-not-persisted; separate local drafts | #12 | None | **2** or **3** | done |
| F-05 | Geocoding UI — address → coordinates via GIS service | #2 | None | **2** | done |
| F-06 | Time-of-day distribution chart (standalone view of all incidents by Morning/Afternoon/Evening) | #4 | None | **2** | done |
| F-07 | Full crime incident dataset table with temporal attributes (month, day, year, timeOfDay, precinct, crimeType) | #6 | None | **2** | done |
| F-08 | Temporal data preprocessing & transformation visualization (raw → aggregated → SSA input) | #7 | None | **2** | done |
| F-09 | Dedicated hotspots → crime prevention recommendations summary screen | #10 | GA-01 (GA-05 patrol allocation) | **2** (now unblocked per GA-01 decisions) | todo |
| F-10 | High-risk time periods + action plan screen (aggregate risk levels into time periods) | #11 | GA-01 (GA-05 patrol allocation) | **2** (now unblocked per GA-01 decisions) | todo |

## GA-01 decision record items (owner/adviser sign-off pending)

| ID | Item | Figures | Depends on | Status |
|----|------|---------|------------|--------|
| G-01 | Document & approve 5 research questions (RQ1–RQ5) | All | None | documented (sign-off pending) |
| G-02 | Study population & data: dates defined by filter of date range (confirmed in code); barangays/crime categories/records in scope open; SQLite sample provenance unverified | #5 Temporal filtering | G-01 | open |
| G-03 | Geographic meaning: authoritative barangay boundary dataset/version; clustering semantics (per-barangay vs. pre-filter vs. reporting); boundary/outside/mismatch handling | #8 Hotspot map | G-01, G-02 | open |
| G-04 | Clustering features, K selection, evaluation methodology | #8/#10 | G-01, G-02, G-03 | open |
| G-05 | Patrol allocation unit, constraints, validation | #10/#11 | G-01, G-02, G-06 | open |
| G-06 | Forecast validation, metrics, user-facing claims (SSA vs. regression, MAPE, zero counts) | #12 | G-01, G-02 | open |
| G-07 | Forecast API constraints, model identity, durable persistence | #12 | G-01, G-06 | open |
| G-08 | Backend authorization boundaries | #1 | None | todo (backend) |
| G-09 | Remove provider-specific DB coupling from controllers | #2/#3 | None | todo (backend) |

## Handoff file convention

- `handoff-active.md` — the single item currently being worked on, or "none" if nothing is active.
- `handoff-dead.md` — completed/archived items (moved here when done).
- Files are mirrored at workspace root and inside both `espasyo/` and `nin-architecture/`.
- Only one item may be active at a time. When an item is complete, move it from active to dead and update TODO.md status.

**Current active step:** Step 2 — Analysis Module. F-07 (Full crime incident dataset table with temporal attributes, Figure #6) is complete. Next sub-task: F-08 — Temporal data preprocessing & transformation visualization (Figure #7).

***Figure Status (all 12 vs. study objectives RQ1–RQ5)***

| # | Figure requirement | Status | GA-01 | GA-05 | Step |
|---|-------------------|--------|-------|-------|------|
| 1 | Secured login module — controlled access, protected crime data | INCORRECT (Bearer token missing on forecastApi/manpowerApi) | — | — | 3 |
| 2 | Geocoding process — addresses → coordinates via GIS | MISSING (no UI/module) | — | — | 2 |
| 3 | Crime data upload module — import police reports | CORRECT | No | No | 1 |
| 4 | Distribution of crime incidents by time of day | CORRECT (raw counts, barangay-only, k-value pending) | Yes (decisions recorded) | No | 2 |
| 5 | Temporal filtering — analyze trends across selected periods | CORRECT | No | No | 2 |
| 6 | Crime incident dataset with temporal attributes | CORRECT (full incident dataset table with month/day/year/timeOfDay/precinct/crimeType columns added as Dataset tab in Analysis module; temporal attributes decomposed client-side mirroring backend Incident.GetTimeOfDay/GetYear/GetMonth) | No | No | 2 |
| 7 | Temporal data preprocessing & transformation | CORRECT (Preprocessing tab in Analysis module with three views: Raw Data (incidents with temporal attributes), Aggregated Data (counts by month/time-of-day), and SSA Input Format (records formatted for MachineLearningService forecasting)); mirrors backend Incident.GetTimeOfDay/GetYear/GetMonth logic (Incident.cs:79-88) and MachineLearningService expectations) | No | No | 2 |
| 8 | Crime hotspot map filtered by selected time period | CORRECT | No | No | 2 |
| 9 | Generated temporal analysis report | CORRECT | No | No | 2 |
| 10 | Summary of identified hotspots → crime prevention recommendations | CORRECT (output w/ manpower allocation) | Yes (decisions recorded) | Yes (patrol allocation model) | 2 / 4 |
| 11 | High-risk time periods + action plan | CORRECT (count + heinous weight; action plan = manpower basis) | Yes (decisions recorded) | Yes (patrol allocation: yes but not alone) | 2 / 4 |
| 12 | Sample prediction / forecasted crime pattern | INCORRECT (SSA vs. regression model mismatch) | Yes (deferred to post-initial phase) | No | 3 |

**Key:**
- **CORRECT** — Figure exists and aligns with study objective
- **INCORRECT** — Figure exists but misaligned (model identity, missing auth, wrong constants)
- **MISSING** — Figure not implemented; no UI/module exists
- **GA-01** — Blocked until thesis evaluation protocol sign-off (decisions recorded for #4, #10, #11)
- **GA-05** — Blocked until patrol allocation model sign-off (required for #10, #11 in Step 4)
- **Step** — Implementation module assignment per the 4-step plan (Step 1=Bulk Upload, Step 2=Analysis, Step 3=Forecast, Step 4=Manpower Allocation)