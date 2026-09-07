# FZ Performance

Canonical source for the FZ Performance PWA shell.

## Operating model

- **STATE REFRESH**: Garmin + Tredict + subjective → reconcile master → validate → interpret → PWA State → runtime-state publication. No shell release.
- **PRODUCT RELEASE**: UI, interaction, charting, presentation logic or schema capability. Preview + browser smoke test + production verification required.
- **PLATFORM RELEASE**: routing, caching, service-worker, runtime transport, domains, hosting or security. Strictest release gate.

Production shell is deliberately boring: static HTML/CSS/JS. The browser fetches one same-origin `/api/runtime-state` JSON response. Server-side transport compatibility reconstructs the current legacy state chunks; that workaround is not exposed to the browser.
