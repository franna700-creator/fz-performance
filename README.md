# FZ Performance

Canonical source for the FZ Performance PWA shell and its dynamic runtime contracts.

## Operating model

- **LIVE SOURCE REFRESH**: Garmin physiology and Tredict/Garmin training evidence update independently of shell deployment. Persisted Neon state paints first; sources check in the background; successful persistence causes immediate canonical reread.
- **INTELLIGENCE STATE**: scheduled FZ interpretation/recommendation state remains versioned and separate from live metric freshness. Normal intelligence cadence is 06:00 / 20:00 SAST.
- **PRODUCT RELEASE**: UI, interaction, derivation capability or schema change. One deliberate pinned Preview, browser acceptance, then exact-candidate production promotion.
- **PLATFORM RELEASE**: hosting/routing/runtime transport/security. Strictest gate.

## v0.7 systemic dynamic runtime baseline

v0.7 makes dynamic truth a product invariant across physiology, training, Athlete Memory and Trends.

Training source ingestion is append-only. Derivations follow `MONOTONIC_BEST_AVAILABLE`: newer evidence wins where present, while older richer evidence can fill fields that a newer sparse payload omits. This prevents live refresh from making known NCL/running evidence disappear.

Athlete Memory can late-bind. Pre-workout context may remain standalone, but clear in-session/post-session feedback is re-evaluated whenever canonical workout evidence arrives and links automatically when confidence is sufficient.

Raw source labels remain provenance. The PWA may derive a more useful canonical workout identity from Tredict, Garmin and linked Athlete Memory, with explicit confidence. Historical ABSORB / MAINTAIN / ADAPT intent is descriptive only in v0.7.

SYSTEM exposes both Tranche 4.1 materiality and broad Dynamic Runtime Integrity so stale/missing relationships can be seen as system state rather than discovered ad hoc from an individual chart.

See `docs/DYNAMIC_RUNTIME_CONSISTENCY_STANDARD.md`, `docs/RELEASE_V0_7_0_ACCEPTANCE.md` and `docs/TRANCHE_4_ADAPTIVE_CHOICE_ARCHITECTURE.md`.

## FZ design and systemic repair contract

FZ visual semantics are centralised in `src/fz-design-system.css`, loaded last. The brand anchors are `#050505` black and `#f5cf19` yellow, matching the application mark. Page-specific modules may own layout, but they do not invent independent colour, status, control or focus semantics.

The project also follows `docs/SYSTEMIC_REPAIR_STANDARD.md`: fixes are made at the earliest safe invariant layer, propagated through dependent contracts, and protected by regression tests. Date-specific corrections may exist only as documented backfills after the systemic rule is repaired.

The intended development habit is therefore: **diagnose once → fix the invariant → reconcile dependants → test the invariant → keep it fixed.**

## Adaptive roadmap

The prepared Adaptive Choice contract defines the future three-lane model: **ABSORB / MAINTAIN / ADAPT**. It is intentionally not activated in v0.7. Tranche 4.2 owns recommendation recomputation, 4.3 athlete accept/override, and 4.4 ranked session composition.

## Runtime truth

Neon is operational truth for runtime state, wellness, training and Athlete Memory. Google Drive remains the human-owned audit/flight-recorder representation. The legacy immutable Vercel state project is fail-stale recovery only and is not used for routine publication.

## RC4 objective intelligence foundation
The release candidate now also prepares the dynamic event/objective layer that later adaptive recommendations will consume. Strategic event priority is separated from near-term event pressure; events share capability evidence through weighted transfer rather than direct equivalence; and an evergreen maintenance objective can be surfaced after event-specific goals change without activating silently.

Architecture hardening also includes an executable data-contract registry, transitive dependency graph and read-only systemic reconciliation sweep so future fixes propagate across dependent contracts rather than remaining page-local.

## RC5 event-demand correction
RC5 replaces generic event-family assumptions with exact demand profiles. Deadly Dozen Track is encoded as 12 x 400 m Journeys + 12 ordered Labours with South African male loads, HYROX Open Men as 8 x 1 km + 8 official workout stations, and the half marathon as continuous 21.0975 km road running. Cross-event evidence now transfers at station/capability level rather than by vague hybrid-sport similarity. Source date conflicts are surfaced rather than silently corrected.

## RC6 event-intelligence ingestion
RC6 makes future event handling systemic. A new event can be captured immediately, but it does not influence capability priorities merely because FZ knows its name or date. The event must first pass a format knowledge gate using athlete-confirmed structure or adequate sourced research. Qualified profiles are converted into demand fingerprints and compared directionally with the current primary objective across running structure, stations/movements, modalities, transitions and reusable capabilities.

This separates **transfer potential** from **net training value**. Similar or overlapping events can provide useful evidence toward the primary objective without being interchangeable; whether doing the event is strategically positive on a given date still depends on recovery and opportunity cost and belongs to Tranche 4.2.

Deadly Dozen UJ is now resolved to the athlete-confirmed race date of Sunday 20 Sep 2026. The previously observed external 19 Sep discrepancy remains provenance only.

## RC7 release preparation
RC7 completes the 21–26 pre-deployment preparation pass: release metadata is normalized, the data-contract registry is expanded to every current decision-driving concept, and the dependency graph is cross-validated against each contract's declared triggers/consumers. The exact candidate remains off Vercel until quota headroom is confirmed.


## Event demand, measurement and explainability foundation

RC8 preparation adds four reusable intelligence contracts on top of the RC7 systemic foundation: Event Demand Taxonomy v1, a primary-objective-resolved measurement hierarchy (HYROX v1 first), a recommendation explainability contract, and ten synthetic golden athlete scenarios. These are software/intelligence primitives, not athlete-state hard-coding. Once deployed, athlete event additions, event changes and ordinary feedback remain runtime data operations under the Athlete Input Intelligence Ingestion Standard.
