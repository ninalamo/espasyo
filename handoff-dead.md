# Handoff — Dead (Completed / Archived) Tasks

**Status:** VERIFY-01 completed — objective-centered verification of all 12 figure requirements against the study objectives (RQ1–RQ5).  
**Archived item:** VERIFY-01 — Verified each figure: EXISTS/PARTIAL/MISSING, CORRECT/INCORRECT/UNCERTAIN, with file-path + line evidence and calibration needed. See `FIGURE_OBJECTIVE_VERIFICATION.md`.  
**Archived item:** F-03 — Correct forecast model identity: `list()` activeModel from `r.modelType`; `getById()` fetches run metadata for forecastPeriod/modelType instead of hardcoded values; `save()` uses `data.params.model`. `ForecastParams.model` widened to `string`.  
**Archived item:** F-04 — Remove silent localStorage fallback: `save()` throws visible error on server failure instead of silently saving locally.  
**Convention:** When an active task is complete, its entry is moved here from `handoff-active.md`, and `handoff-active.md` is reset to "none" (or the next task). TODO.md status is updated to "done".  
**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`
