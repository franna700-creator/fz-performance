# FZ Performance

Canonical source for the FZ Performance PWA shell and runtime gateway.

## Operating model

- **STATE REFRESH**: Garmin + Tredict + subjective → reconcile master → validate → interpret → PWA State → immutable runtime-generation publication. No shell release.
- **PRODUCT RELEASE**: UI, interaction, charting, presentation logic or schema capability. Preview + browser smoke test + production verification required.
- **PLATFORM RELEASE**: routing, caching, service-worker, runtime transport, domains, hosting or security. Strictest release gate.

## v0.5.1 reliability baseline

The production shell is deliberately simple static HTML/CSS/JS. The browser fetches one same-origin `/api/runtime-state` JSON response. Runtime state is published as content-addressed immutable generations with an atomic `current.json` current/previous pointer, end-to-end checksums and server-side previous-generation fallback. Publication is monotonic and uses an optimistic base-generation check to prevent overlapping jobs from racing.

Formal contracts live in `schemas/`. The exact publication procedure is in `docs/STATE_PUBLICATION_PROTOCOL.md`. GitHub Actions performs static/schema checks on source changes and a real Chromium production smoke test hourly.
