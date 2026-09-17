# Measurement and intelligence propagation audit

Date: 17 September 2026. Candidate branch: `fix-measurement-evidence-propagation`.

## Intended outcome

Canonical evidence must reach qualified measurements, reusable capability evidence, objective-specific priorities, adaptive context, immutable recommendation audit, active projection and the relevant surfaces. Availability is distinct from improvement, benchmark equivalence, objective attainment and recommendation benefit. Routine evidence arrival uses deployed runtime logic; it does not require deployment.

This is a code-level audit with a read-only canonical-session replay. It is not certification of every production path or a claim that all future defects are eliminated. No production data repair is required for the triggering execution.

## Verified defects addressed in this candidate

| Boundary | Finding in prior code | Repair / executable proof |
|---|---|---|
| Protocol execution → measurement | `adaptive-context.js` only emitted six broad flags; canonical run laps and linked protocol/PM5 evidence had no consumer | New `measurement-evidence.js` derives ordered equal-distance run splits and explicitly defined first-to-last/worst fade. Actual session replay reaches both running measurements through the real GOALS handler. |
| Canonical history → current evidence | Measurement read reused the three-day planning window | Separate declared 45-day evidence scope, aligned with the existing current-trends scope; expiry and future sessions are tested. This scope is exposed, not an assertion that older history is invalid. |
| Feedback/title → qualification | Any post-session feedback became post-station response; HYROX/MIXED title became transition evidence; two wellness rows became recovery evidence | Remove these promotions. Plans are not executions; only linked, qualified observed capture satisfies a measurement. Next-day response must be linked to a hybrid-family execution. |
| Evidence resolver → measured state | Any non-null value, including false/empty/invalid, counted as measured | Reject false, empty arrays/objects, zero counts and explicitly invalid/pending/stale records. Preserve observations and references in the resolved result. |
| Protocol output → reusable capabilities | Runtime hierarchy expected `CAPABILITY:*` signals that the adapter never produced | Reviewed bindings emit explicit capability evidence, with transfer scope retained and no event-equivalence claim. Runtime-demand fallback is tested. |
| Algorithm/evidence change → recommendation identity | Measurement policy was absent from freshness checks; values could change without changing the top gaps | Include evidence version/fingerprint in decision identity and shadow summary. Old shadows become pending via the existing refresh controller; no new deployment is needed for subsequent evidence changes. |
| Dependency graph → GOALS | GOALS absent from affected surfaces and contract surface vocabulary | Register `measurement.evidence`, connect canonical triggers, include GOALS in revision surfaces, fail-stale read coverage and staged acceptance routes. |
| GOALS capability cards → canonical evidence | Cards consumed `trends.capabilities`, inherited from a published runtime CAP snapshot | Cards now consume current objective capability evidence from the same adaptive-context derivation as the measurement map. They say evidence available/unmeasured, not improving/achieved. |
| Build source → reviewed source | Existing prescription hotfix rewrote tracked intelligence/UI/test files during build | Retain the already-deployed generated corrections as reviewed source in this candidate. Existing hotfix becomes idempotent for these files; repeat build must not alter the candidate tree. |
| Test text → executable behaviour | Architecture golden-thread test mainly asserted source substrings | Add canonical fixtures, derivation adversarial cases and actual adaptive-context/resolver/GOALS-handler integration with source reads mocked and no persistence calls. |

## Measurement contract

The family registry remains the owner of protocol meaning. Bindings reference its declared comparison metrics and require observed capture; arrays of capture names are never values. Supported bindings cover compromised running, controlled steady running, transition time, erg output/cost, wall-ball output/cost, standardised station split and repeated strength-endurance output. These additional mappings require structured observed capture; they do not extract facts from arbitrary prose or assume existing sessions contain those fields.

The concrete run/PM5 decoder uses the existing stored shapes: `runLaps`, linked `FZ_PLANNED_INTENT`, linked `athlete_feedback.pm5Evidence`, and source-version history. It requires positive times/distances, unique ordered rounds, equal running distances and per-round pre-fatigue coverage. Newer sparse records fill from richer history via the existing monotonic merge. The PM5 fifth-interval field is an existing payload compatibility shape, not a five-round algorithm limit: round matching and run derivation accept arbitrary counts.

Observed and derived PM5 values remain distinct. Recovery-interval average HR is retained as context and is not relabelled as a timed HR-recovery metric. A modified/family-comparable execution remains family-comparable. Exact benchmark fidelity is not asserted by measurement availability. Reported limitations remain historical source context; a later PM5 supplement does not erase what was originally reported.

The anonymised regression fixture preserves the five reported rounded run splits. The private live-record replay uses canonical fractional durations, so its first-to-last result differs slightly from the rounded fixture. No athlete/session/date identifier is embedded in runtime logic.

## Remaining boundaries and decisions

| Area | Evidence / disposition |
|---|---|
| Matched Run AET | Existing dynamic classifier owns match qualification; reused with its session, comparison and power/HR evidence. A linked plan alone cannot declare an exact matched AET. |
| Sled, carry, full simulation, race results | Hierarchy declares these evidence types, but no qualified source decoder is established by this repair. Keep unknown; do not reinterpret generic strength, a PM5 warm-up or hybrid title as race-specific performance. Future release needs source-shape fixtures, load/distance/standards and comparison rules. |
| Strength reserve / training-only family | No defensible direct mapping to the current event hierarchy is asserted. Explicit coverage gap rather than invented transfer. |
| Longitudinal capability improvement | Measurement availability now propagates; improvement/plateau/regression, minimum repeat counts and matched conditions still require a separately specified longitudinal algorithm. Published CAP narratives are not promoted into live evidence. |
| Choice outcomes → learning | `choice-outcome.js` intentionally sets `OBSERVE_ONLY` and disallows causal inference from one response. Activating learned recovery cost requires the sample-size/comparability/confidence gates described in `NEXT_DEPLOYMENT_SCOPE_2026-09-14.md`. It is not an accidental missing adapter. |
| Full event/research ingestion and all source corrections | Existing graph, materiality, late-binding and event tests remain in the full suite. This change does not claim a new production end-to-end audit of every external provider or every event-format mutation. |
| Evidence older than current window | Canonical history is retained. Current evidence map explicitly scopes to 45 days. Per-measurement validity horizons and lifetime benchmark retrieval need a documented policy, not an arbitrary wider query. |

## Acceptance and release

Required before promotion: exact-head GitHub quality green; branch current with main; clean tree after build; frozen SHA/tree; release preflight; isolated mutation-path acceptance; one authorised staged production build; read-only live API checks including GOALS; desktop/mobile acceptance against that exact deployment; rollback identity; promotion without rebuild.

Local replay is not a deployed endpoint check. Source-loader mocks are explicit. Production history was read but not rewritten. Routine post-release refresh should converge through the existing materiality/readiness/shadow/active controller; do not manufacture an athlete choice or write a new canonical workout to make GOALS green.
