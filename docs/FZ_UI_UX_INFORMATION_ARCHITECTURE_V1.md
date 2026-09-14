# FZ Performance Information Architecture — v1

Status: PLANNING
Date: 2026-09-14

## 1. Design objective

The information architecture must preserve canonical truth while presenting each concept once, in the surface best suited to its job.

The experience should optimise for athlete decision-making, not system exposition.

## 2. Primary architecture

### TODAY — Current decision surface
Primary question: **What matters today and what should I do?**

Core modules:

- FZ Recommendation hero
- Readiness / recovery interpretation
- Live Physiology grouped summary
- Today's training decision / prescription
- Daily FZ Thought
- Recent response / one key trend
- Event proximity summary when materially relevant

TODAY may summarise data owned elsewhere, but should not create competing truth.

### TRAIN — Execution and memory
Primary question: **What am I doing, what did I do, and how did I respond?**

Core modules:

- Current selected training prescription
- Exact execution detail
- Training Memory timeline
- Session cards
- Athlete-response events linked to sessions
- Session metrics and source detail on drill-down
- Training sync / source status only when relevant

### TRENDS — Longitudinal meaning
Primary question: **What is changing and what does the evidence say?**

Core modules:

- Improving / stable / unresolved summary
- Recovery response
- Exposure cost / NCL
- Matched diagnostic performance
- Running / modality relationship views
- Capability trajectory
- Measurement gaps
- Event markers where useful
- Athlete Voice trends derived from canonical Athlete Memory

### SYSTEM — Integrity and provenance
Primary question: **Can I trust what the app is showing and what is pending?**

Core modules:

- runtime freshness
- source connectivity
- canonical state validation
- reconciliation / pending items
- provenance
- adaptive-intelligence observability
- publication / refresh state

Athlete Mode should visually demote this surface without removing access.

## 3. TODAY information hierarchy

### Layer 1 — Decision
Recommendation, lane, prescription summary, current training action.

### Layer 2 — Current state
Live physiology and readiness/recovery interpretation.

### Layer 3 — Context
Daily FZ Thought, recent response, near-term event context, one key longitudinal signal.

### Layer 4 — Detail
Drill-downs to TRAIN, TRENDS, or SYSTEM.

## 4. Data grouping model

### Live Physiology
Group raw values by athlete meaning rather than source field:

**Recovery anchors**
- HRV
- sleep score / duration
- resting HR

**Current strain / energy**
- Body Battery
- current / average stress
- current heart rate when useful

**Activity today**
- steps
- active minutes
- active calories
- distance

The UI should prefer directional interpretation where supported. A number without meaningful comparison should remain a number; do not fabricate baseline interpretation.

## 5. Goals and events

Goals are lower-priority athlete context than current physiology, readiness, training decision, and trends.

Recommended handling:

- do not create a dedicated TODAY block unless an objective is materially close or affecting current recommendation;
- maintain event/objective context in TRENDS or a future Goals/Calendar surface;
- surface proximity on TODAY only when it changes the current decision.

## 6. Athlete Voice

Athlete Voice remains canonical context, not a decorative journal feature.

Current display rules:

- session-linked feedback belongs primarily in TRAIN;
- longitudinal Athlete Voice patterns belong in TRENDS;
- TODAY may surface the most recent material athlete input only when it affects current interpretation.

A new in-app subjective check-in control must not appear until capture, persistence, materiality, propagation, and feedback behaviour are operational end-to-end.

## 7. Daily FZ Thought architecture

The Daily FZ Thought is editorial content with a stable daily identity.

Recommended runtime shape:

- quote_id
- text
- optional author/source attribution
- category
- tone: MOTIVATIONAL | REFLECTIVE | INSTRUCTIONAL
- active_from / active_to or deterministic daily selection
- image treatment key
- approval status

The quote component must not write athlete state or influence readiness unless a future explicit recommendation relationship is introduced.

## 8. Desktop navigation

Recommended visible order:

**TODAY | TRAIN | TRENDS | SYSTEM**

The visual emphasis should strongly favour TODAY, TRAIN, and TRENDS. SYSTEM is lower-frequency and can be visually quieter.

## 9. Mobile navigation

Fixed bottom tab bar:

**Today | Train | Trends | More**

More contains:

- System
- Settings
- provenance / diagnostics entry points
- future lower-frequency utilities

The mobile home is a continuous full feed rather than a compact tile-only control panel.

## 10. Cross-surface linking

TODAY -> TRAIN: open current prescription or Training Memory.

TODAY -> TRENDS: open the trend supporting a current interpretation.

TODAY -> SYSTEM: open freshness / provenance only when stale, delayed, pending, or requested.

TRAIN -> TRENDS: open related capability or matched-performance trajectory.

TRENDS -> TRAIN: open the session that created a point, exposure, or athlete-response event.

SYSTEM -> owner surface: technical detail remains available without contaminating athlete-facing copy.

## 11. Empty / loading / stale principles

### Loading
Persisted canonical truth paints first. Background refresh may update the living surface.

### Empty
Explain what is missing without implying failure or normality.

### Stale
Stale data is visibly distinct from live data. Do not label stale metrics LIVE.

### Pending
Pending reconciliation or derived interpretation remains pending; it does not become zero, normal, or current.

## 12. Current implementation implications

The existing TODAY, TRENDS, TRAIN, and SYSTEM model remains structurally valid. The redesign should therefore be treated mainly as a presentation and interaction refactor, not a reinvention of canonical state.

Primary architecture changes to investigate during implementation:

- navigation order TODAY / TRAIN / TRENDS / SYSTEM;
- mobile More destination for SYSTEM;
- grouped physiology component replacing equal-weight metric tile sprawl;
- consolidated recommendation hero;
- stronger TRENDS summary hierarchy;
- progressive disclosure for provenance and source detail.
