# Phase 5 — Training Exposure Explorer

## Product intent
Use existing canonical training history to show how much training was accumulated, where it came from, and how that changed across short and medium rolling windows.

## Placement
Primary home: TRENDS. TRAIN remains the session-level execution/drill-down surface.

## Controls
- date range: 7 days / 28 days / custom
- rolling overlay: 7-day / 28-day / both
- filters: modality, adaptive intent, session/exercise type where canonically classifiable

## Shared exposure layer
- training time
- existing Tredict-derived NCL / HR-zone relative load
- low / moderate / high intensity time where available

## Modality-specific volume
- running: km + minutes + load
- row/ski/erg: metres where valid + minutes + load
- bike/assault bike/elliptical: minutes primary; distance/calories only when source semantics are trustworthy
- strength: sets / reps / tonnage where canonical set detail exists; otherwise duration + load

## Summary
- total training time
- session count
- modality share of time
- modality share of load
- running distance
- strength volume where supported
- rolling 7d and 28d load

## Architecture rules
- no second athlete-state store
- no replacement Tredict load model
- no mixed-unit synthetic volume score
- missing != zero
- monotonic best-available evidence remains authoritative
- TRENDS aggregates only and does not mutate canonical training truth
- implement after Phase 4 SYSTEM production acceptance
