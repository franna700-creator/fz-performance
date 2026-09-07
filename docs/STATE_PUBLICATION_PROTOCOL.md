# FZ Performance Atomic Runtime-State Publication Protocol

This protocol governs the 06:00, 13:00 and 20:00 SAST state-only refreshes.

## Invariants

1. The reconciled Google Drive master is canonical. Connectors never publish directly.
2. `PWA State` is the canonical render contract.
3. A runtime generation is immutable after publication.
4. `generationId` is the SHA-256 of the complete gzip payload.
5. A routine publication must be monotonic: new `stateId` > live `stateId`.
6. Production changes only through a complete validated Vercel deployment. Never replace live generation files one-by-one.
7. A competing/newer publisher wins. If the live base generation changes while a run is preparing, the older run aborts and restarts.
8. Failure preserves the previous production deployment and last-known-good state.

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

1. Reconcile and validate the master.
2. Produce the complete runtime JSON state.
3. Validate the state against `schemas/runtime-state.schema.json` and product content-parity requirements.
4. Serialize once; compute uncompressed SHA-256.
5. Gzip; compute compressed SHA-256. This is `generationId`.
6. Split gzip bytes into bounded chunks.
7. Compute each chunk's exact byte count and SHA-256.
8. Write immutable chunk paths under `/generations/<generationId>/`.
9. Write `manifest.json` using `schemas/state-generation-manifest.schema.json`.
10. Read back/reconstruct the generation and verify both hashes and JSON contract before it is eligible for production.

## Optimistic publication lease

At run start, read live `current.json` and record `baseGenerationId`, `pointerVersion` and live `stateId`.

Immediately before publication, read the live pointer again. Abort/restart if any of those base values changed. This prevents a delayed 13:00 run from overwriting a newer generation produced by another publisher.

The new pointer uses `pointerVersion = old.pointerVersion + 1`, records `baseGenerationId`, sets the new generation as `current`, and carries the old current generation as `previous`.

## Atomic production switch

Deploy one self-contained `fz-performance-state` production package containing the new current generation, retained previous generation and the new `current.json`. Vercel's production alias switch is the commit point. Do not emulate atomicity by sequentially redeploying chunk filenames.

After READY:

1. Fetch production `current.json` and verify pointerVersion/current generation/stateId.
2. Fetch and validate the immutable current manifest/chunks.
3. Fetch `https://fz-performance-mvp.vercel.app/api/runtime-state`.
4. Require HTTP 200, matching `X-FZ-State-Id`, `X-FZ-State-SHA256`, `X-FZ-State-Generation` and `X-FZ-State-Source=current`.
5. Record the publication ledger entry.

If verification fails, restore the last-known-good state-project deployment/alias and do not modify the PWA shell.
