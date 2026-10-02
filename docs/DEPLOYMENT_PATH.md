# FZ Performance Deployment Path

Status: v0.7 release-candidate operating standard

## Core principle

**Data movement is not a product deployment.**

FZ Performance has three separate change classes:

1. **Dynamic source refresh** — physiology/training source evidence changes during the day.
2. **Intelligence/state refresh** — validated FZ interpretation/readiness/recommendation state changes.
3. **Product/platform release** — executable shell/API/schema/hosting capability changes.

Only the third class should consume Vercel deployments.

## Canonical architecture

`Garmin / Tredict / Athlete Memory → Neon operational truth → FZ intelligence → PWA runtime reads`

Google Drive is the human-owned audit / flight-recorder representation. It is not a runtime dependency.

### Vercel projects

FZ keeps exactly two persistent projects:

- `fz-performance-mvp` — canonical PWA shell + same-origin APIs.
- `fz-performance-state` — retained fail-stale immutable fallback only.

Do not create temporary projects for previews, schema experiments, recovery work or state publication.

## Dynamic source refresh — zero deployments

While the PWA is open:

- persisted wellness and training render first;
- Garmin physiology is source-checked on load, every 5 minutes while visible, and after focus/online wake-up;
- training sources are source-checked on load, every 5 minutes while visible, and after focus/online wake-up;
- server-side source throttles prevent unnecessary upstream calls;
- successful persistence invalidates the canonical runtime views;
- TODAY / TRENDS / TRAIN / SYSTEM reread current Neon-backed contracts;
- manual `Refresh Garmin` and `Sync workouts` actions remain available.

No Git commit and no Vercel deployment is permitted for these routine updates.

## Intelligence/state refresh — zero deployments

Canonical intelligence refreshes reconcile persisted source evidence through the Neon mutation/revision/convergence graph. Explicit athlete feedback may create a material intraday state update when warranted, and the server-side convergence loop may settle new source writes while the PWA is closed.

Routine athlete-state evolution does **not** rebuild or advance the legacy complete-runtime pointer. Current athlete truth lives in Neon-native readiness, Current Athlete State, recommendation, training, trends, goals and source-health contracts.

Production `/api/runtime-state` remains database-backed, but its persisted `stateId/masterAsOf` identifies a **validated base presentation envelope**, not the current athlete-state timestamp. The endpoint overlays current canonical intelligence onto that base and exposes the distinction explicitly through `renderContract.intelligence.runtimeBase`. A historical base must never be presented as current readiness or current recommendation truth.

The PWA reads current domains separately:
- `/api/wellness/today` for current recovery/physiology;
- `/api/training/memory` for canonical execution and Athlete Memory;
- `/api/trends/current` for current longitudinal derivations;
- `/api/goals/current` for current objective/capability state;
- `/api/system/status` and `/api/intelligence/current` for current system/intelligence truth.

The persisted runtime pointer advances only when a genuinely new validated base envelope is published. That is not required for normal feedback, workouts, readiness changes or recommendation recomputation.

The immutable `fz-performance-state` project is a fail-stale fallback, not the primary publication target.

## Tranche 4.1 boundary

The v4.1 materiality engine evaluates new evidence and persists an auditable result. SYSTEM exposes the latest assessment read-only. A `RECOMPUTE_RECOMMENDATION` or `SAFETY_OVERRIDE` assessment records what must happen next; actual recommendation recomputation remains Tranche 4.2.

## Product release path

Automatic Git deployments are disabled.

A product release should be deliberately boring:

1. Prepare and validate the candidate without Vercel.
2. Batch related UI/reliability changes into one release candidate.
3. Run deterministic build/static/schema/materiality/dynamic-runtime gates.
4. Create exactly **one staged Production deployment without assigning Production traffic** in `fz-performance-mvp`.
5. Verify the immutable deployment on desktop + mobile against read-only live runtime contracts.
6. Promote that exact deployment ID to Production traffic without rebuilding it.
7. Verify production runtime, source freshness, training memory, Trends, SYSTEM, materiality observability and rollback readiness.

If staged acceptance fails, do not move Production traffic. Fix the candidate off-Vercel where possible and treat the next staged build as a new release attempt.

## Deployment-protection rule

`vercel.json` sets `git.deploymentEnabled=false` so ordinary development pushes do not create Preview deployments. Direct/manual product releases remain available and are the canonical release mechanism.

## Production acceptance invariants

Production tests must validate rules that remain true as athlete data changes. They must not freeze moving values such as current 7-day/28-day NCL totals.

Examples of stable invariants:

- runtime is database-backed and master-validated;
- dynamic endpoints are no-store and healthy;
- a canonical training day is never represented as a false zero load day;
- known historical benchmark classifications remain correct;
- new matched AET rows may extend the series without breaking the smoke test;
- Athlete Memory remains canonical subjective history;
- Drive remains audit-only;
- materiality engine remains observable and auditable;
- desktop/mobile pages render without console/page errors or horizontal overflow.
