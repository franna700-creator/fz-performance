# FZ Performance

Canonical source for the FZ Performance PWA shell and its dynamic runtime contracts.

## Operating model

- **LIVE SOURCE REFRESH**: Garmin physiology and Tredict/Garmin training evidence update independently of shell deployment. Persisted Neon state paints first; sources check in the background; successful persistence causes immediate canonical reread.
- **INTELLIGENCE STATE**: scheduled FZ interpretation/recommendation state remains versioned and separate from live metric freshness. Normal intelligence cadence is 06:00 / 20:00 SAST.
- **PRODUCT RELEASE**: UI, interaction, derivation capability or schema change. One deliberate pinned Preview, browser acceptance, then exact-candidate production promotion.
- **PLATFORM RELEASE**: hosting/routing/runtime transport/security. Strictest gate.

## v0.7 systemic dynamic runtime baseline

v0.7 makes dynamic truth a product invariant across physiology, training, Athlete Memory and Trends.

Training source ingestion is append-only. Derivations follow `MONOTONIC_BEST_AVAILABLE`: newer evidence wins where present, while older richer evidence can fill fields that a newer sparse payload omits. This prevents live refresh from making known NCL/running evidence disappear.

Athlete Memory can late-bind. Pre-workout context may remain standalone, but clear in-session/post-session feedback is re-evaluated whenever canonical workout evidence arrives and links automatically when confidence is sufficient.

Raw source labels remain provenance. The PWA may derive a more useful canonical workout identity from Tredict, Garmin and linked Athlete Memory, with explicit confidence. Historical ABSORB / MAINTAIN / ADAPT intent is descriptive only in v0.7.

SYSTEM exposes both Tranche 4.1 materiality and broad Dynamic Runtime Integrity so stale/missing relationships can be seen as system state rather than discovered ad hoc from an individual page.

## Event + objective intelligence foundation

v0.7 also introduces a generic event/objective graph. Events, objectives and reusable capabilities are separate concepts:

- an event has a date, lifecycle and role;
- strategic priority is distinct from proximity;
- events map to reusable capability demands;
- secondary/validation events contribute transferable evidence without becoming interchangeable with the primary objective;
- new events can be inserted/rescheduled without changing recommendation code;
- evergreen objectives can exist independently from the race calendar;
- dynamic event/objective persistence is prepared as migration 005 but remains inactive until the release migration gate.

Current seeded planning hierarchy is explicit: HYROX Johannesburg 28 Nov 2026 is PRIMARY; Hoka Half Marathon Pretoria 24 Sep carries the explicit 1:50:00 secondary target; Deadly Dozen UJ is a VALIDATION event where sub-60 is desirable but not an active development target.

## Event-format intelligence

A race name is not enough evidence for FZ to infer its training value. New events enter an event-knowledge gate. Athlete-described or adequately researched structure is converted into a reusable demand fingerprint; unknown structure remains `RESEARCH_REQUIRED` and cannot influence capability priority until resolved.

Deadly Dozen and HYROX are therefore not represented simply as two HYBRID events. Their exact run/station structures are retained and transferable elements are mapped explicitly. Deadly Dozen can strengthen evidence for compromised running, transitions, farmer carry, burpee-broad-jump locomotion, lunging and general strength-endurance while leaving HYROX-specific ergs, sleds, wall balls and 1 km compromised-running repeatability under-measured.

`TRANSFER_POTENTIAL` is deliberately separate from `NET_TRAINING_VALUE`; event similarity is not an automatic recommendation to race.

## FZ design and systemic repair contract

`src/fz-design-system.css` is the authoritative visual semantics layer and must load last. FZ black `#050505` and FZ yellow `#f5cf19` are canonical brand anchors. All pages share surface, type, control, focus, status and chart semantics. Motion is reserved for truthful living-state transitions and honours `prefers-reduced-motion`.

Repairs follow `docs/SYSTEMIC_REPAIR_STANDARD.md`: diagnose the owning layer, state the invariant, repair the earliest safe layer, reconcile dependants, test the invariant, and verify every affected surface. Date-specific hard-coding is permitted only as an explicit migration/backfill after the systemic rule exists.

The intended outcome is **fix once, stay fixed**: source refreshes propagate through canonical persistence, reconciliation, derivation, intelligence and presentation without shell deployments.

## Data contracts + dependency graph

`lib/data-contract-registry.js` is the canonical contract catalogue for current decision-driving data. It declares each concept's owner, source/derivation, freshness class, missing semantics, fallback, provenance, primary UI home and downstream consumers.

`lib/runtime-dependency-graph.js` defines the transitive invalidation path from source evidence through canonical truth, derivations, intelligence and UI surfaces. `scripts/contract-dependency-closure-smoke.mjs` cross-checks the two so they cannot silently drift apart.

A new workout, Garmin wellness refresh, athlete feedback, event change or objective change should invalidate the dependency graph once; pages reread the resulting truth rather than maintaining their own refresh logic.

## Data and UI ownership

- Neon is the operational runtime truth.
- Drive remains an audit/human representation, not the app data backend.
- Static HTML is a neutral shell; athlete-state values live in runtime APIs.
- TODAY owns current state and recommendation.
- TRENDS owns longitudinal change and performance relationships.
- TRAIN owns canonical training execution and Athlete Memory.
- SYSTEM owns source/freshness/provenance and adaptive-intelligence observability.

## Release gate

Pre-release changes are prepared off-branch/off-Vercel. Before production:

1. create one exact candidate commit;
2. run full repository CI/build;
3. confirm deployment quota/headroom;
4. create one pinned Vercel Preview;
5. verify desktop/mobile rendered UI and live APIs against that exact deployment;
6. run candidate-pinned release smoke;
7. promote that exact candidate only;
8. verify production readback and keep rollback ready.

Routine data refreshes do not deploy.
