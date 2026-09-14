# FZ Performance UI/UX — Implementation Tranche 1

Status: IMPLEMENTATION CONTRACT

## Objective
Translate the approved FZ Performance UI/UX North Star into a real responsive TODAY experience without changing canonical athlete-state logic or introducing unavailable product capability.

## Product direction
The FZ visual identity is clean, sleek, data-driven, dense and innovative. The product should balance premium restraint with race-focused energy while remaining broadly hybrid-performance rather than event-brand-specific.

The colourful high-fidelity concept is the primary visual benchmark for hierarchy, icon treatment, restrained semantic colour, card density and athlete-facing polish. The photo-led FZ prototype is the brand grounding for real-world imagery, recommendation prominence and hybrid-performance tone. Implementation must combine the strengths of both rather than reproduce either image literally.

## Navigation direction
Desktop uses a top-side navigation shell rather than the legacy left rail. The shell should keep the FZ brand mark, active page, date/freshness context and primary navigation in one compact horizontal band. TODAY / TRENDS / TRAIN remain primary. SYSTEM remains available but visually subordinate.

Mobile remains a full vertical feed with persistent bottom navigation. The top mobile area is compact brand/date context only; it must not duplicate the desktop navigation pattern or consume excessive vertical space.

## TODAY hierarchy
TODAY is ordered by athlete priority: current FZ recommendation / decision; live physiology; readiness and recovery interpretation; current training state / execution context; Daily FZ Thought; provenance and freshness detail through progressive disclosure.

The page must answer: how am I, what should I do, why, and what matters next.

## Typography
The redesign must avoid the large, inconsistent header-size jumps of the legacy shell. Use a deliberate type scale with one dominant recommendation headline, a compact page title, consistent section headings and readable supporting copy. Small uppercase labels are reserved for true metadata/kicker use and should not become the default language of the interface.

## Colour and iconography
FZ yellow remains the primary brand accent, but the interface may use restrained semantic accent colours to improve scanning and reduce monochrome fatigue. Colour belongs mainly in icons, live/freshness states, metric direction, selected navigation and progress/decision cues.

Recommended semantic families: green for positive/current/supportive recovery, cyan/blue for cardio/heart-rate context, violet for sleep/recovery, yellow for FZ decision/action, and red/orange only for warning/constraint states. Colour must remain accessible and must never be the only carrier of meaning.

## Photography
Use the athlete-supplied training photograph primarily in the TODAY hero / editorial brand layer first. Do not spread photography across every surface until the TODAY composition is stable. Future TRENDS / TRAIN photographic use should inherit explicit crop, overlay and readability rules from this tranche.

## Goals & Progress
Goals & Progress is deliberately excluded from tranche 1 until TODAY is stable. It remains an explicit next capability/surface and must be tracked in the roadmap rather than forgotten. No decorative goal cards or fabricated progress percentages may appear before a canonical goal/progress contract is ready for athlete-facing use.

## No-placeholder rule
A feature is visible only when an operational end-to-end contract exists. Planned subjective check-in, future journal actions, unreleased goal workflows and other roadmap concepts may be accounted for in layout planning, but must not appear as fake controls or decorative placeholders.

## Daily FZ Thought
The quote feature is a real product component, not static copy. It uses one deterministic thought per Africa/Johannesburg calendar day, prevents immediate consecutive-day repeat, draws from curated categories (discipline, consistency, recovery, execution, perspective and adaptation), remains motivational, reflective or occasionally instructional, is always visible on TODAY, remains concise enough for desktop and mobile, and has a deterministic local fallback.

## Responsive model
Desktop retains information density through hierarchy and grouping rather than small type. Mobile becomes a full vertical feed with persistent bottom navigation. Mobile priority order is recommendation, Daily FZ Thought, live physiology, readiness context, training state, then lower-priority detail.

## Freshness semantics
Freshness is part of meaning. LIVE, STALE, PENDING and UNAVAILABLE must be visually distinguishable. Live physiology and the last interpreted FZ recommendation must never imply that they share the same timestamp when they do not.

## Architecture boundaries
This tranche is presentation evolution only. Preserve existing runtime-state, wellness, training, trends and system contracts; do not change readiness or recommendation algorithms; do not hard-code athlete truth into static UI; do not change database/schema; and do not deploy to production until preview, CI and visual review pass.

## Acceptance criteria
- top-side desktop navigation replaces the legacy left rail;
- recommendation-led hero is the dominant decision surface;
- readiness score supports the recommendation instead of competing with it;
- live physiology is grouped, colourful enough to scan and operational controls remain available;
- Daily FZ Thought rotates by SAST day;
- desktop and mobile behaviour are intentional and tested together;
- mobile retains a bottom tab bar;
- typography follows the locked scale without legacy header-size jumps;
- goals/progress is absent from tranche 1 but tracked as a post-stability workstream;
- athlete photography is hero/editorial-first rather than sprayed across the UI;
- no unavailable feature is shown;
- existing athlete-mode navigation and underlying contracts continue to function;
- stale/pending/unavailable states remain truthful;
- keyboard focus and reduced-motion behaviour remain intact.