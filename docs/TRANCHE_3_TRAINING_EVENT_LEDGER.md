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

Tredict-native `executedTrainingId` is authoritative when available. Otherwise Garmin and Tredict activity records may be auto-linked only when there is one clear candidate based on local date, sport, start-time proximity and duration similarity. Ambiguity becomes `MATCH_REQUIRED`; it is never silently forced.

## Production source adapters

- Garmin activities: existing Fitness AI/Garmin server connection.
- Tredict: server-side Streamable HTTP MCP client at `https://www.tredict.com/api/mcp/v2`, authenticated with a Vercel `TREDICT_API_TOKEN` secret.

## Production activation note

Vercel environment-variable changes apply to new deployments. After `TREDICT_API_TOKEN` is created or rotated, trigger one production deployment before validating `/api/source/tredict/status` or running a training refresh.

## API contract

`GET /api/training/today?refresh=0`

Returns persisted canonical sessions/events quickly.

`GET /api/training/today?refresh=1`

Runs source ingestion/reconciliation first, then returns the canonical window. A source failure is reported as a warning and does not erase persisted history.

`GET /api/source/tredict/status`

Reports whether the production Tredict credential is configured.

## Tranche 3 exit gate

1. Production schema is live.
2. Tredict source is authenticated server-side.
3. Tredict planned/executed records and Garmin activities ingest idempotently.
4. Clear duplicate executions reconcile; ambiguous ones remain explicit.
5. Athlete feedback can be written as `REPORTED` or `HYPOTHESIS` without mutating source evidence.
6. The canonical timeline can reconstruct a real session lifecycle.
7. TRAIN/TODAY can consume the canonical ledger without querying source systems directly.
