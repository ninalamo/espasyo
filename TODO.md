# TODO — Espasyo Calibration Backlog

**Source:** Frontend code calibration vs. figure requirements (login, geocoding, upload, time-of-day distribution, temporal filtering, temporal attributes dataset, preprocessing visualization, hotspot map, temporal report, hotspots→recommendations, high-risk periods+action plan, forecast pattern).  
**Mirrors:** `espasyo/TODO.md` and `nin-architecture/TODO.md` are maintained copies; keep status decisions synchronized.
**GA-01 gate:** Items marked [GA-01] require thesis evaluation protocol sign-off before implementation thresholds can be set. Items without that tag have no GA-01 dependency.

***Implementation Module Strategy (4-step plan)***

| Step | Module | Core Figures | GA-01 Gated | GA-05 Gated | Description |
|------|--------|-------------|-------------|-------------|-------------|
| **1** | **Bulk Upload / Insert** | #3 (Data Input) | No | No | CSV import endpoint + frontend page; provides dataset for all downstream modules. Calibration: verify CSV column mapping. |
| **2** | **Analysis Module** | #4, #10, #11, #5, #6, #7, #8, #9 | **Yes** (decisions recorded: #11 high-risk=count+heinous weight; #10 output w/ manpower; #4 raw counts by barangay) | No | K-Means clustering, temporal filters, hotspot map, time-of-day distribution, analysis report, hotspots→recommendations, high-risk periods+action plan. |
| **3** | **Forecast Module** | #12, #5, #11 (partial), #10 (partial) | **Yes** (Figure #12 methodology/validation remains deferred; calibrated technical correctness fixes may proceed) | No | Forecast generation, temporal comparison, horizon handling, and effective-model reporting. Figure #12 methodology and validation remain GA-01 gated. |
| **4** | **Manpower Allocation + Crime Prevention** | #10, #11 | **Yes** (decisions recorded) | **Yes** (patrol allocation model) | Precincts page + manpower allocation; action plan as one basis of manpower allocation; output together with manpower allocation model. Blocked on GA-05 sign-off. |

***Calibration items (frontend) — Step Assignment***

| ID | Item | Figures | Depends on | Step | Status |
|----|------|---------|------------|------|--------|
| F-01 | Attach the session JWT to requests from `forecastApi.ts` and `manpowerApi.ts` when available | #1 | None | **3** | done |
| F-02 | Replace stale API base URL fallbacks; explicitly report when `NEXT_PUBLIC_API_URL` is unset (the current clients silently use a fallback) | #1 | None | **1** | partial |
| F-03 | Use persisted forecast model and horizon metadata for saved runs; remove stale defaults and incorrect model labels | #12 | None | **3** | done |
| F-04 | Remove silent localStorage fallback when snapshot endpoint fails; visibly report server-not-persisted; separate local drafts | #12 | None | **2** or **3** | done |
| F-05 | Frontend geocoding lookup and incident-coordinate validation — verify address matches on a map and submit returned coordinates when creating an incident | #2 | None | **2** | done |
| F-06 | Time-of-day distribution chart (standalone view of all incidents by Morning/Afternoon/Evening) | #4 | None | **2** | done |
| F-07 | Show searchable, filterable crime incident temporal attributes within Preprocessing; export all filtered analysis records as CSV without a separate Dataset tab | #6 | None | **2** | done |
| F-08 | Align temporal preprocessing visualization with the actual backend forecast aggregation and input (monthly counts by precinct/crime type) | #7 | None | **2** | done |
| F-09 | Dedicated hotspot recommendations screen; match forecast series to source incidents by precinct/crime type and handle empty results | #10 | None (recommendations only; manpower allocation remains separate) | **2** (unblocked per GA-01 decisions) | done |
| F-10 | Unified Analysis-launched Forecast workflow with backend-generated monthly projected volume by existing risk band, available for saved forecasts; separate spatial hotspot recommendations | #11 | GA-01 decisions recorded; GA-05 patrol allocation remains separately gated | **2** | done |
| F-11 | Calibrated forecast corrections: next full month, 1-24 month horizon, N year-qualified forecast months, backend-computed prior-year comparisons, full-history Linear/Seasonal trend with 12-month half-life recency weighting, saved-run history, effective-model transparency, and focused regression tests | #12 | Calibrated by user; remaining model methodology, thresholds, validation criteria, and performance claims remain GA-01 gated | **3** | partial (backend comparison and weighting implemented; remaining acceptance criteria pending; see `FORECAST_CALIBRATION_SPEC.md`) |

**Status key (calibration items):** `done` = verified complete; `partial` = some criterion remains incomplete; `todo` = not implemented.

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

**Current active step:** Step 3 — Forecast technical calibration. F-11 implementation is in progress; the backend comparison and calibrated history weighting are implemented, with remaining acceptance criteria to verify. Figure #12 methodology/validation remains deferred under GA-01.

***Figure Status (all 12 vs. study objectives RQ1–RQ5)***

| # | Figure requirement | Status | GA-01 | GA-05 | Step |
|---|-------------------|--------|-------|-------|------|
| 1 | Secured login module - controlled access, protected crime data | INCORRECT (API data access is not enforced server-side; frontend route guards and optional bearer headers do not protect unannotated controllers) | - | - | 3 |
| 2 | Geocoding process — addresses → coordinates via GIS | CORRECT (authenticated frontend lookup uses the existing API; incident entry can validate the matched address and submit its returned coordinates) | — | — | 2 |
| 3 | Crime data upload module — import police reports | CORRECT | No | No | 1 |
| 4 | Distribution of crime incidents by time of day | CORRECT (standalone time-of-day distribution chart added; raw counts, barangay-only, k-value pending) | Yes (decisions recorded) | No | 2 |
| 5 | Temporal filtering — analyze trends across selected periods | CORRECT | No | No | 2 |
| 6 | Crime incident dataset with temporal attributes | CORRECT (Preprocessing Analysis Records view shows month/day/year/timeOfDay/precinct/crimeType for current analysis clusters; supports case/precinct/crime-type search, time/month/year filters, pagination, and CSV export of all filtered records; no separate Dataset tab) | No | No | 2 |
| 7 | Temporal data preprocessing & transformation | CORRECT (Preprocessing tab shows current analysis records, observed counts grouped by calendar year-month/precinct/crime type, and a model-neutral monthly input preview with backend-equivalent chronological ordering and zero-filled gaps) | No | No | 2 |
| 8 | Crime hotspot map filtered by selected time period | CORRECT | No | No | 2 |
| 9 | Generated temporal analysis report | CORRECT | No | No | 2 |
| 10 | Summary of identified hotspots → crime prevention recommendations | CORRECT (dedicated screen shows API risk summary, recommendations, and hotspot details; backend matches forecast series to source incidents by precinct/crime type; empty results handled explicitly; no personnel allocation) | Yes (decisions recorded) | Separate allocation remains gated | 2 |
| 11 | High-risk time periods + action plan | CORRECT (Analysis launches one configurable forecast workflow; backend monthly summaries group projected volume using existing forecast risk labels and are available with saved forecasts; spatial hotspot recommendations are a distinct linked workflow; no personnel assignment) | Yes (decisions recorded) | Yes (Step 4 patrol allocation remains gated; Step 2 guidance is informational) | 2 / 4 |
| 12 | Sample prediction / forecasted crime pattern | INCORRECT (temporal chart can mislabel/misrepresent forecasts crossing a year; saved runs lack generation-time history; effective SSA-to-linear fallback is not exposed. Technical correction plan calibrated; methodology/validation still pending) | Yes (methodology/validation deferred to post-initial phase; technical corrections scoped) | No | 3 |

**Key:**
- **CORRECT** — Figure exists and aligns with study objective
- **INCORRECT** — Figure exists but misaligned (model identity, missing auth, wrong constants)
- **MISSING** — Figure not implemented; no UI/module exists
- **GA-01** — Blocked until thesis evaluation protocol sign-off (decisions recorded for #4, #10, #11)
- **GA-05** — Blocked until patrol allocation model sign-off (required for #10, #11 in Step 4)
- **Step** — Implementation module assignment per the 4-step plan (Step 1=Bulk Upload, Step 2=Analysis, Step 3=Forecast, Step 4=Manpower Allocation)