# FZ Performance Manual State Publication

Status: ACTIVE
Product baseline: v0.6.1
Timezone: Africa/Johannesburg

## Purpose

This contract adds a safe on-demand publication entry point for already-reconciled FZ Performance state. It does not create a second publisher, a second Vercel project, a second intelligence cycle, or a shell deployment path.

The manual path invokes the same deterministic state publisher used by the scheduled 06:30 / 20:30 publication workflow and inherits the same validation, optimistic lease, immutable generation, rollback and three-level verification rules.

## When manual publication is allowed

A manual publication may be requested after a material intraday change has already been reconciled into the canonical master and a complete `PWA State` candidate exists.

Typical triggers include:
- direct athlete feedback that materially changes readiness, local-state interpretation or the recommended session;
- a delayed Garmin/Tredict sync that resolves an earlier uncertainty;
- a same-day workout completion or other decision-relevant update that has already been reconciled and validated;
- an explicit user request to publish the latest validated state now.

Manual publication is a STATE REFRESH only. It must never be used to deploy product-shell HTML/CSS/JS changes.

## Required handoff

Before a manual publisher may run, `PWA State` must contain:
- `candidate_state_id` strictly newer than live production;
- `master_as_of` aligned to that candidate;
- `master_validated=TRUE`;
- `publication_status=READY_FOR_PUBLISH`;
- `schedule_sast=[6,20]` and the normal `next_refresh_at` for the next intelligence cycle;
- an explicit auditable manual publication request in the publication metadata.

The manual request does not authorize intelligence recomputation. If the candidate is not already complete and validated, the publisher must report `SKIPPED_NOT_PUBLICATION_READY` and preserve production.

## Run type

Manual runs use run type:

`MANUAL_AD_HOC`

Unlike PRIMARY and WATCHDOG runs, a MANUAL_AD_HOC run is not required to correspond to 06:30, 07:30, 20:30 or 21:30. The explicit manual handoff is the trigger.

The manual run must not alter the routine intelligence cadence. `nextRefreshAt` remains tied to 06:00 / 20:00 SAST, not to the manual publication time.

## Execution path

1. Read the current GitHub operating contracts and schemas.
2. Read the latest publication-ready candidate solely from `PWA State`.
3. Read live `fz-performance-state/current.json` and production `/api/runtime-state`.
4. Require the same schema, content-parity, `WELLNESS_HISTORY`, historical-preservation and v0.6.1 compatibility gates as the scheduled publisher.
5. Establish the optimistic publication lease from live stateId, pointerVersion and generationId.
6. Build the complete runtime JSON only from validated `PWA State`.
7. Serialize once, compute uncompressed SHA-256, gzip deterministically, compute compressed SHA-256 generationId, chunk, manifest, reconstruct and verify.
8. Re-read the live pointer immediately before deploy. Abort/restart once if another publisher changed the base.
9. Publish one atomic production deployment to canonical project `fz-performance-state` (`prj_vAhaOqu3dlQibh7BbUMqjhboqwrJ`) only.
10. Never mutate or redeploy `fz-performance-mvp`.
11. Perform Level 1 transport, Level 2 semantic-data and Level 3 real-product/browser verification before success is reported.
12. Record the publication receipt/ledger and resulting production state metadata.

## Canonical interactive-chat trigger

When the user explicitly asks to publish a validated state immediately from an interactive ChatGPT conversation, the safe trigger is a one-shot publisher invocation using this contract and the same canonical publisher instructions. The invocation must be single-use and must not create a new recurring refresh cadence.

The one-shot publisher should identify itself as `MANUAL_AD_HOC`, re-read this contract at execution time, and publish the latest eligible validated candidate rather than trusting stale prompt-copied values.

## Concurrency and no-op behavior

- If another publisher has already published the exact candidate, deploy nothing and report `ALREADY_CURRENT_VERIFIED` after verification.
- If production advanced to a different newer validated state, do not overwrite it with an older manual candidate.
- If the candidate fails any gate, preserve current production.
- A manual request never weakens monotonicity, content parity, optimistic lease or fail-stale behavior.

## Outcomes

Use exactly one:
- `PUBLISHED_AND_VERIFIED`
- `ALREADY_CURRENT_VERIFIED`
- `SKIPPED_NOT_PUBLICATION_READY`
- `FAILED_PUBLISH_OR_VERIFY`

## Core principle

Manual means **publish sooner**, not **publish differently**.
