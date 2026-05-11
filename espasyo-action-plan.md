# Espasyo — Action Plan

**Source:** `espasyo-review-plan.md`  
**Scope:** `nextjs-auth-app` (frontend) + `nin-architecture` (backend)  
**Status:** 🟡 Planning — No work started

---

## How to Use

- `[ ]` = pending, `[x]` = done, `[-]` = in progress, `[~]` = blocked
- Each task has a **target file** and **acceptance criteria** (AC)
- Tasks are grouped by priority (P0 → P3) matching the review plan phases
- Backend = `nin-architecture`, Frontend = `nextjs-auth-app` (inside `espasyo`)

---

## P0 — Critical (must fix before anything else)

### P0-1: Fix Manpower ML Training Data
- **Source:** `espasyo-review-plan.md` §9.3 Task 1.7, Gap G1
- **Effort:** 2 days

- [x] **P0-1a** Replace `Barangay.Alabang` hardcode in `GetHistoricalManpowerData`
  - _File:_ `nin-architecture/espasyo.Application/Services/MLManpowerAllocationService.cs:415`
  - _AC:_ Method iterates over all real precincts from repository, not a single hardcoded value
  - _Commit:_ `nin-architecture@1a16761`

- [x] **P0-1b** Add monthly variance to manpower training data
  - _File:_ `MLManpowerAllocationService.cs:409-419`
  - _AC:_ Each `(Year, Month, PrecinctId)` combination has its own `HeadCount` from actual records, not duplicated from a single value
  - _Commit:_ `nin-architecture@1a16761`

- [~] **P0-1c** Regenerate and validate ML models
  - _AC:_ Delete `MLModels/*.zip`, restart API, run a training request → verify `RSquared > 0.3` for all 3 models (complexity, workload, optimization)
  - _Status:_ Blocked — requires running system with seeded data. Execute once API is running and manpower records exist for all 9 precincts.

### P0-2: Create Pipeline Orchestrator
- **Source:** `espasyo-review-plan.md` §10.1 Task 2.1-2.2, Gap G2
- **Effort:** 5 days

- [x] **P0-2a** Create `PipelineOrchestratorService`
  - _File:_ `nin-architecture/espasyo.Application/Services/PipelineOrchestratorService.cs` (new)
  - _AC:_ Service has a single `RunFullPipeline(PipelineRequest)` method that:
    1. Fetches incidents by date range
    2. Runs K-Means clustering
    3. Persists `AnalysisRun`
    4. Runs SSA forecast on cluster groups
    5. Persists `ForecastRun` + `ForecastResults`
    6. Runs manpower optimization per precinct
    7. Persists `ManpowerRecommendations`
    8. Returns `PipelineResult` with all IDs
  - _Prerequisites created:_ `AnalysisRun` entity + config + repository (SQL Server + SQLite), `ManpowerRecommendation` entity + config + repository, `IPrecinctRepository` + repository
  - _Commit:_ `nin-architecture@c8ffd57`

- [x] **P0-2b** Create `POST /api/pipeline/run` endpoint
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/PipelineController.cs` (new)
  - _AC:_ Accepts `PipelineRequest` body, returns `PipelineResult` with status 200
  - _Commit:_ `nin-architecture@c8ffd57`

- [~] **P0-2c** Create `GET /api/pipeline/status/{runId}` endpoint
  - _File:_ `PipelineController.cs`
  - _AC:_ Returns current stage, progress %, and any errors for async execution
  - _Status:_ Deferred — requires async execution pattern. Pipeline currently runs synchronously; will add async polling in P2-11a.

### P0-3: Wire Forecast Output to Manpower Input
- **Source:** `espasyo-review-plan.md` §10.3 Task 2.6, Gap G3
- **Effort:** 3 days

- [x] **P0-3a** Map `ForecastSeries` → `Dictionary<CrimeTypeEnum, int>` per precinct
  - _File:_ `PipelineOrchestratorService.cs:195-197` (group by precinct), `:207-213` (extract counts)
  - _AC:_ For each precinct in forecast, extract predicted count per crime type for the target period
  - _Note:_ Done as part of P0-2 pipeline orchestrator stage 6

- [x] **P0-3b** Feed mapped forecasts into `CalculateOptimalManpowerAsync`
  - _File:_ `PipelineOrchestratorService.cs:228-229`
  - _AC:_ `MLManpowerAllocationService` receives real `predictedCrimeCounts` from SSA forecast (not empty or default values)
  - _Note:_ Done as part of P0-2 pipeline orchestrator stage 6

- [x] **P0-3c** Return per-precinct, per-shift recommendations from pipeline
  - _File:_ `PipelineController.cs` (`POST /api/pipeline/run`) + `GET /api/pipeline/recommendations/{forecastRunId}`
  - _AC:_ Response includes `{ precinctId, shift, recommendedHeadCount, confidence, justification }` for every precinct
  - _Commit:_ `nin-architecture@c8ffd57` (orchestrator) + `nin-architecture@pending` (controller endpoint)

---

## P1 — High Priority

### P1-1: Persist Analysis Runs
- **Source:** `espasyo-review-plan.md` §9.1-9.2 Tasks 1.1-1.6, Gap G5
- **Effort:** 3 days

- [x] **P1-1a** Create `AnalysisRun` entity
  - _File:_ `nin-architecture/espasyo.Domain/Entities/AnalysisRun.cs` (new)
  - _AC:_ Entity has fields: `Id`, `Parameters` (json), `ClusterGroups` (json), `QualityMetrics` (json), `CreatedAt`, `CreatedBy`
  - _Note:_ Created in P0-2 (commit `c8ffd57`)

- [x] **P1-1b** Create `IAnalysisRunRepository` + implementation
  - _File:_ `nin-architecture/espasyo.Application/Interfaces/IAnalysisRunRepository.cs`
  - _File:_ `nin-architecture/espasyo.Infrastructure/Data/Repositories/AnalysisRunRepository.cs`
  - _File:_ `nin-architecture/espasyo.Infrastructure/Data/Repositories/Sqlite/SqliteAnalysisRunRepository.cs`
  - _AC:_ Full CRUD: Save, GetById, GetAll, Delete with pagination
  - _Note:_ Created in P0-2 (commit `c8ffd57`)

- [x] **P1-1c** Create EF Core migration
  - _AC:_ `AddAnalysisAndManpowerEntities` migration generated for both SQL Server and SQLite
  - _Commit:_ `nin-architecture@a75c318`

- [x] **P1-1d** Create `AnalysisRunController` API endpoints
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/AnalysisRunController.cs`
  - _AC:_ `POST /api/analysis-runs`, `GET /api/analysis-runs`, `GET /api/analysis-runs/{id}`, `DELETE /api/analysis-runs/{id}` all functional
  - _Commit:_ `nin-architecture@a75c318`

### P1-2: Persist Manpower Recommendations
- **Source:** `espasyo-review-plan.md` §9.2 Tasks 1.4-1.6, Gap G4
- **Effort:** 2 days

- [x] **P1-2a** Create `ManpowerRecommendation` entity
  - _File:_ `nin-architecture/espasyo.Domain/Entities/ManpowerRecommendation.cs`
  - _AC:_ Entity has fields: `Id`, `ForecastRunId` (FK), `Precinct`, `RecommendedHeadCount`, `Shift`, `PredictedWorkloadHours`, `ComplexityScore`, `Confidence`, `Justification`, `CreatedAt`
  - _Note:_ Created in P0-2 (commit `c8ffd57`)

- [x] **P1-2b** Create `IManpowerRecommendationRepository` + implementation + migration
  - _AC:_ Full CRUD, migration generated (`AddAnalysisAndManpowerEntities`)
  - _Note:_ Repository created in P0-2 (commit `c8ffd57`); migration just added

- [~] **P1-2c** Create manpower recommendation endpoints
  - _AC:_ `POST /api/manpower/recommend`, `GET /api/manpower/recommendations/{forecastRunId}`
  - _Status:_ `GET` exists via `PipelineController.GetRecommendations` (commit `16aa35d`); `POST` deferred — recommendations are generated by the pipeline orchestrator, not standalone
  - _Wait for frontend demand for standalone POST_

### P1-3: Use Cluster Assignments in Forecasting
- **Source:** `espasyo-review-plan.md` §10.2 Task 2.4, Gap G7
- **Effort:** 4 days

- [x] **P1-3a** Add `ClusterId` to forecast grouping dimensions
  - _File:_ `nin-architecture/espasyo.Infrastructure/MachineLearning/MachineLearningService.cs`
  - _AC:_ Forecast series grouped by `(Precinct, CrimeType, ClusterId)`; `GroupClusterDataForForecasting` key changed from `(int,int)` to `(int,int,uint)`
  - _Commit:_ `nin-architecture@0047d2d`

- [x] **P1-3b** Update `ForecastSeries` and `ForecastResult` models to include `ClusterId`
  - _AC:_ `ForecastSeries.ClusterId`, `ForecastResult.ClusterId`, `ForecastResultDto.ClusterId`, `ClusterItem.ClusterId` all added; EF Core migration generated for both providers
  - _Commit:_ `nin-architecture@0047d2d`

- [ ] **P1-3c** Update frontend forecast components to handle cluster-dimensioned data
  - _File:_ `nextjs-auth-app/src/app/forecast/[id]/**/*.tsx`
  - _AC:_ All sub-pages (summary, timeseries, map, ensemble) handle the new `ClusterId` dimension without breaking
  - _Status:_ Backend complete. Frontend depends on forecast UI being fully refactored in P2/P3.

### P1-4: Hotspot Prediction
- **Source:** `espasyo-review-plan.md` §10.2 Task 2.5, Gap G8
- **Effort:** 5 days

- [x] **P1-4a** Create `POST /api/incident/forecast/hotspots` endpoint
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/IncidentController.cs`
  - _File:_ `nin-architecture/espasyo.Application/UseCase/Incidents/Commands/PredictHotspots/PredictHotspotsCommand.cs`
  - _File:_ `nin-architecture/espasyo.Application/UseCase/Incidents/Commands/PredictHotspots/PredictHotspotsCommandHandler.cs`
  - _AC:_ Accepts `PredictHotspotsCommand` body, returns GeoJSON FeatureCollection with hotspot polygon features
  - _Commit:_ `nin-architecture@0ab4e03`

- [x] **P1-4b** Implement hotspot polygon generation
  - _File:_ `nin-architecture/espasyo.Infrastructure/MachineLearning/MachineLearningService.cs`
  - _File:_ `nin-architecture/espasyo.Application/Common/Models/ML/GeoJsonModels.cs` (new)
  - _AC:_ `PredictHotspotsAsync` method computes convex hull (Graham scan) around cluster incident points, expands by buffer, assigns severity/confidence per forecast series; returns GeoJSON FeatureCollection
  - _Commit:_ `nin-architecture@0ab4e03`

- [ ] **P1-4c** Frontend: render predicted hotspots on forecast map
  - _File:_ `nextjs-auth-app/src/components/ForecastMap.tsx`
  - _AC:_ Map shows predicted hotspot polygons (not historical points), color-coded by confidence + severity
  - _Status:_ Backend complete. Frontend implementation deferred to P2-8 (Forecast Map Rework) which replaces historical points with predicted polygons.

### P1-5: Enable K-Means Auto K-Selection + Validation Metrics
- **Source:** `espasyo-review-plan.md` §5 (K-Means gaps)
- **Effort:** 4 days

- [x] **P1-5a** Implement silhouette analysis across k=2..15
  - _File:_ `nin-architecture/espasyo.Infrastructure/MachineLearning/MachineLearningService.cs`
  - _File:_ `nin-architecture/espasyo.Application/Common/Models/ML/ClusteringMetricsCalculator.cs` (new)
  - _AC:_ `FindOptimalK` loops k=2..15, runs K-Means for each (1 run), picks k with highest silhouette score
  - _Commit:_ `nin-architecture@c8460c6`

- [x] **P1-5b** Add Davies-Bouldin and Calinski-Harabasz indices
  - _AC:_ `ClusteringMetricsCalculator` computes all three (silhouette, DBI, CH) for each candidate k
  - _Commit:_ `nin-architecture@c8460c6`

- [x] **P1-5d** Expose quality metrics in API response
  - _File:_ `GroupedClusterResponse.QualityMetrics`
  - _File:_ `GetGroupedClustersQuery.AutoSelectK` (set `numberOfClusters: 0` or `true`)
  - _AC:_ `GroupedClusterResponse` includes `QualityMetrics` with `OptimalK`, silhouette/DBI/CH scores per k; `autoSelectK` parameter on query triggers auto-selection
  - _Commit:_ `nin-architecture@pending`

### P1-6: Baseline Comparisons on Dashboard
- **Source:** `espasyo-review-plan.md` §11.1 Task 3.1
- **Effort:** 3 days

- [ ] **P1-6a** Backend: add YoY and PoP comparison to incident stats endpoint
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/IncidentController.cs`
  - _AC:_ `GET /api/incident/stats` returns `{ current, previousYear, previousPeriod, rolling12moAvg }` for each metric

- [ ] **P1-6b** Frontend: update dashboard card rendering
  - _File:_ `nextjs-auth-app/src/app/page.tsx`
  - _AC:_ Each stat card shows ±Δ with color coding (green/amber/red) and trend arrow

- [ ] **P1-6c** Add tooltips explaining change calculation
  - _AC:_ Hovering over Δ shows: "Up 15% vs same period last year"

### P1-7: Implement Anomaly Detection (B5)
- **Source:** `espasyo-review-plan.md` §11.1 Task 3.2, Gap G9
- **Effort:** 4 days

- [ ] **P1-7a** Create `POST /api/incident/anomalies` endpoint
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/IncidentController.cs`
  - _AC:_ Accepts date range, returns flagged anomalies with method (IQR/Z-score/moving avg), severity, and contributing factors

- [ ] **P1-7b** Implement IQR-based outlier detection
  - _File:_ `nin-architecture/espasyo.Infrastructure/MachineLearning/MachineLearningService.cs` (or new AnomalyDetectionService)
  - _AC:_ Flags data points outside 1.5×IQR from median as anomalies

- [ ] **P1-7c** Implement Z-score and moving average deviation
  - _AC:_ Z-score: flags |z| > 3. Moving avg: flags deviation > 2σ from rolling window

- [ ] **P1-7d** Frontend: anomaly flags on dashboard and precinct views
  - _File:_ `nextjs-auth-app/src/app/page.tsx`, `nextjs-auth-app/src/app/precincts/page.tsx`
  - _AC:_ Anomalous periods shown with badge/anchor for drill-down

### P1-8: Analysis Map Improvements
- **Source:** `espasyo-review-plan.md` §11.3 Task 3.8
- **Effort:** 3 days

- [ ] **P1-8a** Clickable cluster markers with incident popup
  - _File:_ `nextjs-auth-app/src/components/Map.tsx`
  - _AC:_ Clicking a cluster marker shows a popup listing incidents in that cluster

- [ ] **P1-8b** Precinct boundary GeoJSON overlay
  - _AC:_ Semi-transparent precinct polygons overlay the map, togglable

- [ ] **P1-8c** Heatmap layer toggle (kernel density)
  - _AC:_ Button toggles between cluster markers and heatmap view

- [ ] **P1-8d** Before/after time period comparison slider
  - _AC:_ Slider splits map into two halves showing period A vs period B

---

## P2 — Medium Priority

### P2-1: Remove Redundant localStorage Layers
- **Source:** `espasyo-review-plan.md` §9.5 Tasks 1.10-1.11
- **Effort:** 2 days

- [ ] **P2-1a** Migrate analysis page from localStorage to API
  - _File:_ `nextjs-auth-app/src/app/analysis/page.tsx`
  - _AC:_ Analysis runs are fetched from `/api/analysis-runs`, localStorage reads removed

- [ ] **P2-1b** Migrate manpower page from localStorage to API
  - _File:_ `nextjs-auth-app/src/app/manpower/page.tsx`
  - _AC:_ Manpower recommendations loaded from `/api/manpower/recommendations/{forecastRunId}`

- [ ] **P2-1c** Demote `fetchCachedData.ts` to read-through cache
  - _File:_ `nextjs-auth-app/src/app/api/utils/fetchCachedData.ts`
  - _AC:_ API is primary source; localStorage is fallback only when backend unreachable

### P2-2: Pipeline UI
- **Source:** `espasyo-review-plan.md` §10.4 Tasks 2.8-2.9
- **Effort:** 4 days

- [ ] **P2-2a** Create `/pipeline` wizard page
  - _File:_ `nextjs-auth-app/src/app/pipeline/page.tsx` (new)
  - _AC:_ 4-step wizard (Select params → Configure → Run → Review), calls `POST /api/pipeline/run`

- [ ] **P2-2b** Pipeline progress indicator component
  - _File:_ `nextjs-auth-app/src/components/PipelineProgress.tsx` (new)
  - _AC:_ Shows 7 stages with animated progress, real-time status updates via polling

- [ ] **P2-2c** Create `/pipeline/{runId}/summary` dashboard
  - _AC:_ Side-by-side analysis → forecast → manpower summary with total officers KPI

- [ ] **P2-2d** Add "Run Full Analysis" CTA on home dashboard
  - _File:_ `nextjs-auth-app/src/app/page.tsx`
  - _AC:_ Button navigates to `/pipeline`, prominent placement

### P2-3: Scheduled Background Jobs
- **Source:** `espasyo-review-plan.md` §9.4 Tasks 1.8-1.9, Gap G11
- **Effort:** 3 days

- [ ] **P2-3a** Implement `ScheduledForecastService : BackgroundService`
  - _File:_ `nin-architecture/espasyo.WebAPI/BackgroundServices/ScheduledForecastService.cs` (new)
  - _AC:_ Runs on configurable interval (cron expression) and auto-generates forecast from latest analysis data

- [ ] **P2-3b** Implement model retraining scheduler
  - _File:_ `nin-architecture/espasyo.WebAPI/BackgroundServices/ModelRetrainingService.cs` (new)
  - _AC:_ Weekly retraining of all ML models with fallback to previous version on failure

- [ ] **P2-3c** Add configuration for intervals in `appsettings.json`
  - _File:_ `nin-architecture/espasyo.WebAPI/appsettings.json`
  - _AC:_ `Scheduling:ForecastInterval`, `Scheduling:RetrainingInterval` are configurable

### P2-4: Precinct Benchmarking
- **Source:** `espasyo-review-plan.md` §11.1 Task 3.3
- **Effort:** 2 days

- [ ] **P2-4a** Backend: normalize crime counts by population
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/PrecinctsController.cs`
  - _AC:_ `GET /api/precincts/benchmarks` returns crimes per 1000 residents, clearance rate, staffing ratio per precinct

- [ ] **P2-4b** Frontend: precinct comparison bar chart
  - _File:_ `nextjs-auth-app/src/components/PrecinctRadarChart.tsx` (new)
  - _AC:_ All 9 barangays compared on multi-metric radar/spider chart

- [ ] **P2-4c** Resource efficiency metric
  - _AC:_ "Officers per 1000 residents" vs "Crime rate" scatter plot with quadrant labeling

### P2-5: Add Missing Critical Visualizations
- **Source:** `espasyo-review-plan.md` §11.2 Task 3.6
- **Effort:** 4 days

- [ ] **P2-5a** Precinct Radar Chart component
  - _File:_ `nextjs-auth-app/src/components/PrecinctRadarChart.tsx`
  - _AC:_ 5+ axes (incidents, severity, staffing, risk, clearance) per precinct with interactive legend

- [ ] **P2-5b** Seasonal Decomposition plot
  - _File:_ `nextjs-auth-app/src/components/SeasonalDecomposition.tsx` (new)
  - _AC:_ 3-panel (observed, seasonal, trend+residual) with forecast overlay, using Chart.js

- [ ] **P2-5c** Resource Gap Chart
  - _File:_ `nextjs-auth-app/src/components/ResourceGapChart.tsx` (new)
  - _AC:_ Horizontal bar chart comparing current vs optimal staffing per precinct, red/yellow/green by gap %

- [ ] **P2-5d** Anomaly Calendar component
  - _File:_ `nextjs-auth-app/src/components/AnomalyCalendar.tsx` (new)
  - _AC:_ Monthly calendar heatmap showing days with anomalies, clickable for details

### P2-6: Confidence Communication
- **Source:** `espasyo-review-plan.md` §11.1 Task 3.4
- **Effort:** 2 days

- [ ] **P2-6a** Add confidence band legend to forecast charts
  - _File:_ `nextjs-auth-app/src/components/TimeSeriesChart.tsx`
  - _AC:_ Chart legend explains: "80% CI: actual value falls in this range 80% of the time"

- [ ] **P2-6b** Show confidence score on manpower recommendations
  - _File:_ `nextjs-auth-app/src/app/manpower/page.tsx`
  - _AC:_ Each recommendation shows a confidence bar (0-1) with color coding

- [ ] **P2-6c** Data quality badge on all analysis views
  - _AC:_ Badge: 🟢 Good / 🟡 Fair / ❌ Poor based on `AssessDataQuality` output with tooltip explanation

### P2-7: Dashboard Redesign
- **Source:** `espasyo-review-plan.md` §11.2 Task 3.7
- **Effort:** 3 days

- [ ] **P2-7a** Row 1: Alert and anomaly banner
  - _File:_ `nextjs-auth-app/src/app/page.tsx`
  - _AC:_ Shows active anomaly flags, threshold breaches, data freshness warnings

- [ ] **P2-7b** Row 2: Trend summary section
  - _AC:_ Sparklines for total incidents (12mo), per precinct mini-charts, YoY change indicators

- [ ] **P2-7c** Row 3: Pipeline quick access
  - _AC:_ Last pipeline run summary card, prominent "Run Full Analysis" CTA

- [ ] **P2-7d** Row 4: System health
  - _AC:_ API connectivity status, data freshness ("as of {timestamp}"), last ML training date

### P2-8: Forecast Map Rework
- **Source:** `espasyo-review-plan.md` §11.3 Task 3.9
- **Effort:** 3 days

- [ ] **P2-8a** Replace historical points with predicted polygons
  - _File:_ `nextjs-auth-app/src/components/ForecastMap.tsx`
  - _AC:_ Map shows predicted hotspot polygons from `POST /api/forecast/hotspots`

- [ ] **P2-8b** Color gradient by confidence + severity
  - _AC:_ Polygons use color scale (green→yellow→red) based on confidence and severity

- [ ] **P2-8c** Month-by-month forecast animation
  - _AC:_ Play/pause button animates through forecast months (reuse `HotspotTimeline.tsx`)

- [ ] **P2-8d** Compare mode (historical vs predicted)
  - _AC:_ Toggle overlay of historical clusters vs predicted hotspots

### P2-9: Reports & Export
- **Source:** `espasyo-review-plan.md` §11.4 Tasks 3.10-3.11
- **Effort:** 3 days

- [ ] **P2-9a** Backend PDF report generation
  - _File:_ `nin-architecture/espasyo.Application/Services/ReportGenerationService.cs` (new)
  - _AC:_ Generates PDF with sections: Executive Summary, Analysis, Forecast, Manpower Recommendations, Methodology

- [ ] **P2-9b** API endpoint for report download
  - _AC:_ `GET /api/pipeline/{runId}/report` returns PDF file

- [ ] **P2-9c** Frontend "Download Report" button
  - _AC:_ Button on pipeline summary page downloads PDF

- [ ] **P2-9d** Enhanced CSV/JSON export with metadata
  - _AC:_ Export includes analysis params, model version, timestamp in addition to data

### P2-10: Monitoring & Observability
- **Source:** `espasyo-review-plan.md` §12.1 Tasks 4.1-4.3
- **Effort:** 4 days

- [ ] **P2-10a** ML model performance tracking
  - _File:_ `nin-architecture/espasyo.Application/Services/ModelMetricsTracker.cs` (new)
  - _AC:_ Logs RSquared, MAE, RMSE per retraining; alerts on >20% degradation

- [ ] **P2-10b** Structured pipeline logging
  - _File:_ `PipelineOrchestratorService.cs`
  - _AC:_ Each stage logs: duration, record count, errors (structured JSON with correlation ID)

- [ ] **P2-10c** Data freshness monitoring
  - _File:_ `nin-architecture/espasyo.WebAPI/BackgroundServices/FreshnessMonitorService.cs` (new)
  - _AC:_ Alerts if no new data/analysis in N days (configurable)

### P2-11: Performance Optimization
- **Source:** `espasyo-review-plan.md` §12.2 Tasks 4.4-4.6
- **Effort:** 5 days

- [ ] **P2-11a** Async pipeline execution with 202 Accepted
  - _File:_ `PipelineController.cs`
  - _AC:_ `POST /api/pipeline/run` returns 202 + status URL immediately, runs pipeline in background

- [ ] **P2-11b** EF Core query optimization
  - _AC:_ Review and fix N+1 queries; add database indexes on `PoliceDistrict`, `TimeStamp`, `CrimeType`

- [ ] **P2-11c** Data retention policy
  - _AC:_ Configurable retention periods for raw incidents, analysis runs, forecasts; archival option

### P2-12: Testing
- **Source:** `espasyo-review-plan.md` §12.4 Tasks 4.9-4.10
- **Effort:** 5 days

- [ ] **P2-12a** Unit tests for ML pipeline stages
  - _File:_ `nin-architecture/espasyo.Application.Tests/` (new test project)
  - _AC:_ Each pipeline stage has unit tests with mocked dependencies

- [ ] **P2-12b** Integration tests for full pipeline
  - _AC:_ Seed data → run pipeline → verify outputs match expected values

- [ ] **P2-12c** Frontend E2E tests
  - _File:_ `nextjs-auth-app/cypress/` or `e2e/`
  - _AC:_ Critical flows: login → run analysis → view forecast → check manpower

---

## P3 — Low Priority

### P3-1: Remove Redundant Components
- **Source:** `espasyo-review-plan.md` §11.2 Task 3.5
- **Effort:** 1 day

- [ ] **P3-1a** Delete `SimpleForecastMap.tsx` (merge logic into `ForecastMap.tsx`)
- [ ] **P3-1b** Delete orphaned modal files (`CalculationMethodologyModal`, `DataQualityModal`, `TrendAnalysisMethodologyModal`)
- [ ] **P3-1c** Replace `ScatterPlot.tsx` or remove if unused

### P3-2: Reconnect Orphaned TrendAnalysis
- **Source:** `espasyo-review-plan.md` §8 (Frontend issues)
- **Effort:** 0.5 day

- [ ] **P3-2a** Add `TrendAnalysis.tsx` back to forecast sub-route navigation
  - _File:_ `nextjs-auth-app/src/app/forecast/[id]/layout.tsx`
  - _AC:_ Tab for "Trends" appears alongside Summary/Timeseries/Heatmap/Map/Ensemble

### P3-3: Security & Access Control
- **Source:** `espasyo-review-plan.md` §12.3 Tasks 4.7-4.8
- **Effort:** 3 days

- [ ] **P3-3a** Enforce ADMIN/USER/VIEWER roles on frontend routes
  - _File:_ `nextjs-auth-app/src/app/hoc/withAuth.tsx`
  - _AC:_ Unauthorized users redirected; admin-only actions (model retrain) hidden from non-admins

- [ ] **P3-3b** Backend role-based authorization
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/*`
  - _AC:_ `[Authorize(Roles = "Admin")]` on sensitive endpoints (model retraining, data deletion)

- [ ] **P3-3c** API rate limiting
  - _AC:_ Per-user rate limits on clustering/forecasting/pipeline endpoints

### P3-4: API Versioning + Error Handling
- **Source:** `espasyo-review-plan.md` §13 (Best practices)
- **Effort:** 2 days

- [ ] **P3-4a** Add `v1` prefix to all API routes
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/*`
  - _AC:_ All endpoints accessible at `/api/v1/{controller}/{action}`

- [ ] **P3-4b** Implement RFC 7807 Problem Details responses
  - _File:_ `nin-architecture/espasyo.WebAPI/Middleware/ProblemDetailsMiddleware.cs` (new)
  - _AC:_ Error responses follow RFC 7807 format (`type`, `title`, `status`, `detail`, `instance`)

### P3-5: Extract ForecastController
- **Source:** `espasyo-review-plan.md` §7 (Architectural smell)
- **Effort:** 0.5 day

- [ ] **P3-5a** Move forecast endpoints from `IncidentController` to dedicated `ForecastController`
  - _File:_ `nin-architecture/espasyo.WebAPI/Controllers/ForecastController.cs` (new)
  - _AC:_ `POST /api/v1/forecast/statistical`, `POST /api/v1/forecast/validate`, `POST /api/v1/forecast/assess-data-quality` all work from new controller

---

## Summary

| Phase | Task Count | Est. Effort | Focus |
|-------|-----------|-------------|-------|
| P0 | 3 tasks (9 subtasks) | 10 days | Critical blockers: fix training data, pipeline orchestrator, forecast→manpower wire |
| P1 | 8 tasks (26 subtasks) | 28 days | Backend entities, K-Means validation, hotspot prediction, anomaly detection, dashboard baselines |
| P2 | 12 tasks (30 subtasks) | 40 days | UI pipeline, visualizations, backend scheduled jobs, monitoring, performance, testing |
| P3 | 5 tasks (7 subtasks) | 7 days | Cleanup, security, versioning, controller extraction |

**Total:** 28 tasks / 72 subtasks / ~85 days estimated

---

*Generated from `espasyo-review-plan.md` (2026-05-11). Update status checkboxes as work progresses.*
