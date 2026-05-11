# Espasyo Application Architecture

## Overview
Espasyo is a full-stack Crime Data Analysis System. The architecture is divided into two repositories:
1. **Frontend**: Next.js 15.3 App Router (`nextjs-auth-app` in this repo)
2. **Backend**: ASP.NET Core 8 Web API (Clean Architecture) at `D:\hobby\nin-architecture`
3. **Database**: SQL Server via Docker container

---

## Frontend Architecture (Next.js)

### Tech Stack
- **Framework**: Next.js 15.3 (App Router, Turbopack dev)
- **Language**: TypeScript (strict off)
- **Authentication**: NextAuth.js 4.24 (CredentialsProvider, JWT strategy)
- **Styling**: Tailwind CSS 3 + PostCSS
- **Maps**: Leaflet + React-Leaflet + leaflet.heat
- **Charts**: Chart.js 4 + react-chartjs-2 + chartjs-adapter-date-fns
- **Geospatial**: Turf.js
- **Forms**: react-hook-form
- **Notifications**: react-toastify
- **UI**: @headlessui/react, @heroicons/react, lucide-react
- **Mock Backend**: json-server (`db.json`)
- **Linting**: ESLint 9 (next/core-web-vitals)

### Route Structure
| Route | Page | Description |
|-------|------|-------------|
| `/` | `page.tsx` | Home / Dashboard |
| `/login` | `login/page.tsx` | Login page |
| `/analysis` | `analysis/page.tsx` | K-Means clustering UI |
| `/crime-record` | `crime-record/page.tsx` | Crime incidents table with filters |
| `/crime-record/[id]` | `crime-record/[id]/page.tsx` | Single incident detail |
| `/crime-record/add` | `crime-record/add/page.tsx` | Add new incident form |
| `/crime-record/bulk-upload` | `crime-record/bulk-upload/page.tsx` | Bulk CSV upload |
| `/forecast` | `forecast/page.tsx` | Statistical forecasting dashboard |
| `/precincts` | `precincts/page.tsx` | Precinct list + streets + manpower |

### Component Tree
```
src/
  app/           # App Router pages + API routes
  components/    # Shared UI components
    DashboardLayout.tsx   # App shell with Navbar
    Navbar.tsx            # Top navigation
    Map.tsx               # Interactive Leaflet map
    MapModal.tsx          # Map in modal
    SimpleForecastMap.tsx # Forecast-dedicated map
    ScatterPlot.tsx       # Scatter chart
    BarangayMonthlyChart.tsx
    ClusterDataTable.tsx
    CrimeDetailModal.tsx
    InfoBadge.tsx
    InfoModal.tsx
    MultiSelectDropdown.tsx
    StaticMultiSelectDropdown.tsx
  constants/
    consts.tsx
  services/
    csvProcessingService.ts
  types/
    analysis/ClusterDto.ts
    crime-record/{AddIncidentDto,CrimeDetailDto,CrimeListItemDto,IncidentDto}.ts
    forecast/{EnsembleTypes,ExtendedForecastTypes}.ts
    ClusterColorsMapping.ts
    ErrorDto.ts
    next-auth.d.ts          # JWT token field in Session
    PrecinctDto.ts
  utils/
    forecastEnhancements.ts
    forecastEnsemble.ts
    manpowerApi.ts
```

### Page-Specific Components
**Analysis Page** (`/analysis`):
- `AnalysisTabs.tsx`: Tabbed view (map, table, charts)
- `QueryBar.tsx`: Date range, feature selection, cluster parameters

**Forecast Page** (`/forecast`):
- `TimeSeriesChart.tsx`: Primary forecast line chart
- `ForecastMap.tsx`: Forecast overlay on map
- `ForecastFilters.tsx`: Filter by precinct/crime type
- `ForecastSummary.tsx`: Summary cards
- `EnsembleView.tsx`: Multi-model ensemble comparison
- `HotspotTimeline.tsx`: Timeline animation of hotspots
- `RiskHeatmap.tsx`: Heatmap of risk levels
- `TrendAnalysis.tsx`: Trend component breakdown
- `ManpowerAllocation.tsx`: Officer allocation recommendations
- `ForecastDocumentation.tsx`: Inline docs
- `modals/CalculationMethodologyModal.tsx`
- `modals/DataQualityModal.tsx`
- `modals/TrendAnalysisMethodologyModal.tsx`

**Crime Record Pages**:
- `CrimeTable.tsx`: Paginated, sortable incident table

---

## Backend Architecture (ASP.NET Core 8 Clean Architecture)

Full document: `D:\hobby\nin-architecture\architecture.md`

### Layers
| Layer | Project | Responsibility |
|-------|---------|----------------|
| **Domain** | `espasyo.Domain` | Entities, Enums — zero dependencies |
| **Application** | `espasyo.Application` | Use cases, CQRS, DTOs, repository interfaces — depends on Domain |
| **Infrastructure** | `espasyo.Infrastructure` | EF Core, Repositories, ML.NET services, dual SQL Server/SQLite — depends on Application |
| **Presentation** | `espasyo.WebAPI` | Controllers, Swagger, DI — depends on Application + Infrastructure |

### Database
- **Primary**: SQL Server in Docker (port 1433)
- **Alternative**: SQLite (for development without Docker)
- **ORM**: Entity Framework Core, Code-First Migrations
- **Orchestration**: .NET Aspire (`nin-architecture.AppHost`)

### Seed Data
- **Console App**: `espasyo_console` — seeds 1000+ incidents with GIS geocoding
- **Auto-Seeded**: Admin user on first Web API startup

### ML.NET Subsystem
All ML resides in `MachineLearningService` (Infrastructure layer):
1. **K-Means Clustering** → `PUT /api/incident/grouped-clusters`
2. **SSA Forecasting** (with fallback: linear, seasonal, SES) → `POST /api/incident/forecast/statistical`
3. **Ensemble Model** → combines SSA + seasonal + linear
4. **Manpower Optimization** → 3-stage Poisson/SDCA regression pipeline

---

## API Integration Layer (Frontend → Backend)

### Base URL Configuration
`src/app/api/utils/apiConfig.ts`:
```
NEXT_PUBLIC_API_URL (default: http://localhost:5041/api)
```

### API Service (`apiService.ts`)
Auto-attaches JWT Bearer token from NextAuth session:
- `apiService.get<T>(endpoint)` → `GET /api/{endpoint}`
- `apiService.post<T>(endpoint, body)` → `POST /api/{endpoint}`
- `apiService.put<T>(endpoint, body)` → `PUT /api/{endpoint}`
- `apiService.delete<T>(endpoint)` → `DELETE /api/{endpoint}`

### Cached Fetch (`fetchCachedData.ts`)
localStorage-backed caching layer wrapping `apiService.get()`.

### Backend Controllers & Frontend Consumers

| Backend Controller | Endpoints | Frontend Consumer |
|-------------------|-----------|-------------------|
| `UserController` | `POST /api/user` | NextAuth `route.ts` (CredentialsProvider.authorize) |
| `IncidentController` | `GET /api/incident`, `POST /api/incident`, `PUT /api/incident/grouped-clusters`, `POST /api/incident/forecast/statistical` | Crime record pages, Analysis page, Forecast page |
| `PrecinctsController` | `GET /api/precincts/streets`, `GET /api/precincts/{code}/streets` | Precincts page |
| `StreetController` | `GET /api/street` | Crime record add form (address lookup) |
| `ManpowerController` | `GET/POST /api/manpower`, `PUT /api/manpower/{id}`, `GET /api/manpower/precincts`, `GET /api/manpower/summary/{year}`, `POST /api/manpower/upsert`, `GET /api/manpower/shifts`, `GET /api/manpower/precinct/{precinctId}` | ManpowerAllocation, Precincts page |
| `ForecastRunController` | `POST /api/ForecastRun`, `GET /api/ForecastRun`, `GET /api/ForecastRun/{id}/results`, `GET /api/ForecastRun/{id}/evaluate` | Forecast page (persistence layer) |
| `ForecastPreferencesController` | `GET /api/forecast/preferences/{userId}`, `PUT /api/forecast/preferences/{userId}` | Forecast page (user settings) |

---

## Authentication Flow

1. User submits email + password on `/login`
2. NextAuth `CredentialsProvider.authorize()` sends `POST /api/user` to backend
3. Backend validates credentials, returns JWT token + username
4. NextAuth stores token in JWT session (custom `token` field in `next-auth.d.ts`)
5. All subsequent `apiService` calls auto-attach `Authorization: Bearer {token}`
6. Token is NOT persisted to localStorage — NextAuth manages it via httpOnly cookie

### Credentials
- **Admin**: admin@example.com / Admin@123
- **Mock (json-server)**: admin / admin1234!

---

## Data Flow by Feature

### 1. Clustering (Analysis Page)
```
User sets params → PUT /api/incident/grouped-clusters
  → Backend: K-Means (Lat + Long + 1 demographic feature)
  → Returns cluster items with CaseId, Lat, Lng, Month, Year, TimeOfDay, Precinct, CrimeType
  → Frontend: renders on Leaflet map + DataTable + Charts
  → Saved to localStorage ("clusterData")
  → Shared with Forecast page
  → Export: CSV, JSON, Markdown
```

### 2. Forecasting (Forecast Page)
```
Primary path:
  POST /api/incident/forecast/statistical
  → Backend: ML.NET SSA (grouped by Precinct × CrimeType, aggregated monthly)
  → Returns forecast points with predicted counts, bounds, risk levels, shift breakdown
  
Local fallback (when backend unavailable):
  Linear Trend (OLS, 12 months), Polynomial (quadratic), Seasonal (monthly avg × trend), SES (α=0.3)

Risk levels: low / medium / high / critical (ratio of predicted-to-recent-average)

Data quality: AssessDataQuality checks ≥100 data points, ≥24 months, <10% outliers

Persistence:
  POST /api/forecastrun → runs + saves forecast (ForecastRun + ForecastResult entities)
  GET /api/forecastrun → list past runs
  GET /api/forecastrun/{id}/results → get saved results
  GET /api/forecastrun/{id}/evaluate → MAE, RMSE, MAPE evaluation
```

### 3. Manpower Allocation
```
Three-stage ML pipeline (backend):
  1. Crime Complexity Model (LBFGS Poisson)
  2. Workload Prediction Model (LBFGS Poisson)
  3. Manpower Optimization Model (SDCA Regression)

Database: composite unique index on (PrecinctId, Shift) — multi-shift per precinct supported natively

Frontend integration:
  src/utils/manpowerApi.ts — full API client with shift support
  Upsert endpoint: POST /api/manpower/upsert (precinctId + shift number + headCount)
  Shift mapping: 0=Morning, 1=Evening, 2=Night
  No client-side workaround needed — backend handles shift uniqueness via composite key
```

### 4. User Forecast Preferences
```
Backend: UserForecastPreference entity (UserId, DefaultHorizon, DefaultModelType, etc.)
Frontend: ForecastFilters.tsx → user can save/view preferences
```

### 5. Precinct Streets
```
Backend: PrecinctsController serves street name lists from JSON files (not GeoJSON polygons)
Files: espasyo.WebAPI/Data/Streets/*.json (9 files: ALB, AAL, SUC, etc.)
Frontend: /precincts page displays precincts + street lists
```

---

## Backend Phase 1 Implementation Status

All documented in detail in the Phase 1 section below. Features are implemented on `second-space-backend` branch of `nin-architecture`.

### B1 — ForecastRun + ForecastResult Persistence ✅
### B2 — Forecast Evaluation (Actual vs Predicted) ✅
### B3 — Backend Ensemble Model ✅
### B4 — Precinct Street Lists ✅
### B7 — User Forecast Preferences ✅

### Pending (documented for reference)
- **B5** — Anomaly detection in forecast response
- **B6** — Scheduled forecast generation via IHostedService

---

## Development Setup

### Prerequisites
- Node.js 18+
- .NET 8 SDK
- Docker Desktop (SQL Server)
- Git

### SQL Server
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:latest
```

### Backend
```bash
cd D:\hobby\nin-architecture
dotnet run --project espasyo.WebAPI
# API: http://localhost:5041
# Swagger: http://localhost:5041/swagger
```

### Frontend
```bash
cd D:\hobby\espasyo\nextjs-auth-app
npm install
# Create .env.local:
#   NEXT_PUBLIC_API_URL=http://127.0.0.1:5041/api
#   NEXTAUTH_URL=http://localhost:3000
#   NEXTAUTH_SECRET=17CF4AC5-4DC6-4567-BCCE-BB6B668873B3
npm run dev
# Frontend: http://localhost:3000
```

### Environment Variables (.env.local)
| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5041/api` | Backend API base URL |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth site URL |
| `NEXTAUTH_SECRET` | (guid) | NextAuth encryption secret |

### Migration Commands
```powershell
# SQLite
cd D:\hobby\nin-architecture
dotnet ef migrations add <Name> --project espasyo.Infrastructure --startup-project espasyo.WebAPI --context SqliteApplicationDbContext --output-dir Data/Migrations/Sqlite

# SQL Server
dotnet ef migrations add <Name> --project espasyo.Infrastructure --startup-project espasyo.WebAPI --context ApplicationDbContext
```

---

## Related Documentation
- `nin-architecture/architecture.md` — Backend Clean Architecture + ML details
- `manpower-api-documentation.md` — Manpower Allocation API docs + shift-aware upsert
- `README.md` — Setup instructions
- `nin-architecture/README.md` — Backend-specific setup + Aspire
- `nin-architecture/SQLITE_IMPLEMENTATION.md` — Dual database support
- `nin-architecture/WARP.md` — WARP.dev dev commands

---

## Related Documents
- `espasyo-review-plan.md` — Comprehensive review, gap analysis, and phased remediation plan
- `nin-architecture/architecture.md` — Backend-specific architecture (mirrors this document)

---

## Known Gaps & Remediation Roadmap

A full review was conducted on 2026-05-11 (`espasyo-review-plan.md`). Key findings:

### Critical Gaps (P0 — must fix)

1. **Disconnected Pipeline:** Analysis → Forecast → Manpower is manually chained via `localStorage`, not backend-orchestrated. No single endpoint connects all three stages.
2. **Manpower ML Training Data Broken:** `MLManpowerAllocationService.GetHistoricalManpowerData` hardcodes `Barangay.Alabang` with zero-variance data, rendering the regression models untrustworthy.
3. **Forecast Output Not Consumed by Manpower:** No code path feeds SSA forecast predictions into the manpower optimization service.
4. **Dashboard Shows Raw Counts Without Context:** No baseline comparisons, trend indicators, or anomaly flags — data is not meaningful at face value.

### High-Priority Gaps (P1)

5. **Clustering Results Not Persisted:** Stored only in browser `localStorage`; no `AnalysisRun` entity or API endpoint.
6. **Manpower Recommendations Not Persisted:** No `ManpowerRecommendation` entity — history lost on page refresh.
7. **K-Means Underutilized:** No auto K-selection, no silhouette validation, cluster assignments not used by forecasting engine.
8. **No Hotspot Prediction:** Forecast predicts counts, not locations. No predicted hotspot map exists.
9. **No Anomaly Detection:** B5 documented but unimplemented.

### Medium-Priority Gaps (P2)

10. No background scheduled jobs (B6 — `IHostedService`)
11. Redundant/misleading visualizations (`SimpleForecastMap.tsx`, `ScatterPlot.tsx`)
12. Missing critical visualizations (precinct radar, seasonal decomposition, resource gap chart)
13. No PDF report generation
14. No role-based access control enforcement (types exist, not enforced)

### Phase Plan

| Phase | Focus | Timeline (est.) |
|---|---|---|
| P1: Data Infrastructure | Persist analysis runs, fix manpower training data, create entities | 10 days |
| P2: Pipeline Integration | Pipeline orchestrator, connect forecast→manpower, fix K-Means | 15 days |
| P3: Analytics & Visualization | Baseline comparisons, anomaly detection, dashboard redesign, hotspot maps | 20 days |
| P4: Production Readiness | Background jobs, monitoring, testing, performance, RBAC | 15 days |

**Full details:** `espasyo-review-plan.md`

---

## Savepoint: 2026-05-11
Last comprehensive review of both frontend (nextjs-auth-app) and backend (nin-architecture `second-space-backend` branch). All routes, components, controllers, and integration points documented above reflect the current state of both repositories. See `espasyo-review-plan.md` for full gap analysis and remediation roadmap.
