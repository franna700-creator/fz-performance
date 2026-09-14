# FZ Performance UI/UX North Star — v1

Status: PLANNING / DESIGN DIRECTION
Date: 2026-09-14
Scope: Product presentation and experience only. No athlete truth, canonical state, recommendation logic, or source contract is moved into the UI layer.

## 1. Product intent

FZ Performance should feel like a premium hybrid-performance operating system rather than a generic fitness dashboard or engineering console.

The interface should convert dense longitudinal athlete intelligence into a clear sequence:

**What matters now -> what FZ recommends -> why -> supporting evidence -> deeper detail when requested.**

The product may remain data-dense, but density must come from hierarchy, grouping, and progressive disclosure rather than small text or equally weighted cards.

## 2. Brand character

Authoritative athlete-defined brand words:

- Clean
- Sleek
- Data-driven
- Dense
- Innovative

The visual character should balance premium minimalism with race-focused energy. The product should not be HYROX-branded or HYROX-specific. It should feel at home in the broader hybrid-performance category: running, strength, erg work, race preparation, recovery, and multi-modal performance.

## 3. Visual direction

Retain the established FZ core:

- near-black / charcoal foundations;
- warm white primary text;
- FZ yellow as the principal accent;
- green and red only for state semantics;
- compact, precise typography;
- calm depth through contrast, spacing, and restrained elevation.

Evolve the presentation toward:

- fewer visible borders;
- stronger typographic scale differences;
- more deliberate negative space around decision surfaces;
- richer imagery in controlled hero/quote areas;
- stronger relationship between data visualisation and interpretation;
- reduced reliance on small uppercase telemetry labels.

FZ yellow means selected, actionable, current focus, or important attention. It should not become decorative wallpaper.

## 4. Experience principles

### Decision before telemetry
The athlete should never need to assemble the recommendation mentally from multiple unrelated widgets.

### Human before machine
Athlete-facing copy should interpret state in natural language. Quantitative evidence remains available, but internal system terminology should not dominate athlete-facing surfaces.

### Dense, not crowded
Show substantial information, but group it into meaningful systems: recovery, physiology, training, trajectory, and evidence.

### One concept, one primary home
Avoid parallel truth. TODAY summarises current state. TRENDS owns longitudinal change. TRAIN owns execution memory. SYSTEM owns provenance and integrity.

### Progressive disclosure
The first layer answers the athlete's question. The second layer provides evidence. The third layer exposes technical provenance.

### No fake capability
A control, check-in, insight, or feature must not appear in the live product unless the underlying workflow is operational. Future capability may be designed and documented, but not shipped as a decorative placeholder.

### Desktop and mobile are co-designed
Mobile is not a collapsed desktop. The same hierarchy must be preserved through a full-feed mobile experience with a bottom tab bar.

## 5. Athlete priority order

The athlete-defined information priority is:

1. Live physiology
2. Readiness / recovery
3. Training decision
4. Trends
5. Goals
6. Athlete Voice

The TODAY hero remains recommendation-led. Therefore the visual hierarchy is:

- recommendation as hero decision;
- live physiology as the first supporting evidence layer;
- readiness/recovery as the interpreted state layer;
- training action immediately adjacent or next in sequence.

This resolves the distinction between information importance and visual hero role.

## 6. TODAY experience

TODAY should feel like the athlete's command surface rather than a dashboard index.

### Above-the-fold desktop sequence

1. FZ Recommendation hero
2. Current readiness / recovery context integrated into or directly supporting the hero
3. Live physiology summary grouped by meaning
4. Today's training action / selected prescription
5. Daily FZ Thought visible without scrolling where practical

### Full-feed mobile sequence

1. Compact brand/date header
2. Recommendation hero
3. Daily FZ Thought
4. Live physiology summary
5. Readiness / recovery context
6. Today's training / prescription
7. Key trend or recent-response card
8. Recent execution / goals when relevant
9. Deeper cards continue in feed
10. Bottom navigation remains fixed

## 7. Daily FZ Thought

The quote feature is a permanent TODAY component.

Requirements:

- rotates once per local calendar day;
- no duplicate quote on consecutive days;
- source set may contain motivational, reflective, and occasionally instructional statements;
- tone must remain performance-oriented, grounded, and non-cheesy;
- quote presentation may use controlled hybrid-athlete imagery;
- quote selection must not imply athlete-specific advice unless the selection engine explicitly supports contextual matching;
- absent contextual logic, quotes are daily editorial content rather than recommendations.

Future enhancement may allow state-aware categories such as recovery, discipline, race build, consistency, patience, execution, and resilience. This should be implemented only when selection logic is explicit and testable.

## 8. Imagery direction

Photography should feel real, tactile, and hybrid-performance oriented:

- indoor training environments;
- running / track / road work;
- ergs;
- sleds / carries / strength work;
- warm-up / recovery moments;
- race-preparation energy without event-brand dependence.

Athlete-supplied imagery may be used in hero or quote treatments once explicitly supplied for production use.

Image rules:

- dark overlay / gradient must preserve text contrast;
- avoid generic stock-fitness aesthetic;
- retain real texture and movement;
- mobile crop must be separately art-directed;
- imagery supports the content hierarchy and never replaces data meaning.

## 9. Navigation direction

### Desktop
Primary navigation remains compact and persistent.

Recommended athlete-facing hierarchy:

- TODAY
- TRAIN
- TRENDS
- SYSTEM / MORE

SYSTEM should remain accessible but visually demoted in Athlete Mode because it is an integrity/provenance surface rather than a primary athlete task.

### Mobile
Use a fixed bottom tab bar. Initial target:

- Today
- Train
- Trends
- More

SYSTEM, settings, provenance detail, and lower-frequency utilities can sit under More unless a future workflow justifies a dedicated tab.

## 10. Surface responsibilities

### TODAY
Current state, live physiology, readiness interpretation, FZ recommendation, today's prescription, Daily FZ Thought.

### TRAIN
Canonical execution memory, current prescription detail, completed sessions, athlete-response evidence, session-linked Athlete Voice, drill-down metrics.

### TRENDS
Longitudinal change, recovery response, exposure cost, matched performance evidence, capability trajectory, event markers, measurement gaps.

### SYSTEM
Freshness, source health, provenance, canonical integrity, pending/reconciliation state, adaptive-intelligence observability.

## 11. Accessibility and interaction baseline

- 44 px minimum touch targets on mobile.
- Visible keyboard focus.
- Colour never carries meaning alone.
- Charts remain pointer, touch, and keyboard accessible where interactive.
- Motion communicates liveliness only when a source is genuinely live.
- Reduced-motion preference is respected.
- Text over imagery must maintain strong contrast.
- Small metadata should be grouped rather than shrunk below practical readability.

## 12. Delivery boundary

This North Star is a controlled product-design direction. It does not authorize deployment or alteration of canonical athlete logic.

UI changes are software changes and should follow the normal controlled release path. Routine athlete-state updates remain runtime data operations and must not require a UI deployment.
