# Tranche 4.4 — Session Composer Preparation

Status: **preparatory design only**. No runtime activation, PWA exposure, deployment aperture or production mutation is authorised by this document.

## Objective

Tranche 4.4 composes and ranks concrete session options **after** Tranche 4.3 has established the active ABSORB / MAINTAIN / ADAPT recommendation. It must not become an alternate recommendation engine and it must not weaken the 4.2 shadow audit or 4.3 active projection boundaries.

Canonical flow:

`canonical evidence → 4.1 materiality → adaptive context → 4.2 RECOMMENDATION_SHADOW → 4.3 ACTIVE_RECOMMENDATION → 4.4 SESSION_COMPOSITION → future athlete choice → execution → response evidence`

## Non-negotiable boundary

The 4.3 `ACTIVE_RECOMMENDATION` schema remains the authoritative lane recommendation contract. Its lane arrays intentionally have `maxItems: 0` in schema version 1.0. Tranche 4.4 should therefore **not silently widen or mutate that contract**.

Preferred implementation: persist a separate, versioned `SESSION_COMPOSITION` artifact whose provenance pins it to:

- `shadowRecommendationId`;
- `active recommendationVersion`;
- `contextFingerprint`;
- active status and recommended lane;
- composer engine version;
- composition input revision/fingerprint.

A composition is valid only while those upstream identifiers still match canonical 4.3 truth. Any upstream recommendation revision invalidates the composition rather than mutating it in place.

## Proposed session option contract

Each lane may contain **0–3 ranked options**. Zero is valid when evidence is insufficient or safety/feasibility removes all candidates.

Each option should carry at minimum:

- stable `optionId` derived from semantic content, not processing time;
- `lane`: ABSORB, MAINTAIN or ADAPT;
- `rank` within lane;
- modality / session family;
- structure and dose;
- target duration, intensity and/or volume where applicable;
- expected training value and the capability/gap targeted;
- expected recovery cost;
- sequencing impact, including what subsequent higher-value session is being protected or enabled;
- success condition and stop condition;
- constraints applied from Athlete Voice / Athlete Memory;
- assumptions and missing evidence;
- confidence;
- source/provenance references sufficient to explain why the option exists.

## Composer inputs

The composer may consume only canonical or qualified upstream evidence:

1. 4.3 active recommendation and its exact 4.2 shadow provenance;
2. current adaptive context;
3. event/objective intelligence and measurement hierarchy;
4. canonical recent execution and NCL;
5. canonical Garmin wellness evidence;
6. reconciled Athlete Voice / Athlete Memory;
7. plan-vs-execution sequencing context;
8. learned response/recovery cost only where confidence is explicit.

Raw provider payloads must not bypass canonical stores and reconciliation merely because they are convenient to query.

## Ranking principles

Ranking is **lane-relative**, not a global hardness score.

- **ABSORB:** maximize useful continuity while minimizing recovery interference.
- **MAINTAIN:** preserve relevant capability with controlled incremental cost.
- **ADAPT:** maximize expected objective-relevant adaptation per recoverable cost and sequencing opportunity.

The same modality may appear in multiple lanes only when dose/structure produces materially different intended training effects. Duplicate-looking options that do not create a meaningful athlete choice should be collapsed.

## Safety and missing-data behavior

- A 4.3 `WITHHELD` recommendation yields no composed options.
- `SAFETY_OVERRIDE` remains higher order than composition or athlete preference.
- Missing evidence is never converted to zero or normality.
- Where a required constraint is unresolved, the affected option is withheld or explicitly downgraded in confidence.
- No option may infer permission for a contraindicated or blocked movement from absence of recent Athlete Voice.

## Idempotency and revision semantics

The composition payload must exclude volatile processing timestamps from its semantic hash.

Repeated composition against identical upstream revisions must produce the same semantic option IDs, ranking and composition hash. A changed Garmin/Tredict/Athlete Voice input affects 4.4 **only through canonical reconciliation/materiality and an upstream 4.3 revision or an explicitly defined composition-only dependency**; routine data evolution must never require deployment.

Late-arriving stale provider revisions must not generate a new composition if Neon canonical truth rejected them.

## Athlete-choice isolation

Composition creates choices; it does **not** select one for the athlete.

Future athlete acceptance/override should be persisted as a separate decision artifact/event referencing:

- composition version;
- selected `optionId` and lane;
- whether selection matches the FZ recommended lane;
- optional override reason;
- safety state at selection time.

An athlete choice must never rewrite the shadow audit, active recommendation or historical composition.

## UX preparation

The future TODAY surface should answer three questions immediately:

1. **What does FZ recommend today?** — one clearly dominant recommended lane.
2. **What can I actually do?** — concise ranked options with understandable dose and purpose.
3. **Why this option?** — human explanation using evidence → meaning → context, not telemetry strings.

The UI should not force the athlete to understand materiality, fingerprints, source reconciliation or internal engine versions. Those remain available for SYSTEM/diagnostic surfaces.

## Observability requirements before activation

A 4.4 diagnostic record should expose:

- upstream active recommendation ID/fingerprint;
- composition revision/hash;
- input freshness summary;
- candidate count before/after constraints;
- withheld candidate reason codes;
- final ranked option IDs;
- whether the composition is current, stale, withheld or superseded;
- no-op/idempotent recomposition count where useful for diagnostics.

No protected token, provider credential or raw sensitive source payload should be exposed to the browser diagnostic contract.

## Development sequence

1. Define and validate a standalone `SESSION_COMPOSITION` schema.
2. Build a pure composer/ranker with deterministic fixtures; no database writes.
3. Add adversarial fixtures for missing NCL, missing wellness, conflicting Athlete Voice, safety override, stale source revisions, option duplication and sequencing conflicts.
4. Add persistence as an immutable/idempotent intelligence-ledger artifact pinned to 4.3 provenance.
5. Add dependency invalidation and canonical reread checks.
6. Only then add athlete decision persistence.
7. Only after all contracts are stable should TODAY consume the composed options.

## 4.3 protection rule

Tranche 4.4 work must not require changing 4.3 recommendation semantics merely to make option generation easier. If the composer discovers a missing upstream decision input, fix that input contract explicitly rather than smuggling new coaching logic into the presentation layer.
