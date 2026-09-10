# FZ Performance Data Contract Registry

Status: RELEASE ARCHITECTURE CONTRACT — RC7.

Every current decision-driving concept is declared in `lib/data-contract-registry.js`. The executable contract records: owner layer, canonical source/derivation, definition, refresh triggers, freshness class/tolerance, missing-data policy, fallback behaviour, provenance requirement, primary UI home and canonical consumers.

## Non-negotiable rule
No metric, state, objective, capability or recommendation feature may originate inside a page component. Presentation consumes a canonical contract; it does not own truth. `unknown`, `pending`, `stale` and verified zero are distinct states.

## Cross-validation
`lib/runtime-dependency-graph.js` is the executable invalidation graph. `scripts/contract-dependency-closure-smoke.mjs` validates that every contract refresh trigger reaches the contract and every declared consumer appears in its dependency closure. The registry and dependency graph therefore fail together if they drift.

## Current contract families
- Physiology/recovery: `wellness.current`, `recovery.current`.
- Training: `training.session`, `training.evidence`, `athlete.memory`, `training.identity`, `training.intent`.
- Longitudinal load/performance: `trends.ncl`, `load.rolling`, `performance.aet`.
- Event/objective intelligence: `event.intake`, `event.format`, `event.intelligence`, `objective.graph`.
- Capability intelligence: `capability.evidence`, `capability.priority`.
- Adaptive decision stack: `materiality.current`, `adaptive.context`, `recommendation.current`, `adaptive.choice`.

## Event knowledge rule
A newly scheduled event can exist as context before FZ understands its format. It cannot influence capability priority or adaptive context until athlete-supplied structure or adequate research qualifies the format. Unknown event structure is never converted into guessed relevance.
