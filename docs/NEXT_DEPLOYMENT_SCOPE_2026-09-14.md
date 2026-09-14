# FZ Performance — Next Deployment Batch · 14 Sep 2026

Status: DEVELOPMENT SCOPE. This document does not authorize production deployment.

## Release objective

Use the canonical-readiness repair as the anchor for one coherent product release that advances FZ from closed-loop recommendation/execution toward closed-loop outcome learning without weakening the reliability, security or runtime/deployment boundaries established through Tranches 3–4.

The batch must preserve the core operating rule:

`athlete/source evidence → canonical persistence → reconciliation → derivation → intelligence → decision → choice → execution → response → learning evidence → affected surfaces`

Routine athlete-state evolution after deployment remains runtime data evolution and must not consume Vercel deployments.

## Include in this candidate

### 1. Canonical FZ Readiness v5
- versioned `readiness.current` contract;
- current Garmin wellness relative to personal historical baselines;
- direct Athlete Voice/materiality may temper or cap otherwise favourable physiology;
- historical runtime readiness can never masquerade as current;
- score may be withheld when minimum evidence is insufficient;
- readiness remains distinct from the final ABSORB / MAINTAIN / ADAPT recommendation.

### 2. Tranche 4.4 athlete-facing option completeness
Existing 4.4 composition is retained, but each visible option must expose enough information to act intelligently:
- title and intended lane;
- dose / structure;
- why it fits now;
- expected recovery cost;
- targeted evidence/gap;
- success condition;
- stop / modify condition;
- confidence and material assumptions where useful.

Internal option IDs remain provenance and should not dominate athlete-facing presentation.

### 3. Tranche 4.5 observation layer — choice outcome ledger
Prepare and activate an **observation-only** `choice.outcome` contract that links:
- immutable FZ recommendation;
- athlete choice;
- canonical planned intent;
- reconciled execution;
- subsequent Athlete Voice / response evidence when linked.

This release may persist outcome observations, but the outcome layer must **not yet alter recommendation scoring or session ranking**. The purpose is to create trustworthy longitudinal training-response evidence before allowing a learning model to influence decisions.

### 4. Freshness / divergence observability
SYSTEM and canonical intelligence contracts should make divergent dates or pending propagation visible. Healthy HTTP transport is not sufficient evidence that current-state intelligence is fresh.

The release must continue to distinguish:
- live source freshness;
- current canonical readiness date;
- active recommendation date/version;
- stale historical runtime state;
- pending propagation / reconciliation.

### 5. Release acceptance strengthened around real use
The same immutable release candidate must pass:
- full quality / contract suite;
- real mobile browser liveness and navigation;
- TODAY current readiness render;
- TRAIN recommended and alternate option visibility;
- success/stop condition visibility;
- Training Memory workout detail;
- TRENDS load/performance continuity;
- SYSTEM freshness / provenance health;
- no console/page errors or horizontal overflow;
- production post-promotion acceptance against the exact public alias.

## Prepare now, but do not activate prematurely

### Secure same-athlete browser mutation
Direct browser selection is still gated by security. The PWA must never expose `FZ_STATE_WRITE_TOKEN` or accept anonymous arbitrary athlete decisions. Prepare a secure same-athlete pairing/session design using the existing consolidated athlete-event function budget. Activate only once it can prove:
- HttpOnly/SameSite session semantics or equivalent;
- explicit athlete pairing/bootstrap;
- CSRF/replay protection;
- no secret material in browser JavaScript;
- idempotent choice persistence;
- revocation/expiry;
- mobile browser acceptance.

Until then, the PWA may display all choices while authenticated chat/runtime channels persist the athlete's decision.

### Learned response / recovery model
The next adaptive step after `choice.outcome` is a conservative `response.learning` layer. Prepare its contract and evidence requirements now, but do not allow it to change recommendations until sample-size, comparability and confidence gates are explicit. Repeated choices/outcomes should eventually update expected recovery cost and modality/session suitability without turning one anecdote into a rule.

## Not bundled merely for volume

Do not add unrelated schema migrations, routes or platform changes just because a deployment is available. The release remains within the 12-function hosting envelope and uses the existing generic intelligence ledger wherever the canonical schema already represents the concept.

Migration 005 or any other production DDL remains a separate controlled migration action unless this candidate proves it is genuinely required. No schema change is currently required for `readiness.current` or `choice.outcome`.

## Lessons that are release invariants

1. Fix the earliest invariant, not the screenshot.
2. Static UI never owns athlete truth.
3. Missing never becomes zero or normality.
4. Stale historical state never becomes current merely because transport is healthy.
5. Canonical source writes must propagate through dependent intelligence in the same runtime architecture.
6. UI controllers must be idempotent and observer-safe.
7. Real mobile browser interaction is a mandatory release gate.
8. One frozen source candidate → one staged Production build → read-only acceptance → no-rebuild traffic promotion → production acceptance.
9. Routine source/readiness/recommendation updates after deployment require zero Vercel deployments.
10. A new learning layer starts observation-only; it earns decision influence through evidence.
