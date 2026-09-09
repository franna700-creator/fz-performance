# FZ Performance Consolidation Audit — 9 Sep 2026

## Purpose

Freeze tranche development and reconcile the product into one source-of-truth architecture before adding new adaptive behaviour.

## Product jobs

- **TODAY** — current athlete state, what matters now, and the current FZ recommendation. No historical charting and no duplicate source telemetry.
- **TRENDS** — longitudinal change, response patterns, performance evidence, exposure cost and trajectory. Derived from canonical data, not hard-coded chart arrays.
- **TRAIN** — canonical execution history and canonical Athlete Memory. Garmin/Tredict remain provenance, not separate UI histories.
- **SYSTEM** — source health, freshness, provenance and operating architecture. No coaching narrative duplicated from TODAY/TRENDS.

## Truth hierarchy

1. Original observation: Garmin / Tredict / athlete report.
2. Canonical operational truth: Neon.
3. Recommendation/intelligence truth: versioned FZ state/intelligence.
4. Human-owned/audit representation: Google Drive.

Drive is the flight recorder, not the runtime engine.

## Confirmed defects / drift

### TRENDS — matched AET
The matched AET series is semantically correct through 31 Aug and correctly excludes the 8 Sep GI-confounded incomplete exposure. However the rich TRENDS implementation also carries an independent hard-coded `FZ_AET` array. This duplicates the runtime AET dataset and can drift without any source change.

**Action:** retain matched AET as a core diagnostic, but derive it at runtime from canonical training evidence with an explicit `MATCHED` / `NON_COMPARABLE` classification. Remove hard-coded AET chart data from the active rendering path.

### TRENDS — Running Relationship Map
The current map is a hand-selected static list ending 31 Aug. The underlying Running Efficiency sheet also stops 31 Aug, while the canonical training ledger includes newer running exposure. A second hard-coded `FZ_RUNS` list exists in the rich TRENDS implementation.

**Action:** keep the concept only if it becomes a dynamic contextual running-exposure view. Matched AET points, contextual road/treadmill runs and excluded/non-comparable runs must be visually distinct. Otherwise remove the map. Do not keep a stale hand-curated list.

### TRENDS — Normalised Cardio Load (NCL)
The runtime LOAD series represents 8 Sep as `0` even though three activities occurred. This encodes “not yet calculated” as “zero load”, violating the system rule `missing != zero`.

Using the existing FZ formula `low minutes x1 + moderate minutes x2 + high minutes x4`, the 8 Sep Tredict HR-zone distributions produce:
- Mobility: 16.4667
- Run AET: 43.9833
- brief HIIT: 5.8667
- **Daily NCL: 66.3167**

The incomplete AET is invalid as a matched performance benchmark, but it is valid training exposure/load evidence.

**Action:** move NCL derivation into the backend from source HR-zone distributions. Missing data must render as `null / pending`, never zero. A true zero requires verified no training.

### TRENDS — mixed data paths
The rich Trends experience currently mixes runtime narrative, runtime wellness history, hard-coded response/load arrays, hard-coded AET/run arrays and a later Athlete Memory overlay.

**Action:** one `/api/trends/current` contract. All visible Trend charts read from that contract. Athlete Voice remains a derived lens from canonical Athlete Memory.

### TODAY — duplicate/stale shell data
The shipped HTML contains old static Live Today and coaching content. Live-wellness injectors later hide/replace some of it. This means a truthful live overlay sits on top of stale page content.

**Action:** ship neutral page skeletons. Do not ship historical athlete values in static HTML. TODAY renders from current runtime + live wellness + canonical training/recommendation contracts only.

### TRAIN — overlapping feature patches
TRAIN is currently assembled through multiple Tranche 3 build-time injectors. The visible product is coherent, but the build path is layered and fragile.

**Action:** consolidate into one TRAIN runtime module. Canonical sessions + Athlete Memory remain. Remove source-specific duplicated histories.

### SYSTEM — obsolete architecture copy
SYSTEM still describes the workbook as canonical publication truth and PWA State as the derived contract. Production is now DB-first for runtime, wellness and training memory.

**Action:** rewrite SYSTEM around source status -> canonical Neon -> intelligence/recommendation -> PWA, with Drive explicitly labelled audit/human-owned representation.

## Retain / merge / remove

| Surface | Decision | Reason |
| --- | --- | --- |
| Live Wellness | RETAIN, one authoritative surface | Current physiology belongs on TODAY |
| Static Live Today grid | REMOVE | Duplicate/stale beneath live overlay |
| Matched Run AET | RETAIN | Highest-confidence standardized performance diagnostic |
| 8 Sep incomplete AET | RETAIN AS CONTEXT, EXCLUDE FROM MATCHED SERIES | Useful exposure/tolerance evidence, invalid matched benchmark |
| Running Relationship Map | REBUILD DYNAMICALLY or REMOVE | Current version is stale/static |
| NCL | RETAIN | Useful internal exposure metric when derivation is auditable |
| Athlete Memory | RETAIN as canonical subjective history in TRAIN | First-class athlete evidence |
| TRENDS Athlete Voice | RETAIN as derived summary only | Pattern view, not second memory store |
| Source-specific Garmin/Tredict workout lists | REMOVE from primary UI | Provenance only; canonical session is the user-facing grain |
| Capability Matrix | RETAIN, simplify | Useful HYROX gap/evidence model; should be derived/current rather than static copy |
| Duplicate trajectory prose across TODAY/TRENDS/TRAIN | CONSOLIDATE | Each page should perform one job |
| Detailed pipeline prose in SYSTEM | SIMPLIFY | Status/freshness/provenance matter more than implementation history |

## Build cleanup

Current `npm run build` chains multiple longitudinal, Tranche 2 and Tranche 3 patch scripts over an older release shell. This is the primary structural source of drift.

Target:

`base shell -> clean runtime page modules -> smoke/contract checks`

The old patch scripts may remain in git history, but must leave the active production build path once their functionality has been consolidated.

## Acceptance gate before any new tranche

1. Every visible metric has exactly one canonical source/derivation.
2. No missing value is presented as zero.
3. AET matched/non-comparable classification is explicit and current.
4. Running contextual evidence is current or the relationship map is removed.
5. Athlete Voice is derived from canonical Athlete Memory only.
6. TODAY/TRENDS/TRAIN/SYSTEM have non-overlapping product jobs.
7. Static HTML contains no athlete-state values that can become stale.
8. Desktop and mobile render checks pass.
9. Build path no longer relies on the historical injector tower for active page behaviour.
10. Only then resume tranche development.
