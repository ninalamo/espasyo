# Espasyo Application Architecture

## Overview
Espasyo is a full-stack Crime Data Analysis System. The architecture is divided into two main repositories/components:
1. **Frontend**: A Next.js application located in this repository (`nextjs-auth-app`).
2. **Backend**: An ASP.NET Core Web API implementing Clean Architecture, located in the `nin-architecture` repository.
3. **Database**: SQL Server hosted via a Docker container.

## Frontend Architecture (Next.js)
- **Framework**: Next.js (React)
- **Authentication**: NextAuth.js (JWT-based, communicating with the ASP.NET Core backend)
- **Styling**: Tailwind CSS for responsive and utility-first styling
- **Data Visualization & GIS**:
  - Chart.js for graphs and analytics
  - Leaflet for interactive maps and spatial data visualization (Do not modify the map component directly)
- **Deployment Strategy**: Containerized or standard Node.js deployment, consuming the backend API.

## High-Level Data Flow
1. **Client Interaction**: Users interact with the Next.js frontend to view crime data, filter incidents, and see maps.
2. **Authentication**: The frontend uses NextAuth to authenticate via the backend's `/api/user` endpoints, receiving a JWT.
3. **Data Retrieval/Submission**: Authenticated requests are made to the backend (e.g., `/api/incident`) to fetch or submit crime data.
4. **Data Persistence**: The backend validates requests and interacts with the SQL Server database.

## Data Analysis & Visualization Capabilities

### 1. Grouping and Clustering (Analysis Page)
- **Endpoint Consumed**: `PUT /incident/grouped-clusters`
- **User-controlled Parameters**: Date range, number of clusters (3-10), number of training runs (1-10), and an **additional demographic feature** (e.g., CrimeType, Weather, Severity, Motive) on top of the default geographic base features (Latitude, Longitude). This intentionally limits dimensionality.
- **Result Set**: Clusters are displayed on the Leaflet map (read-only) and in tabular/chart form via `AnalysisTabs`. Each `ClusterItem` exposes: `CaseId`, `Latitude`, `Longitude`, `Month`, `Year`, `TimeOfDay` (Morning/Afternoon/Night), `Precinct` (Barangay), and `CrimeType`.
- **Data Persistence**: After running analysis, the cluster result is saved to `localStorage` and rehydrated on page load. It is also shared with the Forecast page without a new API call.
- **Exports**: Cluster data can be downloaded as CSV, JSON, or a Markdown summary report.

### 2. Statistical Forecasting (Forecast Page)
- **Primary Method**: Calls `/incident/forecast/statistical` (ML.NET SSA on the backend), which generates predictions grouped by Precinct × CrimeType.
- **Local Fallback**: If the backend API is unavailable, the frontend computes predictions locally using:
  - **Linear Trend**: OLS regression over the last 12 months.
  - **Polynomial Trend**: Quadratic approximation (acceleration + velocity).
  - **Seasonal**: Historical monthly averages adjusted by a recent trend multiplier.
  - **Simple Exponential Smoothing (SES)**: A mathematically sound weighted average (`alpha = 0.3`) with a conservative linear trend component. Replaced a previous random-jitter implementation.
- **Risk Levels**: Each forecast point is tagged as `low`, `medium`, `high`, or `critical` based on the ratio of predicted-to-recent-average crime counts.
- **Shift Breakdown**: Forecasts are enriched with time-of-day shift proportions (Morning / Afternoon / Night) derived from historical clustering data.
- **Exports**: Forecast report downloadable as CSV.

### 3. Manpower Forecasting (Manpower Allocation Component)
- **Consumes**: The enriched forecast data (predicted counts per precinct/crime type + shift breakdown).
- **Outputs**: Recommended officer headcount per precinct per period, with justification built from crime complexity score, predicted workload hours, and optimization confidence.

For detailed backend ML implementation, refer to the `nin-architecture/architecture.md` file in the `nin-architecture` repository.

---
## Backend Refinements for `second-space` Branch

The following changes are recommended for the backend (`D:\hobby\nin-architecture`, branch `second-space-backend`) to support the Phase 1 & 2 front-end enhancements. The repo uses **Clean Architecture** with **CQRS (MediatR)**, **ML.NET SSA forecasting**, and a **dual SQLite/SQL Server** database.

### Current Backend State
- **Forecasting**: `MachineLearningService.cs` (1125 lines) — SSA via `ForecastBySsa`, plus linear/seasonal fallbacks. No forecast persistence (computed on-the-fly).
- **Data Quality Assessment**: Exists at `POST /forecast/assess-data-quality` — IQR outlier detection, temporal coverage checks, returns `DataQualityAssessment`.
- **Forecast Validation**: Exists at `POST /forecast/validate` — hold-out validation with MAPE, requires 24+ months.
- **K-Means Clustering**: `PUT /grouped-clusters` — enriched output with precinct/crime-type/month metadata.
- **Manpower ML**: 3-model pipeline (complexity → workload → optimization) in `MLManpowerAllocationService.cs`.
- **Precinct Boundaries**: GeoJSON files exist in `espasyo_console/JsonFiles/` (Alabang, Ayala_Alabang, Bayanan, Buli, Cupang, Poblacion, Putatan, Sucat, Tunasan).
- **Branch**: `second-space-backend` already exists, identical to `master`.

### B1 — Persist Forecast Runs (Domain + Application + Infrastructure)

**Why**: Currently forecasts are computed on-the-fly and never stored. DB persistence enables history comparison, accuracy tracking (B2), and retrieval.

**New Domain Entity** (`espasyo.Domain/Entities/`):
```
ForecastRun: BaseEntity
├── Id: Guid
├── GeneratedAt: DateTimeOffset
├── Horizon: int (months ahead)
├── ModelType: string ("SSA" | "Linear" | "Seasonal" | "Ensemble")
├── ConfidenceLevel: double
├── Status: string ("Completed" | "Failed")
├── TotalPredictions: int
├── ParametersJson: string? (serialized parameters for reproducibility)
└── Results: ICollection<ForecastResult>

ForecastResult: BaseEntity
├── Id: Guid
├── ForecastRunId: Guid (FK → ForecastRun)
├── PrecinctId: Guid (FK → Precinct)
├── CrimeType: CrimeTypeEnum
├── Month: int
├── Year: int
├── PredictedCount: int
├── Confidence: double
├── Trend: string
├── RiskLevel: string
├── ActualCount: int? (nullable, filled when real data arrives)
└── ModelName: string (which model generated this)
```

**New Use Cases** (`espasyo.Application/UseCase/ForecastRun/`):
| Command/Query | Handler |
|---|---|
| `CreateForecastRunCommand` | Calls existing `GenerateStatisticalForecast`, saves results to DB |
| `GetForecastRunHistoryQuery` | Returns paginated list of past runs |
| `GetForecastRunByIdQuery` | Returns single run with all results |
| `UpdateForecastActualsCommand` | Submits actual counts for comparison |

**New Controller or extend** `IncidentController`:
```
GET    /api/incident/forecast/runs       → GetForecastRunHistoryQuery
GET    /api/incident/forecast/runs/{id}  → GetForecastRunByIdQuery
POST   /api/incident/forecast/run        → CreateForecastRunCommand
POST   /api/incident/forecast/runs/{id}/actuals → UpdateForecastActualsCommand
```

### B2 — Forecast Evaluation (Leverages Existing Validation)

**Why**: Front-end Accuracy Tracker needs "last forecast was X% accurate". Backend already has `POST /forecast/validate` with hold-out MAPE.

**Extend** `GetForecastRunByIdQuery` response to include:
```csharp
public class ForecastRunEvaluation {
    double? Mape;
    double? Rmse;
    double? Mae;
    int ActualsAvailable;     // count of results with ActualCount filled
    int TotalPredictions;
    Dictionary<string, double> PerPrecinctMape;   // breakdown
    Dictionary<string, double> PerCrimeTypeMape;
}
```
Computed by comparing `ForecastResult.PredictedCount` vs `ForecastResult.ActualCount` for entries where `ActualCount != null`.

### B3 — Backend Ensemble Model (MachineLearningService Enhancement)

**Current**: SSA only. Front-end already runs 4 local models for the ensemble heat grid.

**Proposed**: Add an `Ensemble` model type to `GenerateStatisticalForecast`:
- Run SSA, Linear, Seasonal simultaneously
- Return all three prediction sets + ensemble average + agreement score
- New response field: `AlternativeModelRuns: [{ ModelName, Series: [...] }]`
- Agreement score: percentage of models agreeing on trend direction per month

**Changes needed**:
- `MachineLearningService.cs`: Add `GenerateEnsembleForecast()` method that calls `GenerateForecastForSeries` with each model type, then aggregates
- `StatisticalForecastRequest`: Add `GenerateEnsemble: bool` flag
- `ForecastResponse`: Add `AlternativeModelRuns` list + `EnsembleAgreement` score

### B4 — Geospatial Precinct Boundaries

**Current**: Front-end uses hardcoded centroids in `forecastEnhancements.ts:226`. Backend has GeoJSON files in `espasyo_console/JsonFiles/`.

**Proposed**: Serve boundary GeoJSON through the API:
```
GET /api/precincts/geojson → FeatureCollection of precinct polygons
```
- Load the 9 existing GeoJSON files from `espasyo_console/JsonFiles/`
- Embed as embedded resources or serve from a static endpoint
- Precinct ID matches the `Precinct.Id` in the DB (use the same GUIDs from seed data)

**Why**: Accurate polygon rendering on the Leaflet map instead of approximate circle markers improves:
- Hotspot boundary clarity in Forecast Map
- Area-based risk coloring instead of point clustering
- Better visual communication to Muntinlupa LGU stakeholders

### B5 — Anomaly Detection in Forecast Response

**Current**: `MachineLearningService.cs` already has IQR-based outlier detection in `AssessDataQuality`.

**Extend** `GenerateStatisticalForecast` to flag anomalous predictions in the response:
```
ForecastResponse.Anomalies: List<ForecastAnomaly>
├── PrecinctId
├── CrimeType
├── Month/Year
├── PredictedCount
├── DeviationScore (how many std deviations from historical mean)
└── Explanation
```

**Why**: Front-end Ensemble View can highlight anomalies as "model disagreement points" where predictions deviate significantly from historical patterns.

### B6 — Scheduled Forecast Generation (Background Job)

**Infrastructure pattern**: Use `IHostedService` or `Quartz.NET` in the WebAPI project.

**Trigger**: Configurable cron schedule (e.g., nightly at 2 AM, or on new incident ingest).

**Process**:
1. Query recent incidents (last 24+ months)
2. Run clustering → grouped-clusters
3. Run statistical forecast
4. Save as `ForecastRun` via B1 use case
5. Optional: Notify via polling endpoint `GET /api/forecast/latest-run` — front-end checks and shows badge

### B7 — User Forecast Preferences

**New Entity**:
```
UserForecastPreference
├── Id: Guid
├── UserId: string (ASP.NET Identity User ID)
├── ForecastPeriod: int = 6
├── ConfidenceLevel: double = 0.95
├── ModelType: string = "ssa"
├── RiskThresholdLow: double = 0.8
├── RiskThresholdMedium: double = 1.2
├── RiskThresholdHigh: double = 1.5
├── IncludeSeasonality: bool = true
├── WeightRecentData: bool = true
├── BaseManpower: int = 25
└── UpdatedAt: DateTimeOffset
```

**Endpoints**:
```
GET  /api/user/forecast-preferences → UserForecastPreference (or defaults)
PUT  /api/user/forecast-preferences → Update preferences
```

### Implementation Order

| Phase | Items | Depends On |
|---|---|---|
| Phase A | B4 (GeoJSON endpoint) | None — standalone, high impact for map |
| Phase B | B1 (ForecastRun persistence) | New entity + migration |
| Phase C | B2 (Evaluation) + B7 (Preferences) | B1 |
| Phase D | B3 (Ensemble) | B1 |
| Phase E | B5 (Anomaly flags) + B6 (Scheduled) | B1, B3 |
