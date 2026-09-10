# FZ Performance Event & Objective Graph

Status: v0.7 FOUNDATION CONTRACT — prepared, not active coaching policy.

## Why this exists
FZ Performance must not hard-code a training plan around a fixed list of races. Events can be added, removed, completed, cancelled or reprioritised. The architecture must absorb those changes without rewriting recommendation logic.

The model therefore separates:

1. **Event** — a dated competition or checkpoint.
2. **Objective** — what that event means to the athlete.
3. **Capability demand** — what physical/performance abilities the event requires.
4. **Strategic priority** — how important that event is to longer-term development.
5. **Near-term execution pressure** — how proximity should influence sequencing, taper and dose.
6. **Evergreen objective** — a non-event goal such as maintaining fitness when no event-specific objective is primary.

## Current hierarchy

### HYROX Johannesburg · 28 Nov 2026
Role: **PRIMARY**.

This remains the strategic development compass. The model should prefer HYROX-relevant measurement and adaptation even when nearer events temporarily influence the next few days.

### Hoka Half Marathon Pretoria · 24 Sep 2026
Role: **SECONDARY**.
Target: **1:50:00**, approximately 5:13/km.

It materially informs running economy, aerobic durability, pacing and tolerance, but does not replace HYROX as the primary objective.

### Deadly Dozen UJ · 20 Sep 2026
Role: **VALIDATION**.
Desired outcome: **sub-60 minutes**. Previous result: **61 minutes in May 2026**.

The event is not treated as an active development target. Its proximity can influence taper/sequencing and it provides useful hybrid/compromised-running evidence.

## Shared capability transfer
Events are not interchangeable. They may share capability demands.

Examples:
- Deadly Dozen and HYROX both require compromised running and mixed-modality repeatability.
- Hoka and HYROX both contribute useful evidence around running economy and aerobic durability.
- HYROX still contains event-specific station strength-endurance and race-specific interaction that the other events cannot validate directly.

The graph therefore stores a demand weight and transfer weight for each event-capability relationship. Shared evidence can inform another event in proportion to transferability; it never makes two events equivalent.

## Strategic priority vs near-term pressure
These are deliberately separate.

**Strategic capability priority** answers: what should development and measurement ultimately optimise?

**Near-term execution pressure** answers: what should change in the next few days because an event is close?

This prevents a close secondary/validation event from overtaking the primary objective simply because of date proximity.

## Dynamic event lifecycle
Supported event states:
- SCHEDULED
- ACTIVE
- COMPLETED
- CANCELLED

Completed/cancelled events stop driving current planning but remain historical evidence. New events can be inserted with their own role, objective and capability links.

## Post-event fitness
`Maintain fitness` is represented as an evergreen objective. It is currently **DORMANT**. When no primary event remains, FZ may surface it as the next objective candidate, but activation requires athlete confirmation. The end of HYROX must not silently rewrite the athlete's goals.

## Tranche boundary
v0.7 establishes the contract and deterministic graph logic only. Tranche 4.2 may consume this context during recommendation recomputation. Tranche 4.3 adds athlete lane choice. Tranche 4.4 uses event/capability priority when composing concrete sessions.

## Event knowledge gate
Event role/priority and event-format knowledge are deliberately separate. FZ may know that an event is scheduled before it knows enough to reason from it. A new event therefore enters through `event.intake`; its format is athlete-confirmed or adequately researched; only a qualified `event.intelligence` profile may feed capability priority and later adaptive recommendations.

This allows event calendars to remain flexible without hard-coding event families. It also preserves uncertainty: `RESEARCH_REQUIRED` means “context exists, transfer is not yet known,” not “the event has no value.”
