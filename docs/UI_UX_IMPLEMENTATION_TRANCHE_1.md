# FZ Performance UI/UX — Implementation Tranche 1

Status: RELEASE CANDIDATE CONTRACT

## Objective
Translate the approved FZ Performance UI/UX North Star into a production-ready responsive TODAY experience without changing canonical athlete-state logic or introducing unavailable product capability. TODAY is Phase 1 of the wider UI overhaul and is the reference implementation for subsequent surfaces.

## Product direction
The FZ visual identity is clean, sleek, data-driven, dense and innovative. The product should balance premium restraint with race-focused energy while remaining broadly hybrid-performance rather than event-brand-specific.

The colourful high-fidelity concept is the primary visual benchmark for hierarchy, icon treatment, restrained semantic colour, card density and athlete-facing polish. The approved hybrid-performance hero artwork is the brand grounding for real-world training energy, recommendation prominence and visual tone. Implementation must combine the strengths of both rather than reproduce either image literally.

## Navigation direction
Desktop uses a top-side navigation shell rather than the legacy left rail. The shell keeps the FZ brand mark, active page, date/freshness context and primary navigation in one compact horizontal band. TODAY / TRENDS / TRAIN remain primary. SYSTEM remains available but visually subordinate.

Mobile remains a full vertical feed with persistent bottom navigation. The top mobile area is compact brand/date context only; it must not duplicate the desktop navigation pattern or consume excessive vertical space.

## TODAY hierarchy
TODAY is recommendation-led. The current FZ decision is dominant, readiness/recovery supports it inside the hero, compact live physiology follows, Daily FZ Thought and training context are then ordered for intentional desktop/mobile scanning, with provenance and detailed physiology available through progressive disclosure.

The page must answer: how am I, what should I do, why, and what matters next.

## Typography
The redesign avoids the large, inconsistent header-size jumps of the legacy shell. Use a deliberate type scale with one dominant recommendation headline, a compact page title, consistent section headings and readable supporting copy. Small uppercase labels are reserved for true metadata/kicker use and should not become the default language of the interface.

## Colour and iconography
FZ yellow remains the primary brand accent, with restrained semantic accent colours where they improve scanning and interpretation. Colour belongs mainly in icons, live/freshness states, metric direction, selected navigation and progress/decision cues.

Semantic families: green for positive/current/supportive recovery, cyan/blue for cardio/heart-rate context, violet for sleep/recovery, yellow for FZ decision/action, and red/orange only for warning/constraint states. Colour must remain accessible and never be the only carrier of meaning.

## Photography and imagery
TODAY uses dedicated responsive hybrid-performance hero assets: one desktop composition and one mobile composition. The implementation must select the appropriate asset by breakpoint rather than forcing a single crop across devices. Future imagery across TRENDS / TRAIN should inherit the same crop, overlay and readability discipline rather than relying on arbitrary stock photography.

## Goals & Progress
Goals & Progress is deliberately excluded from tranche 1 until TODAY is stable. It remains an explicit next capability/surface and is tracked separately. No decorative goal cards or fabricated progress percentages may appear before a canonical goal/progress contract is ready for athlete-facing use.

## No-placeholder rule
A feature is visible only when an operational end-to-end contract exists. Planned subjective check-in, future journal actions, unreleased goal workflows and other roadmap concepts may be accounted for in layout planning, but must not appear as fake controls or decorative placeholders.

## Daily FZ Thought
The quote feature is a real product component, not static copy. It uses one deterministic thought per Africa/Johannesburg calendar day, remains motivational, reflective or occasionally instructional, is always visible on TODAY, stays concise enough for desktop and mobile, and has a deterministic local fallback.

## Responsive model
Desktop retains information density through hierarchy and grouping rather than small type. Mobile becomes a full vertical feed with persistent bottom navigation. Mobile intentionally promotes the hero, Daily FZ Thought, compact physiology and training in a different flow from desktop rather than simply stacking desktop cards.

## Freshness semantics
Freshness is part of meaning. LIVE, STALE, PENDING and UNAVAILABLE must be visually distinguishable. Live physiology and the last interpreted FZ recommendation must never imply that they share the same timestamp when they do not.

## Architecture boundaries
This tranche is presentation evolution only. Preserve existing runtime-state, wellness, training, trends and system contracts; do not change readiness or recommendation algorithms; do not hard-code athlete truth into static UI; do not change database/schema; and do not deploy to production until preview, CI and visual review pass.

## Acceptance criteria
- top-side desktop navigation replaces the legacy left rail;
- recommendation-led hero is the dominant decision surface;
- readiness score supports the recommendation instead of competing with it;
- compact live physiology is immediately scannable and detailed scrub/refresh controls remain operational;
- Daily FZ Thought rotates by SAST day;
- desktop and mobile behaviour are intentionally designed and tested together;
- mobile retains a bottom tab bar;
- typography follows the locked scale without legacy header-size jumps;
- goals/progress is absent from tranche 1 but tracked as a post-stability workstream;
- dedicated responsive hybrid-performance imagery is used for the hero;
- no unavailable feature is shown;
- existing athlete-mode navigation and underlying contracts continue to function;
- stale/pending/unavailable states remain truthful;
- keyboard focus and reduced-motion behaviour remain intact;
- superseded TODAY v1 compatibility assets are absent from the release build.
