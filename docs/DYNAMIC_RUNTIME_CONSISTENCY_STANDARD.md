# FZ Performance Dynamic Runtime Consistency Standard

Status: release gate for v0.7 and later.

## Core rule

The shell is software; athlete truth is runtime data. Physiology, training execution, Athlete Memory, Trends and system freshness must progress without a shell deployment.

## Five runtime behaviours

1. **Persisted-first:** render the latest canonical Neon state immediately. A slow or unavailable upstream source must not blank the PWA.
2. **Source-owned refresh:** Garmin wellness and training sources perform explicit source checks on load, every five minutes while visible, and on stale focus/visibility/online wake-up. Manual refresh remains available.
3. **Canonical reread after persistence:** when source evidence is successfully persisted, TODAY, TRAIN, TRENDS and SYSTEM reread their canonical contracts immediately.
4. **Truth improves monotonically:** a newer but sparser source payload must not erase previously observed detail. Derivations use newest evidence, with older richer fields filling only missing values. Missing is never converted to zero.
5. **Observable freshness:** source time, persistence time, contract generation and integrity state are visible/auditable. Scheduled FZ recommendation state remains distinct from live source freshness.

## Athlete Memory late binding

Athlete feedback may arrive before the workout record.

- Pre-workout state/context may remain standalone.
- In-session and post-session feedback is eligible for automatic association after canonical execution evidence arrives.
- Matching uses temporal proximity, event type, modality/session clues and ambiguity margin.
- A relationship is created only above a confidence gate; ambiguous cases remain standalone rather than being guessed.
- Late association is append/audit friendly: the original event remains intact, `session_id` is attached, the source record is linked as evidence and a SYSTEM `LINKED` event records the inferred relationship.

## Training identity

Raw Tredict/Garmin labels are provenance and are never rewritten merely for presentation.

The user-facing canonical identity is derived from:

- raw title/sport/sub-sport evidence;
- matched device evidence;
- session kind and plan relationship;
- linked Athlete Memory;
- intensity distribution where available.

The derived identity carries confidence and basis. Generic labels such as `misc`, `HIIT` or `cycling` may be replaced in the PWA only when stronger evidence supports a more useful identity. Low-confidence history stays generic.

## Trends / NCL

Training-derived Trends use **MONOTONIC_BEST_AVAILABLE** evidence.

For each execution, the newest source version is the base. Older versions may fill fields that are genuinely missing in that newer version; they may never overwrite a present newer value. This prevents a transient sparse API response from deleting HR-zone distributions, running dynamics or other previously observed metrics.

NCL is derived only when the low/moderate/high HR distribution is available. If a canonical workout exists but required detail is unavailable, the day is `PENDING_DETAIL`/null, never zero. A true zero requires verified absence of canonical training.

Matched AET and running-context sets are generated from current canonical sessions rather than a hard-coded expected-date list.

## Dynamic integrity checks

Every release must test the rules rather than today's values:

- new sparse evidence cannot reduce known metric coverage;
- workout day + missing detail != zero load;
- late binding leaves pre-workout context alone and links clear post-session feedback;
- raw source identity remains available beside derived identity;
- classification confidence is explicit;
- source persistence triggers canonical reread;
- dynamic contracts are `no-store` and do not require Vercel deployment;
- recommendation recomputation remains governed by Tranche 4 materiality policy rather than every live metric tick.
