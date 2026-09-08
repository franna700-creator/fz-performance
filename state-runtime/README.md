# FZ Performance Git-backed Runtime State Transport

Status: PREPARED — requires one-time Vercel Git Integration activation for the existing `fz-performance-state` project.

## Purpose

This directory removes the publication dependency on a ChatGPT execution environment having an arbitrary-file Vercel deployment action. Once activated, a validated publisher writes one atomic `state-input.json` commit and Vercel builds the immutable state package deterministically.

This does **not** create a new Vercel project and does **not** deploy or mutate `fz-performance-mvp`.

## One-time Vercel activation

On the existing Vercel project `fz-performance-state` (`prj_vAhaOqu3dlQibh7BbUMqjhboqwrJ`):

1. Connect Git repository `franna700-creator/fz-performance`.
2. Set Production Branch to `main`.
3. Set Root Directory to `state-runtime`.
4. Keep Framework Preset as Other / no framework override. `state-runtime/vercel.json` owns the build command/output directory.

The committed `state-input.json` is initially `bootstrap-noop`. The first Git deployment therefore fetches and reproduces the currently live `current.json` and retained generations exactly. Activation must not change the live state identity.

After the bootstrap deployment is verified, publishers may change `state-input.json` to `mode: publish` with:

- an explicit live base lease (`pointerVersion`, `generationId`, `stateId`);
- one complete validated v0.6.1 `currentState` built solely from canonical `PWA State`;
- an explicit publication timestamp.

## Build invariants

`build.mjs`:

- reads live `fz-performance-state/current.json` no-store;
- rejects a stale lease;
- copies and verifies the exact live current generation as the previous fallback;
- requires v0.6.1, `masterValidated=true`, TODAY/TRENDS/TRAIN/SYSTEM and `datasets.WELLNESS_HISTORY`;
- requires exactly one `LIVE / PARTIAL` wellness-history row and no duplicate dates;
- builds deterministic gzip/chunks and content-addressed generation paths;
- reconstructs and hashes the candidate before producing `dist/`;
- writes a schema 1.1 pointer with `pointerVersion + 1` and the live generation as `previous`.

Vercel's production deployment/alias switch remains the atomic commit point.

## Publisher handoff

The durable publication transport becomes:

`validated PWA State -> single atomic Git state-input commit -> Vercel Git build in fz-performance-state -> production pointer/gateway verification -> product/browser smoke`

Manual, primary and watchdog runs all use the same transport. The 06:00 / 20:00 intelligence cadence is unchanged.
