# Handoff — Active Task

**Status:** Step 2 — Analysis Module complete. F-05 through F-10 are done. F-07 presents the analysis dataset inside Preprocessing, with search, filters, pagination, and filtered CSV export. F-10 includes a backend-generated monthly risk-band summary derived from persisted forecast rows and shown with the saved forecast overview. Step 3 forecast technical calibration is in progress; backend prior-year comparison and calibrated history weighting are implemented. Figure #12 methodology and validation remain deferred under GA-01.

**F-11 Forecast Technical Calibration (2026-11-01, calibrated; in progress):**
- Spec: `../FORECAST_CALIBRATION_SPEC.md`
- Forecast starts at the next full calendar month; UI and backend use a 1-24 month horizon.
- Backend returns each forecast month's same-month prior-year actual for the temporal comparison; the frontend renders those values without selecting prior-year dates.
- For a 12-month forecast starting December 2026, compare Dec 2025-Nov 2026 with Dec 2026-Nov 2027; the model still receives the complete analysis history.
- Linear and Seasonal use full-history trends with exponential recency weighting (12-month half-life) when enabled. SSA uses all history with native ML.NET behavior.
- Saved-run results recompute prior-year actuals from the preserved generation-time history; missing comparison data remains null.
- Focused backend tests cover year-boundary comparisons, saved-run history, and Linear/Seasonal weighting. Remaining F-11 acceptance criteria still require verification.
- GA-01 boundary: technical correctness fixes may proceed; methodology, thresholds, validation criteria, and user-facing performance claims remain gated.
- Verification completed so far: 49 focused backend forecast tests pass; backend API build and frontend production build succeed.

**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`
