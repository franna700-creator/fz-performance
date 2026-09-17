# Tranche 5.0 — Intelligence Convergence & Canonical Athlete State

Status: IN DEVELOPMENT
Start date: 2026-09-17

## Goal

Build a provably convergent intelligence architecture for FZ Performance in which every decision-relevant canonical change — athlete feedback, wellness, training, choices, objectives, event information, reconciliation changes and relevant passage of time — is revisioned, propagated through one dependency system, and either recomputed or explicitly proven not to affect every dependent intelligence contract.

Establish a canonical current-athlete-state layer so unresolved constraints and athlete context persist until resolved, superseded or legitimately expired rather than being inferred from the latest message alone.

At tranche completion, `pendingPropagation: false` means the complete decision-driving intelligence graph is demonstrably current.

## Architectural principles

1. Canonical truth changes before derived intelligence or presentation.
2. Pages consume converged intelligence; pages do not create convergence.
3. Every changed dependency node is registered. Unknown nodes fail closed.
4. Every affected derived contract is explicitly `INVALIDATED`, `RECOMPUTED`, `RECONCILED`, `PROVEN_UNAFFECTED`, `WITHHELD` or `FAILED` for the governing revision.
5. Athlete Memory, materiality and current athlete state remain distinct concepts.
6. Time is an intelligence input where runway, freshness, sequencing or evidence-validity changes can alter a decision.
7. Runtime data evolution is not a software release when existing canonical architecture can represent it.
8. Missing evidence remains unknown; it is never converted into weakness.
9. Canonical relationships are monotonic unless an explicit reconciliation operation changes them.
10. Release validation must prove code/schema/runtime parity against Production-shaped data.

## Workstreams

### 5.0A — Canonical integrity repair

- Admit every implemented canonical record type in the deployed persistence contract, including `choice_outcome`.
- Prevent source re-ingestion from downgrading reconciled session state.
- Supersede prior open athlete-selected plans when a later choice replaces the same intended training slot.
- Track all decision-driving objective lifecycle states, including `SCHEDULED` objectives.
- Reconcile existing relationship/state contradictions through controlled runtime data repair after code and schema support are validated.

### 5.0B — Canonical revision / mutation ledger

Every canonical change receives a durable revision containing provenance, changed nodes, dependency closure and affected surfaces.

### 5.0C — Fail-closed dependency graph

Every canonical/derived node must be registered. Unknown changed nodes are architecture errors rather than successful no-ops.

### 5.0D — Convergence ledger

For each revision, every affected contract records its convergence state. A revision is complete only when no affected node remains invalidated or failed.

### 5.0E — Canonical current athlete state

Introduce a durable current-state reducer distinct from Athlete Memory and materiality. Current constraints persist until explicit resolution, supersession or policy-based expiry.

### 5.0F — Temporal invalidation

Represent local-day and decision-window progression as dependency sources so event runway, plan timing, evidence validity and freshness can invalidate intelligence without a new external data write.

### 5.0G — Unified adaptive context

One canonical adaptive-context builder must serve recommendation, SYSTEM, GOALS, TRENDS and other decision-driving consumers.

### 5.0H — Canonical longitudinal history

Readiness, TRENDS and load consume the same canonical wellness/training history. Legacy runtime fallbacks are migrated once and then removed from decision-driving reads.

### 5.0I — Late evidence and reconciliation

Historical evidence inside the supported lookback must be capable of re-entering reconciliation and propagation even when it arrives after the normal near-term source-sync window.

### 5.0J — Server-owned presentation contracts

Browser code renders canonical server state. It must not merge competing server responses into a new version of athlete truth.

### 5.0K — Production systemic reconciliation sweep

The reconciliation sweep becomes a live integrity mechanism, not a library exercised only by smoke tests.

### 5.0L — Schema/runtime/release parity

CI verifies that every record type, contract and persistence operation supported by application code is accepted by the deployed database schema.

### 5.0M — Build architecture cleanup

Retire obsolete static-athlete payload construction and patch-chain dependencies so the application builds from current canonical source.

Implemented: the neutral shell, PWA files and release UI contract now live in
`src/shell`; the base stylesheet is ordinary `src/app.css`. The build copies the
complete declared asset set without changing source or patching HTML. The six
archived payload parts, two source hotfix scripts and five chained shell/page
injectors have been removed. Their accepted fixes remain in canonical source.

The source-only build regression verifies deterministic output, unchanged source,
removal of obsolete output, preserved runtime ordering and failure on missing
assets. CI also rejects any tracked source mutation during the full build.
All browser workflow path filters include the new shell/build inputs.

Implementation validation preserves the pre-cleanup `index.html`, PWA files and
every browser asset byte-for-byte. Only the UI contract adds the complete asset
inventory and explicit source-build/server-presentation metadata. Production
migration, release acceptance and runtime convergence remain separate exit gates.

## Hard invariants

- Unknown propagation nodes fail closed.
- Source refresh cannot implicitly downgrade `MATCHED`, `MATCH_REQUIRED` or `MANUAL` reconciliation state.
- One intended athlete-selected training slot cannot retain multiple live replacement plans without an explicit multi-session model.
- Every application record type is persistable by the deployed schema.
- All decision-driving objectives participate in freshness/currentness detection regardless of valid lifecycle label.
- Every recommendation fingerprint input has an invalidation mechanism.
- Relevant time progression can invalidate intelligence.
- Unresolved current constraints survive newer unrelated Athlete Voice.
- No browser component manufactures canonical current state.
- No decision-driving consumer silently falls back to legacy runtime data when canonical data exists.
- Late evidence can revise historical relationships and propagate the change forward.
- Production reconciliation evaluates live runtime contracts.
- A release cannot be green with code/schema/runtime parity drift.
- Every derivation exposes provenance sufficient to trace it to canonical evidence and revision.

## Exit gate

Golden end-to-end mutation scenarios must prove:

`canonical input → canonical revision → relationship reconciliation → current athlete state → materiality → readiness → measurement → adaptive context → recommendation → dependent surfaces → CONVERGED`

The tranche closes only when Production-like acceptance shows no known contradictory canonical state, no unregistered mutation node, no unsupported persisted contract, no unresolved convergence revision, no decision-driving runtime fallback and no presentation-layer truth reconciliation.

## Explicitly out of scope

Tranche 5.0 does not introduce autonomous recommendation-policy learning, `response.learning`, personal-response coefficient optimisation or model self-training. It builds the trustworthy nervous system required before those capabilities can be added safely.
