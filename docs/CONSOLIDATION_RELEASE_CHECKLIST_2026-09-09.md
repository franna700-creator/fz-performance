# FZ Performance consolidation release gate — 09 Sep 2026

This release replaces the stacked build-time injector architecture with a runtime-owned application and a single canonical Trends contract.

## Data integrity acceptance

- Matched Run AET progression expected dates: 27 Jul, 04 Aug, 17 Aug, 25 Aug, 31 Aug.
- 04 Aug may remain matched-with-caveat because the hamstring stop occurred after sufficient standardized exposure; it must remain visibly caveated.
- 08 Sep GI-limited AET is NON_COMPARABLE and excluded from the matched progression line while retained as training exposure/context.
- 08 Sep NCL must derive from the three canonical activities when HR-zone detail is available: Mobility + AET Run + HIIT = approximately 66.32.
- A day containing canonical sessions must never become zero merely because detailed HR-zone data is missing. Missing detail is PENDING_DETAIL / null.
- Running Relationship Map is derived from canonical running activity evidence rather than a static array.
- Athlete Voice in TRENDS is derived from canonical Athlete Memory in TRAIN.

## Product boundaries

- TODAY: current state, live physiology, current FZ recommendation, compact training state.
- TRENDS: longitudinal recovery, exposure cost, standardized performance diagnostics, contextual running relationships, Athlete Voice patterns, measurement gaps.
- TRAIN: canonical Training Memory and Athlete Memory; Garmin/Tredict are evidence/provenance.
- SYSTEM: source health, freshness, operational truth and provenance.

## Runtime architecture

Sources → Neon operational truth → FZ interpretation/recommendation → PWA.

Google Drive is an audit / human-owned representation (flight recorder), not a runtime dependency.

## Production proof required after merge

The production environment has the database secret that preview does not. After merge, verify `/api/runtime-state`, `/api/wellness/today?refresh=0`, `/api/training/memory`, `/api/trends/current?days=45`, `/api/system/status`, and the neutral static shell before declaring the consolidation released.
