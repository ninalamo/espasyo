# Forecast Page Restructure — May 2026

## Problem

The `/forecast` page was a 2193-line God Page that:

- **Orchestrated everything**: data loading, API calls, 4 math model implementations, 9 tab views, 9 info modals, filtering, CSV export
- **Duplicated code**: `calculateLinearTrend`, `calculatePolynomialTrend`, `calculateSeasonalForecast`, `calculateExponentialSmoothing`, `getShiftFromTimeOfDay`, `calculateShiftPatterns`, `applyShiftPatterns`, `processClusterData` were all defined **inline** in the page AND again in `utils/forecastEnsemble.ts`
- **No persistence**: forecast data lived in React `useState` — navigate away = gone
- **Fragile data chain**: forecast depended on analysis data from `localStorage`; no way to revisit past forecasts
- **Misplaced Manpower**: `ManpowerAllocation.tsx` (1713 lines) was buried as a tab inside forecast, but it's an operational resource planning tool
- **Duplicated types**: `ForecastData`, `HistoricalData`, `ManpowerAllocation` were redefined inline in 10+ files

## New Architecture

### Route Structure

```
/forecast                          → Dashboard (list saved forecasts)
/forecast/new                      → 4-step wizard to generate + save
/forecast/[id]/summary             → Summary KPIs
/forecast/[id]/timeseries          → Chart.js line chart
/forecast/[id]/heatmap             → Risk heatmap matrix
/forecast/[id]/map                 → Leaflet interactive map
/forecast/[id]/ensemble            → Multi-model comparison + hotspots
/manpower                          → Standalone manpower allocation page
```

### Key Files Created

| File | Purpose |
|------|---------|
| `src/types/forecast/ForecastBaseTypes.ts` | Single source of truth for `ForecastData`, `HistoricalData`, `ForecastParams`, `ForecastFilterState`, `ForecastSnapshot` |
| `src/app/api/utils/forecastApi.ts` | API client: `list()`, `getById()`, `save()`, `delete()` + localStorage fallback |
| `src/utils/forecastHelpers.ts` | Extracted `processClusterData`, `generatePredictions`, `getShiftFromTimeOfDay`, `calculateShiftPatterns`, `applyShiftPatterns`, `calculateLinearTrend`, `calculatePolynomialTrend`, `calculateSeasonalForecast`, `calculateExponentialSmoothing`, `convertHistoricalDataToClusters` |
| `src/app/forecast/ForecastContext.tsx` | React Context (state + actions) shared across all `[id]` sub-routes |
| `src/app/forecast/page.tsx` | New dashboard — lists saved forecasts, link to `/forecast/new` |
| `src/app/forecast/new/page.tsx` | 4-step wizard: Load Data → Configure → Generate → Review & Save |
| `src/app/forecast/[id]/layout.tsx` | Wraps sub-routes with `ForecastProvider` + tab navigation + filters |
| `src/app/forecast/[id]/page.tsx` | Redirects to `/forecast/[id]/summary` |
| `src/app/forecast/[id]/summary/page.tsx` | Summary view (uses ForecastSummary) |
| `src/app/forecast/[id]/timeseries/page.tsx` | Time series chart (uses TimeSeriesChart) |
| `src/app/forecast/[id]/heatmap/page.tsx` | Risk heatmap (uses RiskHeatmap) |
| `src/app/forecast/[id]/map/page.tsx` | Forecast map (uses ForecastMap) |
| `src/app/forecast/[id]/ensemble/page.tsx` | Ensemble + hotspots (uses EnsembleView + HotspotTimeline) |
| `src/app/manpower/page.tsx` | Standalone manpower page (wraps ManpowerAllocation) |
| `src/app/manpower/layout.tsx` | Manpower layout |

### Files Modified

| File | What Changed |
|------|-------------|
| `src/types/forecast/EnsembleTypes.ts` | Removed `ForecastData` (now imports from `ForecastBaseTypes`) |
| `src/types/forecast/ExtendedForecastTypes.ts` | `ExtendedForecastData` now `extends ForecastData` (removed field duplication) |
| `src/utils/forecastEnsemble.ts` | Removed inline `HistoricalData`, `ForecastData` — now imports from `ForecastBaseTypes` |
| `src/utils/forecastEnhancements.ts` | Removed inline `ForecastData`, `HistoricalData` — imports from `ForecastBaseTypes` |
| `src/app/forecast/ForecastSummary.tsx` | Removed inline interfaces — imports from `ForecastBaseTypes` |
| `src/app/forecast/TimeSeriesChart.tsx` | Removed inline interfaces — imports from `ForecastBaseTypes` |
| `src/app/forecast/TrendAnalysis.tsx` | Removed inline interfaces — imports from `ForecastBaseTypes` |
| `src/app/forecast/RiskHeatmap.tsx` | Removed inline interfaces — imports from `ForecastBaseTypes` |
| `src/app/forecast/ForecastFilters.tsx` | Uses `ForecastFilterState` + `initialForecastFilterState` from `ForecastBaseTypes`; re-exports for backward compat |
| `src/app/forecast/EnsembleView.tsx` | Imports `ForecastData` from `ForecastBaseTypes` |
| `src/app/forecast/HotspotTimeline.tsx` | Imports `ForecastData` from `ForecastBaseTypes` |
| `src/app/forecast/ForecastDocumentation.tsx` | Removed inline interfaces — imports from `ForecastBaseTypes` |
| `src/app/forecast/ManpowerAllocation.tsx` | Imports `HistoricalData`, `ForecastData` from `ForecastBaseTypes`. Fixed `precinct` → `precinctId` type errors |
| `src/app/forecast/page-old.tsx` | Backup of the original 2193-line page (kept for reference, NOT used in routing) |
| `src/components/DashboardLayout.tsx` | Added `Users` import, added "Manpower" nav item with `Users` icon |
| `src/app/precincts/page.tsx` | Fixed `ManpowerAllocation.precinct` → `precinctId` type errors |

## Backend API Endpoints (ForecastRunController)

The frontend `forecastApi.ts` now communicates with these actual backend routes:

```http
GET    /api/ForecastRun              → GetForecastRunsResponse (ForecastRunResult[])
GET    /api/ForecastRun/{id}/results → ForecastResultDto[]
POST   /api/ForecastRun              → SaveForecastRunCommand → Guid (new run ID)
GET    /api/ForecastRun/{id}/evaluate → evaluate accuracy
```

The frontend maps backend response shapes to frontend types (`ForecastResultDto[]` → `ForecastSnapshot`, `ForecastRunResult[]` → `ForecastSummaryCard[]`). For save/delete operations where the backend data model differs, the frontend falls back to localStorage persistence.

## Remaining Cleanup (Optional)

- The 3 modal files in `src/app/forecast/modals/` and `ForecastDocumentation.tsx` contain mostly static text that was in the inline modals of the old page. They still exist but are not imported by the new sub-routes. Can be cleaned up or replaced with a help panel.
- `TrendAnalysis` component is no longer in the tab navigation (usability decision — trend data shows in Summary). It still exists and can be added back as a sub-route if needed.
