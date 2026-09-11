# FZ Performance — Zero-Failure Release Standard

Status: authoritative release-preparation guidance for FZ software releases. This does **not** authorize deployment.

## Objective

A release should reach Vercel only after the repository, hosting envelope, runtime environment, candidate identity and rollback path have already been proven. Production traffic is never a troubleshooting environment.

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

### 3. Environment scope must be verified before release execution

Prior Preview deployments built successfully but database-backed routes reported that the database connection string was not configured. Production being healthy does not prove Preview environment-variable scope.

Permanent control:
- `config/release-environment-contract.json` requires database and runtime-write configuration in both Preview and Production;
- `/api/system/status` exposes only secret-safe booleans (`databaseConfigured`, `writeTokenConfigured`), never secret values;
- Preview environment-variable scope is audited separately before the release window so future Preview workflows cannot silently regress;
- the actual 4.3 release candidate is built with **Production** environment variables from the outset using the staged-production workflow below.

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

### 6. READY is not the same as accepted

Several recent deployments were technically READY yet required follow-up work for Live Physiology UI refresh, mobile interaction/refresh behaviour and training auto-sync wiring.

Permanent control:
- browser/runtime acceptance is a release gate, not an optional afterthought;
- desktop and mobile surfaces must both be exercised;
- Live Physiology, training auto-sync, TODAY, TRENDS, TRAIN and SYSTEM must render and interact against canonical APIs;
- no console/page errors are allowed;
- source persistence must trigger canonical rereads without blanking last-known state;
- promotion may occur only after the staged deployment passes these checks at its immutable deployment URL.

### 7. One source candidate, one build, one traffic promotion

Vercel's Preview-to-Production promotion path can trigger a fresh Production rebuild so that Production-scoped environment variables are applied. That is safe in general, but it does **not** meet FZ's stricter goal of a single release build.

The authoritative FZ release path is therefore a **staged Production deployment**:

1. freeze the exact green candidate SHA/tree;
2. ensure the development/release branch is not behind `main`;
3. run the full quality gate and zero-failure preflight;
4. verify required Production environment-variable scope and separately audit Preview scope;
5. create exactly **one** Production-target deployment with domain assignment skipped (`vercel --prod --skip-domain` or equivalent API behaviour);
6. verify that staged deployment's identity matches the frozen SHA/tree and that it was built using Production configuration;
7. exercise the staged deployment at its immutable URL: environment probes, canonical APIs, 4.3 propagation, desktop/mobile browser acceptance, refresh behaviour and runtime logs;
8. if any check fails, **do not promote**. The release attempt is stopped; the candidate returns to development and a later candidate is a new release attempt;
9. if all checks pass, point Production traffic to the **same staged deployment ID** using a promotion/alias operation that does not rebuild it;
10. verify Production health immediately and retain the previous known-good rollback candidate.

There is no second build, no changed commit between validation and traffic assignment, and no Production troubleshooting deployment.

## Hard pre-deployment gate

All must be true before the single staged Production deployment is attempted:

- full GitHub `quality` workflow green at the exact candidate head;
- zero-failure release preflight green;
- candidate SHA and tree frozen;
- Node runtime pinned and aligned with Vercel;
- physical serverless-function count <= plan limit;
- Git auto-deploy disabled;
- controlled release metadata closed until explicit athlete authorization;
- branch not behind `main`;
- no unresolved schema migration requirement;
- required Production environment-variable targets verified;
- Preview environment-variable scope separately audited and corrected for future Preview workflows;
- current Production healthy enough to provide a trustworthy rollback baseline;
- previous successful Production deployment identifiable and rollback-capable;
- no 4.4 runtime activation contaminating the 4.3 candidate.

## Staged Production candidate acceptance gate

The staged deployment may receive Production traffic only if all of the following pass against the **same deployment ID**:

- deployment state READY;
- deployment source SHA/tree equals the frozen candidate;
- no automatic Production domain has been assigned yet;
- `/api/system/status` returns 200;
- `releaseEnvironment.databaseConfigured === true`;
- `releaseEnvironment.writeTokenConfigured === true`;
- `/api/intelligence/current` returns 200 and a coherent revision/dependency state;
- runtime, wellness, training and trends canonical reads return successfully;
- no unexpected 5xx/error/fatal runtime cluster appears;
- active recommendation matches the exact current shadow ID/fingerprint or is correctly WITHHELD;
- PWA renders canonical/last-known state without blanking on transient failures;
- desktop and mobile interaction acceptance passes;
- Live Physiology and training auto-sync controls remain functional;
- manual Refresh FZ converges idempotently;
- no athlete choice is manufactured;
- the candidate has not mutated code, config or deployment identity since freeze.

## Traffic-promotion gate

Promotion is an alias/traffic operation, not a second build. If the staged candidate is not clean, traffic does not move.

Before promotion:
- record current Production deployment ID as rollback target;
- confirm the exact staged deployment ID and candidate SHA/tree;
- confirm runtime acceptance is green;
- confirm there has been no newer candidate commit substituted into the release.

After promotion:
- verify Production points to the exact accepted staged deployment ID;
- verify key canonical routes and PWA shell;
- inspect runtime errors immediately;
- confirm release metadata is closed again;
- preserve the previous known-good deployment until post-promotion acceptance is complete.

## Preview environment hygiene

Preview is not the release vehicle for the single-build workflow, but its configuration must still be correct because Preview remains useful for future development validation.

Before release authorization, audit Vercel environment-variable scope and confirm at minimum:
- `DATABASE_URL` or `POSTGRES_URL` includes Preview;
- `FZ_STATE_WRITE_TOKEN` includes Preview;
- branch-specific Preview overrides do not accidentally shadow the project-level values for the intended release/development branch;
- sensitive values are not exposed in logs or API responses.

A historical Preview returning `database connection string is not configured` is evidence of a real scope/configuration gap until the current project settings are directly verified.

## Core rule

**Find failures in development or preflight. Build the release candidate once with Production configuration but no Production traffic. Test that exact deployment. Then move traffic to it without rebuilding or changing it.**
