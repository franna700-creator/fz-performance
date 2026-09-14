# Tranche 4.6 — Secure Athlete Choice + Execution-Grade Session Prescription

Status: PREPARATION ONLY. No production deployment is authorized by this document.

## Product objective

Allow Francois to select a recommended or alternate FZ workout directly inside the PWA while preserving public/shared read access for trusted viewers and preventing any viewer from accidentally or deliberately changing athlete state.

The same tranche must also upgrade session presentation from "good training option" to **execution-grade prescription**: the athlete should be able to execute the selected session correctly without needing to infer missing structure.

## Core access invariant

**Anyone with the shared link may remain a viewer. Only the paired athlete session may mutate athlete state.**

Viewing and mutation are separate capabilities. Possession of the URL never grants mutation rights.

### Recommended access model

Use a two-tier model on the existing public app:

1. **Viewer mode — default**
   - no login required for trusted people already holding the link;
   - can view TODAY / TRENDS / TRAIN / SYSTEM according to current product visibility;
   - can expand session details and alternate lanes;
   - cannot select, modify, cancel or reschedule workouts;
   - cannot submit Athlete Voice or other state-changing inputs;
   - UI must never imply that tapping a card changes canonical state.

2. **Athlete mode — explicit paired session**
   - only Francois can activate it;
   - mutation capability is held in an HttpOnly secure browser session, never in JavaScript;
   - SameSite cookie policy plus CSRF protection;
   - session has expiry and revocation;
   - athlete mode is visually obvious (e.g. `ATHLETE MODE · EDITING ENABLED`);
   - viewer mode remains the safe fallback whenever identity cannot be proven.

### Preferred bootstrap

Use a one-time pairing flow rather than a permanent password embedded in the app:

- From a trusted authenticated channel, generate a short-lived one-time pairing token or magic link.
- Opening it on Francois's device exchanges the token server-side for an HttpOnly/Secure/SameSite athlete session cookie.
- The one-time token is invalidated immediately after successful use.
- The browser never receives or stores `FZ_STATE_WRITE_TOKEN`.
- Future writes are authorized by the paired athlete session, not by the shared URL.

The pairing session should be revocable and optionally scoped to a device/browser.

### Why this model

It preserves line of sight for people Francois has shared FZ with while making the default state read-only. A trusted viewer can explore everything but cannot accidentally choose a workout. Mutation requires a second factor: possession of Francois's paired athlete session.

### Alternative models considered

- **Whole-app login:** strongest privacy boundary but removes frictionless viewer access and is unnecessary if the goal is public/trusted viewing with private mutation.
- **PIN before every write:** simple but weaker against observation/replay and poor UX; acceptable only as an additional re-authentication step, not the primary security boundary.
- **Secret query parameter / hidden URL:** rejected. URL possession must never be equivalent to write authorization.
- **Browser-held API token:** rejected. No privileged runtime secret may be exposed to client JavaScript or localStorage.

## Athlete-mode write boundary

Reuse the existing `/api/training/athlete-event` consolidated function and canonical `ADAPTIVE_CHOICE` path where possible. Do not create another serverless function unless the existing route cannot safely represent the session bootstrap/authorization contract.

Browser mutation requirements:

- HttpOnly/Secure/SameSite athlete session;
- explicit athlete identity binding;
- CSRF protection for state-changing requests;
- replay/idempotency protection;
- stale recommendation-version rejection;
- current-option membership validation;
- safety override cannot be bypassed;
- write result must return canonical decision ID / planned session ID;
- immediate reread of `/api/intelligence/current` after success;
- failure leaves canonical state unchanged;
- audit provenance identifies `captureChannel='paired-browser'`.

## Viewer-mode UI requirements

Viewer mode may show all workout options and details but every mutation affordance is replaced by a non-interactive state such as:

`VIEW ONLY · Athlete selection requires Athlete Mode`

The app must not show an enabled-looking button that later fails authorization.

Athlete mode enables:

- `Select this workout`
- choose date (`Today` default when valid)
- optional start time
- override reason when selecting outside the recommended lane
- confirmation step before canonical write

A successful selection visibly changes the card to `SELECTED`, shows the planned date/time, and preserves the immutable FZ recommendation separately.

## Execution-grade session prescription

Every concrete session option must be detailed enough that the athlete does not need to invent any part of execution.

The existing fields remain useful (`title`, `objective`, `dose`, `whyNow`, `expectedCost`, `successCondition`, `stopCondition`, confidence, evidence target), but the athlete-facing prescription must expand into the following canonical sections when applicable.

### A. Session intent
- exact purpose of the session;
- what capability it is training or measuring;
- what this session is **not** intended to become;
- expected recovery cost and why.

### B. Pre-session gate
- readiness/function requirements before starting;
- symptoms or conditions that should cancel, downgrade or switch the session;
- hydration/fuelling guidance only when relevant and supported;
- equipment/setup requirements.

### C. Warm-up
- total duration;
- exact sequence;
- movement/exercise names;
- durations/reps/distances;
- target intensity/RPE/HR where relevant;
- specific readiness checks during warm-up;
- clear transition into the main set.

### D. Main set — step-by-step
For every block/round/rep:
- exact order;
- reps / distance / time;
- target pace, power, cadence, HR, RPE or technical standard where appropriate;
- recovery duration and whether recovery is passive/active;
- transition rules;
- equipment/load specifications;
- movement standards;
- how to pace the first vs later repetitions;
- what to record.

No phrases such as `controlled`, `easy`, `moderate` or `hard` may stand alone when a more executable anchor is available. They should be paired with an objective or subjective anchor (e.g. RPE, talk test, HR band, pace/power range, reps in reserve).

### E. Decision rules during the workout
- when to continue unchanged;
- when to reduce pace/load/reps;
- when to extend recovery;
- when to terminate the session;
- how to handle a single bad rep vs progressive deterioration;
- safety override rules.

### F. Success criteria
- exact definition of a successful session;
- acceptable performance variation between reps/rounds;
- whether completion or quality has priority;
- what counts as useful evidence even if the full session is not completed.

### G. Cool-down
- exact duration and modality;
- any specific mobility or easy movement;
- whether immediate post-session fueling/hydration is relevant.

### H. Post-session report
Prompt only for information FZ actually needs to learn from the session, for example:
- session RPE;
- limiting system (breathing / legs / grip / GI / pain / other);
- pain or local symptoms;
- execution deviations;
- whether target quality was maintained;
- free-text athlete comment.

This response should feed Athlete Memory and Tranche 4.5 `choice.outcome` rather than becoming a separate disconnected form.

## Prescription levels

Not every workout needs identical verbosity. Use three internal prescription levels while keeping the athlete-facing experience coherent:

- **SIMPLE** — recovery/easy aerobic/mobility; still includes exact duration, intensity anchor, stop rules and completion criteria.
- **STRUCTURED** — strength, intervals, AET, station work; full warm-up, block structure, recoveries, pacing and data capture.
- **PROTOCOL** — measurement/validation sessions; exact standardisation is mandatory because comparability depends on execution fidelity.

The composer should select prescription level based on `sessionKind`, purpose and measurement intent.

## Architecture boundary

The canonical session composer should own execution structure. Static UI must only render it.

Preferred evolution:

`session-option-composer 4.4 summary` → `session-prescription composer 4.6` → athlete-facing render

The PWA must not invent missing reps, pacing or recovery locally.

A prescription should carry a version/fingerprint so the planned intent records the exact structure the athlete selected. If the recommendation later changes, the original selected prescription remains auditable.

## Acceptance requirements

Real mobile browser tests must prove both modes:

### Viewer
- shared URL loads without mutation credentials;
- all pages and workout details remain viewable;
- no selection/input control can mutate state;
- direct POST without athlete session is rejected;
- browser source contains no privileged write token.

### Athlete
- one-time pairing establishes secure session;
- athlete mode is visually explicit;
- selecting recommended option creates canonical decision + planned intent;
- selecting alternate lane requires explicit confirmation/override reason as defined by policy;
- duplicate submission is idempotent;
- stale recommendation cannot be selected;
- logout/revoke returns browser to viewer mode;
- selected workout remains visible after page refresh and on a second canonical reread.

### Execution detail
- each released option exposes its required prescription level;
- structured/protocol workouts contain warm-up, main set, recovery, targets, decision rules, success criteria, stop criteria and post-session capture requirements;
- no workout requires the athlete to infer missing work/rest structure;
- mobile layout remains stable while expanding prescription sections.

## Roadmap relationship

Tranche 4.6 closes the human decision loop inside the product:

`recommendation → secure athlete selection → planned intent → execution → Athlete Voice → choice outcome`

After 4.6 is stable, the next meaningful adaptive step is conservative response learning: repeated comparable outcomes may gradually calibrate expected cost and session suitability, but only behind explicit sample-size/comparability/confidence gates.
