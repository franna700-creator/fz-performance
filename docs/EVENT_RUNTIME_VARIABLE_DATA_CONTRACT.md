# Event Runtime Variable-Data Contract

Date: 2026-09-10  
Status: Tranche 4.2 hardening contract

## Principle

Event data is runtime athlete/intelligence data, not release configuration.

The repository event/objective and event-format JSON files are bootstrap/reference fixtures only. Once the Neon objective graph exists, live FZ intelligence must read event identity, dates/date windows, participation state, objective role, target, strategic weight, format profile, capability demands, source evidence and transfer assessments from Neon.

An empty or incomplete runtime graph must never silently resurrect an old repository event seed. Missing runtime event data lowers confidence or withholds the decision.

## Athlete-driven evolution

Natural athlete communication may create or revise event runtime data without a Vercel deployment. ChatGPT remains the semantic ingestion layer and must preserve Athlete Voice/provenance while applying the canonical runtime mutation.

Examples include:
- considering a new event;
- confirming or withdrawing from an event;
- moving an event date;
- giving only an approximate date window;
- changing a target or objective role;
- clarifying event division/format;
- correcting organiser information for the athlete's own participation;
- supplying structure that qualifies a previously unknown event.

`DORMANT`/candidate events may exist without influencing current planning. Scheduled/active events may use exact dates or bounded approximate windows. The system must not manufacture an exact date.

## Event-format revisions

Shared format profiles must not be silently overwritten when athlete-specific or newly researched structure differs. A material format revision should be persisted as a new/versioned profile (or otherwise retain prior provenance), then the event objective points to the current profile. Source evidence remains in `fz_event_source_evidence`.

Directional transfer calibration is runtime evidence. The live engine reads current-profile assessments from `fz_event_transfer_assessments`; static repository transfer rules are not injected into a live Neon graph.

Because transfer assessments carry both source and target profile IDs, changing either profile makes an old assessment non-current automatically. Generic structural comparison may still operate while a new calibrated assessment is absent.

## Objective revisions and invalidation

Every material event/objective mutation should append an `fz_objective_revisions` record and source evidence where applicable. Recommendation identity must include revision-sensitive event evidence, so a changed date, profile, overlap or objective revision invalidates the previous shadow decision even when the event ID remains stable.

Runtime propagation is:

`athlete/research event evidence -> event.intake -> event.format/objective.graph -> event.demand_taxonomy -> event.intelligence -> capability.priority/measurement.hierarchy -> adaptive.context -> recommendation.shadow`

Shadow mode remains isolated from `recommendation.current` and TODAY.

## Bootstrap boundary

`config/objective-seed.json` and `config/event-format-profiles.json` are permitted for explicit bootstrap, fixtures and regression tests. They are not permitted as silent live fallbacks after the runtime graph is established.
