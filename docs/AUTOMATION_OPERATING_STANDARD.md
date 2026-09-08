# FZ Performance Automation Operating Standard

Status: ACTIVE
Product baseline: v0.6.1
Canonical ChatGPT environment: `FZ Performance Scheduled Prompt Environment`
Timezone: Africa/Johannesburg

## Purpose

This document is the durable operating contract for the production workflows that keep the FZ Performance PWA current. Scheduled prompts and one-shot manual publisher invocations should orchestrate this contract rather than accumulating incident-specific logic indefinitely.

## Canonical scheduled workflows

### A. FZ Intelligence & Reconciliation
Runs at 06:00 and 20:00 SAST.

Responsibilities:
- Use the highest available reasoning effort. This is a production-critical, multi-source reconciliation workflow and must not intentionally downgrade reasoning depth.
- Run from the ChatGPT conversation titled `FZ Performance Scheduled Prompt Environment`.
- Read Garmin/Fitness AI, Tredict, relevant athlete feedback, GitHub product contracts, and the canonical Google Drive master.
- Reconcile `Francois Training Readiness Master` first.
- Validate the master before producing a new state.
- Maintain longitudinal tables and `PWA State.datasets.WELLNESS_HISTORY`.
- Maintain the five current deep-lens summary fields in `PWA State`: `runtime_trends_recovery`, `runtime_trends_performance`, `runtime_trends_exposure`, `runtime_trends_voice`, and `runtime_trends_trajectory`.
- Produce a complete publication-ready `PWA State` only after validation passes.
- Never deploy to Vercel.

06:00 branch:
- Close yesterday from completed Garmin/master truth.
- Yesterday becomes HISTORICAL when completed data are available.
- Populate completed-day stress, steps and active calories.
- Create/update today as LIVE / PARTIAL.
- Pull overnight HRV, RHR, sleep and Body Battery data.
- Rebuild chart-ready wellness history from the reconciled master.

20:00 branch:
- Reconcile material same-day deltas, workouts and athlete feedback.
- Preserve completed historical rows unchanged unless correcting verified source data.
- Keep current day LIVE / PARTIAL.
- Never use partial-day stress, steps or active calories as completed-day baseline observations.

### B. FZ Publish & Production Verify
Primary runs at 06:30 and 20:30 SAST. Watchdog verification runs may occur at 07:30 and 21:30 SAST.

Responsibilities:
- Use the highest available reasoning effort.
- Run from the ChatGPT conversation titled `FZ Performance Scheduled Prompt Environment`.
- Never perform Garmin/Tredict intelligence or master repair.
- Accept only a `READY_FOR_PUBLISH`, `masterValidated=true` candidate from `PWA State` that is eligible for the resolved run type.
- Validate schema, content parity, longitudinal history integrity and runtime compatibility.
- Map the five canonical `runtime_trends_*` PWA State fields into `runtimeState.renderContract.trends` as `{recovery, performance, exposure, voice, trajectory}` without dropping or paraphrasing them. This object is required by the v0.6.1 interactive deep-lens runtime and production smoke contract.
- Publish atomically only to `fz-performance-state`.
- Never mutate or redeploy `fz-performance-mvp` during routine state refreshes.
- Verify the production gateway and the real PWA before claiming success.

Watchdog behavior:
- If the intended cycle has already been published and verified, no-op and report `ALREADY_CURRENT_VERIFIED`.
- If the current-cycle candidate became ready after the primary publish slot, publish and verify it.
- If it is still not publication-ready, preserve production and report the exact failing gate.

## Manual ad-hoc state publication

A validated intraday state may be published on explicit user request without waiting for the next routine publish slot. This is run type `MANUAL_AD_HOC` and is governed by `docs/MANUAL_STATE_PUBLICATION.md` plus the same state-publication protocol used by the scheduled publisher.

Manual publication rules:
- It is a state-only publication mode, not a new intelligence cycle and not a product release.
- It may run only after the canonical master has already been reconciled and `PWA State` is complete, `masterValidated=true` and `READY_FOR_PUBLISH`.
- It must have an explicit auditable manual publication request in `PWA State` metadata.
- It is not required to align to 06:30 / 07:30 / 20:30 / 21:30.
- It does not alter `scheduleSAST=[6,20]` or the normal `nextRefreshAt`.
- It must use the same optimistic lease, monotonic stateId rules, immutable generation build, content-parity gate, rollback behavior and three-level verification as the scheduled publisher.
- It publishes only to `fz-performance-state` and never mutates or redeploys `fz-performance-mvp`.
- If the exact candidate is already live, it must no-op and verify rather than redeploy.
- If a newer publisher wins, the older manual candidate must not overwrite it.

The canonical interactive-chat trigger is a single-use publisher invocation that re-reads the current GitHub contracts at execution time. Manual means publish sooner, not publish differently.

## Pre-flight rules

Before any write or deployment, confirm:
1. Correct product baseline and canonical GitHub repository.
2. Canonical master is reachable.
3. Required connectors are reachable for the intelligence task.
4. Current production state/pointer is readable.
5. The run type is resolved as PRIMARY, WATCHDOG or MANUAL_AD_HOC.
6. Required schemas and product contracts are readable.
7. The workflow is operating in the canonical scheduled-prompt conversation context where available, or in a single-use manual publisher invocation explicitly governed by `docs/MANUAL_STATE_PUBLICATION.md`.

If the execution environment explicitly reports a lower-than-required reasoning mode, missing required tools, missing canonical data, or an incompatible product contract, fail closed. Do not substitute a shortened or partial workflow.

## State integrity invariants

- Master first, always.
- Exactly one intended daily wellness record per date/grain.
- Only the current date may normally be LIVE / PARTIAL.
- Completed historical days must not become thinner over time.
- A completed historical row may not lose stress, steps, active calories, provenance or retained exact readiness values once validated.
- `WELLNESS_HISTORY` is runtime data, not hard-coded shell history.
- `runtimeState.renderContract.trends` is required runtime data for v0.6.1 and must contain non-empty `recovery`, `performance`, `exposure`, `voice`, and `trajectory` strings sourced from the canonical `PWA State` deep-lens fields.
- Preserve genuine gaps; do not fabricate missing Garmin data.
- Readiness history is forward-only and uses exact retained contemporaneous values only.
- Deduplicate Garmin/Tredict activity overlap.
- Preserve Observation / Inference / Coaching Judgment separation.
- Separate systemic/autonomic readiness from local tissue/function.

## Regression / content-parity gate

Before publication compare the candidate with the current validated production state. Reject unexpected loss of:
- TODAY / TRENDS / TRAIN / SYSTEM content;
- required datasets;
- completed historical wellness fields;
- longitudinal observations;
- training exposures;
- athlete feedback;
- trend interpretations;
- current-day decision context;
- the five deep-lens current-summary fields required to build `runtimeState.renderContract.trends`.

A newer state may update or add data; it must not silently remove previously validated information.

## Three-level production verification

### Level 1 — transport
Verify stateId, generation, checksum, pointer, schema, gateway headers and `masterValidated=true`.

### Level 2 — semantic data
Verify:
- current date is correct;
- current day is LIVE / PARTIAL;
- yesterday is HISTORICAL after the morning close where source data are available;
- yesterday's completed stress/steps/active calories are present;
- latest overnight values match the reconciled master;
- expected activities exist exactly once;
- `WELLNESS_HISTORY` survived publication intact;
- `runtimeState.renderContract.trends` contains all five non-empty current deep-lens summaries.

### Level 3 — product behavior
Exercise production as a user on desktop and mobile/touch:
- TODAY, TRENDS, TRAIN and SYSTEM open;
- TRENDS loads the longitudinal layer first;
- wellness metric tabs work;
- graph scrubbing works;
- latest/current day is correct;
- previous completed day can be selected and displays completed values;
- STATE / RESPONSE / PERFORMANCE / COST / ATHLETE VOICE / TRAJECTORY lenses render;
- RESPONSE / PERFORMANCE / COST / ATHLETE VOICE / TRAJECTORY contain the current master-validated runtime update card generated from `renderContract.trends`;
- required legacy supporting charts remain usable.

Only after all required verification levels pass may the workflow report that the PWA is updated successfully.

## Publication outcomes

Use explicit outcomes only:
- `PUBLISHED_AND_VERIFIED`
- `ALREADY_CURRENT_VERIFIED`
- `SKIPPED_NOT_PUBLICATION_READY`
- `FAILED_PUBLISH_OR_VERIFY`

## Core operating principle

No inference without reconciliation.
No state without validation.
No publish without an explicit eligible handoff.
No success without production verification.
No historical data may silently disappear.
