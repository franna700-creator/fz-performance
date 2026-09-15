# Phase 5 — Training Exposure contract

## Product question

Training Exposure extends **TRENDS** so the athlete can interrogate what training was actually accumulated over time without collapsing unlike work into a fabricated universal volume number.

The surface must answer:
- how much time was spent training;
- which modalities contributed that time;
- how much canonical relative cardio load/intensity was accumulated where Tredict HR-zone evidence supports it;
- what modality-specific volume is available (for example running distance);
- how those exposures differ over 7-day, 28-day and user-selected date windows.

## Canonical ownership

This is a projection over existing canonical training evidence and `/api/trends/current`.

No new athlete-state store, database table, recommendation model or independent load formula is introduced.

Canonical session identity, modality classification, duration, distance, HR-zone distribution and NCL remain owned by the existing training-evidence/TRENDS pipeline.

## Exposure dimensions

### Time
Universal exposure measure. Aggregate `durationMin` only where duration is present. Missing duration remains missing and is reported in coverage metadata.

### Relative load / intensity
Use existing canonical NCL only:
`low HR-zone minutes × 1 + moderate × 2 + high × 4`.

No substitute FZ load score may be inferred when NCL is unavailable.

HR-zone composition may be shown where `hrDistributionSeconds` exists.

### Volume
Volume stays modality-specific. Initial release supports running distance (`distanceKm`) and does not add metres/calories/tonnage unless their source semantics are explicitly qualified in a later tranche.

## Window semantics

- **7 DAYS**: inclusive current/end date and prior six local dates.
- **28 DAYS**: inclusive current/end date and prior 27 local dates.
- **CUSTOM**: inclusive athlete-selected start/end date constrained to the canonical response range.

A zero is valid only when the canonical session set proves no matching exposure in that window. Missing evidence is never converted to zero.

## Filters

Initial modality filters:
- ALL
- RUNNING
- STRENGTH
- CYCLING / ASSAULT BIKE
- ROWING
- SKI ERG
- ELLIPTICAL
- MOBILITY / WALKING
- OTHER

Filtering is presentation-level and operates over the canonical session exposure projection.

## UI hierarchy

1. Training Exposure heading and plain-language interpretation.
2. Date-window controls (7d / 28d / custom).
3. Modality filters.
4. Measure controls (TIME / LOAD / VOLUME).
5. Summary strip for defensible totals and evidence coverage.
6. Longitudinal stacked exposure chart.
7. Modality composition / detail rows.
8. Coverage and provenance note.

## Quality rules

- Never sum kilometres, metres, repetitions, calories and minutes into one number.
- Never infer NCL from duration when HR-zone detail is missing.
- Never treat a workout with missing duration/load detail as a zero-duration/load workout.
- Mixed/OTHER sessions stay visible rather than being silently reclassified.
- Existing matched-performance and capability logic is untouched.
- Routine future workouts populate this surface through canonical runtime sync; no deployment is required for athlete-state evolution.
