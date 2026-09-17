# Canonical shell build

`npm run build` runs release/config preflight, builds the neutral application
shell, then runs the canonical architecture, schema and runtime regression gates.

`scripts/build.mjs` copies these current, reviewable inputs directly into `dist`:

- `src/shell/index.html`: neutral loading states, five-page navigation and ordered runtime assets;
- `src/shell/manifest.webmanifest` and `icon.svg`: PWA identity;
- `src/shell/release-ui-contract.json`: presentation capabilities and complete asset inventory;
- the declared `src/*.js`, `src/*.css` and hero images: unchanged browser assets.

The existing `4.6-secure-athlete-choice` shell capability identifier is retained;
`buildArchitecture: CANONICAL_SOURCE_COPY` identifies the Tranche 5 build path.
Athlete state remains owned by canonical APIs, including the server-owned
`/api/runtime-state` presentation contract.

The build validates every input before replacing `dist`. It never rewrites source,
reconstructs an archived release, injects HTML, or generates static athlete truth.
The base stylesheet is now ordinary source in `src/app.css`; its bytes and
style order are preserved to avoid changing the accepted interface.

The retired payload and patch scripts remain recoverable in Git history only.
Their fixes are already in canonical source and remain covered by regression tests.

`build-source-smoke.mjs` builds in a temporary directory containing only `src`,
verifies deterministic output and unchanged source, exercises obsolete-output
removal and missing-input failure, and guards runtime module ordering. Desktop
and mobile browser workflows include shell/build changes in their path filters.

Production still follows `docs/ZERO_FAILURE_RELEASE_STANDARD.md`: one staged
Production build, immutable read-only acceptance, then promotion of that same
deployment. Git auto-deployment remains disabled.
