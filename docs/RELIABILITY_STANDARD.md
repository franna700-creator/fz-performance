# FZ Performance Reliability & Release Standard v0.6.1

## Core rule
Tooling workarounds must never become browser runtime architecture. The browser receives the final static shell and one same-origin runtime-state endpoint.

## Health layers
1. **Platform** — deployment/HTTP availability.
2. **Application** — real-browser boot, navigation, charts and interactions.
3. **Data** — canonical-master validation, state freshness, integrity and provenance.

HTTP 200 or Vercel READY is necessary but is not sufficient evidence of application health.

## Failure policy
Fail stale, not dead. Runtime resolution order is current validated server generation → previous validated server generation → last validated browser state → embedded last-known-good shell state. A source, publication or transport failure must not produce a blank application.

## Immutable state generations
Routine state publication uses content-addressed immutable generations.

- Serialize the complete validated runtime state once.
- Gzip it and compute the compressed SHA-256. That hash is the `generationId`.
- Every chunk is written below `/generations/<generationId>/` and is never overwritten by a later refresh.
- `/generations/<generationId>/manifest.json` records stateId, master validation, full payload checksums and each chunk's exact byte size/hash.
- `/current.json` is a small atomic pointer containing `current` and, when available, `previous` generation references.
- The gateway validates the pointer, generation manifest, chunk sizes, chunk hashes, complete payload hash, optional uncompressed hash, state schema and stateId before serving it.

The old failure mode where stable chunk filenames could be overwritten underneath an older manifest is prohibited.

## Publication concurrency and monotonicity
Before generating a new state, the publisher reads and records the current pointer/generation. A routine refresh may publish only a state whose stateId is newer than the live stateId. Immediately before the final production deployment/pointer switch, re-read the live pointer. If the base generation changed, abort and restart rather than racing another publisher. The new pointer records `baseGenerationId` for auditability.

A production state package must be self-contained and deploy atomically: current generation, previous-generation fallback files where available, manifests and `current.json` are promoted together. If any validation or deployment check fails, the prior production deployment/pointer remains authoritative.

## Formal contracts
The repository contains versioned JSON Schemas for:

- `schemas/runtime-state.schema.json`
- `schemas/state-generation-manifest.schema.json`
- `schemas/state-pointer.schema.json`

Schema/contract validation is part of CI and routine publication. Incompatible or incomplete state must never be rendered optimistically.

## Operating cadence
The user-approved production cadence is two intelligence cycles per day with a separated publisher/watchdog stage:

- 06:00 SAST — intelligence/reconciliation
- 06:30 SAST — state publish/verify
- 20:00 SAST — intelligence/reconciliation
- 20:30 SAST — state publish/verify

The browser countdown reflects the next **intelligence** refresh slot: 06:00 or 20:00 SAST. There is no 13:00 slot.

## Release gate
1. Build final assets.
2. Syntax/static/schema validation.
3. Deploy preview from a pinned Git commit/artifact.
4. Browser smoke test: TODAY/TRENDS/TRAIN/SYSTEM, Africa/Johannesburg date, exact 06:00/20:00 countdown, validated state, charts, pointer/touch/keyboard scrubbing and no fatal JavaScript errors.
5. Record rollback deployment.
6. Promote the exact tested artifact.
7. Repeat production gateway and browser checks.
8. Roll back immediately if a critical assertion fails.

## Continuous browser monitoring
`.github/workflows/production-smoke.yml` runs a real Chromium synthetic check hourly and after production-source pushes. It verifies desktop and mobile boot, the four primary surfaces, SAST date/countdown, runtime state validation/checksum headers, chart rendering and graph scrubbing. Failure screenshots are retained as GitHub Actions artifacts.

## Caching
- Navigation: no-store / network authoritative.
- Runtime state: no-store.
- Static assets: revalidate until a fully hashed immutable asset pipeline is introduced.
- No cache-first service worker in this baseline. Legacy FZ workers/caches are removed on boot.

## Graph interaction
Trend charts support pointer, touch and keyboard scrubbing. Scrubbing reveals the nearest actual observation rather than interpolating or inventing values. Normal mobile scrolling remains usable.

## Canonical roles
- GitHub `franna700-creator/fz-performance`: canonical application/platform source and release history.
- Google Drive master/PWA State: canonical analytical truth, interpretation contract and audit trail.
- Vercel `fz-performance-mvp`: production shell/gateway delivery.
- Vercel `fz-performance-state`: validated immutable runtime-state delivery.
