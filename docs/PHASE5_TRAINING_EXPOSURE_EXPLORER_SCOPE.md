# Phase 5 — Training Exposure Explorer Scope

## Purpose
Turn the canonical training history already held by FZ into a filterable exposure view that answers:

- How much have I trained?
- What modalities have I actually accumulated?
- How has that changed across 7-day and 28-day windows?
- Where has the training cost come from?
- How much running / erg / strength exposure have I accumulated?
- Has recent load shifted toward or away from the primary objective?

This is a projection/UI feature over existing canonical training truth. It does not create a new athlete-state store or replace Tredict load semantics.

## Placement
Primary home: **TRENDS**, as a new `Training Exposure` section / explorer.

TRAIN remains the session-level execution record. TRENDS owns longitudinal aggregation and comparison.

## Canonical inputs already available
- session date/time
- canonical modality/classification
- duration
- distance where valid
- calories where valid
- HR-zone distribution / heart-rate effort where available
- Tredict-derived NCL / daily load
- adaptive intent/lane
- running metrics where available
- strength sets, reps, weight and exercise labels where available in canonical workout detail
- source/provenance and evidence quality

## Core interaction
### Date range
- 7 days
- 28 days
- custom range (bounded to available canonical history)

### Rolling overlay
- none
- 7-day rolling
- 28-day rolling
- both, when visually legible

### Filters
- all training
- modality: Running, Bike/Assault Bike, Row, Ski, Elliptical, Strength, Walking/Recovery, Other
- session intent/lane: ABSORB / MAINTAIN / ADAPT
- intensity/load availability
- exercise/session type where canonical classification supports it

## Views
### 1. Time exposure
Stacked time by modality. This is the universal common denominator across modalities.

### 2. Relative training load
Use the existing Tredict-derived NCL / HR-zone load contract. Do not introduce a second competing load model.

Current FZ load contract: low HR-zone minutes ×1 + moderate ×2 + high ×4, preserving missing != zero and monotonic best-available evidence.

### 3. Modality-specific volume
Do not sum unlike units into one synthetic volume value.

Examples:
- Running: km + minutes + load
- Row/Ski/Erg: metres or distance when valid, minutes + load
- Bike/Assault Bike/Elliptical: minutes as primary; distance/calories only when source semantics are trustworthy and comparable
- Strength: sets / reps / tonnage when canonical set detail exists; otherwise duration + load only

### 4. Composition / distribution
For the selected period show:
- total training time
- sessions
- modality share of time
- modality share of NCL/load
- low / moderate / high intensity time where available
- running km
- strength sets / tonnage where available
- rolling 7d vs rolling 28d load

## Visual direction
- stacked bars/area for modality exposure over time
- 7d and 28d rolling load lines
- modality chips for filtering
- compact summary strip for totals
- no decorative health score
- missing evidence is shown as unknown/pending, never zero
- source/evidence caveat visible where a metric is only partially populated

## Architecture constraints
1. Canonical session truth remains in existing training stores.
2. Existing Tredict-derived NCL semantics remain authoritative for relative load.
3. TRAIN remains the drill-down destination for individual sessions.
4. TRENDS performs aggregation only; it must not mutate training truth.
5. No mixed-unit aggregate "volume score".
6. Sparse later source data must not erase richer historical evidence.
7. Custom date filtering must operate over canonical history, not hard-coded fixture windows.
8. 7d/28d calculations must retain missing-data semantics.

## Likely implementation gap
The current dynamic TRENDS contract already exposes daily load, rolling 7d/28d load, running relationships and training-intent sessions. It will need a projection extension that aggregates canonical sessions by modality and exposes modality-specific volume/detail. This should reuse existing canonical metrics/workout detail rather than create a new athlete schema.

## Release sequencing
Do not interrupt the already-frozen Phase 4 SYSTEM release. Implement this as a subsequent controlled UI/software tranche after Phase 4 reaches production acceptance.
