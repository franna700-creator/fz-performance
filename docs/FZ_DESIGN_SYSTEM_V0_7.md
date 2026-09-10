# FZ Performance Design System — v0.7

Status: RELEASE CONTRACT

## Purpose
FZ Performance should feel like one living athlete operating system, not a collection of separately developed dashboards. Visual consistency is a product invariant.

## Brand anchors
- Brand black: `#050505`.
- Brand yellow: `#f5cf19`, matching the FZ application mark.
- Yellow means FZ-selected, active, actionable, or a warning that needs attention. It is not sprayed across decorative UI.
- Green communicates healthy/current/positive system state.
- Red communicates failure, safety concern, or invalid/blocked state.
- Neutral greys carry provenance and secondary information.

## Information hierarchy
1. Decision / current athlete state.
2. What changed or is live now.
3. Evidence and longitudinal meaning.
4. Provenance / quality / system diagnostics.

Density must come from grouping and hierarchy, not unreadably small text.

## Surface jobs
- TODAY: current athlete state, live physiology, current training focus, current FZ recommendation.
- TRENDS: longitudinal change, exposure cost, performance evidence, response patterns, trajectory.
- TRAIN: canonical training execution and Athlete Memory.
- SYSTEM: freshness, provenance, dynamic-integrity health and adaptive-intelligence observability.

A concept should have one primary home. Other pages may link or summarise it, but must not create parallel truth.

## Living-state UI
A living UI means the interface visibly reflects source freshness and new canonical evidence. It does not mean constant animation.

Required behaviour:
- persisted truth paints first;
- live-source freshness is labelled truthfully;
- source persistence causes canonical rereads across dependent surfaces;
- stale, delayed, pending and unavailable states remain visibly distinct;
- subtle motion may indicate an actually LIVE source only;
- reduced-motion preferences are honoured.

## Shared components
All surfaces consume one visual token sheet for:
- backgrounds and surface elevation;
- text hierarchy and contrast;
- FZ accent;
- status semantics;
- radii and borders;
- spacing;
- controls and focus states;
- charts and tooltips.

New page-specific CSS may define layout, but should not invent new brand colours, control semantics or status patterns.

## Interaction standard
- Primary interactive targets use at least a 44 px control height on touch layouts.
- Keyboard focus is always visible.
- Hover cannot be the only way to discover state or data.
- Charts that support scrubbing retain keyboard/pointer access.
- Motion is enhancement only, never information-bearing by itself.

## Release rule
`fz-design-system.css` is the authoritative visual semantics layer and is loaded last. Any future tranche that introduces a new visual primitive must extend this system or explicitly document why a new primitive is necessary.
