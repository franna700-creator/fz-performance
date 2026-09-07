# FZ Performance Reliability & Release Standard v0.5

## Core rule
Tooling workarounds must never become browser runtime architecture.

## Health layers
1. **Platform** — deployment/HTTP availability.
2. **Application** — browser boot, navigation, charts and interaction.
3. **Data** — master validation, state freshness and provenance.

## Failure policy
Fail stale, not dead. If runtime state cannot be loaded, use the last validated browser state; if none exists, render the embedded last-known-good shell state. A source or state failure must not produce a blank application.

## Release gate
1. Build final assets.
2. Syntax/static validation.
3. Preview deployment.
4. Browser smoke test: TODAY/TRENDS/TRAIN/SYSTEM, date, 06/13/20 countdown, state load, charts, scrubbing.
5. Record rollback deployment.
6. Promote exact tested artifact.
7. Repeat production smoke test.
8. Roll back immediately if critical assertion fails.

## Caching
- Navigation: no-store / network authoritative.
- Runtime state: no-store.
- Static assets: revalidate until hashed asset pipeline is introduced.
- No cache-first service worker in v0.5. Legacy FZ workers/caches are removed on boot.

## Graph interaction
Trend charts support pointer, touch and keyboard scrubbing. Scrubbing reveals the nearest actual observation rather than interpolating or inventing values.
