# Tranche 3 — Canonical Training + Athlete Event Ledger

## Objective

Move FZ from source mirroring to a canonical training lifecycle that can preserve:

`SOURCE EVIDENCE → CANONICAL SESSION → ATHLETE RESPONSE → OUTCOME → MEMORY`

without collapsing Garmin, Tredict, FZ interpretation, or athlete-reported information into one mutable row.

A future source-supplied workout is an **UPCOMING PLAN**, not the FZ next-session recommendation. The adaptive **NEXT SESSION RECOMMENDATION** belongs to the later event-driven/adaptation layer.

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

Tredict planned-workout support remains implemented for interoperability, but FZ does not treat Tredict as the athlete's planning authority. If Tredict supplies a future workout it is retained as source evidence only.

## Production activation note

Vercel environment-variable changes apply to new deployments. After `TREDICT_API_TOKEN` is created or rotated, trigger one production deployment before validating `/api/source/tredict/status` or running a training refresh.

## API contracts

`GET /api/training/today?refresh=0`

Returns the persisted near-term canonical session/event window quickly.

`GET /api/training/today?refresh=1`

Runs near-term source ingestion/reconciliation first, then returns the canonical window. A source failure is reported as a warning and does not erase persisted history.

`GET /api/training/memory?refresh=0`

Returns the broader athlete-facing canonical memory window from Neon. The default window is 45 days back and 14 days forward, with superseded source-only sessions returned separately for audit.

`GET /api/training/memory?refresh=1`

Refreshes only the near-term source window (-2 / +7 days), then returns the broader canonical memory window. This prevents the TRAIN page from repeatedly re-reading an unnecessarily large source history.

`GET /api/source/tredict/status?probe=1`

Validates live `activityRead` access and returns the source connection state.

## Athlete-facing surface

### TODAY — compact lifecycle

TODAY stays the current-state/recommendation surface, not an activity log. Its training card shows the most relevant canonical training state with:

- current lifecycle context such as `TODAY · LATEST EXECUTION`, `LAST EXECUTION`, or source `UPCOMING PLAN`;
- session title and canonical status;
- one human-readable explanation of what happened;
- source/reconciliation and athlete-feedback context;
- a direct handoff into TRAIN.

The presence of an `UPCOMING PLAN` must never be presented as the FZ next-session recommendation.

### TRAIN — canonical Training Memory + Athlete Memory

TRAIN owns the richer memory view. It exposes:

- canonical sessions with status and reconciliation state;
- chronological source/system/athlete events;
- certainty labels (`OBSERVED`, `ATHLETE REPORTED`, `FZ INFERRED`, `HYPOTHESIS`);
- canonical Athlete Memory categories (`STATE`, `SESSION`, `COST`, `RECOVERY`, `FUELING`, `CONSTRAINT`, `HYPOTHESIS`);
- athlete-event date/time separately from any related training-session date;
- linked and standalone athlete context;
- source and reconciliation provenance;
- superseded source rows retained for audit without duplicating athlete-facing sessions.

TRENDS Athlete Voice is derived from the same canonical Athlete Memory rather than maintaining a competing subjective-history list.

## Tranche 3 exit gate

1. Production schema is live.
2. Tredict source is authenticated server-side.
3. Tredict executed records and Garmin activities ingest idempotently; planned records are consumed when supplied by the source adapter, but zero planned records is valid when the athlete does not use Tredict as a planner.
4. Clear duplicate executions reconcile; ambiguous ones remain explicit.
5. Athlete feedback can be written as `REPORTED` or `HYPOTHESIS` without mutating source evidence.
6. The canonical timeline can reconstruct a real session lifecycle.
7. TODAY consumes a compact current lifecycle from the canonical ledger.
8. TRAIN exposes the full canonical event history, Athlete Memory and provenance without querying source systems directly from the browser.

Final production evidence and the signed exit result are recorded in `docs/TRANCHE_3_EXIT_GATE_2026-09-09.md`.
