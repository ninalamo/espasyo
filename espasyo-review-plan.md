# Espasyo — Comprehensive Review & Remediation Plan

**Date:** 2026-05-11  
**Reviewers:** Senior Data Analyst / Senior Software Engineer  
**Scope:** Frontend (`nextjs-auth-app`) + Backend (`nin-architecture`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Objective Fulfillment Analysis](#2-objective-fulfillment-analysis)
3. [Data Meaningfulness & Face-Value Readiness](#3-data-meaningfulness--face-value-readiness)
4. [Visualization Necessity & Effectiveness](#4-visualization-necessity--effectiveness)
5. [K-Means Clustering — Usage & Efficiency](#5-k-means-clustering--usage--efficiency)
6. [Architecture & Data Flow Gaps](#6-architecture--data-flow-gaps)
7. [Backend Current State (nin-architecture)](#7-backend-current-state-nin-architecture)
8. [Frontend Current State (nextjs-auth-app)](#8-frontend-current-state-nextjs-auth-app)
9. [Remediation Plan — Phase 1: Data Infrastructure](#9-remediation-plan--phase-1-data-infrastructure)
10. [Remediation Plan — Phase 2: Pipeline Integration](#10-remediation-plan--phase-2-pipeline-integration)
11. [Remediation Plan — Phase 3: Analytics & Visualization](#11-remediation-plan--phase-3-analytics--visualization)
12. [Remediation Plan — Phase 4: Production Readiness](#12-remediation-plan--phase-4-production-readiness)
13. [Appendix: Best Practices Reference](#13-appendix-best-practices-reference)

---

## 1. Executive Summary

Espasyo is a full-stack crime data analysis system with significant architectural investment (Clean Architecture backend, ML.NET pipeline, Next.js frontend with rich visualizations). However, a critical gap exists between **the system's stated objective** (analyze crime data → forecast hotspots → determine manpower needs) and **the current implementation** (three disconnected subsystems: clustering, forecasting, and manpower optimization).

The system has strong foundations but fails to close the loop between analysis output and actionable decision support. This document provides a detailed, phase-based remediation plan from both data analytics and software engineering perspectives.

---

## 2. Objective Fulfillment Analysis

### Stated Objective
> "A tool for analyzing crime data, eventually leading to know how much manpower is needed for a certain period of time or season, to forecast hotspots — in relation to how much manpower a precinct will need given the forecasted values."

### Current Reality

| Requirement | Status | Evidence |
|---|---|---|
| Crime data analysis | ✅ Partially | K-Means clusters incidents by location + 1 feature |
| Hotspot forecasting | ❌ Not achieved | Clusters show *current* hotspots; forecast predicts *counts* not *locations* |
| Seasonal manpower planning | ❌ Not achieved | Manpower ML models use hardcoded data; no seasonality feed |
| Forecast → Manpower pipeline | ❌ Broken | No code path feeds forecast output into manpower optimizer |
| Precinct-specific recommendation | ⚠️ Partial | MLManpowerAllocationService exists but hardcodes `Barangay.Alabang` (line 415) |

### Critical Gaps

1. **Disconnected Pipeline:** Analysis → Forecast → Manpower is a manual, localStorage-mediated chain with no backend orchestration. Each stage operates independently.

2. **Forecast Produces Counts, Not Hotspots:** The SSA forecast predicts monthly crime counts per `(Precinct, CrimeType)` group, but does not produce geospatial hotspot predictions. The "ForecastMap" component renders historical cluster data, not predicted future clusters.

3. **Manpower Does Not Consume Forecast:** `MLManpowerAllocationService.CalculateOptimalManpowerAsync` accepts `predictedCrimeCounts` but this parameter is never populated from the forecasting engine. No controller endpoint or query handler connects them.

4. **No Seasonal Modeling in Manpower:** The manpower optimizer uses `GetSeasonalFactor` (a sine wave based on month) but the `GetHistoricalManpowerData` method hardcodes all months to `Barangay.Alabang` with the same `HeadCount`, producing zero-variance training data.

5. **Backend Persistence Disconnect:** Forecast results are persisted (`ForecastRun`, `ForecastResult` entities) but manpower recommendations are not. There is no `ManpowerRecommendation` entity.

---

## 3. Data Meaningfulness & Face-Value Readiness

### Current State Assessment

| Data Point | Current Display | Meaningful? | Actionable? |
|---|---|---|---|
| Cluster counts | Numbers on map + legend | ❌ — no risk labeling | ❌ — user must infer |
| Cluster centroids | Average lat/lng in report | ❌ — no interpretation | ❌ — no recommendation |
| Forecast predictions | Line chart with bounds | ⚠️ — no comparison to baseline | ⚠️ — trend direction visible |
| Risk levels | low/medium/high/critical | ⚠️ — based on ratio, not calibrated | ⚠️ — no confidence band |
| Manpower numbers | Table of headcounts | ❌ — no justification shown | ❌ — no cost/resource context |
| Dashboard stats | Today/Week/Month counts | ❌ — no anomaly detection | ❌ — no alerting |

### What "Meaningful at Face Value" Means

A non-analyst user (e.g., a police precinct commander) should be able to look at any screen and immediately understand:

1. **Where** are the problem areas? (risk-ranked map with clear labels)
2. **What** is the trend? (is crime going up/down compared to last period?)
3. **Why** should I care? (anomaly flags, threshold breaches)
4. **What** should I do? (specific, quantified recommendations)

**None of these four questions are answered by the current UI.**

### Specific Issues

- **No baselines/comparisons:** Current month count of 50 incidents is meaningless without context (was it 30 last month? 70 last year same month?)
- **No anomaly detection:** System has `AssessDataQuality` but no runtime anomaly detection on live data
- **No precinct benchmarking:** Users cannot compare precinct performance or crime rates normalized by population
- **No confidence communication:** Forecast bounds exist but the meaning of "80% confidence interval" is not explained
- **Manpower recommendations lack cost context:** Number of officers needed has no budget or shift-hour equivalent

---

## 4. Visualization Necessity & Effectiveness

### Map Visualizations

| Component | Necessary? | Issues |
|---|---|---|
| `Map.tsx` (Analysis) | ✅ Yes — core for spatial crime analysis | Cluster markers lack interactivity; no popup with incident details; no precinct boundary overlay |
| `ForecastMap.tsx` | ⚠️ Partially — shows historical data, not future | Renders past cluster data, mislabeled as "forecast"; should show predicted hotspot polygons |
| `SimpleForecastMap.tsx` | ❌ Redundant | Duplicates ForecastMap functionality for no clear analytical gain |
| `HotspotTimeline.tsx` | ✅ Yes — valuable for temporal-spatial insight | Needs predicted data; currently likely shows historical only |

### Chart Visualizations

| Component | Necessary? | Issues |
|---|---|---|
| `TimeSeriesChart.tsx` | ✅ Yes — core forecast visualization | Single-model view; no ensemble comparison; no confidence shading toggle |
| `BarangayMonthlyChart.tsx` | ⚠️ Partially — useful for breakdown | Aggregated monthly view loses week/day patterns |
| `ScatterPlot.tsx` | ❌ Low value | Without axis labels and trend lines, scatter adds no insight over map |
| `RiskHeatmap.tsx` | ⚠️ Potentially valuable | Current implementation unclear if it shows predicted risk or historical density |
| `TrendAnalysis.tsx` | ✅ Yes — valuable | Orphaned component (not linked in navigation) |

### Table Visualizations

| Component | Necessary? | Issues |
|---|---|---|
| `ClusterDataTable.tsx` | ⚠️ Partially — useful for export | Screen real estate better used for actionable analytics |
| `CrimeTable.tsx` | ✅ Yes — operational necessity | Good for record management, not for analytics |
| `ForecastSummary.tsx` (KPI cards) | ✅ Yes — essential | Numbers need trend arrows and benchmark comparisons |

### Key Findings

1. **Over-visualization:** Several visualizations exist without serving a distinct analytical purpose, leading to UI clutter.
2. **Under-visualization:** Missing critical views:
   - Precinct radar/spider chart (multi-metric comparison)
   - Seasonal decomposition plot (trend + seasonal + residual)
   - Resource gap chart (optimal vs. current staffing per precinct)
   - Confidence timeline (how reliability changes over horizon)
3. **No unified command center:** The dashboard should be the primary analytical interface but currently shows simple counts.

---

## 5. K-Means Clustering — Usage & Efficiency

### Current Implementation

**Feature Selection:**
- Always includes: `Latitude`, `Longitude`
- Plus ONE user-selected demographic feature from: `CrimeType`, `Severity`, `Weather`, `Motive`, `PoliceDistrict`
- Rationale documented: prevents curse of dimensionality

**Pipeline:**
```
Categorical features → OneHotEncoding
Float features → Type Conversion to Single
Numeric features → MinMax Normalization
Concatenate → "Features" column
→ NormalizeMeanVariance
→ KMeans trainer (k = user-selected, 3-10)
→ N runs, select best by min AverageDistance
```

### Efficiency Assessment

| Aspect | Rating | Explanation |
|---|---|---|
| Feature engineering | ⚠️ Adequate | OneHotEncoding for categories is correct; but single-demographic limit is overly conservative |
| Initialization | ❌ Poor | ML.NET default initialization (not K-Means++) leads to suboptimal centroids |
| K selection | ❌ Missing | No elbow method, silhouette score, or gap statistic — user must guess |
| Multiple runs | ⚠️ Present but weak | User selects 1-10 runs; best by AverageDistance only, no Davies-Bouldin index |
| Evaluation | ❌ Limited | Only `AverageDistance` evaluated; no silhouette score, no Calinski-Harabasz index |
| Persistence | ❌ None | Clusters stored only in localStorage; not persisted to database |
| Temporal tracking | ❌ Missing | Cannot compare cluster evolution across time windows |
| Scalability | ⚠️ Adequate | In-memory ML.NET handles moderate data; no streaming/batching for large datasets |

### Underutilization Analysis

K-Means is **underexploited** in two critical ways:

1. **Not used for hotspot prediction:** The `clusterId` assignment could predict future cluster membership for new/unlabeled incidents, enabling "hotspot probability" maps. Current implementation only describes historical groupings.

2. **Not consumed by downstream models:**
   - Forecasting engine ignores cluster assignments — groups by `(Precinct, CrimeType)` instead
   - Manpower optimizer ignores cluster assignments — uses separate complexity calculation
   - The `clusterId` is the most information-dense output of the ML pipeline and it's thrown away

### Recommendation: From K-Means to K-Means++ Pipeline

Replace the current approach with a multi-stage clustering pipeline:

1. **Stage 1 — Optimal K Selection:** Silhouette analysis + elbow method across k=2..15, automated recommendation
2. **Stage 2 — K-Means++ Initialization:** Proper centroid seeding for reproducibility
3. **Stage 3 — Multi-feature Clustering:** Allow multiple demographic features with PCA/SVD dimensionality reduction
4. **Stage 4 — Cluster Validation:** Silhouette score, Davies-Bouldin index, Calinski-Harabasz index
5. **Stage 5 — Cluster Interpretation:** Automated labeling (e.g., "High-risk night-time theft cluster in Alabang")

---

## 6. Architecture & Data Flow Gaps

### Current Data Flow

```
User runs Analysis → K-Means clusters incidents → stored in localStorage
                                                          ↓
User creates Forecast → reads clusters from localStorage → SSA forecast
                                                          ↓
                                               Forecast persisted to DB (ForecastRun/ForecastResult)
                                                          ↓
User checks Manpower → reads latest forecast from localStorage → ML models
                                                          ↓ (no DB persistence)
                                               Manpower recommendation (in-memory only)
```

### Critical Architectural Deficiencies

1. **Backend lacks pipeline orchestration:** No single endpoint orchestrates Analysis → Forecast → Manpower. Each is a separate API call the user must chain manually.

2. **localStorage as integration bus:** Forecast and Manpower pages read cluster data from browser localStorage, an ephemeral, single-user, non-scalable integration mechanism.

3. **No session management for analysis runs:** Users cannot compare multiple analysis runs side-by-side. Each run overwrites the last.

4. **Manpower recommendations not persisted:** No database entity stores recommendation output — no history, no audit trail.

5. **No background job for scheduled retraining:** The `IHostedService` for scheduled forecast generation (B6 in documentation) is unimplemented.

6. **No API contract between forecast and manpower:** The `predictedCrimeCounts: Dictionary<CrimeTypeEnum, int>` expected by `CalculateOptimalManpowerAsync` has no corresponding output from the forecast controller.

---

## 7. Backend Current State (nin-architecture)

### What Exists

| Layer | Components | Status |
|---|---|---|
| Domain | Entities (9), Enums (9), Domain Events | ✅ Well-structured |
| Application | CQRS Handlers (17+), ML Service Interfaces, Pipeline Behaviors | ✅ Well-architected |
| Infrastructure | MachineLearningService (1195 lines), EF Core, Repositories, Dual DB | ✅ Implemented |
| WebAPI | Controllers (7), JWT Auth, Swagger, Exception Filters | ✅ Functional |
| ML Pipeline | K-Means, SSA, Linear/Seasonal/SES, Ensemble, 3-Stage Manpower | ✅ Implemented |

### What's Missing / Broken

| Issue | Location | Severity |
|---|---|---|
| `GetHistoricalManpowerData` hardcodes `Barangay.Alabang` | `MLManpowerAllocationService.cs:415` | 🔴 Critical |
| Manpower training data has zero variance (same HeadCount every month) | `MLManpowerAllocationService.cs:409-419` | 🔴 Critical |
| No backend orchestrator for full pipeline | Missing controller | 🔴 Critical |
| Manpower recommendations not persisted | Missing entity + repository | 🔴 Critical |
| Anomaly detection unimplemented | B5 (documented pending) | 🟡 High |
| Scheduled forecast `IHostedService` unimplemented | B6 (documented pending) | 🟡 High |
| No cluster persistence | Missing entity | 🟡 High |
| `DataDrivenComplexityService` uses synchronous wrappers instead of async | `MLManpowerAllocationService.cs:572-588` | 🟡 High |
| No standardized cluster quality metrics exposed to API | `MachineLearningService.cs` | 🟢 Medium |
| Forecast endpoints on `IncidentController` (not `ForecastController`) | Architectural smell | 🟢 Medium |

---

## 8. Frontend Current State (nextjs-auth-app)

### What Exists

| Area | Components | Status |
|---|---|---|
| Pages | Dashboard, Analysis, Forecast (10 sub-routes), Crime Records, Precincts, Manpower | ✅ Rich set |
| Visualizations | Map, TimeSeriesChart, RiskHeatmap, ScatterPlot, EnsembleView, HotspotTimeline | ✅ Extensive |
| Data Layer | apiService, forecastApi, manpowerApi, fetchCachedData, localStorage caching | ✅ Functional |
| Auth | NextAuth.js with JWT, CredentialsProvider | ✅ Working |

### What's Missing / Broken

| Issue | Location | Severity |
|---|---|---|
| Dashboard shows raw counts without context/trends | `page.tsx` | 🔴 Critical |
| Forecast map shows historical not predicted data | `ForecastMap.tsx` | 🔴 Critical |
| No unified pipeline UX (one-click analysis→forecast→manpower) | Missing page/flow | 🔴 Critical |
| `TrendAnalysis.tsx` orphaned (not in navigation) | Navigation config | 🟡 High |
| Multiple redundant modal files not imported | `forecast/modals/` | 🟢 Low |
| `SimpleForecastMap.tsx` duplicates `ForecastMap.tsx` | Components | 🟢 Low |
| No data export for forecast/manpower results | Missing buttons | 🟡 High |
| No comparison view (side-by-side forecast runs) | Missing | 🟢 Medium |
| Mobile responsiveness likely degraded with tab layout | Layout concerns | 🟢 Medium |

---

## 9. Remediation Plan — Phase 1: Data Infrastructure

### Objective
Build the data foundation for a connected, persistent, and scheduler-driven pipeline.

### 9.1 Backend: Persist Clustering Results

**Task 1.1 — Create AnalysisRun Entity**
```
Domain/AnalysisRun.cs:
  Id: Guid
  Parameters: json (dateFrom, dateTo, features, k, runs)
  ClusterGroups: json
  QualityMetrics: json (silhouette, davies-bouldin, etc.)
  CreatedAt: DateTime
  CreatedBy: Guid (userId)
```

**Task 1.2 — AnalysisRun Repository + Migration**
- `IAnalysisRunRepository` in Application layer
- Implementation in Infrastructure for both SQL Server and SQLite
- EF Core migration

**Task 1.3 — AnalysisRun API Endpoints**
- `POST /api/analysis-runs` — run + persist
- `GET /api/analysis-runs` — list
- `GET /api/analysis-runs/{id}` — detail with clusters
- `DELETE /api/analysis-runs/{id}`

### 9.2 Backend: Persist Manpower Recommendations

**Task 1.4 — Create ManpowerRecommendation Entity**
```
Domain/ManpowerRecommendation.cs:
  Id: Guid
  ForecastRunId: Guid (FK → ForecastRun)
  Precinct: Barangay
  RecommendedHeadCount: int
  Shift: Shift (0/1/2)
  PredictedWorkloadHours: float
  ComplexityScore: float
  Confidence: float
  Justification: string
  CreatedAt: DateTime
```

**Task 1.5 — ManpowerRecommendation Repository + Migration**

**Task 1.6 — ManpowerRecommendation API Endpoints**
- `POST /api/manpower/recommend` — accepts forecast run ID, returns recommendations
- `GET /api/manpower/recommendations/{forecastRunId}` — list for a run

### 9.3 Backend: Fix Manpower ML Training Data

**Task 1.7 — Real Manpower History Data**
- Replace hardcoded `Barangay.Alabang` with actual precinct-level staffing data
- Add `Year`, `Month`, `PrecinctId` to manpower records if not present
- Implement proper monthly aggregation in `GetHistoricalManpowerData`
- Ensure sufficient variance in training data for meaningful regression

### 9.4 Backend: Scheduled Background Jobs

**Task 1.8 — IHostedService for Scheduled Forecasting**
- Implement B6: `ScheduledForecastService : BackgroundService`
- Configurable interval (weekly/monthly)
- Automatic cluster generation → forecast → persistence
- Optional: auto-trigger manpower recommendation

**Task 1.9 — IHostedService for Model Retraining**
- Weekly retraining of ML models (K-Means, SSA, manpower)
- Model versioning and performance tracking
- Graceful fallback to previous model on failure

### 9.5 Frontend: localStorage → Backend API Migration

**Task 1.10 — Replace localStorage reads with API calls**
- Analysis page: `useEffect` reads from `/api/analysis-runs` instead of localStorage
- Forecast page: `forecastApi.ts` already partially does this, but ensure it works as primary path
- Manpower page: Load from `/api/manpower/recommendations/{forecastRunId}`

**Task 1.11 — Remove localStorage caching layer (or demote to offline fallback)**
- `fetchCachedData.ts` should be a read-through cache, not a primary data source
- `forecastApi.ts` localStorage fallback should be removed once API is stable

---

## 10. Remediation Plan — Phase 2: Pipeline Integration

### Objective
Connect Analysis → Forecast → Manpower into a seamless, backend-orchestrated pipeline.

### 10.1 Unified Pipeline Orchestration

**Task 2.1 — Pipeline Orchestrator Service**
```
Application/Services/PipelineOrchestratorService.cs:
  RunFullPipeline(PipelineRequest):
    1. Fetch incidents (date range, filters)
    2. Run K-Means clustering with optimal k (auto or specified)
    3. Persist AnalysisRun
    4. Run SSA forecast on cluster groups
    5. Persist ForecastRun + ForecastResults
    6. Run Manpower optimization for each precinct
    7. Persist ManpowerRecommendations
    8. Return PipelineResult (analysisRunId, forecastRunId, recommendations)
```

**Task 2.2 — Pipeline API Endpoint**
- `POST /api/pipeline/run` — single endpoint for full pipeline
- `GET /api/pipeline/status/{pipelineRunId}` — async status polling

**Task 2.3 — Pipeline UI Page**
- One-click "Run Full Analysis" from dashboard or dedicated pipeline page
- Progress indicator (stages 1-7 with status)
- Results summary page linking to analysis, forecast, and manpower detail pages

### 10.2 Cluster → Forecast Connection

**Task 2.4 — Use Cluster Assignments in Forecasting**
- Current: forecast groups by `(Precinct, CrimeType)` independently of cluster assignments
- Fix: add `ClusterId` as a grouping dimension in forecast:
  - Forecast per `(Precinct, CrimeType, ClusterId)` for hotspot-specific predictions
  - Produces both count predictions AND cluster membership probability

**Task 2.5 — Hotspot Prediction**
- New endpoint: `POST /api/forecast/hotspots`
- Uses cluster centroids + temporal forecast to predict where hotspots will be
- Output: GeoJSON feature collection of predicted hotspot polygons with confidence levels
- Frontend: render as heatmap overlay on forecast map

### 10.3 Forecast → Manpower Connection

**Task 2.6 — Wire forecast output to manpower input**
- `ManpowerController` or new `PipelineController` maps `ForecastSeries` → `predictedCrimeCounts`
- For each precinct in the forecast, extract `PredictedCount` per `CrimeType`
- Feed into `MLManpowerAllocationService.CalculateOptimalManpowerAsync`
- Return per-precinct, per-shift recommendations

**Task 2.7 — Seasonal Manpower Adjustment**
- Enhance `MLManpowerAllocationService` to accept `TimePeriod` (month/quarter/season)
- Generate 12-month manpower forecast per precinct (one recommendation per month)
- Visualize as a stacked bar chart: optimal staffing level by month

### 10.4 Frontend: Unified Experience

**Task 2.8 — Pipeline Page**
- New route: `/pipeline`
- Wizard-style: Select date range, features, forecast horizon
- "Run Full Analysis" button
- Shows pipeline stages with real-time status
- On completion: redirects to `/pipeline/{runId}/summary`

**Task 2.9 — Pipeline Summary Dashboard**
- New route: `/pipeline/{runId}/summary`
- Side-by-side: Analysis summary → Forecast summary → Manpower summary
- Key KPI: "Total officers needed: X" with precinct breakdown
- Comparison with current staffing levels
- Export: PDF report containing full analysis

---

## 11. Remediation Plan — Phase 3: Analytics & Visualization

### Objective
Make every data point meaningful at face value, with actionable insights and no visual redundancy.

### 11.1 Data Meaningfulness Enhancements

**Task 3.1 — Baseline Comparisons Everywhere**
- Every count metric (today/week/month incidents) must show ±Δ from:
  - Same period last year (year-over-year)
  - Previous period (period-over-period)
  - Rolling 12-month average (trend baseline)
- Color coding: 🟢 improving, 🟡 stable, 🔴 worsening

**Task 3.2 — Anomaly Detection (Implement B5)**
- Backend: `POST /api/incident/anomalies`
- Methods: IQR-based outlier detection + Z-score + moving average deviation
- Frontend: flags on dashboard, analysis page, and individual precinct views
- Alert when current period exceeds 2σ from mean

**Task 3.3 — Precinct Benchmarking**
- Normalize crime counts by population (crimes per 1000 residents)
- Precinct comparison view: bar chart comparing all 9 barangays
- Ranking with percentile indicators
- Resource efficiency metric: officers per 1000 residents vs. crime rate

**Task 3.4 — Confidence Communication**
- Forecast charts: shaded confidence bands with legend explaining
  - "80% confidence: 80 out of 100 times, actual value falls in this range"
- Manpower recommendations: show confidence score (0-1) next to each number
- Data quality badge on every analysis: "Good ⚠️ Fair ❌ Poor" with explanation

### 11.2 Visualization Rationalization

**Task 3.5 — Remove Redundant Components**
- Delete `SimpleForecastMap.tsx` — merge into `ForecastMap.tsx`
- Delete orphaned modal files (`CalculationMethodologyModal`, `DataQualityModal`, `TrendAnalysisMethodologyModal`) — inline tooltips instead
- Replace `ScatterPlot.tsx` with more informative view or remove

**Task 3.6 — Add Missing Critical Visualizations**
- **Precinct Radar Chart:** Multi-metric (total incidents, severity, clearance rate, staffing adequacy, risk level) per precinct
- **Seasonal Decomposition:** 3-panel plot (observed → seasonal → trend → residual) with forecast overlay
- **Resource Gap Chart:** Horizontal bar — "Current Staffing" vs "Optimal Staffing" per precinct, color-coded by gap magnitude
- **Anomaly Calendar:** Monthly calendar heatmap showing anomaly days (useful for pattern spotting)

**Task 3.7 — Dashboard Redesign**
- Current: static count cards + system info (low value)
- New design:
  - Row 1: Key alerts (anomaly flags, threshold breaches)
  - Row 2: Trend summary (sparklines + Δ for total, by precinct, by crime type)
  - Row 3: Quick access to pipeline results (last run summary, "Run New Analysis" CTA)
  - Row 4: System health (API status, data freshness, last ML training timestamp)

### 11.3 Map Enhancement

**Task 3.8 — Analysis Map Improvements**
- Cluster markers: click to show incident list popup
- Precinct boundary overlay (GeoJSON polygons)
- Heatmap layer toggle (kernel density estimation)
- Before/after comparison slider (time period A vs B)

**Task 3.9 — Forecast Map Rework**
- Render predicted hotspot polygons (not historical points)
- Color gradient by confidence + severity
- Animation: month-by-month forecast progression (already partially built in `HotspotTimeline.tsx`)
- Compare mode: overlay historical hotspots vs predicted hotspots

### 11.4 Reports & Export

**Task 3.10 — Comprehensive PDF Report**
- Backend: generate report server-side (QuestPDF or similar)
- Sections: Executive Summary, Analysis Results, Forecast, Manpower Recommendations, Methodology
- Frontend: "Download Report" button on pipeline summary

**Task 3.11 — Enhanced CSV/JSON Export**
- Include metadata (analysis params, model version, timestamp)
- Multiple export formats per page
- Scheduled export (email report) — future consideration

---

## 12. Remediation Plan — Phase 4: Production Readiness

### Objective
Stability, performance, monitoring, and developer experience.

### 12.1 Monitoring & Observability

**Task 4.1 — ML Model Performance Dashboard**
- Track model metrics over time (RSquared, MAE, RMSE per retraining)
- Alert on metric degradation (>20% drop)
- Log training data distribution drift

**Task 4.2 — Pipeline Execution Logging**
- Structured logging for each pipeline stage (duration, input/output record counts, errors)
- Grafana dashboard or similar for pipeline monitoring
- API metrics: request rates, latency percentiles, error rates

**Task 4.3 — Data Freshness Monitoring**
- Track last successful data ingestion/analysis run
- Alert if no new analysis in > N days (configurable)
- Dashboard badge: "Data as of: {timestamp}"

### 12.2 Performance Optimization

**Task 4.4 — Asynchronous Pipeline Execution**
- Pipeline runs as background job (return 202 Accepted with status URL)
- Real-time progress via WebSocket or polling
- Cancel long-running pipeline option

**Task 4.5 — Query Optimization**
- Review EF Core queries for N+1 patterns
- Add database indexes on frequently filtered columns (`PoliceDistrict`, `TimeStamp`, `CrimeType`)
- Consider read replicas for reporting queries

**Task 4.6 — Data Retention Policies**
- Configurable retention for raw incidents, analysis runs, forecasts
- Archival strategy for historical data (> 3 years)

### 12.3 Security & Access Control

**Task 4.7 — Role-Based Access Control**
- Implement ADMIN/USER/VIEWER roles (types already exist in `next-auth.d.ts`)
- Admin: full access, model retraining
- User: run analyses, view results
- Viewer: view-only dashboard and reports

**Task 4.8 — API Rate Limiting**
- Prevent abuse of clustering/forecasting endpoints
- Per-user rate limits for pipeline execution

### 12.4 Testing Strategy

**Task 4.9 — ML Model Testing**
- Unit tests for each pipeline stage
- Integration tests: seed data → run pipeline → verify expected outputs
- Regression tests: compare new model outputs against baseline

**Task 4.10 — End-to-End Tests**
- Full pipeline: API → clustering → forecast → manpower → persistence → API retrieval
- Frontend: Page load → data fetch → render → user interaction flow
- Use test fixtures with known expected outputs

---

## 13. Appendix: Best Practices Reference

### Data Science Best Practices

| Practice | Current State | Target |
|---|---|---|
| Feature Scaling | ✅ MinMax + MeanVariance | ✅ Keep, add option for StandardScaler |
| Dimensionality Reduction | ❌ Not used | Add PCA before clustering with multi-feature selection |
| K Selection | ❌ User guesses | Automated silhouette + elbow method |
| Cluster Validation | ❌ AverageDistance only | Silhouette, Davies-Bouldin, Calinski-Harabasz |
| Temporal Validation | ❌ Not done | Walk-forward validation for time series |
| Model Persistence | ⚠️ Partially (manpower) | Full model registry with versioning |
| Feature Importance | ❌ Not computed | SHAP or permutation importance for interpretability |
| Cross-Validation | ❌ Not done | K-fold CV for manpower regression models |
| Drift Detection | ❌ Not implemented | PSI (Population Stability Index) on feature distributions |
| Experiment Tracking | ❌ Not implemented | Log all runs with params + metrics for comparison |

### Software Engineering Best Practices

| Practice | Current State | Target |
|---|---|---|
| Clean Architecture | ✅ Well implemented | ✅ Keep, extend to pipeline orchestration |
| CQRS | ✅ Present | ✅ Keep for all new query/command handlers |
| Dependency Injection | ✅ Proper | ✅ Keep |
| API Versioning | ❌ None | Add `v1` prefix to all endpoints |
| OpenAPI/Swagger | ✅ Present | ✅ Document new endpoints with examples |
| Error Handling | ⚠️ Basic | Add structured error responses (RFC 7807 Problem Details) |
| Logging | ⚠️ Console + ILogger | Add structured logging with correlation IDs |
| Health Checks | ⚠️ Aspire defaults | Add custom health checks for ML model status, DB connectivity |
| Caching | ❌ localStorage only | Add distributed cache (Redis) for analysis/forecast results |
| Background Jobs | ❌ Not implemented | Add Hangfire/Quartz for scheduled tasks |
| Feature Flags | ❌ Not implemented | Add for phased rollout of new pipeline UI |
| E2E Tests | ❌ None | Add Playwright/Cypress tests for critical user flows |

### Data Quality Best Practices

| Check | Current State | Implementation |
|---|---|---|
| Completeness | ✅ AssessDataQuality | Enhance: per-field null/empty rates |
| Uniqueness | ❌ Not checked | Add duplicate incident detection (by CaseId, coordinates, timestamp) |
| Timeliness | ⚠️ Temporal coverage check | Add staleness flag (data > N days without update) |
| Consistency | ❌ Not checked | Cross-field validation (e.g., precinct matches barangay) |
| Accuracy | ❌ Not checked | Geospatial validation (lat/lng within city bounds) |
| Outlier Detection | ⚠️ IQR-based (in DataQuality) | Add Z-score, modified Z-score, DBSCAN-based outlier detection |

---

## Implementation Priority Matrix

| Task ID | Description | Effort | Impact | Priority |
|---|---|---|---|---|
| 1.7 | Fix manpower training data (hardcoded precinct) | 2 days | 🔴 Critical | P0 |
| 2.1 | Pipeline orchestrator service | 5 days | 🔴 Critical | P0 |
| 2.6 | Wire forecast output to manpower input | 3 days | 🔴 Critical | P0 |
| 2.4 | Use cluster assignments in forecasting | 4 days | 🟡 High | P1 |
| 1.1-1.3 | Persist analysis runs | 3 days | 🟡 High | P1 |
| 1.4-1.6 | Persist manpower recommendations | 2 days | 🟡 High | P1 |
| 3.1 | Baseline comparisons everywhere | 3 days | 🟡 High | P1 |
| 3.2 | Anomaly detection (B5) | 4 days | 🟡 High | P1 |
| 3.8 | Analysis map improvements | 3 days | 🟡 High | P1 |
| 2.5 | Hotspot prediction | 5 days | 🟡 High | P1 |
| 1.8-1.9 | Scheduled background jobs | 3 days | 🟢 Medium | P2 |
| 2.8-2.9 | Pipeline UI | 4 days | 🟢 Medium | P2 |
| 3.3 | Precinct benchmarking | 2 days | 🟢 Medium | P2 |
| 3.6 | Missing visualizations | 4 days | 🟢 Medium | P2 |
| 3.7 | Dashboard redesign | 3 days | 🟢 Medium | P2 |
| 3.10-3.11 | Reports & export | 3 days | 🟢 Medium | P2 |
| 3.5 | Remove redundant components | 1 day | 🟢 Low | P3 |
| 4.1-4.3 | Monitoring & observability | 4 days | 🟢 Medium | P2 |
| 4.4-4.6 | Performance optimization | 5 days | 🟢 Medium | P2 |
| 4.7-4.8 | Security & access control | 3 days | 🟢 Medium | P3 |
| 4.9-4.10 | Testing strategy | 5 days | 🟢 Medium | P2 |

**Total estimated effort:** 70+ days for full implementation across all phases.

---

*This document represents the current state of both repositories as of 2026-05-11 and serves as the authoritative remediation roadmap. All architectural changes should reference this document for context and rationale.*
