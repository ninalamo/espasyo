# Project Gap Analysis — Handover

**Purpose:** GA-01 decision record updated with study objectives (see image: "Objectives of the Study"). GA-02 implementation complete — seeder made reproducible with `--seed` flag (default 42), provenance record created at `nin-architecture/DATA_PROVENANCE.md`; build green (0 errors). Remaining GA-02 owner-side steps: SQLite sample inspection and GA-01 owner/adviser sign-off.  
**Thesis:** *Spatiotemporal Mapping for Manpower Allocation in Muntinlupa using K-Means Clustering*  
**Current review limit:** Static source review only; the database contents and runtime flows have not been independently verified.

## Start here: GA-01 — Approve the thesis evaluation protocol

**Status:** Decision record updated with study objectives from "Objectives of the Study" (image). Owner/adviser sign-off still pending — no implementation thresholds are approved yet.

### Study objectives (from "Objectives of the Study", decision input for GA-01)

**General objective:** develop a program that utilizes spatiotemporal analysis to evaluate and address crimes in Muntinlupa City.

**Specific objectives:**
- Design a secured web-based system that will:
  - identify and map crime hotspots in Muntinlupa City using spatiotemporal analysis;
  - analyze temporal trends of crime incidents to understand how crime patterns change over time;
  - provide recommendations for improving crime prevention and resource allocation based on findings;
  - predict crime based on crime patterns using a regression model.
- Test and improve the system's functionality with pre-defined test cases.
- Evaluate system performance using ISO/IEC 25010 software standard criteria.

**GA-01 decision implications:** Research questions are now concretely scoped (hotspot mapping, temporal trend analysis, crime prediction, resource-allocation recommendations). Geographic scope is Muntinlupa City. Forecasting objective ("predict crime using regression model") is stated — SSA's role (required vs. supporting implementation choice) remains open. Evaluation criteria reference ISO/IEC 25010 and pre-defined test cases — these are candidate acceptance criteria awaiting owner/adviser approval.

### Completed (GA-01)

- Thesis evaluation protocol drafted: research questions, population/scope, success criteria, baselines, thresholds documented for owner/adviser review.
- Backend `MachineLearningService.cs` � KMeans `numberOfClusters`/`runs` parameterized with approved-inputs fallback.
- Backend `TemporalForecastService.cs` � forecast validation reliability/high-error thresholds parameterized.
- Decision record updated: `Acceptance criteria and thresholds` row recorded (Pending owner approval).

### Known project intent

- K-Means and spatiotemporal mapping are the thesis core; objectives additionally include temporal trend analysis, crime prediction (regression model), and resource-allocation recommendations.
- The unit of analysis is an individual crime record; analysis is filtered by crime category and barangay geography.
- Geographic scope: Muntinlupa City.
- The supplied SQLite sample is the intended working dataset, but its provenance and suitability have not been verified.
- Forecasting supports manpower allocation for roving/patrol personnel, not case-handling staff.
- SSA means Singular Spectrum Analysis. It is not yet confirmed whether SSA is a required thesis method or a supporting implementation choice; the study objectives mention a "regression model" for prediction, which is a separate open question.
- Evaluation references ISO/IEC 25010 criteria and pre-defined test cases (candidate acceptance criteria awaiting owner/adviser approval).
- The owner has not yet supplied success criteria, validation thresholds, baselines, or an approved evaluation design.

### Decisions to obtain

Discuss these with the thesis owner/adviser and record the answers. “Undecided” is acceptable; do not silently substitute implementation defaults.

1. **Research questions and claims**
   - What exact research question(s) should the application answer?
   - Is the intended contribution a map/description of observed spatiotemporal patterns, a validated forecast, a patrol allocation recommendation, or a defined combination?
   - What conclusions must the thesis avoid because the data or study design cannot support them?

2. **Study population and data**
   - What incident dates, barangays, crime categories, and records are in scope?
   - Is the SQLite sample real, anonymized, synthetic, or mixed? What evidence establishes its source and collection period?
   - Is the sample suitable for evaluation, or only for development/demo? How should missing, duplicate, invalid, or out-of-period records be handled?

3. **Geographic meaning**
   - Which boundary dataset/version is authoritative?
   - Does “using K-Means on barangay geography” mean separate K-Means runs within each barangay, a barangay filter before clustering, clusters that may cross barangay borders but are reported by barangay, or another design?
   - How should records on boundaries, outside every polygon, or with a precinct/coordinate mismatch be treated?

4. **Clustering evaluation**
   - What does a useful cluster mean for the thesis and intended reader?
   - Which feature set, distance/normalization decisions, and method for choosing K are approved?
   - Which quality measures or expert review will be reported? What constitutes acceptable evidence?
   - Is repeatability with a fixed seed required, and how should cluster-label permutations be compared?

5. **Temporal/spatial analysis and forecast**
   - Which temporal and spatial outputs are required to support the thesis claims?
   - Is seasonal decomposition part of the research question?
   - Is SSA required, or should it be compared against simpler baselines?
   - What forecast horizons, chronological holdout/backtest design, baselines, metrics, and acceptable error are approved?
   - How should zero-count months and insufficient history be evaluated and reported?

6. **Patrol allocation**
   - What is being allocated: officers, patrol units, officer-hours, or another unit?
   - Is allocation per barangay, precinct, shift, or another operational unit?
   - What roster, operational constraints, coverage assumptions, and external evidence support the conversion from predicted crime patterns to roving patrol capacity?
   - What outcome or defensible proxy can validate a recommendation?

### Record the outcome

Complete and review this decision record with the owner/adviser. Link minutes or approved documents if they exist; do not put sensitive data in this note.

| Topic | Decision / source | Owner or approver | Status |
|---|---|---|---|
| Research questions and permitted claims | RQ1: How can crime hotspots be identified and mapped using spatiotemporal analysis? RQ2: What temporal trends characterize crime incidents in Muntinlupa? RQ3: How can K-Means clustering be utilized to determine crime patterns and hotspot groupings? RQ4: What crime prevention recommendations can be generated from the results of the spatiotemporal analysis? RQ5: How effectively can a regression model predict crime occurrences based on historical crime data? Source: "Objectives of the Study" (map crime hotspots, analyze temporal trends, predict crime via regression, recommend resource allocation; geographic scope Muntinlupa City). Permitted claims limited to what ISO/IEC 25010 + pre-defined test cases can evidence. |  | Documented (5 research questions); owner sign-off pending |
| Dataset provenance and evaluation suitability | Dates: defined by filter of date range (CONFIRMED in code: Analysis page QueryBar dateFrom/dateTo, default last 12 months up to yesterday, sent in /incident/grouped-clusters payload; forecast page has NO date filter). Precincts/barangays: UI filter exists (FilterSection selectedPrecinct) but NOT sent to backend (buildFilters() drops it — implementation gap). Crime types: sent only when CrimeType feature selected. Severity: sent only when Severity feature selected. Motives: UI exists but NOT sent. Weather: UI exists but NOT sent. Still open: barangays/crime categories/records in scope, SQLite sample provenance (real/anonymized/synthetic/mixed), source & collection period, evaluation suitability (dev/demo vs. evaluation), missing/duplicate/invalid/out-of-period record handling. See `nin-architecture/DATA_PROVENANCE.md`. |  | Partially documented (dates confirmed; precincts UI gap); owner sign-off pending |
| Geographic boundary source and clustering semantics | UI feature options (CONFIRMED in code: FeatureSelect.tsx): CrimeType, Severity, PoliceDistrict, Weather, Motive (single-select); FIXED_FEATURES: Latitude, Longitude. Precinct filter exists in UI but NOT sent to backend (buildFilters() drops it — geographic gap). Still open: authoritative barangay boundary dataset/version, clustering semantics (per-barangay runs vs. pre-filter vs. reporting boundary), boundary/outside/precinct-coordinate-mismatch record handling. |  | Partially documented (UI features confirmed; clustering semantics open); owner sign-off pending |
| Clustering features, K selection, and evaluation |  |  | Open |
| Required temporal/spatial/seasonal outputs | Temporal trend analysis is a stated objective; seasonal decomposition role open. |  | Open |
| SSA role and forecast evaluation protocol | Objectives mention "regression model" for prediction; SSA role (required vs. supporting) unconfirmed. |  | Open |
| Patrol allocation unit, constraints, and validation | Resource-allocation recommendation is a stated objective; unit/constraints open. |  | Open |
| Acceptance criteria and thresholds | ISO/IEC 25010 criteria + pre-defined test cases cited as candidate acceptance criteria; code thresholds (KMeans approved inputs; forecast reliability 25%, high error 50%) not yet owner-approved. |  | Pending owner approval |

### Definition of done for GA-01

- A reviewed protocol states the study population, date range, geographic authority, crime-record unit, and scope.
- It specifies which claims the system is intended to support and records unsupported claims/limitations.
- It defines clustering semantics and evaluation, forecast role and evaluation (or explicitly excludes forecast claims), and how patrol allocation is to be interpreted.
- It identifies baselines, metrics, validation design, and thresholds where evidence supports them. Unknown or unmeasurable criteria are explicitly marked as such.
- It identifies who approved the decisions and when.
- Subsequent tasks use these decisions as acceptance criteria. Any change to scope is reviewed and recorded before implementation.

## Remaining pending tasks

The ordering and dependencies below match the gap-analysis backlog. Tasks with no dependency may proceed independently, but GA-01 informs the thesis-validity tasks.

| ID | Priority | Next task | Depends on |
|---|---|---|---|
| GA-02 | P0 | Establish sample-data provenance and reproducibility | GA-01 |
| GA-03 | P0 | Make barangay geography authoritative and wire all analysis filters | GA-01, GA-02 |
| GA-04 | P0 | Correct and test clustering methodology and reproducibility | GA-01, GA-02, GA-03 |
| GA-05 | P0 | Specify and unify patrol/roving staffing recommendations | GA-01, GA-02, GA-06 |
| GA-06 | P1 | Rework forecast validation, metrics, and user-facing claims | GA-01, GA-02 |
| GA-07 | P1 | Align forecast API constraints, model identity, and durable persistence | GA-01, GA-06 |
| GA-08 | P1 | Define and enforce backend authorization boundaries | None |
| GA-09 | P1 | Remove provider-specific database coupling from controllers | None |
| GA-10 | P1 | Build a cross-layer automated test strategy | GA-01 through GA-09 |
| GA-11 | P2 | Publish authoritative architecture and API/data contracts | GA-01 through GA-09 |

GA-01 decision record updated with study objectives; owner/adviser sign-off still pending. GA-02 (Establish sample-data provenance and reproducibility) implementation complete — seeder reproducible with `--seed` (default 42), provenance record at `nin-architecture/DATA_PROVENANCE.md`, build green (0 errors). Remaining GA-02 owner-side steps: SQLite sample inspection and GA-01 sign-off before GA-03+ can treat fixture data as evaluation-ready.

Use the detailed descriptions, evidence, and acceptance criteria in [PROJECT_GAP_ANALYSIS.md](./PROJECT_GAP_ANALYSIS.md) as the authoritative task definitions. Update that backlog when GA-01 decisions change scope, priority, or dependencies.

## Handoff notes

- Both worktrees clean on branch `revamp`, up to date with `origin/revamp`. Frontend: `espasyo/`; Backend: `nin-architecture/`.
- GA-01 **deferred**: owner/adviser sign-off on the thesis evaluation protocol is pending. No implementation thresholds are approved; no GA-01-dependent work (GA-03 through GA-05) should proceed until sign-off.
- GA-02 implementation complete and verified: build green (0 errors via `dotnet build nin-architecture.sln`). Seeder `--seed` flag added (default `42`) across `espasyo_console/` (Program.cs, IncidentGenerator.cs, CoordinateGenerator.cs, EnumHelper.cs, AddressGenerator.cs, ManpowerSeeder.cs); provenance record at `nin-architecture/DATA_PROVENANCE.md`. MLContext seed-42 registration changes in both DI paths are now committed (commits `b33529f`, `c91fe80`) — no longer uncommitted. Do not treat seed 42 as an approved evaluation setting (GA-04 scope).
- Pre-existing build error in `espasyo.Infrastructure` (CS0535: `MachineLearningService` missing two `IMachineLearningService.PerformKMeansAndGetGroupedClusters` overloads) fixed by adding delegating overloads. No behavior change.
- Test results verified via `dotnet test nin-architecture.sln`: 5 pre-existing failures unrelated to GA-02, exactly as documented — `Domain.Tests.GetYearTest` (hardcoded 2025 vs actual 2026) and 4 `Infrastructure.Tests.GenerateStatisticalForecastCommandHandlerTests` (CompositeRiskScore calculations). 51 tests passed.
- SQLite provenance is GA-02 remaining owner-side work: inspect the sample, establish whether it is real/anonymized/synthetic, document source and collection period.
