# FZ Performance — Event Demand Taxonomy v1

Status: PREPARED ARCHITECTURE · item 27

## Purpose

FZ needs one reusable language for describing what an event demands before it can reason about overlap, transfer, evidence or recommendation value. Event names remain important, but event names are not the intelligence model.

The taxonomy therefore separates **event-specific structure** from **shared demand dimensions**. HYROX, Deadly Dozen and a half marathon can share useful dimensions without becoming interchangeable.

## Canonical domains

The v1 registry covers running structure, work/station density, transition frequency, mixed-modality sequencing, locomotion, carry/grip, squat/lunge, hinge/posterior chain, push/pull, overhead work, ergs, sleds, glycolytic burden, muscular endurance, interrupted pacing and local tissue cost.

Structural facts such as total run distance, running-bout count, typical bout length and station count remain literal. Normalised 0–1 scores describe relative event demand, not athlete ability.

## Invariants

- Unknown demand is not zero demand.
- A shared dimension does not make two events equivalent.
- Event-specific station/order/load detail is retained alongside the reusable taxonomy.
- Transfer remains directional: event A can support event B differently from B supporting A.
- New events map into the taxonomy after the event knowledge gate is satisfied; insufficiently understood events remain research-pending.

## Runtime boundary

Adding or changing an athlete event does not change this taxonomy. It is a runtime data operation that maps the event into already-deployed dimensions. The taxonomy itself changes only when FZ introduces a genuinely new canonical demand concept.
