# FZ Performance UI/UX Component Readiness Matrix — v1

Status: PLANNING
Date: 2026-09-14

## Readiness labels

- LIVE_REFACTOR: underlying capability exists; redesign may use it.
- LIVE_KEEP: operational and conceptually correct; mainly visual consolidation.
- DESIGN_PREP: prepare the design and contract, but do not show it live until the workflow is complete.
- FUTURE: outside the current implementation scope.
- ADMIN_ONLY: operational but secondary in Athlete Mode.

| Component | Readiness | Direction |
|---|---|---|
| FZ Recommendation hero | LIVE_REFACTOR | Consolidate recommendation, current state, reason and training action into the dominant hero |
| Readiness score | LIVE_REFACTOR | Use as supporting evidence; never imply currency when interpreted state is stale |
| Recovery narrative | LIVE_REFACTOR | Human-language interpretation with drill-down evidence |
| Live physiology | LIVE_REFACTOR | Group into recovery anchors, current strain/energy and activity today |
| Source freshness | LIVE_KEEP | Keep quiet when healthy; elevate stale/delayed/unavailable states |
| Current training prescription | LIVE_REFACTOR | Place immediately after the hero; exact execution remains in TRAIN |
| Training Memory | LIVE_KEEP | Present as a clean execution timeline/journal |
| Session-linked Athlete Voice | LIVE_KEEP | Keep attached to relevant training sessions |
| Athlete Voice trend view | LIVE_REFACTOR | Summarise material longitudinal patterns in TRENDS |
| HRV / sleep charts | LIVE_REFACTOR | Interpretation first, chart second |
| NCL / exposure cost | LIVE_REFACTOR | Retain in TRENDS with clear quality-gap treatment |
| Matched AET trajectory | LIVE_REFACTOR | Preserve comparison classes; improve visual comparison |
| Capability trajectory | LIVE_REFACTOR | Use priority, direction and evidence strength with drill-down |
| SYSTEM provenance | ADMIN_ONLY | Keep available but visually demote in Athlete Mode |
| Daily FZ Thought | DESIGN_PREP | Create a curated daily quote source and local-day rotation before shipping |
| State-aware quote selection | DESIGN_PREP | Only add when explicit selection logic exists |
| Athlete-supplied hero image | DESIGN_PREP | Define asset storage, desktop/mobile crop and overlay rules |
| In-app subjective check-in | DESIGN_PREP | Design now; keep absent until capture, persistence, materiality and downstream propagation work end-to-end |
| Mood / soreness quick controls | DESIGN_PREP | Same dependency as subjective check-in |
| Goals / event progress summary | DESIGN_PREP | Canonical objectives exist; expose only once a stable presentation contract is defined |
| Event countdown / proximity | DESIGN_PREP | Surface only when dynamically read and materially relevant |
| Calendar page | FUTURE | Do not add simply because concept art shows one |
| Messages | FUTURE | No current approved product need |
| Search | FUTURE | No current athlete need established |
| Separate Journal nav item | FUTURE | Avoid duplicating TRAIN / Athlete Memory truth |
| Dedicated Goals nav item | FUTURE | Consider later after core redesign |

## Promotion rule

A DESIGN_PREP component becomes eligible for live UI only when its source contract, interaction behaviour, state handling, propagation implications, responsive behaviour and regression coverage are defined. It must not create parallel athlete truth.

## First redesign release scope

Use existing operational capability first: shell/navigation refinement, recommendation hero, grouped live physiology, readiness/recovery presentation, current training action, improved TRENDS and TRAIN hierarchy, SYSTEM demotion and responsive mobile full-feed behaviour.

Daily FZ Thought may join the first release only if a minimal rotating quote contract is implemented as part of the same controlled software release. A single hard-coded permanent quote is not acceptable.
