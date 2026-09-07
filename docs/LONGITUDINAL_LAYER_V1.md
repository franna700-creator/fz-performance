# FZ Performance Longitudinal Intelligence Layer v1

Status: ACTIVE DEVELOPMENT PHASE

Stabilisation status: v0.5.1 operational hardening remains at the final exit gate. Longitudinal development may proceed in parallel but must not weaken, bypass or redesign the locked production shell or release controls.

## Product intent

The longitudinal layer turns FZ Performance from a reliable daily decision system into a system with durable athlete memory.

The immediate objective is not more screens and not machine learning. It is to create a trustworthy, versioned history that can reconstruct:

1. what the system knew at the time;
2. what FZ interpreted;
3. what decision space was presented;
4. what the athlete chose and actually executed;
5. what happened afterwards;
6. how the observation fits the athlete's event and capability trajectory.

North-star chain:

STATE -> RECOMMENDATION -> ATHLETE CHOICE -> EXECUTION -> RESPONSE

## Phase-1 exit gate

FZ can select any prior day in the longitudinal cohort and reconstruct the athlete state as understood at that time, place it in preceding training/load context, show the recommendation and its confidence where captured, show actual execution where captured, and connect the day to subsequent response without silently recalculating history using today's rules.

## Core objects

### 1. Daily athlete state
One immutable/versioned morning record per date and decision snapshot.

Minimum fields:
- snapshot ID and date
- captured-at timestamp or explicit historical-backfill status
- source coverage and completeness
- sleep, HRV, RHR, stress, Body Battery and relevant daily physiology
- prior-day training/load context
- 7d / 28d rolling load and coaching A:C where available
- subjective/local state where explicitly captured
- readiness, readiness band and major limiter where explicitly produced
- recommendation summary and confidence where explicitly produced
- event-context version
- interpretation/decision logic version
- runtime state ID / provenance where applicable
- correction lineage through `supersedesSnapshotId` rather than silent overwrite

### Forward-capture invariants
For every contemporaneous `LIVE_CAPTURE` or `DAILY_CLOSE` created after Longitudinal v1 activation:
- FZ readiness score is mandatory;
- readiness band/status is mandatory;
- the producing decision-logic version is mandatory;
- the immediately preceding completed Garmin Daily record must be confirmed `HISTORICAL_COMPLETE` before the new morning anchor is accepted;
- a missing completed Garmin Daily record is a DATA HEALTH exception and must not be silently tolerated;
- subjective/local state may still be missing if it was not explicitly captured, but must remain visibly missing rather than inferred from wearables.

Historical backfills are different. A historical readiness score is populated only when the exact contemporaneous FZ score can be recovered from a dated FZ artifact or master record. Historical readiness must never be recreated retrospectively using a newer decision engine and then presented as if it were the original score.

Historical records must preserve what was known at the time. Missing data remains missing. Historical backfill is labelled as reconstruction and must never be presented as an original contemporaneous decision snapshot.

### 2. Training exposure
One record per meaningful training exposure/session.

The object should describe more than sport + duration. It should identify:
- session family and modality
- planned vs executed status
- duration, distance, HR/power/pace where available
- load/HR-effort where available
- matched diagnostic family where applicable
- capability targets
- local/mechanical cost observations where captured
- event relevance
- source identity and reconciliation status

Matched diagnostic families such as RUN_AET, BIKE_AET and WALLBALL_AET remain distinct from unmatched contextual training.

### 3. Decision / outcome ledger
One record for each material FZ recommendation cycle.

Minimum chain:
- morning/daily-state ID
- recommendation options
- FZ preferred path
- confidence
- athlete selection
- execution result: planned / modified / different / rest / aborted
- RPE or perceived difficulty when captured
- limiting factor
- immediate response
- next-morning response link
- outcome assessment

The purpose is not to score the athlete for compliance. It is to learn which decisions preserve or improve future training value.

### 4. Event context
Persistent event objects provide the strategic layer.

Each event should contain:
- event ID, date, type and priority
- current phase
- capability requirements
- important exposures still required
- taper/recovery constraints
- status

Daily decisions may then be evaluated against event runway rather than readiness alone.

### 5. Logic registry
Every material interpretation/decision rule-set must be versioned.

Historical recommendations are evaluated using the rule version that produced them. New rules do not silently rewrite old decisions.

## Data architecture

Google Drive master remains the canonical analytical/audit layer during v1.

The master gains five longitudinal tables:
- `Longitudinal Daily`
- `Training Exposures`
- `Decision Outcomes`
- `Event Context`
- `Logic Registry`

These tables are durable analytical memory, not browser state. The existing PWA State remains the render contract for current production.

The approved PWA shell remains visually stable while the longitudinal layer matures. The preferred future product direction is to deepen the existing TRENDS surface with longitudinal reconstruction, exposure-response and trajectory intelligence rather than adding a new top-level HISTORY destination unless later evidence justifies one. Any UI exposure remains a PRODUCT RELEASE and must pass the locked v0.5.1 gate.

## Historical integrity rules

- Do not fabricate missing continuity.
- Do not silently convert missing wearable values to zero.
- Do not infer subjective state from wearable data.
- Do not use today's rules to rewrite yesterday's recommendation.
- Corrections must be attributable and versioned.
- Historical backfills must be labelled `HISTORICAL_BACKFILL`.
- Contemporaneous daily records created by scheduled operation are labelled `LIVE_CAPTURE` or `DAILY_CLOSE` as appropriate.
- Observation, Inference and Coaching Judgment remain distinct.
- From Longitudinal v1 activation forward, readiness persistence and completed prior-day Garmin Daily closure are non-negotiable daily invariants.

## Initial cohort

V1 begins with the current high-confidence modern cohort:
- Garmin daily physiology from 17 Aug 2026 onward;
- reconciled Tredict/Garmin training exposures around the same period;
- current event runway: Deadly Dozen 20 Sep 2026, HOKA Half Marathon Pretoria 24 Sep 2026, HYROX Johannesburg Solo Male 28 Nov 2026.

Older Apple Health / Strava / integrated history remains valuable baseline context but is not automatically promoted into the same metric definitions. Source-consistent baseline rules remain in force.

## Operating cadence

06:00:
- complete normal master-first reconciliation;
- confirm the prior calendar day's Garmin Daily row is historically complete;
- produce the FZ readiness score and readiness band under the active decision-logic version;
- publish current runtime state under the locked production workflow;
- append/finalise one new longitudinal morning state only after master validation passes;
- reject the longitudinal morning capture if readiness/band/logic version or prior-day Garmin closure is absent;
- never mutate prior longitudinal rows except via an explicit superseding correction record.

13:00 / 20:00:
- continue normal state refresh logic;
- append decision/execution/outcome events only when genuinely new evidence exists;
- do not create duplicate daily snapshots for ordinary intraday physiology unless the event is intentionally modelled as a separate material decision snapshot.

Training completion:
- ingest/reconcile the session into `Training Exposures`;
- attach it to the relevant decision where possible.

Next morning:
- link the new morning state to the prior day's decision/exposure as an outcome observation.

## What v1 deliberately does not do

- no opaque adaptive scoring;
- no machine-learning recommendation engine;
- no automatic causal claims from correlation;
- no new dashboard screen merely because data exists;
- no cross-source baseline pooling where measurement definitions differ;
- no coach/multi-athlete scale work.

## First longitudinal questions the system should eventually answer

- What is normal for this athlete rather than for a generic population?
- How does recovery typically respond to specific exposure families?
- Which session sequences preserve the next key quality exposure?
- Which local-tissue patterns override otherwise strong systemic recovery?
- Which interventions historically produce the best next-day or 48-hour response?
- Is a capability improving on matched evidence, and with what confidence?
- How does today's decision affect the current event runway and remaining exposure needs?

## Development sequence

1. Persist trustworthy daily state, including readiness and source-completeness invariants.
2. Persist training exposures.
3. Record decision -> choice -> execution.
4. Link next-state outcomes.
5. Build individual baselines and temporal relationships.
6. Deepen TRENDS with longitudinal reconstruction and exposure-response interpretation.
7. Add weekly/event trajectory reasoning.
8. Only then consider adaptive individual weighting.
