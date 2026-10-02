# Stage 2 — Ingestion Coverage Audit

Date: 2 October 2026  
Programme: #49  
Acceptance programme: #56  
Authoritative behavioural source: `docs/FZ_ATHLETE_INPUT_INTELLIGENCE_INGESTION_STANDARD.md` binding + Project Source

## Purpose

Stage 2 starts by proving what the deployed architecture can already represent and execute before adding new intelligence code.

This audit maps the information classes in the Athlete Input & Intelligence Ingestion Standard to the current canonical implementation. It distinguishes:

- **EXECUTABLE** — a typed canonical path exists and downstream propagation is owned by deployed logic;
- **REPRESENTABLE / ORCHESTRATION REQUIRED** — the current schema can represent the information correctly, but ChatGPT/operator orchestration still has to compose the runtime write because there is no single typed application mutator;
- **PARTIAL** — the source information can be preserved canonically, but a durable projection or downstream use is incomplete;
- **GAP** — the current architecture cannot correctly represent or continuously ingest the concept.

A GAP does not license an ad-hoc Production patch. Source information is preserved first; software work is separated into a controlled change.

## Existing canonical primitives

### Natural athlete feedback

`recordExerciseAthleteResponse()` is the canonical athlete-feedback write path. It:

1. normalises Exercise-project ownership, Francois athlete identity, reported/occurred time and timestamp precision;
2. persists Athlete Memory first;
3. persists materiality;
4. enriches choice-outcome evidence when a linked execution exists;
5. recomputes durable Current Athlete State;
6. propagates through the dependency graph.

Athlete Memory supports the canonical categories `STATE`, `SESSION`, `COST`, `RECOVERY`, `FUELING`, `CONSTRAINT` and `HYPOTHESIS`, plus stopped/aborted/skipped/modified and response event types.

### Training and source evidence

Canonical execution lives in `fz_training_sessions`, `fz_training_source_records`, `fz_training_session_sources` and `fz_athlete_events`. Late Athlete Memory linking and planned-intent reconciliation run after source sync. Training presentation uses monotonic best-available source evidence.

### Events and objectives

Neon owns `fz_objectives`, `fz_objective_revisions`, `fz_event_source_evidence`, `fz_event_format_profiles`, `fz_objective_capabilities` and `fz_event_transfer_assessments`. Persistence-boundary triggers put objective/event mutations into the canonical mutation outbox and the dependency graph owns downstream invalidation.

The graph is therefore representable at runtime. There is, however, no typed event/objective mutation helper equivalent to `recordExerciseAthleteResponse()` or `recordAthleteChoice()`; correct mutation currently requires orchestration across several tables.

### Athlete choice

`recordAthleteChoice()` preserves the active recommendation, the athlete-selected lane/option, override reason, immutable selected prescription, canonical planned intent and materiality. Safety override cannot be bypassed.

## Coverage matrix

| Standard input class | Canonical representation / operation | Downstream behaviour | Status | Stage 2 finding |
|---|---|---|---|---|
| Scheduled/proposed event | Objective + source evidence + optional format profile | objective graph → event intelligence → adaptive context | REPRESENTABLE / ORCHESTRATION REQUIRED | Schema and graph are ready; no single typed event mutator |
| Completed/cancelled/changed event | Objective revision + state/date mutation + source evidence | outbox invalidates objective graph/runway/transfer/recommendation context | REPRESENTABLE / ORCHESTRATION REQUIRED | Correct multi-table transaction is not encapsulated |
| Event target / performance goal | `fz_objectives.target` + objective revision | objective version token changes downstream decision identity | REPRESENTABLE / ORCHESTRATION REQUIRED | Needs canonical mutation helper + regression trace |
| Primary/secondary/validation/maintenance objective | `fz_objectives.role`, strategic weight and revision | strategic priority remains separate from proximity | REPRESENTABLE / ORCHESTRATION REQUIRED | Model is correct; mutation path is not packaged |
| Training plan / intended session | FZ adaptive choice creates canonical planned intent/session | planned intent participates in sequencing and later execution reconciliation | PARTIAL | Exact FZ-choice path works; arbitrary natural-language training intent has no generic typed plan-intent writer |
| Completed training | Canonical session + source record + execution relationship/event | training evidence → NCL/performance/capability/adaptive context | PARTIAL | Store/reconciliation works; autonomous upstream activity continuity is currently degraded |
| Change from planned training | Athlete Memory + session state + materiality | invalidates sequencing/recommendation when material | EXECUTABLE | Covered by `ATHLETE_MODIFIED` |
| Aborted / stopped / skipped session | Athlete Memory + canonical session status | `RECOMPUTE_RECOMMENDATION` and downstream propagation | EXECUTABLE | Deterministic materiality coverage exists |
| Session RPE / perceived difficulty | Athlete Memory + materiality signals | cost/response evidence; very high RPE can recompute | EXECUTABLE | Numeric RPE requires semantic extraction into materiality signals |
| Muscular soreness / local fatigue | Athlete Memory COST/CONSTRAINT + Current Athlete State where recognised | readiness/local-state/recommendation context | PARTIAL | Generic memory is durable; local-subject projection is finite |
| General fatigue | Athlete Memory STATE/COST | recent current-state projection + materiality | EXECUTABLE | Current-state projection covers recent state/cost windows |
| Motivation / psychological state | Athlete Memory STATE | retained as recent state when semantically classified | PARTIAL | Preserved, but no dedicated durable motivation dimension |
| Sleep / recovery comment | Athlete Memory STATE/RECOVERY + wellness evidence separately | readiness + adaptive context | EXECUTABLE | Subjective and objective recovery remain separate evidence |
| Hydration | Athlete Memory FUELING/context | materiality/audit history | PARTIAL | Preserved but not a durable first-class current-context dimension |
| Nutrition / fuelling | Athlete Memory FUELING | response/learning evidence, materiality if decision-relevant | PARTIAL | Preserved; durable fuelling constraints are not projected into Current Athlete State |
| GI response | Athlete Memory CONSTRAINT/FUELING + GI current-state subject | readiness/local state + recommendation when material | EXECUTABLE | GI active/resolved/staleness semantics exist |
| Environmental conditions | Athlete Memory context/raw voice | available as provenance/history | PARTIAL | No dedicated durable environmental-context projection |
| Illness / symptoms | Athlete Memory CONSTRAINT/STATE + ILLNESS_RESPIRATORY subject | readiness/local state; high/safety states can block/recompute | EXECUTABLE | Respiratory/illness family is represented |
| Pain / niggle / injury concern | Athlete Memory CONSTRAINT + subject registry | readiness/local state; materiality up to safety override | PARTIAL | Supported only for registered subject families |
| Equipment availability | Athlete Memory context | available as evidence | PARTIAL | No durable equipment-availability state consumed by later recommendation recomputes |
| Exercise preference / dislike | Athlete Memory context | available as evidence | PARTIAL | No durable preference projection/calibration input yet |
| Movement limitation | Athlete Memory CONSTRAINT + subject registry when recognised | local-state/readiness/recommendation | PARTIAL | Same finite-subject limitation as pain |
| Scheduling constraint | Athlete Memory context; exact FZ choice can set planned date/start | sequencing only when explicitly carried into current decision context | PARTIAL | No durable generic schedule-constraint projection |
| Travel / lifestyle interference | Athlete Memory context | may trigger materiality in the current turn | PARTIAL | Can be stored but is not reliably retained as governing context across later recomputes |
| Alcohol / unusual recovery stressor | Athlete Memory STATE/RECOVERY/COST | materiality and recent-state evidence | PARTIAL | Preserved; no specific durable stressor model |
| Positive/negative response to stimulus | Athlete Memory response + materiality | recompute when sufficiently material; choice outcome can be enriched | EXECUTABLE | Positive/negative response is regression-covered |
| Athlete override of FZ recommendation | `recordAthleteChoice()` decision + plan + Athlete Memory | immutable recommendation retained; choice propagates | EXECUTABLE | Authenticated PWA/runtime path exists |
| Reason for athlete decision | `overrideReason` + Athlete Voice/provenance | retained with decision and planned intent | EXECUTABLE | Part of choice identity |
| Race / event result | Objective state/target/source evidence + training execution where applicable | objective graph/capability evidence | REPRESENTABLE / ORCHESTRATION REQUIRED | No typed result/objective completion mutator |
| Performance target | Objective target or Athlete Memory depending scope | objective/adaptive context when objective-backed | REPRESENTABLE / ORCHESTRATION REQUIRED | Requires semantic routing to objective vs contextual target |
| Training observation | Athlete Memory | relationship reconciliation + materiality + adaptive context | EXECUTABLE | Core feedback path |
| Information changing interpretation of prior/future evidence | Athlete Memory + reconciliation/materiality or objective/source revision | dependency invalidation + recompute | EXECUTABLE WITH DOMAIN-SPECIFIC LIMITS | Mechanism exists; correctness depends on relevant durable projection |

## Confirmed gaps

### G1 — local-tissue subject taxonomy: FOREARM

**Classification: `SCHEMA_OR_RELATIONSHIP_GAP` (runtime taxonomy / canonical subject registry).**

`athlete-current-state.js` recognises `HAND_FINGER_GRIP`, GI, hamstring, calf, knee, ankle/foot, quad DOMS, shoulder/upper, back and respiratory illness. It does not recognise `FOREARM`.

The 22 Sep Athlete Voice was correctly preserved without forcing forearm inflammation into `HAND_FINGER_GRIP`. A controlled taxonomy extension plus regression coverage is required before FOREARM can become current canonical local-tissue state.

### G2 — autonomous training-source continuity

**Classification: `RUNTIME_RECONCILIATION_DEFECT` plus source-integration software debt.**

The canonical training store and reconciliation path are sound. Upstream autonomous acquisition is not:

- Production Tredict Personal API credential is configured but rejected upstream with HTTP 401.
- The Tredict ChatGPT integration works and 2 Oct execution was recoverable/persistable, proving the source record itself exists.
- The production Garmin activity path still calls the deprecated/disconnected Fitness AI custom OAuth source.
- Intervals.icu is healthy for daily recovery, but FZ does not yet use its activity API as an execution backstop.

This is not a schema problem. Credential repair can restore Tredict without software release. Replacing the deprecated Garmin activity transport or adding an Intervals.icu activity backstop is a controlled software integration change.

### G3 — generic durable current context is narrower than ingestion

**Classification: `ALGORITHM_GAP`.**

Athlete Memory can preserve travel, equipment, scheduling, fuelling, preference, environmental and lifestyle context. Current Athlete State deliberately projects recent STATE/RECOVERY/COST plus registered constraints. The adaptive context consumes that durable projection, not the full Athlete Memory stream.

Result: a travel/equipment/schedule/fuelling constraint can be persisted and can influence materiality in the ingest turn, but it is not guaranteed to remain active governing context during a later recomputation.

Stage 2 must define a generic, bounded current-context projection before treating these classes as fully closed. This should reuse Athlete Memory and existing intelligence storage rather than creating a competing journal/state store.

### G4 — event/objective runtime mutations are representable but not encapsulated

**Classification: `RUNTIME_RECONCILIATION_DEFECT` + `TEST_COVERAGE_GAP`.**

The schema, revision ledger, source evidence, outbox triggers and dependency graph support dynamic event/objective data. What is missing is a typed canonical mutator that atomically applies:

- event/objective create or change;
- source evidence;
- objective revision;
- participation/date/target/role semantics;
- optional format-profile linkage;
- propagation trigger.

Direct SQL orchestration can perform this correctly, so ordinary event data remains a runtime operation. Stage 2 should encapsulate and regression-test the transaction rather than repeatedly relying on bespoke SQL.

### G5 — arbitrary natural-language training intent is not a first-class planned-intent write

**Classification: `RUNTIME_RECONCILIATION_DEFECT`.**

The canonical training schema can hold planned sessions. `recordAthleteChoice()` writes an exact planned intent only when the athlete selects from the active FZ recommendation. A natural statement such as “I’m doing an easy run tomorrow morning” has no equivalent generic typed mutation path.

The existing tables should be reused; the missing piece is a safe canonical operation and reconciliation contract.

### G6 — event-intake contract is richer than objective persistence

**Classification: `SCHEMA_OR_RELATIONSHIP_GAP`.**

The event-intake schema correctly allows `role: UNCLASSIFIED` and `knowledgeStatus: ATHLETE_STRUCTURE_REQUIRED`. Production `fz_objectives` does not currently accept either value.

Without correction, FZ would have to invent a strategic role for a newly considered event or collapse “I need the athlete to describe the structure” into the broader research-required state. Both would lose canonical meaning.

Stage 2 migration 010 therefore extends the existing objective constraints, keeps `UNCLASSIFIED` at strategic weight zero, and adds a source-evidence idempotency index. The migration has been prepared and verified on a temporary Neon branch; Production has not been changed pending migration approval.

## Coverage already protected by deterministic regression

The current suite already protects:

- all four materiality levels, including `RECORD_ONLY` and `SAFETY_OVERRIDE`;
- athlete feedback persistence before materiality/current-state/propagation;
- late Athlete Memory association;
- monotonic best-available training evidence;
- adaptive choice immutability and safety precedence;
- choice → execution → response outcome evidence;
- dynamic event date windows/participation states;
- objective revision sensitivity in recommendation identity;
- dependency-graph closure across athlete feedback, training and objectives;
- no deployment requirement for routine athlete/training evolution.

The accompanying `stage2-ingestion-coverage-smoke.mjs` adds one structural acceptance gate spanning these primitives without pretending the confirmed gaps are already solved.

## 2A conclusion

The deployed architecture has a strong ingestion spine. Natural athlete feedback, modified/aborted training, current recovery/local state, materiality, propagation and adaptive choice are executable end to end.

Stage 2 should **not** begin by replacing that architecture. The next work is to close the smallest confirmed gaps in order:

1. align event-intake/objective persistence semantics, then add generic event/objective mutation orchestration and deterministic trace coverage;
2. add a generic planned-intent mutation path for athlete-described intended sessions;
3. extend durable Current Athlete Context for travel/equipment/scheduling/fuelling/preferences without duplicating Athlete Memory;
4. extend the local-tissue subject taxonomy for FOREARM;
5. restore autonomous training-source continuity: repair Tredict credential operationally, then remove the deprecated Fitness AI dependency from activity ingestion through a separately controlled integration change if required;
6. execute the #56 live matrix against genuine athlete behaviour and mark each scenario PASS/FAIL from the full trace.

No athlete data mutation and no Vercel deployment is required to record this audit.
