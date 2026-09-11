# FZ Performance — Zero-Failure Release Standard

Status: authoritative release-preparation guidance for FZ software releases. This does **not** authorize deployment.

## Objective

A release should reach Vercel only after the repository, hosting envelope, runtime environment, candidate identity and rollback path have already been proven. Production is never a troubleshooting environment.

Routine athlete-state evolution remains data evolution and is outside this software release process.

## Lessons captured from Tranche 3 / Tranche 4 releases

### 1. CI success is not enough if the hosting envelope is not checked

A Tranche 4.1 preview built successfully but failed during Vercel packaging with `exceeded_serverless_functions_per_deployment`: the Hobby project permits at most 12 Serverless Functions.

Permanent control:
- every build runs `release-preflight-smoke.mjs`;
- the physical `api/**` function count must be <= 12;
- new read/diagnostic contracts should be consolidated into existing functions where the architecture permits it;
- this limit must be evaluated before any Vercel deployment is attempted.

For Tranche 4.3, `/api/intelligence/current` and `/api/intelligence/refresh` remain public contracts but are rewrites into the existing `/api/system/status` function, preserving the 12-function envelope.

### 2. Never change Git auto-deployment state as part of release troubleshooting

RC8 preview and the first Tranche 4.2 production attempt demonstrated that changing `git.deploymentEnabled` to trigger deployment can conflict with repository deployment-separation tests and create a self-inflicted failed deployment.

Permanent control:
- `vercel.json -> git.deploymentEnabled` stays `false` at all times;
- releases are explicit, pinned deployments rather than Git-push side effects;
- no build-command mutation may rewrite `vercel.json` during a release;
- a release gate is metadata/authorization, not permission for ordinary Git pushes to deploy.

### 3. Preview must prove runtime environment before it can be promoted

A prior pinned Preview built successfully but its database-backed routes reported that the database connection string was not configured. Production being healthy does not prove Preview environment-variable scope.

Permanent control:
- `config/release-environment-contract.json` requires database and runtime-write configuration in both Preview and Production;
- `/api/system/status` exposes only secret-safe booleans (`databaseConfigured`, `writeTokenConfigured`), never secret values;
- Preview acceptance must verify these probes before any promotion;
- a Preview with missing environment configuration is non-promotable even if its build is READY.

### 4. Pin the runtime major

Repeated builds warned that `engines: >=20` would automatically move to future Node majors.

Permanent control:
- package runtime is pinned to Node `24.x`;
- CI also runs Node 24;
- a runtime-major change is a deliberate release decision, not an incidental platform upgrade.

### 5. Architecture tests must advance with intentional architecture changes

4.3 correctly introduced controlled shadow -> active projection, but old 4.2 tests still asserted that shadow could never reach the active recommendation. CI caught this, but stale guards create noise and can conceal the difference between regression and intentional contract evolution.

Permanent control:
- when an architecture boundary intentionally changes, update both the dependency registry and the invariant test in the same development sequence;
- never weaken a guard merely to turn CI green: replace it with the new exact invariant;
- active recommendation still cannot bypass materiality/adaptive context/shadow.

### 6. One immutable candidate, one Preview, one promotion

The successful Tranche 4.2 path established the safer pattern: validate a pinned candidate, exercise a Preview, then release the same candidate.

Permanent control:
1. freeze the exact green candidate SHA/tree;
2. ensure the development branch is not behind main;
3. run the full quality gate and zero-failure preflight;
4. verify Vercel environment target scope before deployment where API/tooling permits;
5. create exactly one explicit pinned Preview;
6. verify Preview build state, environment probes, canonical read APIs, PWA shell and recommendation propagation;
7. inspect Preview runtime errors before promotion;
8. promote the **same validated candidate**—do not rebuild a modified commit for production;
9. verify Production health immediately;
10. retain a known-good rollback candidate.

If any preflight condition is unresolved, do not deploy. Fix or verify it first.

## Hard pre-deployment gate

All must be true before the first release deployment is attempted:

- full GitHub `quality` workflow green at the exact candidate head;
- zero-failure release preflight green;
- Node runtime pinned and aligned with Vercel;
- physical serverless-function count <= plan limit;
- Git auto-deploy disabled;
- controlled release metadata closed until explicit athlete authorization;
- branch not behind `main`;
- no unresolved schema migration requirement;
- Preview and Production required environment targets verified where tooling permits;
- production currently healthy enough to provide a trustworthy rollback baseline;
- previous successful production deployment identifiable and rollback-capable;
- no 4.4 runtime activation contaminating the 4.3 candidate.

## Preview acceptance gate

The Preview may be promoted only if all of the following pass against the pinned candidate:

- deployment state READY;
- `/api/system/status` returns 200;
- `releaseEnvironment.databaseConfigured === true`;
- `releaseEnvironment.writeTokenConfigured === true`;
- `/api/intelligence/current` returns 200 and a coherent revision/dependency state;
- runtime, wellness, training and trends canonical reads return successfully;
- no unexpected 5xx/error/fatal runtime cluster appears;
- active recommendation matches the exact current shadow ID/fingerprint or is correctly WITHHELD;
- PWA renders last-known/canonical state without blanking on transient failures;
- manual Refresh FZ converges idempotently;
- no athlete choice is manufactured;
- no production data or deployment is changed by Preview verification.

## Production promotion gate

Promotion is not authorization to troubleshoot. If Preview is not clean, promotion does not occur.

After promotion:
- verify the production deployment points to the exact validated candidate;
- verify key canonical routes and PWA shell;
- inspect runtime errors;
- confirm release gate is closed again;
- record the new rollback candidate and preserve the previous known-good deployment until acceptance is complete.

## Core rule

**Find failures in development or preflight, not in Vercel deployment. Find environment mistakes in Preview acceptance, never in Production. Promote only an unchanged candidate that has already passed both.**
