# FZ Performance Event Intelligence Ingestion Standard

Status: v0.7 FOUNDATION CONTRACT — prepared, not active recommendation policy.

## Core rule
An event name/date is **context**, not sufficient intelligence.

Before a new event may influence capability priority, recommendation context or cross-event evidence, FZ must understand what the athlete is actually expected to do. That structure may come from:

1. athlete-supplied/confirmed event structure; or
2. adequate research, preferring official rulebooks/event organisers and retaining source provenance.

If neither exists, the event can remain scheduled but its transfer state is `RESEARCH_REQUIRED`. FZ must not guess the format or silently assign training value.

## Intake workflow
`EVENT COMMUNICATED -> IDENTITY/DATE -> FORMAT KNOWLEDGE GATE -> DEMAND FINGERPRINT -> PRIMARY-OBJECTIVE OVERLAP -> CAPABILITY LINKS -> DOWNSTREAM RECOMPUTE`

### 1. Event signal
Capture name, date, division/variant where known, location where material, intended role and athlete objective.

### 2. Format knowledge gate
FZ checks whether it knows:
- exact event family/division;
- sequence/round structure;
- running/locomotion distance and segment structure;
- stations, order, reps/distances/loads where applicable;
- transition pattern;
- material execution rules;
- provenance and verification date.

Incomplete structure creates a research requirement. It does not create a speculative capability profile.

### 3. Demand fingerprint
A qualified format is translated into reusable dimensions:
- modalities;
- movement families and exact subtypes;
- running structure;
- transition density;
- aerobic/high-aerobic demands;
- mixed-modality repeatability;
- strength-endurance/local tissue demand;
- pacing/execution demand;
- event-specific skills.

### 4. Directional overlap
Overlap is always assessed **from the event into the current primary objective** (and can be assessed in reverse separately). It is directional because 21.1 km continuous running can support HYROX running durability without HYROX necessarily proving half-marathon durability to the same degree.

The assessment records:
- transferable capabilities;
- movement/station overlap;
- running overlap;
- sequence/transition overlap;
- capability gaps;
- event-specific areas not validated.

### 5. Transfer value is not equivalence
A secondary/validation event may be strongly supportive of a primary objective. That does not make the events interchangeable and does not allow FZ to infer unsupported capabilities.

Example: Deadly Dozen can strongly inform HYROX compromised running, carries, burpee locomotion and mixed-modality repeatability. It cannot validate SkiErg, RowErg, sled or wall-ball-specific proficiency.

### 6. Transfer potential is not net training value
`TRANSFER_POTENTIAL` asks whether doing/performance in this event can support or inform the primary objective.

`NET_TRAINING_VALUE` requires additional context: recovery cost, opportunity cost, taper interference, injury/tissue risk, event proximity and what valuable training would otherwise occur. This second decision belongs in Tranche 4.2.

A high-overlap event may therefore be useful evidence but still be a poor choice on a particular date.

## Dynamic events
A newly communicated event must not require source-code changes. The intake resolver should:
- create/update the event candidate;
- attach or research a format profile;
- qualify the profile;
- derive capability/overlap context;
- promote it into the objective graph;
- trigger the transitive dependency graph.

Rescheduling, cancellation, role change or new source information uses the same pathway.

## Athlete vs external source conflict
Athlete-entered schedule and researched source data are separate evidence. Conflicts are surfaced explicitly. Athlete-confirmed schedule remains active when the athlete resolves the discrepancy.

For Deadly Dozen UJ 2026, Francois confirmed on 10 Sep 2026 that he is racing **Sunday 20 Sep 2026**. The prior external-site discrepancy is retained as provenance but is resolved for FZ runway/taper calculations.

## Future intelligence use
Tranche 4.2 consumes the qualified event-intelligence context, not raw event names. This allows FZ to reason:

> What does this event test, how does that overlap with the primary objective, what evidence would it add, what remains untested, and is the timing/cost positive enough to influence today's recommendation?
