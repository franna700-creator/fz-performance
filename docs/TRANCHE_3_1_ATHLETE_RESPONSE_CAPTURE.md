# Tranche 3.1 — Athlete Response Capture Hardening

Date: 2026-09-09

## Scope

Athlete response is captured project-wide across the ChatGPT **Exercise** project. It is not tied to one chat thread. Any chat in the Exercise project may supply valid FZ athlete feedback.

Chat is the primary athlete-response input. Francois should speak naturally; no special prefix, form or command is required.

## Capture trigger

A first-person statement is a candidate Athlete Memory event when it materially describes one or more of:
- current state/readiness;
- session experience or outcome;
- perceived cost/fatigue/DOMS;
- recovery or next-day response;
- fueling/hydration context;
- pain, symptoms, constraints or limitations;
- training modification, stop, abort or skip;
- an athlete-supplied causal hypothesis.

Routine conversation that does not contain athlete-state/training information is not ingested.

## Speaker rule

FZ Performance belongs to Francois.

A message may be ingested only when the active speaker is:
- `CONFIRMED` as Francois; or
- `INFERRED_HIGH_CONFIDENCE` as Francois from project context.

If speaker attribution is materially unclear, ingestion must wait for confirmation. Neelechia's personal feedback must never be silently written into Francois's Athlete Memory.

## Evidence semantics

- Athlete-stated information is `REPORTED`.
- Athlete causal speculation is retained separately as `HYPOTHESIS`.
- Garmin/Tredict evidence is `OBSERVED`.
- FZ classification/session matching is `INFERRED`.

FZ may infer categories and relationships, but must not invent how the athlete felt from wearable metrics.

## Time semantics

Two timestamps are first-class for forward Athlete Memory:

- `reported_at` — when the athlete supplied the feedback in chat.
- `occurred_at` — when the described state/event actually happened.

If no separate occurrence time is supplied or safely inferable, `occurred_at = reported_at` and occurrence precision is `report-time`.

If the athlete says, for example, "my quads became sore around 22:00 last night" at 08:00 the next morning, FZ preserves both the approximate 22:00 occurrence and the 08:00 report time.

Historical events whose original report time is unavailable are not backfilled with fabricated timestamps.

## Classification

Canonical Athlete Memory categories remain:

`STATE · SESSION · COST · RECOVERY · FUELING · CONSTRAINT · HYPOTHESIS`

A single report may carry multiple categories.

## Session relationship

1. Explicit session/workout reference or confirmed user linkage: link directly.
2. Clear unique date/modality/time context: infer a relationship only above the matching threshold.
3. Ambiguous multi-session context: retain as standalone Athlete Memory or ask the athlete; never force a relationship.

Observation date/time and related training date/time remain separate facts.

## Persistence rule

Relevant athlete feedback should be persisted during the same conversational turn in which it is supplied.

The ingestion contract is idempotent. Reprocessing the same message/event must not create duplicate Athlete Memory.

The source payload retains capture scope, athlete identity, speaker-resolution method, raw statement when supplied, classification, link-resolution evidence, occurrence precision, `reported_at`, and `occurred_at`.

## Project-wide operating contract

The rule applies to **all chats inside the Exercise project**, not only the chat in which Tranche 3.1 was designed.

Operationally:

`Exercise-project chat → detect athlete feedback → resolve Francois speaker → preserve report/occurrence time → classify → link conservatively → persist → expose in TRAIN Athlete Memory → derive Athlete Voice in TRENDS`

## Boundary

Tranche 3.1 hardens capture and memory. It does not decide whether the new response is material enough to change the next-session recommendation. Materiality evaluation and adaptive recomputation belong to Tranche 4.
