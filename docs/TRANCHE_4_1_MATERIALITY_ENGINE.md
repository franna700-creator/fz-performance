# Tranche 4.1 — Materiality Engine

Date: 2026-09-09
Status: IMPLEMENTATION

## Objective

Tranche 4.1 answers one question before any adaptive recomputation occurs:

> Does this new evidence materially change FZ's understanding of the athlete or the suitability of the current next-session recommendation?

It deliberately separates **evidence capture** from **decision recomputation**.

## Architecture choice

FZ uses the Tranche 4 Option C model:

`new evidence → canonical persistence → materiality assessment → affected intelligence recompute when required → versioned intelligence/recommendation → PWA propagation`

Scheduled reconciliation remains a fallback safety net rather than the primary intelligence engine.

## Materiality levels

### `RECORD_ONLY`
The evidence belongs in memory but does not currently change athlete state or the next-session recommendation.

Examples:
- routine session feedback with no meaningful deviation;
- isolated causal hypothesis;
- wellness movement below defined material thresholds.

### `UPDATE_STATE`
The evidence changes current interpretation/state, but does not by itself require a new next-session recommendation.

Examples:
- moderate soreness or current-state feedback;
- a normal completed training exposure;
- one materially changed wellness signal;
- a previously relevant constraint reported as resolved.

### `RECOMPUTE_RECOMMENDATION`
The evidence is sufficiently material that FZ must reconsider the next-session recommendation.

Examples:
- stopped-early, aborted, skipped or materially modified training;
- high DOMS/pain or significant ongoing constraint;
- materially harder/easier-than-expected recovery response;
- multiple aligned wellness deterioration/improvement signals;
- a major load deviation;
- explicit conflict with the current recommendation.

### `SAFETY_OVERRIDE`
The current recommendation must be treated as blocked until reconsidered.

This is an FZ recommendation guardrail, not a medical diagnosis. It is reserved for explicit high-severity constraints/red flags or a structured safety flag.

## Evidence semantics

The engine accepts normalized evidence from:
- `ATHLETE_FEEDBACK`
- `TRAINING_EXECUTION`
- `WELLNESS_OBSERVATION`
- `SYSTEM_RECONCILIATION`

Athlete evidence retains Tranche 3.1 certainty semantics:
- `REPORTED` facts may affect state/recommendation;
- `HYPOTHESIS` is not promoted to fact;
- a hypothesis-only event remains `RECORD_ONLY`;
- if one report contains both a reported material fact and a hypothesis, the fact may affect materiality while the hypothesis remains explicitly non-factual.

## Deterministic rule principle

Materiality is rule-driven and auditable. It does not assign pseudo-precise readiness probabilities.

Every assessment returns:
- engine version;
- materiality level;
- reason codes;
- affected intelligence domains;
- `shouldUpdateState`;
- `shouldRecomputeRecommendation`;
- `blocksExistingRecommendation`;
- normalized structured signals used by the rule set.

## Initial rule set

The v4.1 engine includes deterministic handling for:
- session stopped/aborted/skipped/modified states;
- current athlete state/recovery/constraint feedback;
- unusually positive or negative athlete response;
- numeric pain/DOMS severity where explicitly present;
- severe GI/illness/constraint structured flags;
- high RPE/load deviations when supplied structurally;
- constraint resolution;
- multi-signal wellness changes using HRV, RHR, sleep score and Body Battery deltas;
- explicit recommendation conflict;
- explicit safety flags/red-flag text.

The thresholds are intentionally conservative. Tranche 4 should prefer a stable recommendation over unnecessary churn.

## Persistence

Tranche 4.1 does not add another mutable decision table. Assessments are persisted idempotently in the existing immutable FZ source-record ledger as:

- `source_key = fz-intelligence`
- `record_type = event_context`
- `contextType = MATERIALITY_ASSESSMENT`

The source record id contains both the materiality engine version and evidence key. This keeps assessments auditable and re-evaluable across later engine versions without mutating the original athlete/Garmin/Tredict evidence.

## Athlete feedback integration

Exercise-project athlete feedback now follows:

`Athlete Memory persistence → materiality evaluation → materiality persistence`

in the same capture transaction path.

At Tranche 4.1, a `RECOMPUTE_RECOMMENDATION` result records the requirement to recompute but **does not yet perform that recomputation**. Intelligence versioning and actual recomputation are Tranche 4.2+ responsibilities.

## Observability

`GET /api/intelligence/materiality?limit=50`

returns recent persisted materiality assessments and engine metadata.

## 4.1 exit gate

Tranche 4.1 is complete when:
1. deterministic engine tests cover all four levels;
2. hypothesis-only evidence cannot trigger recommendation recomputation;
3. athlete feedback is assessed and persisted in the same ingestion path;
4. assessment output is idempotent and auditable;
5. materiality is observable independently of the PWA;
6. no recommendation is actually recomputed yet — that boundary remains explicit for 4.2.
