# FZ Performance — Golden Athlete Scenarios v1

Status: PREPARED REGRESSION CONTRACT · item 30

## Purpose

Golden scenarios are synthetic athlete-state situations that protect FZ against recurring classes of reasoning and reconciliation failure. They assert invariants rather than hard-coding a recommendation for Francois.

## v1 scenarios

1. High readiness after heavy recent load.
2. Poor sleep with subjectively fresh legs.
3. Newer sparse training evidence arriving after richer evidence.
4. Athlete feedback arriving before the workout source record.
5. Aborted AET because of GI symptoms.
6. Two canonical sessions on the same day.
7. Ambiguous feedback that could refer to multiple sessions.
8. Verified rest-day zero versus workout-day pending detail.
9. Athlete override of the recommended lane.
10. Stale source evidence that must never be presented as LIVE.

## Core principles protected

- no single-signal readiness logic;
- objective and subjective discordance is retained rather than erased;
- monotonic best-available evidence;
- late binding without guessed association;
- load and performance comparability remain separate concepts;
- missing is never zero;
- athlete overrides become evidence while safety remains above preference;
- stale evidence cannot drive false freshness semantics.

Golden scenarios should expand whenever a real defect reveals a new reusable invariant. A scenario is not a substitute for a production-data migration or an athlete-specific patch.
