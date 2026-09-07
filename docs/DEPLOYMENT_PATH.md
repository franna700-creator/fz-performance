# FZ Performance Deployment Path

Status: ACTIVE BASELINE from v0.6.0

## Principle

Product/platform releases must be boring, deterministic and attributable.

Routine 06:00 / 13:00 / 20:00 state refreshes are separate and MUST NOT deploy the PWA shell.

## Canonical product-release path

1. GitHub `main` is the canonical application source.
2. The release commit must pass the repository `quality` workflow before deployment.
3. Preview is built from the exact pinned Git commit, not from an uncommitted local copy.
4. Vercel builds that pinned commit through a minimal bootstrap deployment:
   - clone `https://github.com/franna700-creator/fz-performance.git`;
   - checkout the exact approved commit SHA;
   - run the canonical deterministic build and product-release transforms/tests;
   - copy the validated `dist/` artifact into the Vercel deployment output.
5. Verify preview root, generated `assets/app.js`, and `/api/runtime-state` before production promotion.
6. Production is deployed from the same pinned commit and the same bootstrap/build process.
7. Production is not considered complete until all of the following are verified on `https://fz-performance-mvp.vercel.app`:
   - root returns HTTP 200 and the FZ Performance shell;
   - generated app reports the intended shell version/release markers;
   - `/api/runtime-state` returns HTTP 200;
   - `masterValidated=true`;
   - state generation/checksum headers are present and internally consistent;
   - required release functionality/interaction markers are present.
8. On failure, do not invent a second deployment path. Restore or redeploy the last known-good pinned commit through the same deterministic process.

## Authentication rule

Do not use one-off GitHub Actions device-login workflows, personal tokens embedded in workflows, or ad-hoc credential workarounds for normal FZ releases.

The current supported in-chat release mechanism is direct Vercel deployment of the small pinned bootstrap described above. This requires no new plugins and does not alter the FZ runtime architecture.

If native Vercel Git Integration is configured later, it may replace the bootstrap transport only after proving the same guarantees: exact commit identity, preview gate, deterministic build, production verification and rollback safety.

## Separation of release classes

### STATE REFRESH
Data/readiness/interpretation/datasets only.

Flow: Garmin + Tredict + athlete feedback → reconciled Drive master → `PWA State` → validated immutable runtime generation → state-project publication.

No PWA shell deployment.

### PRODUCT RELEASE
HTML/CSS/JS/components/interactions/schema capability.

Flow: branch/main source → quality gate → exact pinned preview → browser/smoke verification → exact pinned production → production readback.

### PLATFORM RELEASE
Hosting/routing/caching/runtime transport/security/infrastructure.

Uses the strictest gate and must preserve fail-stale behavior and last-known-good recovery.

## v0.6.0 baseline

The v0.6.0 longitudinal TRENDS production release established this deployment path after recovery from an invalid production deployment. The release was rebuilt from an exact quality-green GitHub commit and verified on the public production alias before closure.
