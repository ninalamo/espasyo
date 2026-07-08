# Forecast Methodology Gaps

## Background

After reviewing the forecast data output and tracing the full API path, several gaps were identified between the backend's forecasting capabilities and what the frontend actually requests/displays. These are documented below for review before implementation.

---

## Gap 1: Frontend hardcodes `modelType: 'Linear'`

**Files:**
- `nextjs-auth-app/src/app/forecast/ForecastContext.tsx:148`
- `nextjs-auth-app/src/app/forecast/new/page.tsx:146`

**What happens:**
Both `generateForecast` calls send `modelType: 'Linear'` regardless of what the user configures. The `forecastParams.model` field exists but is never read in the API request body.

**Why this is a problem:**
- The backend's **Seasonal** model (monthly averages × trend) is never used — it's a better fit for data with annual cycles (Christmas, summer, rainy season).
- The **Ensemble** model (SSA + Seasonal + Linear averaged) is also never used.
- The `includeSeasonality: true` flag is sent but ignored — `GenerateLinearTrendForecast` doesn't check it. Only `GenerateSeasonalForecast` does.

**The data confirms this:** In the forecast output, all 9 precincts for January 2027 show uniform predictions (e.g. Precinct 0 → 13, Precinct 1 → 13, Precinct 6 → 13) with identical confidence (0.448). A seasonal model would produce differentiated values based on each precinct's historical January pattern.

---

## Gap 2: Premature `Math.round()` discards precision

**Files:**
- `nextjs-auth-app/src/app/forecast/ForecastContext.tsx:165`
- `nextjs-auth-app/src/app/forecast/new/page.tsx:160`

**What happens:**
Both files apply `Math.round(f.forecast)` before storing predictions. The backend returns precise float values (e.g. 11.82, 11.95, 12.09, 12.23, 12.36, 12.50) but only the integer is preserved.

**Why this is a problem:**
- All 6 forecast months can round to the same integer (e.g. `11.82 → 12, 12.36 → 12`), making the trend invisible.
- Lower and upper bounds lose meaning when the midpoint is already rounded.
- The slope of the regression (e.g. +0.14/month) gets erased entirely.
- For a thesis methodology, panel reviewers may question why all predictions are identical integers — it looks like a bug.

---

## Gap 3: No model selection in the forecast UI

**File:** `nextjs-auth-app/src/app/forecast/new/page.tsx:362-367`

**What happens:**
The configure step shows a read-only field: *"Linear Regression — statistical time-series forecasting using linear trends"*. There is no dropdown or toggle to switch between Linear, Seasonal, SSA, or Ensemble.

**Why this is a problem:**
- The only way to use a different model is to edit the code.
- A thesis demo should at minimum acknowledge that other models exist and let the user/panelist compare results.
- The backend supports 4 model types; the UI exposes 0.

---

## Gap 4: `new/page.tsx` does not capture prediction bounds

**File:** `nextjs-auth-app/src/app/forecast/new/page.tsx:154-167`

**What happens:**
The `map` function that builds `ForecastData[]` on the new forecast page does not extract `lowerBound` or `upperBound` from the API response. Only `ForecastContext.tsx` does (line 167-168). When viewing a forecast saved from the "New Forecast" wizard, no confidence interval bands display.

**Why this is a problem:**
- The TimeSeriesChart shows a confidence band only when `lowerBound` / `upperBound` exist.
- Forecasts created through the wizard are missing this data, so the chart renders without interval shading — making the prediction look more precise than it is.

---

## Gap 5: Linear model is univariate (time-only)

**File:** `D:\hobby\nin-architecture\espasyo.Infrastructure\MachineLearning\MachineLearningService.cs:655-701`

**What happens:**
`GenerateLinearTrendForecast` regresses only on time step (`t = 1..n`) using the last 12 months. The formula is a plain OLS:
```
y = intercept + slope × t
```
with damped slope (`0.85^i`) and clamped to `[0, historicalMax × 2]`.

**Why this is a problem:**
- Cannot learn that January behaves differently from June.
- Cannot learn holiday effects, rainy season, election cycles.
- The backend's **Multiple Linear Regression** capability exists in the codebase pattern (see `GenerateSeasonalForecast` which computes monthly averages) but is not extended to the Linear model.
- Adding month as a dummy variable would still be "Linear Regression" — just with more predictors.

---

## Gap 6: Forecast data shows declining confidence but not why

**File:** Both `new/page.tsx` and `ForecastContext.tsx`

**What happens:**
Confidence values drop from ~0.76 (Aug 2026) to ~0.45 (Jan 2027), which is correct — uncertainty compounds. But the UI does not explain this decay anywhere in the creation flow or summary view.

**Why this is a problem:**
- A panelist seeing 45% confidence for January 2027 might think the model is unreliable, not realizing that 45% is the expected confidence for a 6-month-ahead forecast from a damped linear trend.
- The methodology says "accuracy decreases with longer horizon" but the values themselves are not contextualized (e.g. "Expected confidence for this horizon: ~45%").

---

## Summary of Required Changes

| # | Gap | Files Affected | Impact | Status |
|---|-----|---------------|--------|--------|
| 1 | Frontend hardcodes `'Linear'` | `ForecastContext.tsx`, `new/page.tsx`, `TrainerModel.cs` | Seasonal/Ensemble models unreachable | ✅ Fixed — removed from API call; backend default changed from `"SSA"` to `"Linear"` |
| 2 | `Math.round()` on forecast values | `ForecastContext.tsx`, `new/page.tsx` | Trend slope erased, predictions look flat | ✅ Fixed — raw float values preserved |
| 3 | No model selector in UI | `new/page.tsx` | Cannot switch models for comparison | ⏳ Review — confirmed intentional (always Linear) |
| 4 | `new/page.tsx` missing bounds | `new/page.tsx` | No confidence interval on wizard-created forecasts | ⏳ Pending |
| 5 | Linear model is univariate | `MachineLearningService.cs` | Cannot learn seasonality in Linear mode | ⏳ Pending |
| 6 | No confidence context in UI | `new/page.tsx`, `ForecastSummary.tsx` | Decay looks like model weakness, not expected behavior | ⏳ Pending |
| 7 | No year-over-year comparison | `ForecastBaseTypes.ts`, `ForecastContext.tsx`, `new/page.tsx`, `TimeSeriesChart.tsx`, `ForecastSummary.tsx` | Cannot see if crime is up/down vs same period last year | ✅ Fixed — `lastYearActual` field added, computed from historical data, shown as gray dashed line on chart and YoY% card in summary |
