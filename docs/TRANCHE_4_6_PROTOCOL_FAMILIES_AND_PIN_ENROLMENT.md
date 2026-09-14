# Tranche 4.6 Addendum — Repeatable Protocol Families + Athlete PIN Enrolment

Status: PREPARATION ONLY. No production deployment is authorized by this document.

## 1. Training structure principle

A FZ workout category is **not** permission to generate an arbitrary workout that happens to train the same quality.

For longitudinally useful training, each recurring capability category should resolve to a **versioned protocol family** with a stable measurement spine. The workout may still adapt to athlete state and training purpose, but comparison is only valid when the variables required for that comparison remain controlled.

Example:

`ADAPT → Compromised Running` should resolve to a protocol family such as `COMPROMISED_RUNNING_REPEATABILITY`, not a new unrelated circuit every time.

The protocol family owns:
- capability/question being tested;
- required equipment/environment assumptions;
- standard warm-up;
- pre-fatigue modality and dose;
- transition rule;
- run distance / duration;
- recovery rule;
- number of repetitions or rounds;
- pacing/control instructions;
- stop/modify criteria;
- required data capture;
- comparison metrics;
- protocol version and fingerprint.

## 2. Measurement priority by adaptive lane

Measurement rigor is not equally important across all adaptive lanes.

### ABSORB — LOW measurement priority
ABSORB exists primarily to preserve recovery, movement and future training value. These sessions still need exact execution instructions and basic capture, but they do not need to become formal benchmarks unless a specific recovery question requires it.

Default treatment:
- prescription must be executable and safe;
- capture compliance, duration, intensity anchor and notable symptoms/response;
- comparison class normally `TRAINING_ONLY`;
- no requirement to force repeated recovery sessions into a benchmark series.

### MAINTAIN — HIGH measurement priority
MAINTAIN should preserve known capability and make deterioration, stability or unexpected efficiency changes visible over time.

Recurring MAINTAIN categories that materially support the athlete objective should therefore resolve to stable protocol families wherever practical. The aim is not to turn every maintenance workout into a test, but to retain a consistent enough measurement spine that FZ can tell whether the maintained capability is actually being preserved.

Priority families include:
- controlled aerobic / running efficiency;
- strength reserve maintenance;
- hybrid movement / transition economy when relevant to the primary event;
- other objective-linked maintenance categories that recur often enough to justify comparison.

### ADAPT — VERY HIGH measurement priority
ADAPT is where FZ deliberately spends recovery budget to create or measure adaptation. Therefore each important ADAPT category should be strongly protocolised.

A released ADAPT option should normally resolve to a known protocol family before the athlete can select it. Generic quality work that cannot explain its family, measurement question, comparison class and required capture should be withheld or explicitly marked `TRAINING_ONLY` rather than presented as measurement-grade adaptation.

Priority families include:
- compromised running repeatability;
- matched Run AET / controlled running efficiency;
- wall-ball tolerance / repeatability;
- erg efficiency;
- station work-rate / sled capability;
- strength-endurance repeatability;
- other primary-objective gaps that become recurring decision targets.

### Coverage rule
For Tranche 4.6 release readiness:
- ABSORB may remain largely execution-structured without a benchmark family;
- MAINTAIN options that materially support the primary objective should carry a protocol family or an explicit reason why comparison is not useful;
- ADAPT options must carry a protocol family unless intentionally classified `TRAINING_ONLY` with a documented reason;
- a generic fallback such as `targeted-quality` may not silently masquerade as a measurable protocol.

## 3. Benchmark + development-variant model

Each important protocol family should support two related use cases.

### A. Benchmark protocol
A measurement-grade, repeatable exposure used periodically to answer: **has this capability improved?**

Benchmark invariants should remain fixed within a protocol version. For Compromised Running this means, where applicable:
- same warm-up structure;
- same pre-fatigue modality;
- same pre-fatigue work quantity and control target;
- same transition definition;
- same run distance;
- same recovery duration/type;
- same number of rounds;
- same machine settings / course assumptions where material;
- same success and stop rules;
- same required data fields.

If a material invariant changes, FZ must either:
1. create a new protocol version, or
2. mark the session as a training variant that is **not directly benchmark-comparable**.

### B. Development variant
A training exposure from the same family used to create adaptation without pretending every workout is an identical test.

A development variant may change selected variables such as:
- total number of rounds;
- training intensity envelope;
- pre-fatigue volume;
- recovery duration;
- progression/regression appropriate to current readiness;

but the composer must declare which variables changed and what comparison remains valid.

This prevents two errors:
- making training so rigid that progression is impossible;
- changing so much every time that longitudinal comparison becomes meaningless.

## 4. Comparison classes

Every prescribed session should declare one of three comparison classes:

- `BENCHMARK_EXACT` — directly comparable to prior sessions of the same protocol version.
- `FAMILY_COMPARABLE` — same protocol family and measurement spine, but one or more declared dose variables differ; selected metrics remain comparable with context.
- `TRAINING_ONLY` — useful training exposure but not suitable for direct longitudinal performance comparison.

The UI should make this understandable in athlete language, for example:

`Benchmark · directly comparable with your previous Compromised Running benchmark`

or

`Training variant · same capability, but today’s reduced volume means total-time comparison is not valid.`

## 5. Initial protocol-family coverage map

The first 4.6 registry should cover the categories already emitted by the current 4.4 option composer.

### MAINTAIN

`STEADY_AEROBIC_EFFICIENCY`
- maps current `Controlled steady aerobic`;
- measurement spine: duration, route/treadmill assumption, RPE/HR envelope, pace or power, HR drift/decoupling where valid, cadence where reliable, post-session RPE;
- benchmark use: periodic, not every exposure;
- ordinary maintenance exposures may be `FAMILY_COMPARABLE`.

`STRENGTH_RESERVE_MAINTENANCE`
- maps current `Strength maintenance`;
- measurement spine: movement identity, load, reps, sets, RIR, rest, technical completion standard, pain/local limiter;
- comparison focus: same-movement strength reserve and effort cost rather than generic gym volume.

`HYBRID_TRANSITION_ECONOMY`
- maps current `Controlled hybrid technique`;
- measurement spine: fixed transition sequence, submaximal station prescription, running/erg transition rules, movement-quality standard and transition time where useful;
- benchmark use only when the protocol is sufficiently standardised.

### ADAPT

`COMPROMISED_RUNNING_REPEATABILITY`
- maps `Compromised running repeatability`;
- high-value benchmark family.

`MATCHED_RUN_AET`
- maps `Matched Run AET`;
- benchmark protocol should preserve the established matched AET structure exactly within version.

`WALL_BALL_TOLERANCE`
- maps `Standardised Wall Ball tolerance`;
- benchmark protocol should include local next-day/48 h response as part of the measurement spine.

`ERG_EFFICIENCY`
- maps `Standardised erg efficiency`;
- benchmark invariants include erg type, distance/work unit, machine settings where material, recovery and output target.

`STATION_WORK_RATE`
- maps `Standardised station work-rate` and may specialise into sled or other station-specific child protocols;
- benchmark invariants must include qualified load, movement standard, work unit, recovery and downstream-cost capture.

`STRENGTH_ENDURANCE_REPEATABILITY`
- used when the unresolved capability is strength-endurance rather than a specific station;
- measurement spine should preserve exercise/load/reps/rest and degradation metrics.

No ADAPT family should infer race-load values that are not present in authoritative event or athlete capability data.

## 6. Compromised Running example architecture

The exact final prescription must be calibrated before release, but the family structure should resemble:

`COMPROMISED_RUNNING_REPEATABILITY v1`

**Question:** Can Francois reproduce target running quality after a controlled, repeatable pre-fatigue exposure?

**Measurement spine:**
1. standard warm-up;
2. fixed pre-fatigue station exposure;
3. fixed transition rule;
4. fixed run segment;
5. fixed recovery;
6. repeat for the prescribed number of rounds;
7. capture round-by-round run pace/time, HR response, cadence/GCT where available, transition time, pre-fatigue output, RPE and limiting system.

Primary comparison should focus on the variables that answer the capability question, such as:
- run split repeatability / degradation;
- HR cost for equivalent run output;
- recovery between rounds;
- cadence/GCT stability where reliable;
- ability to maintain prescribed pre-fatigue output;
- athlete-reported limiting system;
- execution fidelity to the protocol.

The benchmark should not be scored as "better" simply because one session used less pre-fatigue or longer recovery.

## 7. Protocol versioning and provenance

Every execution-grade prescription should carry at minimum:
- `protocolFamilyId`;
- `protocolVersion`;
- `prescriptionLevel` (`SIMPLE`, `STRUCTURED`, `PROTOCOL`);
- `comparisonClass`;
- `measurementPriority`;
- `prescriptionFingerprint`;
- `benchmarkInvariants`;
- `declaredVariantChanges`;
- `comparisonMetrics`;
- `requiredCapture`.

The selected planned intent stores the exact version/fingerprint. Later recommendation changes must never rewrite what was originally prescribed.

The execution reconciler should preserve:

`recommendation → selected option → exact prescription → execution fidelity → athlete response → outcome observation`

## 8. Progression policy

Progression should be explicit rather than silently changing the test.

Examples:
- If the goal is **measurement**, repeat the benchmark unchanged.
- If the goal is **adaptation**, use a declared family variant.
- If the athlete has clearly outgrown the benchmark, deliberately publish a new protocol version and retain the old series as historical comparison.

FZ should never infer improvement from two materially different tests without clearly qualifying the comparison.

## 9. Athlete PIN enrolment — agreed flow

Francois chooses his own PIN. The PIN must be created inside the FZ app and must never be requested or transmitted through ordinary chat.

### First-time athlete establishment

1. New/unrecognised browser opens the FZ landing page.
2. Francois chooses `Athlete Login / Set up Athlete Access`.
3. Because no athlete PIN exists yet, FZ requires a **one-time athlete bootstrap proof** generated through a trusted administrative/runtime path.
4. Successful bootstrap establishes that this browser is performing the initial athlete enrolment; it does not itself become a reusable login credential.
5. FZ asks Francois to choose a PIN and enter it twice.
6. Server validates PIN policy, hashes it using the approved password-hashing implementation, stores only the hash, and never logs or returns the PIN.
7. The bootstrap credential is immediately invalidated.
8. Server creates the normal opaque HttpOnly/Secure/SameSite athlete session.
9. App enters `ATHLETE MODE · EDITING ENABLED`.

### Normal subsequent login

1. Select `Athlete Login` on the landing page.
2. Enter the chosen PIN.
3. Server verifies the PIN subject to rate limiting / lockout controls.
4. Successful verification creates/rotates the athlete session cookie.
5. Browser enters Athlete Mode.

### Already paired / authenticated browser

A valid athlete session may bypass the landing page and resume Athlete Mode directly. `Lock Athlete Mode` or logout destroys that session and returns to Viewer Mode.

### PIN reset

PIN reset must not rely on knowing the old PIN alone. It should require a new one-time trusted bootstrap/recovery proof, then allow Francois to choose a new PIN. Reset revokes existing athlete sessions.

## 10. PIN security requirements

- Francois selects the PIN; FZ does not assign a permanent PIN.
- Minimum length: 6 digits unless future policy allows a stronger alphanumeric passcode.
- PIN is entered only into the FZ origin over HTTPS.
- Store only an Argon2id/scrypt-equivalent hash with salt and appropriate cost.
- No PIN in localStorage, query strings, analytics, logs, browser source, or canonical athlete records.
- Rate limit and progressive backoff on failed attempts.
- Temporary lockout after repeated failures.
- Generic failure response.
- Successful login rotates the session identifier.
- Session cookie is HttpOnly, Secure and appropriately SameSite-scoped.
- CSRF and replay/idempotency protections remain mandatory for writes.
- Viewer/share-link sessions can never be promoted to Athlete Mode without successful athlete authentication.

## 11. 4.6 acceptance additions

### Protocol families
- every high-priority MAINTAIN/ADAPT option resolves to a declared protocol family or carries an explicit `TRAINING_ONLY` reason;
- repeated benchmark generation for the same family/version is deterministic for all declared invariants;
- development variants explicitly declare every changed comparison-relevant variable;
- benchmark sessions cannot be labelled directly comparable when a required invariant differs;
- planned intent stores protocol family/version/fingerprint and measurement priority;
- UI clearly distinguishes benchmark vs family-comparable vs training-only;
- execution reconciliation retains execution-fidelity evidence;
- longitudinal comparison uses only metrics valid for the declared comparison class;
- ABSORB remains executable and observable without unnecessary benchmark pressure.

### PIN enrolment
- first-time setup requires one-time bootstrap proof before PIN creation;
- athlete chooses and confirms PIN inside the FZ origin;
- plaintext PIN is never persisted or returned;
- bootstrap credential becomes unusable after enrolment;
- normal PIN login establishes Athlete Mode;
- viewer path requires no PIN and remains read-only;
- repeated wrong PIN attempts trigger rate limiting/lockout;
- PIN reset revokes existing athlete sessions;
- direct mutation without a valid athlete session is rejected server-side.
