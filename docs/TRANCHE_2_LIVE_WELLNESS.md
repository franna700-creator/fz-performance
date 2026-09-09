# Tranche 2 — Live Intraday Wellness

Status: OPTION C SELECTED · IMPLEMENTATION CANDIDATE

## Objective

Make current-day Garmin wellness evolve inside FZ independently of product deployments, while keeping TODAY calm and decision-led.

Exit proof:

> Open FZ at materially separated times during the day and the live wellness values and intraday traces have evolved from newly persisted source observations without a Vercel product or state deployment.

## Selected athlete experience — Option C / Hybrid

TODAY retains the FZ readiness and training decision as the primary surface. A compact `LIVE WELLNESS` card sits above the existing TODAY content and shows the latest confirmed steps, Body Battery, stress and active calories plus source time/freshness.

Expanding `View today’s physiology →` reveals the richer intraday layer: Body Battery, stress, heart rate and respiration traces plus overnight HRV and sleep anchors.

This deliberately avoids rebuilding Garmin Connect inside FZ. The live layer answers: what is changing today, how fresh is the evidence, and is there physiology worth inspecting behind the current FZ decision?

## Source architecture

Garmin wearable / Garmin Connect
→ Fitness AI Connector (official Garmin Health API-backed remote MCP)
→ FZ server-side source adapter
→ Neon observation store
→ same-origin `/api/wellness/today`
→ hybrid TODAY surface

The browser never calls Fitness AI or Garmin directly. Source credentials remain encrypted server-side.

## Persistence model

`fz_source_connections` stores live-source connection state and encrypted OAuth material.

`fz_wellness_snapshots` stores timestamped current-day scalar observations. Observations are immutable/idempotent by source/date/content hash rather than overwriting one `today` row.

`fz_wellness_series_points` stores 15-minute heart-rate, stress, Body Battery and respiration observations using source timestamps. Repeated syncs upsert the same source timestamp to allow late source corrections without duplicating the point.

`fz_wellness_current` materializes the latest scalar snapshot for each source/date.

## Refresh behaviour

The PWA calls the same-origin wellness endpoint when TODAY loads. While FZ remains visible it checks every five minutes. Returning the app to the foreground triggers an immediate check.

The server throttles upstream source calls to avoid duplicate refreshes from rapid page reloads. A successful pull requests the whole available current-day 15-minute series, so a later sync can backfill intervals that arrived while the PWA was closed.

The PWA distinguishes `LIVE`, `DELAYED` and `STALE` from the latest confirmed source observation time. Source failure does not erase the last persisted observation or the existing validated FZ readiness state.

## Background scheduling

Tranche 2 does not make Vercel Cron the primary live mechanism. The current Vercel Hobby environment cannot support the desired sub-hour cadence reliably enough for this use case. App-open/foreground synchronization therefore provides the first controlled near-real-time path, with whole-day source-series backfill providing continuity.

A later infrastructure choice may add a background scheduler or provider push without changing the browser contract or persistence model.

## Decision-layer boundary

Live wellness is observation/state infrastructure. It does not automatically rewrite the athlete recommendation on every step, stress or Body Battery change. Materiality rules and event-driven recommendation recomputation belong to Tranche 4.

## Security

- OAuth tokens and discovery state are encrypted at rest with `FZ_SOURCE_TOKEN_KEY`.
- The database URL and source encryption key are Vercel Production secrets.
- OAuth callback state is checked before token exchange.
- No Garmin/Fitness AI token is exposed to browser JavaScript.
- Same-origin wellness responses are `no-store`.

## Activation sequence

1. Quality gate passes for source adapter, persistence, API and hybrid UI.
2. Apply `002_live_wellness.sql` after temporary-branch verification.
3. Configure `FZ_SOURCE_TOKEN_KEY` in Vercel Production.
4. Merge and deploy the exact tested product build once.
5. Complete the one-time Fitness AI/Garmin OAuth authorization from the production FZ application.
6. Force the first live sync and validate source data against the connector.
7. Observe a later source change and prove the PWA evolves without deployment.
8. Confirm the immutable runtime path remains independent and available as the existing fail-stale state safety layer.

## Deployment-source verification

The existing `fz-performance-mvp` Vercel project was linked to `franna700-creator/fz-performance` with `main` as the production branch on 09 Sep 2026. This documentation-only commit is the deliberate trigger used to verify that future product commits deploy automatically from Git while athlete state continues to flow independently through Neon.
