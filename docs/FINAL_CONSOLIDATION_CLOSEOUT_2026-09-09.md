# FZ Performance — Final consolidation close-out

Date: 2026-09-09

This close-out patch completes the consolidation gate before further tranche work.

## Final changes

- Historical Normalised Cardio Load is now read from the one-time Neon historical seed (`HISTORICAL_DAILY_NCL`) rather than requiring Google Drive at runtime.
- Direct canonical Tredict activity detail remains higher-priority evidence when available.
- Rolling 7-day and 28-day NCL retain two-decimal precision.
- TODAY no longer repeats systemic state, local/tolerance state and fallback beneath the readiness/recommendation hero.
- Regression gates now fail the build if the duplicated TODAY section returns, if historical NCL runtime ownership is removed, or if rolling NCL precision regresses.

## Product boundary after cleanup

- TODAY: current state, live physiology, current recommendation and current training state.
- TRENDS: longitudinal recovery, exposure cost, performance, athlete voice and trajectory.
- TRAIN: canonical execution history and Athlete Memory.
- SYSTEM: source health, freshness, provenance and architecture.

## Runtime truth

Neon remains canonical operational truth. Google Drive remains a human-owned audit/flight-recorder representation and is not queried by the runtime Trends contract.
