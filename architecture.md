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
## Phase 1 Backend Implementation (`second-space-backend` branch)

All changes live in `D:\hobby\nin-architecture`, branch `second-space-backend` (4 commits, pushed).

### B4 — Precinct Street Lists ✅

**Note**: `espasyo_console/JsonFiles/` contain street name lists, not polygon GeoJSON. The endpoint serves street data.

| File | Purpose |
|------|---------|
| `espasyo.WebAPI/Controllers/PrecinctsController.cs` | `GET /api/precincts/streets` — all 9 precincts with street names |
| | `GET /api/precincts/{code}/streets` — single precinct (e.g., `ALB`, `AAL`, `SUC`) |
| `espasyo.WebAPI/Data/Streets/*.json` | 9 street list JSON files copied from `espasyo_console/JsonFiles/` |
| `espasyo.WebAPI/espasyo.WebAPI.csproj` | Content items marked `CopyToOutputDirectory: PreserveNewest` |

### B1 — ForecastRun + ForecastResult Persistence ✅

| Layer | Files |
|-------|-------|
| **Domain** | `Entities/ForecastRun.cs`, `Entities/ForecastResult.cs` |
| **Domain** | `Enums/ForecastModelTypeEnum.cs` (SSA, Linear, Seasonal, Ensemble) |
| **Domain** | `Enums/ForecastStatusEnum.cs` (Draft, Completed, Failed, Archived) |
| **Infrastructure** | `Data/Configurations/ForecastRunConfiguration.cs` (FK→Precinct) |
| **Infrastructure** | `Data/Configurations/ForecastResultConfiguration.cs` (FK→ForecastRun, cascade) |
| **Infrastructure** | `Data/Repositories/ForecastRepository.cs` (SQL Server) |
| **Infrastructure** | `Data/Repositories/Sqlite/SqliteForecastRepository.cs` (SQLite) |
| **Infrastructure** | `Data/ApplicationDbContext.cs` — added `DbSet<ForecastRun>`, `DbSet<ForecastResult>` |
| **Infrastructure** | `Data/SqliteApplicationDbContext.cs` — same + DateTimeOffset conversion for `RunAt` |
| **Infrastructure** | `InfrastructureDependencyInjection.cs` — registered `IForecastRepository` |
| **Infrastructure** | `SqliteInfrastructureDependencyInjection.cs` — registered `SqliteForecastRepository` |
| **Application** | `Interfaces/IForecastRepository.cs` — `SaveForecastRunAsync`, `GetForecastRunsAsync`, etc. |
| **Application** | `UseCase/ForecastRuns/Commands/SaveForecastRun/SaveForecastRunCommand.cs` — runs forecast via `IMachineLearningService` + persists run + results |
| **Application** | `UseCase/ForecastRuns/Queries/GetForecastRuns/GetForecastRunsQuery.cs` — paginated list |
| **Application** | `UseCase/ForecastRuns/Queries/GetForecastResults/GetForecastResultsQuery.cs` — results for a run |
| **WebAPI** | `Controllers/ForecastRunController.cs` |
| **Endpoints** | `POST /api/forecastrun` — run + save forecast |
| | `GET /api/forecastrun` — list past runs |
| | `GET /api/forecastrun/{id}/results` — get results |

### B2 — Forecast Evaluation (Actual vs Predicted) ✅

| File | Purpose |
|------|---------|
| `UseCase/ForecastRuns/Queries/EvaluateForecastRun/EvaluateForecastRunQuery.cs` | Compares `ForecastResult` values against actual `Incident` counts from DB |
| `ForecastRunController.cs` (extended) | `GET /api/forecastrun/{id}/evaluate` |

**Output**: MAE, RMSE, MAPE, per-comparison details, warnings for unreliable comparisons (>25% error) and sparse data.

### B3 — Backend Ensemble Model ✅

| File | Change |
|------|--------|
| `MachineLearningService.cs` | Added `GenerateEnsembleForecast()` — runs SSA, seasonal, linear, averages forecasts per month |
| | Added `"ensemble"` case to `GenerateForecastForSeries` switch |
| | Uses min lower bound / max upper bound across models |
| | Dominant trend + risk level by majority vote |
| | Falls back to linear if all models fail |

### B7 — User Forecast Preferences ✅

| File | Purpose |
|------|---------|
| `Domain/Entities/UserForecastPreference.cs` | Entity with `UserId`, `DefaultHorizon`, `DefaultModelType`, `ShowEnsembleView`, `ShowHotspotTimeline`, `EnabledTimeAnimation`, `PreferredTopN` |
| `Data/Configurations/UserForecastPreferenceConfiguration.cs` | Unique index on `UserId`, default values |
| Both `DbContext` files | Added `DbSet<UserForecastPreference>` |
| `Controllers/ForecastPreferencesController.cs` | `GET /api/forecast/preferences/{userId}`, `PUT /api/forecast/preferences/{userId}` |

### Pending (lower priority, documented for reference)

- **B5** — Anomaly detection in forecast response (use existing IQR logic in `AssessDataQuality`)
- **B6** — Scheduled forecast generation via `IHostedService`

### Migration Commands (run when .NET SDK is available)

```powershell
# SQLite
cd D:\hobby\nin-architecture
dotnet ef migrations add AddForecastPersistence --project espasyo.Infrastructure --startup-project espasyo.WebAPI --context SqliteApplicationDbContext --output-dir Data/Migrations/Sqlite

# SQL Server
dotnet ef migrations add AddForecastPersistence --project espasyo.Infrastructure --startup-project espasyo.WebAPI --context ApplicationDbContext
```
