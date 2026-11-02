# Handoff — Active Task

**Status:** Step 2 — Analysis Module complete. F-05 through F-10 are done. F-07 presents the analysis dataset inside Preprocessing, with search, filters, pagination, and filtered CSV export. F-10 includes a backend-generated monthly risk-band summary derived from persisted forecast rows and shown with the saved forecast overview. Step 3 forecast technical calibration (F-11) remains partial. Recent Temporal zero-display, saved Spatial data retrieval, and saved Time of Day projection work is implemented; full acceptance and Figure #12 methodology/validation remain incomplete and GA-01 gated.

**F-11 Forecast Technical Calibration (2026-11-02, calibrated; partial):**
- Spec: `../FORECAST_CALIBRATION_SPEC.md`
- Forecast starts at the next full calendar month; UI and backend use a 1-24 month horizon.
- Backend returns each forecast month's same-month prior-year actual for the temporal comparison; the frontend renders those values without selecting prior-year dates.
- The requested forecast horizon is generated from the complete analysis history; Linear and Seasonal use full-history trends with exponential recency weighting (12-month half-life) when enabled, while SSA uses all history with native ML.NET behavior.
- Saved-run results recompute prior-year actuals from preserved generation-time history. If the backend has no historical comparison record, its API value remains nullable; the Temporal chart displays the missing comparison and missing forecast month as zero with a visible marker. This is a display rule, not a backend claim that an observation occurred.
- Saved-run Spatial now loads persisted forecast spatial rows through `/api/ForecastRun/{id}/spatial-data`; runs without stored spatial rows still have no map data.
- The overview's “Shift Distribution” is now “Time of Day.” Backend-generated time-of-day allocations are stored with new forecast snapshots and loaded for saved runs. These are forecast allocations based on the analysis data, not an independently trained time-of-day forecasting model. Legacy snapshots without allocations show an unavailable state; no fabricated frontend distribution or backfill is provided.
- Snapshot deserialization remains compatible with the legacy historical-data JSON array. No database migration was needed for time-of-day persistence.
- F-11 is still partial: full acceptance, effective-model behavior, methodology, thresholds, validation criteria, and performance claims are not signed off; methodology/validation/performance claims remain GA-01 gated.
- GA-01 boundary: technical correctness fixes may proceed; methodology, thresholds, validation criteria, and user-facing performance claims remain gated.
- Verification: earlier focused forecast coverage (49 tests) passed; three focused saved-run spatial/time-of-day handler tests passed for the recent additions. Frontend lint and production build passed. A WebAPI build to a temporary output directory with `BuildProjectReferences=false` succeeded; the conventional build was blocked by output-file locks from a running API/debugger. No end-to-end browser validation was performed.

**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`
