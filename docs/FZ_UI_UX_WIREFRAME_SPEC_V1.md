# FZ Performance Desktop + Mobile Wireframe Specification — v1

Status: PLANNING
Date: 2026-09-14

## 1. Purpose

This specification converts the North Star and information architecture into implementation-oriented layout guidance without inventing unsupported product features.

The first target is TODAY. TRAIN and TRENDS follow the same hierarchy principles.

---

## 2. Desktop TODAY wireframe

Viewport target: 1280–1600 px wide.

### Shell

- Persistent left navigation, compact and visually quiet.
- Main content max width approximately 1400–1500 px.
- Top row contains date/current-state freshness and low-priority utility controls.
- Primary nav order: TODAY, TRAIN, TRENDS, SYSTEM.

### Content sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FZ PERFORMANCE     TODAY  TRAIN  TRENDS  SYSTEM       Date / freshness     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RECOMMENDATION HERO                                      DAILY FZ THOUGHT  │
│  ┌─────────────────────────────────────────────────────┐  ┌──────────────┐  │
│  │ State / lane                                        │  │ Quote image  │  │
│  │ Human recommendation headline                      │  │ Daily quote  │  │
│  │ Why this is the decision                           │  │              │  │
│  │ [Readiness context] [Current prescription/action]  │  │ Rotates day │  │
│  └─────────────────────────────────────────────────────┘  └──────────────┘  │
│                                                                             │
│  LIVE PHYSIOLOGY                                                           │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────────────┐  │
│  │ Recovery anchors │ │ Strain / energy  │ │ Activity today              │  │
│  │ HRV / Sleep / RHR│ │ BB / Stress / HR │ │ Steps / active min / kcal   │  │
│  └──────────────────┘ └──────────────────┘ └─────────────────────────────┘  │
│                                                                             │
│  TODAY'S TRAINING                         KEY TREND / RECENT RESPONSE        │
│  ┌─────────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Current selected prescription       │  │ One decision-relevant trend  │  │
│  │ Session structure / key constraint  │  │ Small chart + interpretation │  │
│  │ Open exact execution → TRAIN        │  │ Open evidence → TRENDS       │  │
│  └─────────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                             │
│  OPTIONAL MATERIAL CONTEXT                                                  │
│  Event proximity / latest athlete response only when actually relevant      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Desktop hero rules

- Recommendation is the visual focal point.
- Readiness score is integrated as evidence, not isolated as a competing hero.
- Hero copy should use one strong headline and no more than two supporting paragraphs/lines before disclosure.
- Exact prescription CTA links to TRAIN.
- Staleness, if material, appears directly in the hero state rather than only in provenance text.

### Desktop quote rules

- Quote card is always visible on TODAY.
- It may use hybrid-performance imagery with dark overlay.
- Quote text remains readable and visually separate from training recommendation language.
- The component is editorial and must not look like an instruction generated from current readiness unless that relationship truly exists.

---

## 3. Mobile TODAY wireframe

Viewport target: 360–430 px wide.

The mobile home is a full vertical feed. Bottom navigation remains fixed.

```
┌───────────────────────────────┐
│ FZ PERFORMANCE        14 SEP  │
│ freshness/status if material  │
├───────────────────────────────┤
│ RECOMMENDATION HERO           │
│ State / lane                  │
│ Human decision headline       │
│ Why                           │
│ Readiness context             │
│ [Open training prescription]  │
├───────────────────────────────┤
│ DAILY FZ THOUGHT              │
│ image / quote / daily marker  │
├───────────────────────────────┤
│ LIVE PHYSIOLOGY               │
│ Recovery anchors              │
│ HRV · Sleep · RHR             │
│                               │
│ Strain / energy               │
│ Body Battery · Stress         │
│                               │
│ Activity today                │
│ Steps · Active minutes        │
├───────────────────────────────┤
│ TODAY'S TRAINING              │
│ selected prescription         │
│ key constraint / target       │
│ [Open exact execution]        │
├───────────────────────────────┤
│ KEY TREND / RECENT RESPONSE   │
│ compact visual + meaning      │
├───────────────────────────────┤
│ optional relevant context     │
│ event / recent athlete voice  │
├───────────────────────────────┤
│ Today  Train  Trends   More   │
└───────────────────────────────┘
```

### Mobile interaction rules

- No horizontal carousel for primary state or recommendation.
- Metric groups may use two-column sub-grids internally, but the groups themselves remain vertically ordered.
- Detail expands in-place or opens a bottom sheet.
- Primary action targets remain at least 44 px high.
- Bottom nav: Today, Train, Trends, More.
- SYSTEM lives under More in Athlete Mode.

---

## 4. TRAIN wireframe direction

Desktop:

- current prescription at top;
- exact execution details immediately below;
- Training Memory timeline beneath;
- session cards expand for source metrics, linked Athlete Voice, comparison class and provenance.

Mobile:

- current prescription first;
- one-tap expand for exact sequence;
- chronological training feed;
- session detail opens bottom sheet or dedicated detail view.

Do not add a separate Journal truth surface.

---

## 5. TRENDS wireframe direction

TRENDS starts with interpretation, not charts.

Top summary band:

- improving;
- stable;
- unresolved / measurement gap.

Then evidence sections:

- recovery response;
- exposure cost;
- matched performance trajectory;
- capability trajectory;
- event-linked context where relevant.

Each chart should include a plain-language takeaway immediately above or beside it.

Mobile uses one chart per card and prioritises horizontal touch scrubbing over multi-chart density.

---

## 6. SYSTEM wireframe direction

SYSTEM retains high information density because its audience includes the owner/operator.

Athlete Mode:

- top status summary;
- only exceptions and stale/pending conditions prominent;
- deeper provenance behind expanders.

Owner/operator use may retain denser technical panels.

---

## 7. Visual tokens to explore in implementation

- Background: #050505 / #070707 range.
- Surface 1: near-black matte.
- Surface 2: slightly raised charcoal.
- Primary text: warm white.
- Secondary text: muted warm grey.
- Accent: FZ yellow #f5cf19.
- Success: muted performance green.
- Danger: restrained red reserved for failure/safety.
- Radius: 12–18 px depending on component scale.
- Strongest shadow/elevation only for recommendation hero, modal/sheet, and image cards.

Typography should use the existing system stack initially; a later controlled brand typography decision can be made if a licensed/custom face is desired.

---

## 8. Responsive rules

### >= 1200 px
- side nav;
- hero + quote side by side;
- physiology three-group row;
- training + trend two-column band.

### 768–1199 px
- side nav may compact;
- hero full width;
- quote moves below or to narrower secondary column depending on width;
- physiology 2 + 1 layout;
- training and trend stack if needed.

### < 768 px
- side nav removed;
- bottom nav active;
- full vertical feed;
- hero first;
- quote second;
- metric groups stacked;
- one primary chart/card per row;
- technical provenance moved to More / drill-down.

---

## 9. What must not appear merely because it looked good in concept art

- Messages
- Search
- Calendar page
- Dedicated Journal nav
- Decorative mood controls
- Dedicated Goals nav
- race-brand-specific UI language
- unsupported progress percentages
- generic AI Coach labels that duplicate the FZ recommendation engine

These remain excluded unless separately justified and implemented.

---

## 10. First implementation tranche recommendation

A first UI release should change presentation before expanding capability:

1. navigation order and mobile bottom bar;
2. recommendation hero consolidation;
3. grouped live physiology;
4. training action hierarchy;
5. Daily FZ Thought only if its rotating editorial contract is implemented;
6. TRENDS summary-first presentation;
7. TRAIN timeline refinement;
8. SYSTEM Athlete Mode demotion;
9. responsive QA across desktop and mobile.

No production deployment should occur from this planning branch. Implementation should use a separate controlled release branch after visual direction is approved.
