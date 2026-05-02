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

For detailed backend ML implementation, refer to the `architecture.md` file in the `nin-architecture` repository.
