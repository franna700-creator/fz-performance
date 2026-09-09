# Tranche 3 — Production Exit Gate

Date: 2026-09-09
Status: PASS

## Scope

Tranche 3 establishes the canonical training + athlete-event memory layer. It is complete when FZ can reliably preserve what training occurred, reconcile overlapping source evidence, retain what the athlete reported, reconstruct a session lifecycle, and expose that memory through TODAY and TRAIN without the browser querying Garmin or Tredict directly.

This tranche does **not** own adaptive next-session recommendation recomputation. `NEXT SESSION` is an FZ recommendation concept and belongs to the subsequent event-driven/adaptation layer. A source-supplied future workout, if present, is an `UPCOMING PLAN`, not an FZ recommendation.

## Exit-gate evidence

### 1. Production schema is live — PASS

Verified in production Neon:
- `fz_training_source_records`
- `fz_training_sessions`
- `fz_training_session_sources`
- `fz_athlete_events`
- `fz_training_timeline`
- `fz_record_athlete_memory_v1`

### 2. Tredict is authenticated server-side — PASS

Production probe returns `CONNECTED`, `validated=true`, `activityRead=true`.

### 3. Garmin + Tredict execution ingestion is operational and idempotent — PASS

Production evidence at close-out:
- Tredict executed source records: 67
- Garmin executed source records: 4
- Tredict planned records: 0

The planned-workout adapter remains implemented for compatibility, but the athlete does not use Tredict as the planning authority. Zero planned records is therefore expected and is not a failed gate.

### 4. Duplicate executions reconcile explicitly — PASS

Production currently retains 4 Garmin source-only duplicates as `SUPERSEDED` after reconciliation into their canonical Tredict-backed sessions. These remain auditable but do not duplicate the athlete-facing training history.

No active canonical session is currently left in `MATCH_REQUIRED`.

### 5. Athlete feedback is first-class, certainty-aware memory — PASS

Production athlete-event memory at close-out:
- Athlete events: 27
- `REPORTED`: 26
- `HYPOTHESIS`: 1
- Training-linked: 25
- Standalone athlete context: 2

Forward ingestion classifies Athlete Memory into `STATE`, `SESSION`, `COST`, `RECOVERY`, `FUELING`, `CONSTRAINT`, and `HYPOTHESIS`, preserves event time/date, resolves a session only above the matching threshold, and uses an idempotent event key.

### 6. A real session lifecycle can be reconstructed — PASS

The 8 September Run AET is the acceptance example:
1. pre-session athlete state (`REPORTED`)
2. execution observed in Tredict (`OBSERVED`)
3. stopped early due to severe GI symptoms (`REPORTED`)
4. post-session difficulty/recovery interpretation (`REPORTED`)
5. banana-timing explanation retained separately (`HYPOTHESIS`)
6. Garmin/Tredict execution reconciliation (`INFERRED`)

The canonical session remains `STOPPED_EARLY` and `MATCHED`; later source reconciliation does not erase the athlete-reported lifecycle state.

### 7. TODAY consumes the canonical lifecycle — PASS

The consolidated production application renders current training state from the canonical training API rather than from static shell data or direct source calls.

### 8. TRAIN exposes canonical history + Athlete Memory + provenance — PASS

TRAIN exposes canonical sessions and Athlete Memory, including certainty, dates/times, categories, linked-session relationships and source provenance. Superseded source rows remain available for audit without becoming duplicate workouts.

## Release/acceptance evidence

The consolidated production application passed:
- quality / regression CI
- desktop browser acceptance
- mobile browser acceptance
- production browser smoke

The production-smoke run for main commit `d6bf07088fec05f8fa5be500d90d77b2063386ae` completed successfully.

## Final boundary

Tranche 3 ends with **memory and execution truth**.

Tranche 4 begins when new evidence can trigger materiality evaluation and recomputation of FZ intelligence, including reconsideration of the **next-session recommendation**.

**TRANCHE 3 — PASS**
