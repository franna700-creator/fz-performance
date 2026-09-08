# FZ Performance Atomic Runtime-State Publication Protocol

This protocol governs all FZ Performance runtime-state publications to the canonical `fz-performance-state` project, including the separated 06:30 and 20:30 SAST scheduled publish/verify runs, 07:30 / 21:30 watchdogs, and explicit `MANUAL_AD_HOC` publications governed by `docs/MANUAL_STATE_PUBLICATION.md`.

## Invariants

1. The reconciled Google Drive master is canonical. Connectors never publish directly.
2. `PWA State` is the canonical render contract.
3. A runtime generation is immutable after publication.
4. `generationId` is the SHA-256 of the complete gzip payload.
5. A publication must be monotonic: new `stateId` > live `stateId` unless the exact validated candidate is already live, in which case the publisher no-ops and verifies.
6. Production changes only through a complete validated Vercel deployment. Never replace live generation files one-by-one.
7. A competing/newer publisher wins. If the live base generation changes while a run is preparing, the older run aborts and restarts once from the new base or exits if its candidate is no longer eligible.
8. Failure preserves the previous production deployment and last-known-good state.
9. State publication never deploys or mutates the PWA shell.
10. Manual publication may accelerate an already validated state but must never weaken any scheduled-publisher gate.

## Run types and cadence

### PRIMARY
- 06:00 SAST intelligence/reconciliation → 06:30 SAST publish/verify
- 20:00 SAST intelligence/reconciliation → 20:30 SAST publish/verify

### WATCHDOG
- 07:30 and 21:30 SAST verification/recovery slots.
- If the intended cycle is already current and verified, no deployment occurs.
- If a valid candidate became ready late, it may be published under the same gates.

### MANUAL_AD_HOC
- Triggered by an explicit user request after a material intraday change has already been reconciled and validated into `PWA State`.
- Not tied to the routine clock.
- Requires an explicit auditable manual-publication handoff in `PWA State` metadata.
- Uses exactly the same build, lease, atomic deployment and verification path as PRIMARY/WATCHDOG.
- Does not create a new recurring intelligence/publish cadence.

`nextRefreshAt` always points to the next intelligence cycle: 20:00 after the morning intelligence period and 06:00 next day after the evening intelligence period. A manual publication does not redefine this cadence. There is no 13:00 cycle.

## Publication-readiness gate

Before building any generation, require:
- a complete candidate sourced solely from validated `PWA State`;
- `masterValidated=true`;
- `publication_status=READY_FOR_PUBLISH`;
- v0.6.1-compatible schema/shell contract;
- `scheduleSAST=[6,20]`;
- required TODAY/TRENDS/TRAIN/SYSTEM content and datasets, including `WELLNESS_HISTORY`;
- no unexpected content thinning or historical regression;
- strictly newer candidate stateId than live production unless exact candidate is already live;
- for MANUAL_AD_HOC, an explicit manual publication request recorded in `PWA State` and a candidate/masterAsOf consistent with that request.

PRIMARY/WATCHDOG runs additionally require the candidate to be eligible for the intended scheduled cycle. MANUAL_AD_HOC runs are exempt from the clock/cycle-slot requirement but from no other gate.

## Package layout

```text
current.json
generations/
  <current-generation-sha256>/
    manifest.json
    state-01.bin
    state-02.bin
    ...
  <previous-generation-sha256>/
    manifest.json
    state-01.bin
    state-02.bin
    ...
```

The package should retain the immediately previous validated generation whenever available so the application gateway can recover server-side without relying on browser storage.

## Generation build

1. Require an eligible publication-ready state under the resolved run type.
2. Produce the complete runtime JSON state solely from validated `PWA State`.
3. Validate the state against `schemas/runtime-state.schema.json` and product content-parity requirements.
4. Serialize once; compute uncompressed SHA-256.
5. Gzip deterministically; compute compressed SHA-256. This is `generationId`.
6. Split gzip bytes into bounded chunks.
7. Compute each chunk's exact byte count and SHA-256.
8. Write immutable chunk paths under `/generations/<generationId>/`.
9. Write `manifest.json` using `schemas/state-generation-manifest.schema.json`.
10. Read back/reconstruct the generation and verify both hashes and JSON contract before it is eligible for production.

## Optimistic publication lease

At run start, read live `current.json` and record `baseGenerationId`, `pointerVersion` and live `stateId`.

Immediately before publication, read the live pointer again. Abort/restart if any of those base values changed. This prevents a delayed publisher from overwriting a newer generation produced by another publisher.

If the changed live pointer already represents the exact candidate, deploy nothing and continue with verification as `ALREADY_CURRENT_VERIFIED`. If it represents a different newer state that supersedes the candidate, do not overwrite it with the older candidate.

The new pointer uses `pointerVersion = old.pointerVersion + 1`, records `baseGenerationId`, sets the new generation as `current`, and carries the old current generation as `previous`.

## Atomic production switch

Deploy one self-contained `fz-performance-state` production package containing the new current generation, retained previous generation and the new `current.json`. Vercel's production alias switch is the commit point. Do not emulate atomicity by sequentially redeploying chunk filenames.

After READY:

1. Fetch production `current.json` and verify pointerVersion/current generation/stateId.
2. Fetch and validate the immutable current manifest/chunks.
3. Fetch `https://fz-performance-mvp.vercel.app/api/runtime-state`.
4. Require HTTP 200, matching `X-FZ-State-Id`, `X-FZ-State-SHA256`, `X-FZ-State-Generation` and `X-FZ-State-Source=current`.
5. Confirm `masterValidated=true`, shell/runtime compatibility, and required TODAY/TRENDS/TRAIN/SYSTEM plus longitudinal TRENDS content.
6. Confirm semantic data integrity, including `WELLNESS_HISTORY`, current-day LIVE/PARTIAL status, completed historical preservation and activity deduplication.
7. Run the real production browser smoke on desktop and mobile/touch.
8. Record the publication ledger/receipt, including resolved run type.

If verification fails, restore the last-known-good state-project deployment/alias where possible and do not modify the PWA shell.

## Outcomes

Use exactly one:
- `PUBLISHED_AND_VERIFIED`
- `ALREADY_CURRENT_VERIFIED`
- `SKIPPED_NOT_PUBLICATION_READY`
- `FAILED_PUBLISH_OR_VERIFY`

Manual means publish sooner, not publish differently.
