# FZ Performance — Recommendation Explainability Contract

Status: PREPARED ARCHITECTURE · item 29

## Required reasoning chain

Every future adaptive recommendation must be explainable as:

**evidence → interpretation → objective relevance → recommendation → uncertainty**

The contract preserves machine-auditable evidence and provenance while separately carrying athlete-facing language.

## Required content

A valid explanation declares the recommendation ID and lane, evidence references with provenance/quality, interpretations, explicit connection to the active objective and measurement priorities, why the chosen lane is appropriate, expected benefit and recovery cost, relevant stop/modify conditions, uncertainty/unknowns and athlete-facing wording.

Counterfactual lane context is retained where useful: why ABSORB, MAINTAIN or ADAPT was not preferred today. This is not a requirement to write three mini-essays to the athlete; it is decision auditability.

## Human-facing rule

The athlete-facing explanation should communicate the decision rather than dump telemetry. Metrics may appear when genuinely decision-relevant, but strings of HRV/RHR/NCL/etc. are evidence, not prose.

The preferred progression remains **data → meaning → human context**.

## Activation boundary

This contract does not activate Tranche 4.2 recommendation recomputation. It defines the standard that 4.2 must satisfy when it is implemented.
