# FZ Performance — Tranche 1 Persistent Runtime Store

Status: IMPLEMENTATION BRANCH

## Objective

Decouple ordinary athlete-state changes from Vercel state-project deployments while preserving the current validated immutable runtime transport as a rollback path.

Tranche 1 exit gate:

> A newer validated FZ runtime state can become visible through `/api/runtime-state` after a database write, without redeploying either `fz-performance-mvp` or `fz-performance-state`.

## Selected architecture

Operational store: PostgreSQL on Neon.

The PWA contract remains unchanged:

```text
PWA -> /api/runtime-state
```

Only the gateway's upstream source changes.

```text
Transition

validated FZ state
      |
      +--> Neon PostgreSQL --------------+
      |                                  |
      +--> immutable state transport     | fallback
                                         v
                                /api/runtime-state
                                         |
                                         v
                                        PWA
```

The existing `fz-performance-state` immutable generation system is retained during migration and remains the last-known-good fallback until the database path has passed the Tranche 1 exit gate and an explicit later decision retires it.

## Runtime modes

`FZ_RUNTIME_STORE_MODE` controls the gateway.

### `immutable`
Default and current-production-safe mode.

The database is ignored and `/api/runtime-state` behaves exactly as the v0.6.1 baseline.

### `prefer-database`
Recommended Tranche 1 validation mode.

The gateway reads the current validated state from PostgreSQL. If the database is unavailable, empty or invalid, it falls back to the existing immutable current/previous generation path.

### `database-only`
Future hard-cutover mode.

The database is authoritative. A database failure returns HTTP 503 rather than silently using the immutable store.

Do not use this mode until the database path has passed production observation and rollback testing.

## Environment requirements

- `DATABASE_URL` — Neon PostgreSQL connection string. `POSTGRES_URL` is accepted as a compatibility fallback.
- `FZ_RUNTIME_STORE_MODE` — `immutable`, `prefer-database`, or `database-only`.
- `FZ_STATE_WRITE_TOKEN` — high-entropy bearer secret protecting `/api/runtime-state-write`.

Secrets must be configured in Vercel project environment settings and must never be committed to GitHub or written into PWA client assets.

## Database objects

Migration: `db/migrations/001_runtime_store.sql`

### `fz_runtime_state_versions`
Append-only validated runtime-state versions.

Each row retains:
- state ID;
- schema/shell version;
- master-validation status;
- master-as-of timestamp;
- complete JSON runtime payload;
- SHA-256 integrity checksum;
- source class;
- creation timestamp.

A state ID is immutable: attempting to reuse an existing state ID with a different checksum fails.

### `fz_runtime_state_pointer`
Singleton current/previous pointer plus monotonic pointer version.

The database keeps the immediately previous state reference for rollback/audit continuity.

### `fz_publish_runtime_state(...)`
Transactional publication function.

It enforces:
- `masterValidated=true`;
- valid SHA-256 format;
- immutable state IDs;
- monotonic state publication;
- atomic current/previous pointer movement.

## Write path

`POST /api/runtime-state-write`

Authorization:

```text
Authorization: Bearer <FZ_STATE_WRITE_TOKEN>
```

The endpoint:
1. requires a complete current FZ runtime contract;
2. requires `masterValidated=true`;
3. computes the payload SHA-256 server-side;
4. calls the transactional database publication function;
5. returns the new pointer state.

This endpoint is infrastructure plumbing, not an athlete-facing API.

## Read path

`GET /api/runtime-state`

In `prefer-database` mode:
1. read database pointer/current state;
2. validate the runtime contract;
3. return it with `X-FZ-State-Source: database`;
4. on database-path failure, fall back to the existing immutable transport.

The browser therefore remains unaware of Neon, credentials, source adapters or migration state.

## Tranche 1 cutover sequence

1. Provision Neon project/database.
2. Apply `001_runtime_store.sql`.
3. Configure Vercel database and write-secret environment values.
4. Deploy this application change once with `FZ_RUNTIME_STORE_MODE=immutable`.
5. Seed the current master-validated runtime state into PostgreSQL.
6. Confirm database state exactly matches production state ID and required content.
7. Switch to `prefer-database`.
8. Verify `/api/runtime-state` returns `X-FZ-State-Source: database` and the same validated state.
9. Publish a strictly newer test/current FZ state through the authenticated write path without any Vercel deployment.
10. Confirm the PWA reads the new state after refresh.
11. Simulate database unavailability and confirm immutable fallback still serves the last-known-good state.

Exit only after steps 8-11 pass.

## Explicit non-goals in Tranche 1

Tranche 1 does not yet:
- ingest Garmin continuously;
- retain intraday wellness observations;
- poll or subscribe the browser for automatic live updates;
- alter readiness automatically when lifestyle totals change;
- replace the Drive audit/master asset;
- retire `fz-performance-state`.

Those belong to subsequent tranches. The purpose of Tranche 1 is to make state transport deployment-free first.
