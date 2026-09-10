# FZ Performance Systemic Repair Standard

Status: RELEASE / DEVELOPMENT CONTRACT

## Core rule
A defect is not considered fixed merely because the currently visible instance looks correct. The repair must address the invariant that allowed the defect to occur.

## Repair sequence
1. Identify the failing layer: source, ingestion, canonical persistence, reconciliation/linking, derivation, intelligence, API contract, presentation, or release workflow.
2. State the invariant that should always have been true.
3. Repair the earliest safe layer that can enforce that invariant broadly.
4. Reconcile dependent canonical/derived data where required.
5. Trigger or verify all dependent surfaces reread the corrected truth.
6. Add a regression/contract check for the invariant.
7. Update architecture/release documentation when the operating model changed.
8. Verify desktop, mobile and production-health behaviour before promotion.

## Non-negotiable invariants
- One canonical operational truth: Neon.
- Source records remain provenance; user-facing truth is canonical and derived explicitly.
- Missing is never silently converted to zero.
- Newer sparse evidence cannot erase richer previously observed evidence.
- Clear relationships may be late-bound as evidence arrives; ambiguity is retained rather than guessed.
- Derivations are deterministic from canonical evidence and carry provenance/quality state.
- A source refresh must propagate to every dependent surface without a shell deployment.
- Routine data refresh must not consume Vercel deployments.
- Static HTML contains no athlete-state values that can become stale.
- Every visible metric has one declared source/derivation and one primary UI home.
- Release checks test stable invariants, not yesterday's moving athlete values.
- Event proximity must not silently override strategic objective priority.
- Shared capability transfer must never imply event equivalence.
- Objective changes invalidate capability priority and adaptive context through the dependency graph.
- Important cross-surface concepts require an entry in the canonical data-contract registry.

## Date-specific corrections
A one-date or one-session patch is permitted only as a documented migration/backfill after the systemic rule has been fixed. The date-specific data repair must not become runtime logic.

## Dynamic dependency model
When canonical evidence changes, dependent contracts are expected to converge automatically:

`source -> canonical persistence -> reconciliation/linking -> derivation -> intelligence observability -> UI reread`

Examples:
- new workout -> training memory -> Athlete Memory late-binding -> Trends/NCL -> SYSTEM integrity;
- Garmin wellness update -> canonical wellness -> TODAY physiology -> recovery/Trend overlays;
- athlete feedback -> Athlete Memory -> materiality -> session link when evidence permits -> derived Athlete Voice.

## Release gate
A change cannot be promoted solely because its immediate bug is gone. The release gate must prove the relevant invariant holds for multiple dates/sessions/states and does not regress on sparse, missing, duplicate or late-arriving evidence.

## Event-intelligence example
A newly mentioned race is not solved by adding its date to TODAY. The systemic path is: register event context -> establish event structure from athlete or research -> qualify demand profile -> compute directional overlap to the primary objective -> update capability priorities -> propagate affected adaptive/TRENDS/SYSTEM context -> add a regression scenario. This prevents future event additions from becoming one-off page edits.
