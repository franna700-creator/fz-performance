# FZ Performance

Canonical source for the FZ Performance PWA shell, live source orchestration and runtime gateway.

## Operating model

- **DYNAMIC SOURCE REFRESH**: Garmin physiology and training-source evidence refresh while the PWA is open, persist to Neon, then invalidate the canonical views so TODAY / TRENDS / TRAIN / SYSTEM reread current operational truth. No shell release.
- **INTELLIGENCE / STATE REFRESH**: scheduled or explicit athlete-feedback reconciliation produces validated FZ state/intelligence in Neon. Routine publication does not deploy the PWA shell.
- **PRODUCT RELEASE**: UI, interaction, charting, presentation logic or schema capability. Exact release candidate + browser smoke + production verification required.
- **PLATFORM RELEASE**: routing, caching, runtime transport, domains, hosting or security. Strictest release gate.

## v0.7 dynamic runtime baseline

v0.7 makes the consolidated runtime explicitly dynamic. Persisted data renders first. Garmin physiology and training sources are checked on load, every five minutes while the app is visible, and after focus/online wake-up with throttling. New persisted source evidence immediately triggers a canonical reread, so downstream TRAIN, TRENDS and SYSTEM views can move forward without a Vercel deployment.

Tranche 4.1 materiality remains the current adaptive-intelligence boundary. New evidence can be assessed and persisted as `RECORD_ONLY`, `UPDATE_STATE`, `RECOMPUTE_RECOMMENDATION` or `SAFETY_OVERRIDE`; v0.7 exposes that assessment read-only in SYSTEM. Actual recommendation recomputation remains Tranche 4.2.

## Runtime truth

Neon is the canonical operational store for runtime state, wellness, training memory, Athlete Memory and intelligence observability. Google Drive remains the human-owned audit / flight-recorder representation. `fz-performance-state` is retained only as fail-stale fallback transport, not the normal state-publication path.

## Deployment discipline

Automatic Vercel Git deployments are disabled in `vercel.json`. Development commits should run GitHub quality gates without creating Preview deployments. Product releases use one deliberate pinned preview and one deliberate production promotion. Routine source/data updates consume zero Vercel deployments.
