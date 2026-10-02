# Stage 2 — Acceptance Evidence Matrix

Date: 2 October 2026  
Parent: #49  
Acceptance programme: #56

## Status

The deterministic regression lane is now complete across all 14 Stage 2 scenarios.

This does **not** by itself close Stage 2. Lane A still requires genuine Production athlete/source behaviour to prove the same chain after the Stage 2 software bundle is released:

**Athlete Voice / source evidence → canonical persistence → relationship reconciliation → materiality → dependency invalidation/recompute → affected surfaces**

The regression fixture in `fixtures/stage2-acceptance-matrix.json` intentionally contains no Francois-specific outcomes or synthetic Production history. It maps each acceptance scenario to quality-gated deterministic tests.

## Coverage

| Scenario | Deterministic status | Primary regression evidence |
|---|---|---|
| S2-01 Natural current-state feedback | COVERED | ingestion coverage + architecture golden thread |
| S2-02 Post-session feedback after execution | COVERED | choice outcome + golden thread |
| S2-03 Feedback before source sync | COVERED | Athlete Memory late binding + golden scenarios |
| S2-04 Stopped/aborted/skipped session | COVERED | materiality + athlete ingest |
| S2-05 Materially modified/contaminated execution | COVERED | monotonic training evidence + measurement evidence |
| S2-06 Local pain/tissue/function constraint | COVERED | Current Athlete Context + readiness + convergence |
| S2-07 New event | COVERED | canonical objective mutation + event intelligence |
| S2-08 Event/objective change | COVERED | objective mutation + runtime variability + recommendation trigger |
| S2-09 Athlete override | COVERED | ingestion coverage + choice outcome + Athlete Mode auth |
| S2-10 Later richer evidence | COVERED | monotonic evidence + Tredict detail fallback |
| S2-11 Composite workout Athlete Voice | COVERED | dedicated composite Athlete Memory gate |
| S2-12 Non-material information | COVERED | materiality + propagation |
| S2-13 Material response changes decision | COVERED | materiality + recommendation trigger + propagation |
| S2-14 Safety-relevant state | COVERED | materiality safety override + recommendation shadow |

## Gap-closure software now on main

Before this matrix could honestly become 14/14 deterministic coverage, Stage 2 closed the confirmed implementation gaps:

- dynamic objective/event mutation is a typed canonical runtime operation;
- objective persistence supports unclassified and athlete-structure-required event semantics;
- athlete-described future training intent has a canonical planned-intent operation;
- bounded travel/equipment/schedule/fuelling/environment/lifestyle/preference context can persist in Current Athlete State and affect later decision identity;
- FOREARM is a distinct local-tissue subject;
- Intervals.icu provides an autonomous completed-activity transport backstop while Tredict credential continuity remains unresolved;
- composite Athlete Voice can relate to several workout fragments without false one-to-one event ownership.

## Remaining Stage 2 closure work

1. Release the current Stage 2 software bundle through the controlled staged exact-build path.
2. Validate the new Production contracts read-only after promotion.
3. Exercise Lane A naturally from genuine athlete/source behaviour; do not insert fake athlete data.
4. Repair/re-authorise the Tredict Production Personal API credential when a valid credential is available. Intervals activity continuity reduces the operational impact but does not recreate Tredict-specific detail.
5. Record PASS/FAIL against #56 from complete traces, not from endpoint existence alone.

Stage 2 is therefore **deterministically regression-ready, not yet live-accepted**.
