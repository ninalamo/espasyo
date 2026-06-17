# Espasyo — Feedback & Remediation Plan

## Context

This is a thesis project. The bar is not "works in production" but "defensible methodology that can pass a panel review." Everything below is assessed against that standard.

---

## What Works (Keep as-is)

### Frontend
| Feature | Reason |
|---------|--------|
| **Dashboard period comparisons** | Descriptive stats (today vs yesterday, etc.). Simple aggregation, no pretense of inference. Fine. |
| **Crime record CRUD** | Engineering scope, not thesis contribution. Fine. |
| **Auth, routing, layout, export** | Supporting infrastructure. Fine. |
| **UI/UX quality** | Polished interface is a strength in a thesis demo. |

### Backend
| Feature | Reason |
|---------|--------|
| **K-Means clustering** (`MachineLearningService.cs:16-233`) | Uses ML.NET's built-in KMeans with multiple runs, auto-select K via silhouette scoring, quality metrics. Standard technique, properly implemented. Defensible. |
| **SSA forecasting** (`MachineLearningService.cs:702-756`) | Uses ML.NET's `ForecastBySsa` — a legitimate time series decomposition method. Has actual holdout validation with MAE/RMSE/MAPE (`CalculateRealMetricsAsync`, line 1073). This is the strongest part of the analytics. |
| **Dynamic risk thresholds** (lines 919-1063) | Weighted percentile-based thresholds with fallback to constants when data is insufficient. Not perfect, but better than the frontend's hardcoded values. |
| **Anomaly detection** (lines 1408-1610) | Standard IQR/Z-score/moving average with multi-method consensus. Properly implemented, well-documented approach. |
| **Data quality assessment** (lines 530-588) | Checks minimum data points, temporal coverage, outlier rates. Honest about limitations. |

---

## Changes Completed

### ✅ 1. [FRONTEND] Deleted the fallback forecasting engine

**Deleted files:** `forecastHelpers.ts`, `forecastEnsemble.ts`, `forecastEnhancements.ts`, `page-old.tsx`

**Fixed files:**
- `ForecastContext.tsx` — removed ensemble pre-computation, local fallback, and enhancement pipeline. API is the sole data source.
- `forecast/new/page.tsx` — removed `generatePredictions` catch block. API failure → error toast, no silent substitution.
- Both files now use inline `aggregateByMonth()` instead of `processClusterData()`.

**Build status:** Passes clean. No remaining references to deleted utils.

### ✅ 2. [BACKEND] Removed the manpower ML pipeline

**Deleted files (8):**
- `MLManpowerAllocationService.cs` — the 3-stage ML pipeline (Poisson → Poisson → SDCA) trained on fabricated population density and synthetic historical manpower data
- `PipelineOrchestratorService.cs` — orchestrated the full pipeline, called the ML service
- `PipelineController.cs` — exposed pipeline/manpower-recommendation endpoints
- `ManpowerRecommendation.cs` entity, config, interface, and both repo implementations (SQL Server + SQLite)
- `MLSettings.cs`, `MLConfigurationValidator.cs`

**Fixed files:**
- `ApplicationDependencyInjection.cs` — removed `AddMLServices()` and `PipelineOrchestratorService` registration
- `Program.cs` — removed `AddMLServices()` call, switched `Database.Migrate()` → `Database.EnsureCreated()`
- `ApplicationDbContext.cs` + `SqliteApplicationDbContext.cs` — removed `DbSet<ManpowerRecommendation>` and fluent config
- `InfrastructureDependencyInjection.cs` + `SqliteInfrastructureDependencyInjection.cs` — removed `IManpowerRecommendationRepository` bindings
- Deleted all migration files referencing `ManpowerRecommendation` (schema recreates on next launch via `EnsureCreated`)

**Kept:** Basic Manpower CRUD (entity, repos, CQRS), `DynamicManpowerAllocationService` (formula-based, no ML), `ManpowerValidationService` (benchmark comparisons), `ManpowerController` CRUD endpoints.

**Build status:** Passes clean (0 errors).

### ✅ 3. [FRONTEND] Using real SSA prediction intervals

**Changes:**
- Added `lowerBound` and `upperBound` fields to `ForecastData` type
- `ForecastContext.tsx` now passes through `f.lowerBound` and `f.upperBound` from the API response
- `TimeSeriesChart.tsx` uses real SSA lower/upper bounds for the confidence interval band instead of deriving fake bounds from `predictedCount × (1 − avgConfidence) × 0.5`
- `ForecastSummary.tsx` shows the average prediction interval width alongside the confidence percentage
- `ForecastDocumentation.tsx` replaced the fake formula (`confidence = max(0.5, base − months × 0.05)`) with an honest description of SSA eigenvalue-based prediction intervals

**Fallback:** When the API doesn't return bounds (older data), the chart falls back to a conservative ±2.5% band derived from the configured 95% confidence level.

### ✅ 5. [FRONTEND] Removed the API fallback in forecast generation

The catch block in `forecast/new/page.tsx` that silently substituted `generatePredictions()` on API failure has been replaced with re-throw → error toast. The `ForecastContext.tsx` fallback was also removed.

### ✅ 6. [FRONTEND] Deleted orphaned components

`page-old.tsx` (2193 lines of dead code) deleted. It was the only consumer of `SimpleForecastMap`, `ScatterPlot`, and the deleted util files.

---

## What Still Needs to Change

### 4. [FRONTEND] Fix time-of-day parsing (not done)

The backend already returns `timeOfDay` correctly. Remove any frontend re-derivation. The `categorizeTimeOfDay` utility in `ExtendedForecastTypes.ts` is still present — check if any component calls it instead of using the backend value.

### 7. [FRONTEND] Code quality

| Issue | File | Action |
|-------|------|--------|
| TypeScript strict off | `tsconfig.json:11` | Enable `strict: true` |
| `console.log` in production | Multiple files | Strip before submission |
| Zero tests | Entire project | At minimum: unit tests for utility functions |
| Hardcoded GUIDs | `consts.tsx:27-37` | Verify against actual backend precinct IDs |
| CSV export unsafe quoting | `analysis/page.tsx:200-208` | Use a proper CSV library |
| `db.json` + json-server | Root directory | Remove mock data from thesis branch |

### 8. [FRONTEND] Performance (nice-to-have)

- Map rebuilds all layers on every filter toggle
- No virtualization on data tables
- localStorage cache with no size limits

Won't make or break a defense, but a smooth demo helps.

---

## What Changed: Manpower Page → Forecast Summary Report

The `/manpower` page previously rendered the full `ManpowerAllocation` component (1694 lines) that:
- Fetched officer headcount data from the backend
- Computed recommended staffing per precinct/shift
- Used thresholds and multipliers for risk-based allocation

Since the backend ML pipeline is removed, this component has been replaced with a **ForecastSummaryReport** wrapper around the existing `ForecastSummary` component. The page now shows:
- Total predicted crime cases
- Trend distribution (increasing/stable/decreasing)
- Risk assessment by precinct
- Predicted crime types breakdown
- Confidence levels from the SSA model

The `ManpowerAllocation` type and `DEFAULT_MANPOWER_ALLOCATION` constant still exist in `ExtendedForecastTypes.ts` (referenced by `ForecastContext`'s state and `ForecastSummary`'s optional prop) but are no longer used for active computation.

---

## Corrected Assessment After Backend Inspection

After reading both repos fully, the picture is more nuanced than the initial frontend-only review suggested:

**Backend is stronger than expected.** The SSA model is a real time series method, the holdout validation is genuine, the dynamic thresholds are data-driven (with documented fallbacks), and the anomaly detection is standard. These parts can potentially be defended in a thesis — especially if you acknowledge their limitations.

**The manpower ML pipeline was the core problem.** The K-Means → SSA Forecast pipeline is defensible. The manpower optimization was not — it was built on engineered training data, not real records. This is now removed from the codebase.

---

## Recommended Thesis Scope

> **Crime Incident Clustering and Time Series Forecasting in Muntinlupa City**

| Component | Stance |
|-----------|--------|
| K-Means clustering on incident coordinates | Core contribution |
| SSA-based monthly forecasting (citywide aggregate where data permits) | Secondary contribution, with documented limitations |
| Dashboard descriptive statistics | Supplementary |
| Forecast summary report (predicted counts by precinct, trends, risk) | Supplementary visualization |
| Manpower allocation | Removed |

This scope is defensible. The panel gets to see real ML.NET K-Means with silhouette scoring, real SSA forecasting with holdout validation, and a polished dashboard. The limitations chapter honestly documents data sparsity and the absence of socioeconomic covariates. That's a passable thesis.

---

## Summary of Changes

| # | What | Where | Effort | Thesis Impact | Status |
|---|------|-------|--------|---------------|--------|
| 1 | Delete frontend fallback engine | Frontend | Low | Critical — removes duplicate wrong math | ✅ Done |
| 2 | Remove manpower ML pipeline | Backend | High | Critical — removes fabricated training data issue | ✅ Done |
| 3 | Display real SSA confidence values | Frontend | Medium | High — eliminates fake precision | ✅ Done |
| 4 | Fix time-of-day parsing | Frontend | Low | Medium | ⏳ Pending |
| 5 | Remove API fallback catch block | Frontend | Low | Critical — stops silent math substitution | ✅ Done |
| 6 | Delete orphaned components | Frontend | Low | Low — cleanup | ✅ Done |
| 7 | Code quality (strict, tests, logs, CSV, GUIDs) | Frontend | Medium | Medium — panel impression | ⏳ Pending |
| 8 | Performance | Frontend | Low | Low | ⏳ Pending |
