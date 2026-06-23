# App Audit & Minimal Plan — June 2026

## Current Routes

| Route | Page | Components | Backend Dependencies |
|-------|------|------------|---------------------|
| `/` | Dashboard | Stats cards, period comparisons, anomaly alerts, latest analysis summary | `/incident?pageSize=500`, localStorage |
| `/login` | Login | Email/password form | `/user` (credentials provider) |
| `/crime-record` | Crime Records list | CrimeTable, search, pagination, filters | `/incident?search=&pageNumber=&pageSize=` |
| `/crime-record/[id]` | Crime Record detail | Detail view | `/incident/{id}` |
| `/crime-record/add` | Add Record | react-hook-form, Map picker, dropdowns | `/incident/enums`, `/manpower/precincts`, `/street` |
| `/crime-record/bulk-upload` | Bulk Upload | CSV parser, progress bar | `/incident/bulk` |
| `/analysis` | K-Means Analysis | QueryBar, FeatureSelect, FilterSection, AnalysisTabs (Map, ScatterPlot, DataTable, BarangayMonthlyChart) | `/incident/grouped-clusters` (PUT) |
| `/forecast` | Forecast Dashboard | Card list | `/ForecastRun` (GET) |
| `/forecast/new` | New Forecast Wizard | 4-step: data → configure → generate → review | `/incident/forecast/statistical` (POST) |
| `/forecast/[id]/summary` | Forecast Summary | ForecastSummary KPIs | `/ForecastRun/{id}/results`, `/forecast/{id}/evaluate` |
| `/forecast/[id]/trends` | Trend Analysis | TrendAnalysis tables | same as summary |
| `/forecast/[id]/map` | Forecast Map | ForecastMap (Leaflet + precinct boundaries + markers + heatmap) | same as summary |
| `/forecast/[id]/heatmap` | Risk Heatmap | RiskHeatmap (precinct × month matrix) | same as summary |
| `/manpower` | Manpower Allocation | Allocation table, patrol slider, shifts | forecastApi.getById(), precincts.geojson |
| `/precincts` | Precinct Management | CRUD table, per-shift allocation modals | `/manpower/*` (external API) |
| `/methodology` | Methodology | ForecastDocumentation (static) | none |

## Issues Found

### Accuracy Issues

1. **Fake time-of-day data.** `ForecastMapPoint.timeOfDayBreakdown` is hardcoded to `{ morning: 1, afternoon: 1, evening: 1, night: 1 }` and `primaryTimeOfDay` to `'morning'` in `ForecastContext.tsx:204`. The backend returns no time-of-day data. Any UI or calculation using this is meaningless.

2. **Reliability is just confidence.** `reliability` in `ForecastMapPoint` is literally assigned `confidence` (ForecastContext.tsx:203). Not an independent metric.

3. **Competing risk models.** Backend risk = % deviation from historical average. Manpower page risk = absolute thresholds (≥50 critical, ≥25 high, ≥10 medium). They can disagree on the same precinct.

4. **All forecast map points at precinct centers.** Hardcoded coordinates (ForecastContext.tsx:191-197). The map shows barangay-level data, which the table already provides — no additional spatial resolution.

5. **Arbitrary manpower constants.**
   - `1.5 officers/km²` — no policing standard
   - `40 units/officer/month` — no operational basis
   - Crime severity weights (5× for violent, 2× for property) — reasonable but uncited
   - Baseline officers per risk level (2/3/4/6) — arbitrary

6. **Manpower implies false precision.** Showing "17 officers" as an integer suggests accuracy the model doesn't have.

### Redundancy Issues

7. **4 forecast tabs, 1 dataset.** Summary, Trend Analysis, Map, Risk Heatmap all render the same `ForecastData[]` in different layouts. A user must click through 4 tabs to see the full picture.

8. **3 Leaflet maps.**
   - `components/Map.tsx` — analysis cluster map
   - `forecast/ForecastMap.tsx` — forecast map
   - `components/SimpleForecastMap.tsx` — used in new forecast wizard
   All show crime data on Muntinlupa precinct boundaries.

9. **Dashboard ≈ Analysis page.** Both compute crime-type breakdowns, precinct breakdowns, and display latest analysis results (dashboard from localStorage, analysis from API response).

10. **Methodology page duplicates forecast docs modal.** Same `ForecastDocumentation` component rendered at `/methodology` and accessible inside forecast pages.

11. **ScatterPlot.** Bubble chart of clusters (timestamp × time-of-day). Low marginal insight beyond the cluster table.

12. **Manpower proposal page + Precinct management page.** `/manpower` generates suggestions. `/precincts` manages real allocations. Related but disconnected.

### Dead / Misleading Code

13. **`ForecastParams.model` supports 4 types** (`'linear' | 'ssa' | 'seasonal' | 'arima'`), but only `'SSA'` is ever sent. The `modelType` parameter in API calls is a dead input.

14. **Bulk upload page** is fully functional but rarely used. Complex code path for a niche feature.

## Proposed Cuts

| Feature | Action | Rationale |
|---------|--------|-----------|
| Risk Heatmap tab | **Remove** | Data already visible in trend table and summary |
| Methodology route | **Remove** | Static doc accessible from forecast — 1 route less to maintain |
| ScatterPlot component | **Remove** | Low value, overlaps with cluster table + map |
| SimpleForecastMap.tsx | **Remove** | Redundant map — merge its functionality into ForecastMap if needed |
| 4 forecast tabs → 2 pages | **Merge** | Summary + Trends → one scrollable page. Keep Map separate for visual reference. |
| Fake time-of-day data | **Delete** | Remove `timeOfDayBreakdown` and `primaryTimeOfDay` from `ForecastMapPoint` |
| `modelType` parameter | **Remove** | Hardcode SSA on backend, remove from frontend types and API calls |
| Time-of-day from BarangayMonthlyChart | **Remove or flag** | Data may not be from API (verify source) |

## Proposed Fixes

| Fix | Details |
|-----|---------|
| Manpower: show ranges | Display "14-20 officers" instead of "17" to communicate uncertainty |
| Manpower: add disclaimer | Label as "exploratory guideline" with caveat about unvalidated constants |
| Align risk models | Either use backend risk exclusively, or document the divergence |
| Forecast map: use real locations | Fall back to precinct centers, but document this limitation |

## Target Architecture (Minimal But Effective)

```
/                              → Dashboard (stats + latest analysis)
/login                         → Login
/crime-record                  → CRUD (list, add modal, detail modal, bulk upload)
/analysis                      → K-Means + map + table (no scatter plot)
/forecast                      → Saved forecast cards
/forecast/new                  → Generate wizard
/forecast/[id]/overview        → Merged summary + trends (single scrollable page)
/forecast/[id]/map             → Forecast map with precinct boundaries
/manpower                      → Manpower allocation (with disclaimers + ranges)
/precincts                     → Real allocation management
```

**Removed:**
- `/forecast/[id]/trends` (merged into overview)
- `/forecast/[id]/heatmap` (data in overview)
- `/methodology` (duplicate)
- ScatterPlot, SimpleForecastMap, time-of-day fake data, modelType param

**Total reduction:** ~12 routes → ~10 routes, ~3 components removed, ~1 type field removed, dead parameters cleaned up.
