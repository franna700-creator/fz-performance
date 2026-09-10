# FZ Performance v0.7.0 Acceptance Gate

A release is not complete because it builds. It passes only when the following remain true in the exact release candidate and in production.

## Dynamic source behaviour

- Persisted physiology and training render without waiting for upstream source calls.
- Garmin physiology source check occurs on initial load, 5-minute visible cadence and stale wake-up; manual refresh works.
- Training source reconciliation occurs on initial load, 5-minute visible cadence and stale wake-up; manual sync works.
- Successful source persistence causes immediate canonical reread across TODAY / TRAIN / TRENDS / SYSTEM.
- Routine data movement requires zero shell deployments.

## Athlete Memory

- Clear in-session/post-session feedback can late-bind after execution evidence arrives.
- Pre-workout CONTEXT is not force-linked simply because a workout later occurs that day.
- Multiple plausible sessions require semantic/time evidence and a confidence margin; ambiguity remains visible rather than guessed.
- Late links are auditable through `payload.linkResolution`, source EVIDENCE linkage and a SYSTEM `LINKED` event.

## Training identity

- Raw source title/sport identity remains retained.
- User-facing title can become more specific only from stronger source/athlete evidence.
- Every canonical session exposes derived modality, ABSORB/MAINTAIN/ADAPT historical intent, confidence and basis.
- Low-confidence historical sessions are not invented into detailed modalities.

## Trends / NCL

- Evidence policy is `MONOTONIC_BEST_AVAILABLE`.
- New sparse source versions cannot erase previously observed HR-zone/running detail.
- A canonical training day with missing HR-zone detail is `PENDING_DETAIL`/null, never zero.
- 8 Sep 2026 remains a regression anchor: whole-day NCL ~66.32 despite later sparse source refreshes.
- 9 Sep 2026 is either positively derived when HR-zone detail is present or explicitly pending; never false zero.
- Matched AET and Running Relationship sets are generated from current canonical evidence rather than a fixed expected-date list.
- Rolling NCL is allowed to change as new real training arrives; smoke tests validate rules, not yesterday's total.

## UI consistency / observability

- Common button, status, card, spacing, focus and mobile behaviour is consistent across TODAY/TRENDS/TRAIN/SYSTEM.
- SYSTEM shows Tranche 4.1 Adaptive Intelligence.
- SYSTEM shows Dynamic Runtime Integrity: source freshness, late-link state, NCL detail state, monotonic evidence protection and descriptive historical intent mix.
- Desktop and 390px mobile have no material horizontal overflow.

## Tranche 4 boundary

- v0.7 may classify historical sessions into ABSORB/MAINTAIN/ADAPT descriptively.
- v0.7 does not automatically recompute recommendations from 4.1 materiality.
- v0.7 does not expose an active athlete override control.
- Adaptive Choice schema exists only as a prepared versioned contract.
- Tranche 4.2/4.3/4.4 own recomputation, athlete choice and session composition respectively.

## Release/deployment

- Automatic Vercel Git deployments remain disabled.
- One deliberately pinned Preview is tested first.
- The exact tested candidate is promoted to production.
- Production smoke runs against dynamic invariants and current canonical data.
- Rollback target is known before promotion.


## FZ design-system acceptance
- FZ brand yellow is `#f5cf19` and brand black is `#050505` through one authoritative token sheet.
- The design-system stylesheet loads after feature/layout styles.
- TODAY/TRENDS/TRAIN/SYSTEM share control, focus, surface, status and typography semantics.
- Touch-oriented controls use a 44 px minimum height.
- Keyboard focus is visible and reduced-motion preference is honoured.
- LIVE motion is subtle and tied to truthful freshness state only.

## Systemic-fix acceptance
- No release fix is date-specific runtime logic.
- Every repaired defect has an invariant-level check.
- A source update propagates to all dependent canonical/derived surfaces.
- Late-arriving, sparse and ambiguous evidence are explicitly covered by tests.
- Routine production health is version-tolerant; strict release acceptance is candidate-pinned.

## Objective / architecture intelligence gate
- Event/objective registry validates with HYROX remaining PRIMARY.
- Deadly Dozen proximity cannot promote it above HYROX strategic priority.
- Hoka 1:50 target is represented as a secondary performance objective.
- Deadly Dozen sub-60 is represented as validation, not an active development target.
- Deadly Dozen/HYROX share compromised-running transfer without event equivalence.
- Evergreen maintenance remains dormant while a primary event exists and is only surfaced as a candidate afterwards.
- Data-contract registry and dependency graph checks pass.
- Systemic reconciliation sweep detects false-zero load and unresolved relationship drift.

## Event intelligence ingestion gate
- A newly communicated event can be stored as scheduled context before its race structure is known.
- Name/date alone cannot contribute capability priority or recommendation value.
- Event structure must be athlete-confirmed or researched to an adequate standard with retained provenance.
- Qualified event profiles expose running/locomotion structure, station/movement structure, transitions and demand descriptors.
- Cross-event overlap is directional, capability-scoped and never treated as equivalence by default.
- Transfer potential remains separate from net training value; recovery/opportunity cost belongs to Tranche 4.2.
- Unqualified events are excluded from capability priorities and surfaced as `RESEARCH_REQUIRED` rather than guessed.
- Deadly Dozen UJ uses the athlete-confirmed Sunday 20 Sep 2026 date; the prior external discrepancy is provenance only.
