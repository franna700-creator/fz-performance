# Tranche 4.3 — Systemic Propagation + Athlete Choice

Status: development branch design and implementation contract.

## North star

FZ Performance is a closed-loop, athlete-centred performance operating system that continuously reconciles physiology, training execution and Athlete Voice into a single longitudinal truth, understands what has changed and why in the context of the athlete’s goals, constraints and learned responses, and turns that intelligence into timely, explainable and adaptive training decisions while preserving athlete agency.

## Problem being corrected

The runtime dependency graph already describes broad invalidation, but the executable paths are narrower:

- Athlete Voice capture can persist Athlete Memory, evaluate 4.1 materiality and trigger 4.2 shadow recomputation, yet the main PWA can continue reading an older validated runtime snapshot.
- Training source sync can persist/reconcile source evidence and trigger the 4.2 shadow engine, yet UI refresh is currently driven by workout-specific polling and a compatibility `focus` event.
- Normalised Cardio Load is correctly withheld when HR-zone detail is absent, but Tredict detail ingestion omitted the API flag that returns `intensityDistribution` / `zonesDistribution`, leaving otherwise available evidence permanently pending.
- The production athlete-ingest GET contract currently reports `writeConfigured=false`, so conversation understanding cannot be treated as proof that canonical runtime ingestion occurred.

The correction is therefore systemic: evidence ingestion, propagation, recommendation and UI freshness must have one observable contract.

## Architecture principles

1. Neon remains operational truth. Pages are consumers, never owners.
2. The immutable validated runtime snapshot remains the base-state anchor. Live evidence may overlay and supersede the decision interpretation without rewriting historical state in place.
3. A lightweight intelligence revision reports whether canonical truth has changed. The PWA polls this cheaply while visible; a revision change triggers a full canonical reread.
4. Upstream Garmin/Tredict sync remains throttled separately from the cheap revision poll.
5. `Refresh FZ` means source sync -> Athlete Memory reconciliation -> materiality -> adaptive context -> recommendation -> dependent UI reread. It is not an Athlete Voice-only or workout-only refresh.
6. Missing data remains missing. Refresh must never manufacture zero load, rest, readiness or capability weakness.
7. Every athlete-input ingest must be observable: event identity, persistence status, materiality status, recommendation status and affected surfaces.
8. 4.2 shadow history remains append-only and isolated. 4.3 may activate an athlete-facing recommendation from the same deterministic evaluation, but must not erase the shadow audit trail.
9. Athlete override is evidence, not error. It becomes canonical Athlete Memory and can trigger a subsequent recommendation recomputation.
10. Safety override remains above athlete lane preference.

## NCL correction

The existing NCL formula remains unchanged:

`NCL = (low seconds + 2 × moderate seconds + 4 × high seconds) / 60`

Tredict activity detail must be requested with `extraValues=1`, because this is what returns `summary.intensityDistribution` / `summary.zonesDistribution`. Once enriched detail is re-ingested, existing monotonic best-available evidence logic resolves previously pending dates without rewriting missing data as zero.

No database migration is required.

## Intelligence revision

A canonical revision fingerprint should include at minimum:

- runtime-state pointer/version;
- latest athlete-event identity;
- latest training-source record identity;
- latest wellness evidence timestamp;
- latest FZ intelligence/recommendation/decision record identity;
- latest objective revision/update marker.

`GET /api/intelligence/current` is read-only and cheap. It returns the revision, freshness markers, pending propagation status, active recommendation/choice and affected surfaces.

## Propagation refresh

`GET /api/intelligence/refresh` is an idempotent reconciliation action, not an arbitrary athlete-data mutation. It may:

- refresh throttled wellness/training sources when requested;
- reconcile late Athlete Memory links;
- materialise missing 4.1 assessments for canonical athlete events that have not yet been assessed;
- recompute 4.2 shadow recommendation when decision-driving evidence changed;
- create/update the 4.3 active recommendation;
- return the new revision and exact affected surfaces.

The PWA manual action invokes this path. Automatic polling calls the cheap `current` endpoint first and only invokes propagation when the contract reports pending work.

## Tranche 4.3 active choice

The existing source/event schema is sufficient:

- FZ recommendation -> `fz_training_source_records.record_type='recommendation'`
- athlete choice -> `record_type='decision'`
- accepted lane -> `fz_athlete_events.event_type='ATHLETE_ACCEPTED'`
- override -> `event_type='ATHLETE_MODIFIED'`

The existing Adaptive Choice schema already supports ABSORB / MAINTAIN / ADAPT, a recommended lane and athlete selection. No Neon migration is required.

4.3 activates lane choice only. Concrete ranked session options remain 4.4 and may therefore be empty arrays in the 4.3 contract.

### Recommendation lifecycle

1. Canonical evidence changes.
2. Materiality/adaptive context recomputes.
3. 4.2 shadow evaluation is persisted for audit.
4. 4.3 active recommendation is persisted with a stable decision/context fingerprint.
5. TODAY shows the active FZ-recommended lane and explanation.
6. Athlete accepts or overrides.
7. Decision is persisted with provenance.
8. That decision becomes Athlete Memory and may itself change subsequent adaptive context.

A new recommendation context creates a new decision identity. Prior choices remain historical.

## Athlete-choice write security

The production PWA is currently readable without an athlete-authenticated mutation channel, and the existing athlete-event POST is bearer-token protected while its GET contract reports `writeConfigured=false`.

4.3 must not solve this by exposing `FZ_STATE_WRITE_TOKEN` to browser JavaScript or by accepting anonymous arbitrary athlete decisions. Backend choice persistence can be implemented against the existing schema, but an interactive PWA choice control must remain gated until a secure same-athlete write session/pairing mechanism is present.

This is an architecture requirement, not a reason to weaken write security.

## Acceptance gates

- A canonical athlete event cannot remain invisible to the propagation contract.
- New Athlete Voice changes the intelligence revision without a deployment.
- PWA visible-state poll detects revision change within the configured near-real-time interval.
- Manual `Refresh FZ` rereads TODAY, TRAIN, TRENDS and SYSTEM after propagation.
- NCL resolves when Tredict enriched zone distribution exists; missing detail remains a gap when it genuinely does not.
- Source sync/no-op polling does not create duplicate recommendation decisions.
- 4.2 shadow remains immutable/auditable.
- 4.3 recommendation is versioned and references the context fingerprint.
- Accept/override never rewrites the FZ recommendation that preceded it.
- Override reason is preserved when supplied.
- Safety override cannot be bypassed by lane selection.
- No Vercel deployment is required for routine athlete feedback, workouts, source reconciliation or recommendation recomputation after the architecture is deployed.
