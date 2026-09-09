# Tranche 3 — Canonical Training + Athlete Event Ledger

## Objective

Move FZ from source mirroring to a canonical training lifecycle that can preserve:

`PLAN → RECOMMENDATION → ATHLETE CHOICE → MODIFICATION → EXECUTION → OUTCOME → NEXT RESPONSE`

without collapsing Garmin, Tredict, FZ interpretation, or athlete-reported information into one mutable row.

## Truth model

- **Source evidence:** immutable source versions in `fz_training_source_records`.
- **Canonical session:** one meaningful training exposure in `fz_training_sessions`.
- **Source linkage:** explicit relationships and reconciliation confidence in `fz_training_session_sources`.
- **Athlete/event memory:** append-only events in `fz_athlete_events` with actor and certainty.
- **Timeline:** `fz_training_timeline` exposes the event history with current session state.

## Certainty is first-class

- `OBSERVED` — directly supplied by a system/source.
- `REPORTED` — explicitly stated by the athlete.
- `INFERRED` — FZ/system inference, including automatic source matching.
- `HYPOTHESIS` — possible explanation that must not be promoted to fact.

## Source reconciliation

Tredict-native execution relationships are authoritative when available. Otherwise Garmin and Tredict activity records may be auto-linked only when there is one clear candidate based on local date, start-time proximity, duration similarity and compatible sport. A cross-source sport-label mismatch may be reconciled only when time and duration are exceptionally close. Ambiguity becomes `MATCH_REQUIRED`; it is never silently forced.

When a later source establishes the canonical execution, an earlier source-only duplicate is retained as `SUPERSEDED` and linked to its canonical parent. It remains available for audit but is removed from the primary athlete-facing training surface.

## Production source adapters

- Garmin activities: existing Fitness AI/Garmin server connection.
- Tredict: server-side Tredict Personal API read adapter using the production `TREDICT_API_TOKEN` with `activityRead` scope.

The browser never calls either source directly.

## Production activation note

Vercel environment-variable changes apply to new deployments. After `TREDICT_API_TOKEN` is created or rotated, trigger one production deployment before validating `/api/source/tredict/status` or running a training refresh.

## API contracts

`GET /api/training/today?refresh=0`

Returns the persisted near-term canonical session/event window quickly.

`GET /api/training/today?refresh=1`

Runs near-term source ingestion/reconciliation first, then returns the canonical window. A source failure is reported as a warning and does not erase persisted history.

`GET /api/training/memory?refresh=0`

Returns the broader athlete-facing canonical memory window from Neon. The default window is 30 days back and 14 days forward, with superseded source-only sessions returned separately for audit.

`GET /api/training/memory?refresh=1`

Refreshes only the near-term source window (-2 / +7 days), then returns the broader canonical memory window. This prevents the TRAIN page from repeatedly re-reading an unnecessarily large source history.

`GET /api/source/tredict/status`

Reports whether the production Tredict credential is configured and validates live `activityRead` access.

## Option B athlete-facing surface

### TODAY — compact lifecycle

TODAY stays a decision surface, not an activity log. The training card shows the most relevant canonical session with:

- current lifecycle mode (`NEXT SESSION`, `TODAY · LATEST EXECUTION`, or `LAST EXECUTION`);
- session title and canonical status;
- one human-readable explanation of what happened;
- source/reconciliation and athlete-feedback chips;
- a direct `View training memory →` handoff into TRAIN.

### TRAIN — full training memory

TRAIN owns the richer memory view. Each canonical session exposes:

- status and reconciliation state;
- chronological source/system/athlete events;
- certainty labels (`OBSERVED`, `ATHLETE REPORTED`, `FZ INFERRED`, `HYPOTHESIS`);
- athlete feedback and hypotheses without promoting them to source fact;
- expandable source and reconciliation provenance;
- superseded source-row count retained for audit without duplicating the athlete-facing session list.

The persisted ledger renders immediately, followed by a background source refresh. While visible, the source layer is refreshed on a five-minute cadence and when the app returns to the foreground after a meaningful gap.

## Tranche 3 exit gate

1. Production schema is live.
2. Tredict source is authenticated server-side.
3. Tredict executed records and Garmin activities ingest idempotently; planned records are consumed when supplied by the source adapter.
4. Clear duplicate executions reconcile; ambiguous ones remain explicit.
5. Athlete feedback can be written as `REPORTED` or `HYPOTHESIS` without mutating source evidence.
6. The canonical timeline can reconstruct a real session lifecycle.
7. TODAY consumes a compact current lifecycle from the canonical ledger.
8. TRAIN exposes the full canonical event history and provenance without querying source systems directly from the browser.
