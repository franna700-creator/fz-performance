# Tranche 4 — Adaptive Choice Architecture

Status: design target prepared during v0.7 consolidation. Not activated as coaching policy in v0.7.

## Athlete-facing model

Each day FZ owns a recommended **training intent**, while the athlete retains an explicit override:

- **ABSORB** — protect recovery while preserving useful movement and aerobic continuity. Usually low-cost aerobic or recovery-oriented work.
- **MAINTAIN** — preserve capability without creating a material new recovery burden. Technique, controlled aerobic, strength maintenance or mixed work can qualify.
- **ADAPT** — create a deliberate adaptation stimulus against the current priority or measurement gap. It may be higher intensity, but “harder” is not the definition.

FZ recommends one lane. The athlete can accept it or deliberately choose another. Override is evidence, not an error: it is persisted and its downstream response becomes part of Athlete Memory.

## Recommendation context

Lane selection and session ranking must consider, at minimum:

1. current physiology and recent change from personal baseline;
2. prior 24–72 h execution, NCL and local recovery cost;
3. Athlete Memory, including constraints, GI/fueling, local soreness, perceived cost and subjective readiness;
4. what was planned and what was actually executed;
5. modality preferences and learned response/recovery patterns over time;
6. event proximity, event priority and phase objective;
7. primary HYROX trajectory and measurement gaps;
8. sequencing — protecting the next more valuable session can be more adaptive than adding intensity today.

## Session choices

Future TODAY may expose three columns/lanes. Each lane can contain up to three ranked session options. The same modality may appear in more than one lane at different dose/structure; the lane describes intended training effect, not equipment.

Each option should state:

- modality and structure;
- target duration/dose/intensity;
- why it fits this lane today;
- expected training value;
- expected recovery cost;
- success/stop condition;
- what evidence or gap it targets;
- confidence and material assumptions.

## Persistence / audit

The current ledger already supports recommendation/decision source records and athlete accepted/modified events. Future implementation should persist:

- FZ recommended lane and recommendation version;
- ranked options considered;
- athlete selected lane/option;
- whether selection matched or overrode FZ;
- override reason if supplied;
- actual executed session identity;
- subsequent athlete response and physiology;
- whether the choice improved or worsened the predicted outcome.

Historical sessions may receive an inferred ABSORB/MAINTAIN/ADAPT label only when evidence is sufficient. The inference must carry confidence and never rewrite raw source history.

## Tranche boundary

### v0.7 foundation
Dynamic sources, late-bound Athlete Memory, monotonic Trends evidence, richer canonical training identity, inferred historical intent, and 4.1 materiality observability.

### Tranche 4.2 — recomputation
Material evidence triggers a versioned re-evaluation of current state and next-session recommendation. This is where `RECOMPUTE_RECOMMENDATION` becomes an actual action rather than an observed requirement.

### Tranche 4.3 — athlete choice
Add the ABSORB / MAINTAIN / ADAPT control. Persist FZ recommendation, athlete acceptance/override and decision provenance.

### Tranche 4.4 — session composer
Generate and rank up to three concrete options per lane from event plan, trajectory/gaps, recent execution, physiology, Athlete Memory, preferences and learned response cost.

## Safety rule

An athlete override does not bypass a `SAFETY_OVERRIDE`. Safety constraints remain a higher-order gate than lane preference.

## Event/objective intelligence foundation

Adaptive choice consumes a versioned event/objective graph rather than a fixed race list. Strategic priority and event proximity are separate signals. A nearby validation/secondary event can influence sequencing without displacing the primary development objective.

Events link to reusable capabilities with demand and transfer weights. Shared capability evidence may transfer across events (for example, compromised running between Deadly Dozen and HYROX), but event-specific demands preserve non-interchangeability.

The current v0.7 foundation resolves HYROX as the primary strategic event, the Hoka Half as a secondary 1:50 performance target, and Deadly Dozen as a sub-60 validation event rather than an active development target. `Maintain fitness` exists as a dormant evergreen objective and requires confirmation before activation after event-specific priorities change.

### Qualified event context requirement
Tranche 4.2 must consume `event.intelligence`, not raw event names. A future event contributes to recommendation recomputation only after its structure has passed the event knowledge gate through athlete-confirmed structure or adequate sourced research. Cross-event overlap is directional and capability-scoped. `TRANSFER_POTENTIAL` is not itself `NET_TRAINING_VALUE`; 4.2 must still account for recovery cost, opportunity cost, taper/interference and local constraints before using an event as a reason to alter today's recommendation.
