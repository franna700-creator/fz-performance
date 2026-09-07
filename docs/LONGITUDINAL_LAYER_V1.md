# FZ Performance Longitudinal Intelligence Layer v1

Status: ACTIVE DEVELOPMENT PHASE

Stabilisation status: v0.5.1 operational hardening remains at the final exit gate. Longitudinal development proceeds in parallel but must not weaken, bypass or redesign the locked production shell or release controls.

## Product intent

The longitudinal layer turns FZ Performance from a reliable daily decision system into a system with durable athlete memory.

The immediate objective is not more screens and not machine learning. It is to create a trustworthy, versioned history that can reconstruct:

1. what the system knew at the time;
2. what FZ interpreted;
3. what the athlete reported;
4. what decision space was presented;
5. what the athlete chose and actually executed;
6. what happened afterwards;
7. how the observation fits the athlete's wellness, exposure, capability and event trajectory.

North-star chain:

STATE -> RECOMMENDATION -> ATHLETE CHOICE -> EXECUTION -> RESPONSE -> LEARNING

## Phase-1 exit gate

FZ can select any prior day in the longitudinal cohort and reconstruct the athlete state as understood at that time, place it in preceding training/load and wellness context, show material athlete feedback, show the recommendation and confidence where captured, show actual execution where captured, and connect the day to subsequent response without silently recalculating history using today's rules.

## Core objects

### 1. Daily athlete state

The daily state has two compatible but distinct grains:

- `LIVE_CAPTURE`: the contemporaneous morning/decision anchor. It contains overnight physiology, the current FZ readiness state, current subjective/local state when known, recent load context and the active recommendation.
- `DAILY_CLOSE`: the completed calendar-day record written the next morning after Garmin Daily, lifestyle totals, activities and feedback have been reconciled.

Partial current-day movement/stress/energy must never be treated as a completed-day observation.

Minimum fields:
- snapshot ID and date
- captured-at timestamp or explicit historical-backfill status
- source coverage and completeness
- sleep, HRV, RHR, stress, Body Battery and relevant physiology at the correct grain
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

For every contemporaneous morning anchor after Longitudinal v1 activation:
- FZ readiness score is mandatory;
- readiness band/status is mandatory;
- the producing decision-logic version is mandatory;
- the immediately preceding completed Garmin Daily record must be confirmed historically complete before the new morning anchor is accepted;
- a missing completed Garmin Daily record is a DATA HEALTH exception and must not be silently tolerated;
- subjective/local state may still be missing if it was not explicitly captured, but must remain visibly missing rather than inferred from wearables.

Historical backfills are different. A historical readiness score is populated only when the exact contemporaneous FZ score can be recovered from a dated FZ artifact or master record. Historical readiness must never be recreated retrospectively using a newer decision engine and then presented as if it were the original score.

### 2. Training exposure

One record per meaningful training exposure/session. It describes more than sport + duration:
- source activity identity
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

One record for each material FZ recommendation cycle:
- daily-state ID
- recommendation options
- FZ preferred path
- confidence
- athlete selection
- execution result: planned / modified / different / rest / aborted
- linked exposure
- RPE or perceived difficulty when captured
- limiting factor
- immediate response
- next-morning response link
- outcome assessment
- logic version

The purpose is not to score compliance. It is to learn which decisions preserve or improve future training value.

### 4. Athlete Feedback

Athlete feedback is a first-class longitudinal dataset, not a notes footnote.

Multiple observations may exist in one day: `MORNING_STATE`, `PRE_SESSION`, `IN_SESSION`, `POST_SESSION`, `EVENING_STATE`, `NEXT_DAY_RESPONSE`, `RECOVERY_ATTEMPT` or another explicit context.

Persist:
- feedback ID/date/timestamp where known
- the raw or retained athlete note when available
- an FZ summary that preserves meaning
- overall feeling/freshness/energy only to the specificity supported
- local body area, soreness/pain, severity and function/gait where explicitly supplied
- motivation/intent
- session feel and RPE only when actually supplied
- cardiovascular vs muscular feel
- technique/mechanics
- fueling/hydration and relevant confounds
- links to Snapshot ID, Decision ID and Exposure ID
- capture source, extraction class, confidence and provenance

Rules:
- never manufacture numeric scores from qualitative language;
- preserve the original meaning before structuring it;
- a categorical FZ summary may be used when clearly marked derived;
- absence of feedback remains missing;
- wearable data cannot overwrite the athlete's local/function report;
- corrections supersede rather than silently replace prior feedback.

### 5. Wellness Baselines

FZ maintains source-consistent personal baselines rather than generic population thresholds wherever the cohort permits.

A baseline is metric + compatible grain + source + as-of cohort. Store:
- window start/end
- valid observation count
- maturity
- mean, median, SD and CV where appropriate
- latest comparable observation
- absolute/% deviation and optional z-score
- signal, interpretation, confidence and logic version

Baseline maturity:
- <10 valid = IMMATURE
- 10–27 = PROVISIONAL
- 28–41 = ESTABLISHED
- 42+ = MATURE

Morning/overnight metrics and completed-day lifestyle metrics are separate grains. Current partial-day stress, steps or energy are not directly compared with completed-day baselines.

Do not pool Apple HRV with Garmin overnight HRV unless measurement comparability is demonstrated. HRV is a response signal, not workload, and is always interpreted with recent load, sleep/RHR/stress, athlete feedback and subsequent performance.

### 6. Trend Interpretations

The interpretation ledger records material longitudinal relationships, not every fluctuation.

Every insight should use the structure:

OBSERVATION -> RELATIONSHIP -> ATHLETE FEEDBACK -> INTERPRETATION -> PERFORMANCE CONNECTION -> CONFIDENCE -> WHAT TO WATCH

Persist the evidence window, active logic version and provenance. Associations remain associations until repeated athlete-specific evidence supports stronger inference. Confidence should change as the cohort matures. Superseded interpretations remain attributable rather than disappearing.

### 7. Event context

Persistent event objects provide the strategic layer. Each event contains event ID/date/type/priority, phase, capability requirements, important future exposures, taper/recovery constraints, status and version.

Daily decisions are evaluated against event runway rather than readiness alone.

### 8. Logic registry

Every material interpretation/decision rule-set is versioned. Historical recommendations are evaluated using the rule version that produced them. New rules do not silently rewrite old decisions.

## Data architecture

Google Drive master remains the canonical analytical/audit layer during v1. The durable longitudinal tables are:

- `Longitudinal Daily`
- `Training Exposures`
- `Decision Outcomes`
- `Athlete Feedback`
- `Wellness Baselines`
- `Trend Interpretations`
- `Event Context`
- `Logic Registry`

These are analytical memory, not browser state. `PWA State` remains the current render contract.

The approved PWA shell remains visually stable while the longitudinal layer matures. The preferred future product direction is to deepen the existing TRENDS surface rather than add a new top-level HISTORY destination. Any TRENDS product expansion remains a separately gated PRODUCT RELEASE after stabilisation closure.

## TRENDS product questions

The future TRENDS surface should answer six questions rather than merely display charts:

1. **ATHLETE STATE — How am I changing?** Readiness, HRV, RHR, sleep, stress, Body Battery, subjective state and baseline position.
2. **RECOVERY RESPONSE — What am I tolerating?** Prior load -> overnight physiology -> athlete feeling -> subsequent capacity.
3. **PERFORMANCE — Am I actually getting better?** Matched AET, running efficiency, durability, station capacity and other comparable evidence.
4. **EXPOSURE COST — What does training cost me?** Local soreness/function, recovery duration, next-day readiness and effect on the next key quality exposure.
5. **ATHLETE VOICE — What have I been reporting?** Meaningful notes, local-state patterns, session feel and recurring confounds.
6. **TRAJECTORY — Is this moving me toward the event?** Capability progress, remaining exposure requirements, sequencing and event runway.

Charts are evidence surfaces. The conclusion and interpretation must be visible without forcing the athlete to decode the graph.

## Historical integrity rules

- Do not fabricate missing continuity.
- Do not silently convert missing wearable values to zero.
- Do not infer subjective state from wearable data.
- Do not use today's rules to rewrite yesterday's recommendation.
- Corrections must be attributable and versioned.
- Historical backfills must be labelled `HISTORICAL_BACKFILL`.
- Observation, Inference and Coaching Judgment remain distinct.
- From Longitudinal v1 activation forward, readiness persistence and completed prior-day Garmin Daily closure are non-negotiable daily invariants.
- A legacy observation that conflicts with or lacks canonical provenance may be retained as unresolved context but must not silently enter a personal baseline.

## Initial cohort and source depth

V1 uses the highest-confidence modern cohort first:
- reconciled Garmin Daily physiology from 17 Aug 2026 onward;
- Tredict executed training authoritative from 6 Jul 2026 onward;
- Garmin/Tredict deep session metrics and matched benchmark series where available;
- master-retained athlete feedback and explicit exercise-project feedback from the modern block;
- current event runway: Deadly Dozen 20 Sep 2026, HOKA Half Marathon Pretoria 24 Sep 2026, HYROX Johannesburg Solo Male 28 Nov 2026.

Older Apple Health / Strava / integrated history remains useful baseline context but is not automatically promoted into the same metric definitions. Source-consistent baseline rules remain in force.

## Operating workflow

### 06:00 morning cycle

1. Pull overnight Garmin recovery and close the prior calendar day.
2. Reconcile Garmin Daily, activities, Tredict activities/deep metrics, planned/executed work and relevant athlete feedback into the master.
3. Require exactly one historically complete Garmin Daily row for yesterday. If absent after the source-reconciliation attempt, raise DATA HEALTH failure; retain last-known-good production state rather than invent continuity.
4. Finalise yesterday's `DAILY_CLOSE` state with completed lifestyle/training data and feedback summary.
5. Refresh `Training Exposures` for any newly reconciled session and deduplicate before append.
6. Reconcile `Decision Outcomes`: athlete choice/execution only when observed; link exposure and immediate/next-morning response when supported.
7. Capture all material athlete feedback since the previous cycle into `Athlete Feedback`; do not manufacture ratings.
8. Refresh source-compatible `Wellness Baselines`, preserving grain and maturity rules.
9. Re-evaluate active `Trend Interpretations` and append/supersede only where a material relationship, confidence level or what-to-watch item changed.
10. Produce today's FZ readiness score, readiness band and decision under the active logic version.
11. Create today's `LIVE_CAPTURE` morning anchor. Readiness + band + logic version are mandatory.
12. Build `PWA State` and publish runtime state under the locked v0.5.1 master-first/atomic publication workflow.

### 13:00 / 20:00 cycles

1. Pull/reconcile only material same-day deltas.
2. Capture newly supplied athlete feedback and link it to the relevant snapshot/decision/exposure.
3. If a workout is newly completed, reconcile it into source tables then append exactly one Training Exposure.
4. Update the OPEN decision's athlete selection/execution/immediate response only when observed; never rewrite the original recommendation.
5. Do not create a new daily snapshot merely because time passed. Create an intraday LIVE_CAPTURE only if the material decision state genuinely changes.
6. Do not daily-close the current day; closure belongs to the next 06:00 cycle.
7. Refresh a wellness baseline or trend interpretation intraday only if newly compatible evidence materially changes it.
8. Continue the locked runtime-state publication process. Longitudinal write failure is reported separately unless it reveals a canonical master integrity failure.

### Feedback capture outside scheduled runs

When the athlete provides material natural-language feedback in conversation, preserve it as pending longitudinal evidence for the next scheduled reconciliation. The athlete should not need to complete a questionnaire. Relevant explicit detail such as `quads 6/10`, `felt exceptionally fresh`, `workout felt easier`, `gait abnormal`, `stopped because legs did not improve`, or a fueling/context note should be retained with timing and provenance.

## What v1 deliberately does not do

- no opaque adaptive scoring;
- no machine-learning recommendation engine;
- no automatic causal claims from correlation;
- no new dashboard page merely because data exists;
- no cross-source baseline pooling where measurement definitions differ;
- no forced daily questionnaire;
- no coach/multi-athlete scale work.

## Development sequence

1. Persist trustworthy morning state and daily closure.
2. Persist comprehensive training exposures.
3. Persist athlete feedback as structured linked evidence.
4. Persist decision -> choice -> execution -> response.
5. Maintain personal wellness baselines with maturity/confidence.
6. Build the longitudinal interpretation ledger and exposure-response relationships.
7. Deepen TRENDS around athlete state, recovery response, performance, exposure cost, athlete voice and trajectory.
8. Add weekly/event trajectory reasoning.
9. Only then consider adaptive individual weighting.
