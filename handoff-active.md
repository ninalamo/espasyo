# Handoff — Active Task

**Status:** Step 1: Bulk Upload module activated. Figure #3 (crime data upload) is the core data input mechanism; all downstream modules (analysis, forecast, manpower) depend on valid incident data. No GA-01 or GA-05 dependencies.  
**Convention:** Only one item may be active at a time. When work begins, replace this file's content with the active sub-task's ID, description, files to touch, and acceptance criteria. When complete, move the item to `handoff-dead.md` and reset this file to the next step.  
**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`

**Step 1 — Bulk Upload / Insert** (active)
- **Figure:** #3 — Crime data upload module — import police reports via CSV
- **Objective:** Enable bulk import of crime incident records; provides dataset for all downstream modules (analysis clustering, forecast generation, manpower allocation)
- **Module:** `espasyo/nextjs-auth-app/crime-record/bulk-upload/page.tsx` + `csvProcessingService.ts` + `POST /incident/bulk` (WebAPI)
- **Status:** EXISTS + CORRECT — bulk upload page and CSV parser exist; calibration needed: verify CSV column mapping matches incident schema
- **Acceptance criteria:**
  1. Frontend: `/crime-record/bulk-upload` page loads; user selects CSV file; upload triggers POST to API
  2. Backend: `POST /incident/bulk` endpoint accepts CSV, validates rows, persists Incident records
  3. Data integrity: Uploaded records appear in `/incident` list; column mapping confirmed against schema
- **Next sub-task after completion:** Step 2 — Analysis Module

**Blocked on GA-01:** None (Step 1 has no GA-01/GA-05 dependencies).  
**Blocked on GA-05:** None.