# FZ Performance UI/UX — Implementation Tranche 1

Status: IMPLEMENTATION CONTRACT

## Objective
Translate the approved FZ Performance UI/UX North Star into a real responsive TODAY experience without changing canonical athlete-state logic or introducing unavailable product capability.

## Product direction
The FZ visual identity is clean, sleek, data-driven, dense and innovative. The product should balance premium restraint with race-focused energy while remaining broadly hybrid-performance rather than event-brand-specific.

## TODAY hierarchy
TODAY is ordered by athlete priority: current FZ recommendation / decision; live physiology; readiness and recovery interpretation; current training state / execution context; Daily FZ Thought; provenance and freshness detail through progressive disclosure.

The page must answer: how am I, what should I do, why, and what matters next.

## No-placeholder rule
A feature is visible only when an operational end-to-end contract exists. Planned subjective check-in, future journal actions, unreleased goal workflows and other roadmap concepts may be accounted for in layout planning, but must not appear as fake controls or decorative placeholders.

## Daily FZ Thought
The quote feature is a real product component, not static copy. It uses one deterministic thought per Africa/Johannesburg calendar day, prevents immediate consecutive-day repeat, draws from curated categories (discipline, consistency, recovery, execution, perspective and adaptation), remains motivational, reflective or occasionally instructional, is always visible on TODAY, remains concise enough for desktop and mobile, and has a deterministic local fallback.

## Responsive model
Desktop retains information density through hierarchy and grouping rather than small type. Mobile becomes a full vertical feed with persistent bottom navigation. Mobile priority order is recommendation, live physiology, readiness context, training state, Daily FZ Thought, then lower-priority detail.

## Freshness semantics
Freshness is part of meaning. LIVE, STALE, PENDING and UNAVAILABLE must be visually distinguishable. Live physiology and the last interpreted FZ recommendation must never imply that they share the same timestamp when they do not.

## Architecture boundaries
This tranche is presentation evolution only. Preserve existing runtime-state, wellness, training, trends and system contracts; do not change readiness or recommendation algorithms; do not hard-code athlete truth into static UI; do not change database/schema; and do not deploy to production until preview, CI and visual review pass.

## Acceptance criteria
- recommendation-led hero is the dominant decision surface;
- readiness score supports the recommendation instead of competing with it;
- live physiology is grouped and scannable;
- Daily FZ Thought rotates by SAST day;
- desktop and mobile behaviour are intentional and tested together;
- mobile retains a bottom tab bar;
- no unavailable feature is shown;
- existing athlete-mode navigation and underlying contracts continue to function;
- stale/pending/unavailable states remain truthful;
- keyboard focus and reduced-motion behaviour remain intact.
