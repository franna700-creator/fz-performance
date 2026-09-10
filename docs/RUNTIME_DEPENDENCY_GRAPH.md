# FZ Performance Runtime Dependency Graph

Status: RELEASE ARCHITECTURE CONTRACT — RC7.

The executable graph lives in `lib/runtime-dependency-graph.js`. Refresh is dependency-driven, not page-driven.

## Core invariant
When canonical truth changes, every transitive dependant is invalid until reread/rederived or explicitly proven unaffected. Page components never decide independently whether athlete truth is stale.

## Canonical closures
`Garmin wellness -> wellness.current -> recovery.current -> materiality/adaptive context -> TODAY/TRENDS`

`Tredict/Garmin activity -> training.session + training.evidence -> identity/intent/NCL/AET/capability evidence -> rolling load/materiality/adaptive context -> TODAY/TRAIN/TRENDS/SYSTEM`

`Athlete feedback -> athlete.memory -> late-binding reconciliation -> recovery/identity/capability/materiality/adaptive context -> affected surfaces`

`Event communication/research -> event.intake -> event.format -> event.intelligence -> capability evidence/priority -> adaptive context -> affected surfaces`

`Objective change -> objective.graph -> event intelligence/capability priority -> adaptive context -> recommendation state`

## Drift prevention
The graph is validated against `lib/data-contract-registry.js`. Every declared refresh trigger must reach its owned contract and every declared consumer must exist in the dependency closure. This makes architecture-wide propagation an executable invariant rather than documentation.
