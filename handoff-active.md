# Handoff — Active Task

**Status:** Step 2 — Analysis Module. Active sub-task: F-06 — Time-of-day distribution chart (standalone view of all incidents by Morning/Afternoon/Evening), Figure #4.

**F-06 Detail:**
- Item: Time-of-day distribution chart (standalone view of all incidents by Morning/Afternoon/Evening)
- Figure: #4 (Distribution of crime incidents by time of day)
- Step: 2 — Analysis Module
- Depends on: None
- Status: in_progress
- Files to touch: frontend page for time-of-day chart, API client for incident data by time of day
- Backend: Verify incident endpoint provides time-of-day data (AnalysisRun or Incident controller)

**Acceptance criteria:**
1. Frontend: Standalone chart view of all incidents grouped by Morning/Afternoon/Evening
2. Backend: API provides incident counts by time-of-day period
3. No local mock fallback — surface error if API fails

**Mirrored at:** workspace root, `espasyo/`, `nin-architecture/`
