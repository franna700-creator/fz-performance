# Tranche 4.2 — Recommendation Recomputation (Shadow)

Date: 2026-09-10
Status: IMPLEMENTED IN SHADOW · NOT ACTIVE COACHING POLICY
Engine: `4.2.0-shadow.1`

## Objective

Tranche 4.2 turns the 4.1 `RECOMPUTE_RECOMMENDATION` requirement into an actual, versioned evaluation while preserving a hard activation boundary: shadow output may be observed and audited, but it may not overwrite `recommendation.current` or alter TODAY.

The decision question is:

> Given the athlete's current recoverability, recent execution and load, the active primary objective, qualified event context, measurement priorities, sequencing and uncertainty, which training-intent lane has the highest expected value now?

## Inputs

The shadow engine composes canonical context from Neon runtime state, persisted wellness, canonical training/Trends evidence, Athlete Memory/materiality, the runtime objective graph, qualified event intelligence and the primary-objective measurement hierarchy.

A near-term event may influence sequencing only after its event structure is qualified. Proximity never promotes a secondary or validation event over the primary objective.

## Lane semantics

`ABSORB` protects recovery and the next useful training opportunity.

`MAINTAIN` preserves capability while avoiding unnecessary new recovery cost.

`ADAPT` deliberately creates useful stimulus against the active objective or a high-priority evidence opportunity.

An unmeasured capability remains `UNKNOWN`, never `WEAK`. A measurement gap can justify gathering evidence; it is not proof that the athlete lacks the capability.

## Decision hierarchy

1. Safety overrides ordinary scoring and resolves to ABSORB.
2. No active primary objective means the recommendation is withheld. Dormant evergreen maintenance is never silently activated.
3. An unqualified primary event structure or unavailable primary measurement hierarchy withholds the decision.
4. Material recovery/constraint evidence can bias ABSORB.
5. High recent load, repeated recent ADAPT exposure, or an imminent higher-value planned ADAPT session biases MAINTAIN.
6. Qualified near-term secondary/validation events can bias cost control without replacing the primary objective.
7. Good recoverability plus available capacity and a valuable measurement/adaptation opportunity can support ADAPT.
8. Missing decision context lowers confidence and biases conservatively rather than fabricating precision.

## Versioning and persistence

The recommendation ID is derived deterministically from decision-relevant canonical context. Re-evaluating unchanged evidence does not manufacture a new recommendation version.

Shadow evaluations are persisted idempotently in the existing append-only FZ intelligence ledger as `contextType = RECOMMENDATION_SHADOW`. No new database table or schema migration is required.

## Activation boundary

`recommendation.shadow` is a separate canonical contract from `recommendation.current`.

There is intentionally no dependency path from `recommendation.shadow` to `recommendation.current` or `ui.today`. Shadow results are visible only through SYSTEM observability until a later controlled activation decision. Tranche 4.3 remains responsible for athlete accept/override interaction.

## Failure isolation

When athlete feedback triggers 4.2, Athlete Memory and the 4.1 materiality record persist first. Shadow recomputation is downstream and failure-isolated; a 4.2 error may not roll back or invalidate athlete evidence ingestion.

## Exit gates

4.2 shadow is ready for deployment consideration only after full inherited CI, runtime objective graph reconciliation, real canonical-data dry-run, repeated adversarial regression passes, dependency-closure proof, and explicit confirmation that TODAY remains unchanged.
