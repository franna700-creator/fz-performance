# FZ Performance Deployment Path

Status: ACTIVE BASELINE from v0.6.1

## Principle

Product/platform releases must be boring, deterministic and attributable.

Routine intelligence runs occur at 06:00 and 20:00 SAST. Their corresponding state publish/verify runs occur at 06:30 and 20:30 SAST. Routine state publication is separate from product deployment and MUST NOT deploy the PWA shell.

## Canonical Vercel project registry

FZ Performance uses exactly two persistent Vercel projects:

1. **Application / main product**
   - Project: `fz-performance-mvp`
   - Project ID: `prj_Y5AbwT02Hc5O74bAnmUzNlZSY2yq`
   - Canonical public URL: `https://fz-performance-mvp.vercel.app`
   - Purpose: the production PWA shell plus same-origin `/api/runtime-state` gateway.

2. **Runtime state transport**
   - Project: `fz-performance-state`
   - Project ID: `prj_vAhaOqu3dlQibh7BbUMqjhboqwrJ`
   - Canonical state URL: `https://fz-performance-state.vercel.app`
   - Purpose: immutable runtime-state generations and the current/previous pointer contract.

The machine-readable copy of this registry is `config/vercel-projects.json`.

**Anti-proliferation rule:** do not create additional Vercel projects for previews, schema tests, restore tests, file-path tests, runtime experiments, deployment tooling tests, or one-off recovery work. Product previews belong inside `fz-performance-mvp`; schema/build tests belong in repository CI/local artifacts; state publications belong only in `fz-performance-state`.

Any legacy Vercel project outside this two-project registry is non-canonical and may be retired after confirming that it is not referenced by production code or automation.

## Canonical product-release path

1. GitHub `main` is the canonical application source.
2. The release commit must pass the repository `quality` workflow before deployment.
3. Preview is built from the exact pinned Git commit, not from an uncommitted local copy.
4. Vercel builds that pinned commit through a minimal bootstrap deployment **into the existing `fz-performance-mvp` project**:
   - clone `https://github.com/franna700-creator/fz-performance.git`;
   - checkout the exact approved commit SHA;
   - run the canonical deterministic build and product-release transforms/tests;
   - copy the validated `dist/` artifact into the Vercel deployment output.
5. Verify preview root, generated `assets/app.js`, and `/api/runtime-state` before production promotion.
6. Production is deployed from the same pinned commit and the same bootstrap/build process into `fz-performance-mvp`. Creating a new project is a release-path failure.
7. Production is not considered complete until all of the following are verified on `https://fz-performance-mvp.vercel.app`:
   - root returns HTTP 200 and the FZ Performance shell;
   - generated app reports the intended shell version/release markers;
   - the shell schedule is 06:00 / 20:00 SAST with no 13:00 slot;
   - `/api/runtime-state` returns HTTP 200;
   - `masterValidated=true`;
   - state generation/checksum headers are present and internally consistent;
   - required release functionality/interaction markers are present.
8. On failure, do not invent a second deployment path or Vercel project. Restore or redeploy the last known-good pinned commit through the same deterministic process.

## Authentication rule

Do not use one-off GitHub Actions device-login workflows, personal tokens embedded in workflows, or ad-hoc credential workarounds for normal FZ releases.

The current supported in-chat release mechanism is direct Vercel deployment of the small pinned bootstrap described above into the pre-existing canonical application project. This requires no new plugins and does not alter the FZ runtime architecture.

If native Vercel Git Integration is configured later, it may replace the bootstrap transport only after proving the same guarantees: exact commit identity, preview gate, deterministic build, production verification and rollback safety. It must not introduce automatic shell deployment for ordinary intelligence/state refreshes.

## Separation of release classes

### INTELLIGENCE / STATE REFRESH
Data/readiness/interpretation/datasets only.

Flow: Garmin + Tredict + athlete feedback → reconciled Drive master → `PWA State` → validated immutable runtime generation → `fz-performance-state` publication.

Operational cadence:
- 06:00 intelligence → 06:30 publish/verify
- 20:00 intelligence → 20:30 publish/verify

No PWA shell deployment.

### PRODUCT RELEASE
HTML/CSS/JS/components/interactions/schema capability.

Flow: branch/main source → quality gate → exact pinned preview in `fz-performance-mvp` → browser/smoke verification → exact pinned production in `fz-performance-mvp` → production readback.

### PLATFORM RELEASE
Hosting/routing/caching/runtime transport/security/infrastructure.

Uses the strictest gate and must preserve fail-stale behavior and last-known-good recovery. The two-project registry remains the default unless a future architecture decision explicitly supersedes it.

## v0.6.1 baseline

v0.6.1 is the production patch level for the v0.6 longitudinal TRENDS product. It retains the revised longitudinal TRENDS experience while aligning the shell, countdown and runtime-state schedule contract with the user-approved two-cycle operating cadence. It removes stale v0.5 shell labels and removes the legacy 13:00 runtime slot. The immutable state-generation transport and fail-stale architecture remain unchanged.
