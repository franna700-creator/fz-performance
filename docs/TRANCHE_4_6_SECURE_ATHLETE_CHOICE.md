# Tranche 4.6 — Secure Athlete Choice + Execution-Grade Session Prescription

Status: PREPARATION ONLY. No production deployment is authorized by this document.

## Product objective

Allow Francois to select a recommended or alternate FZ workout directly inside the PWA while preserving frictionless shared read access for trusted viewers and preventing any viewer from accidentally or deliberately changing athlete state.

The same tranche must also upgrade session presentation from "good training option" to **execution-grade prescription**: the athlete should be able to execute the selected session correctly without needing to infer missing structure.

## Core access invariant

**Anyone with the shared link may remain a viewer. Only an authenticated athlete session may mutate athlete state.**

Viewing and mutation are separate capabilities. Possession of the URL never grants mutation rights.

## Preferred landing-page model

Every new/unrecognised browser first reaches a simple FZ landing page with two explicit paths:

### Continue as Viewer
- no login required;
- opens the existing FZ PWA in read-only mode;
- can navigate TODAY / TRENDS / TRAIN / SYSTEM according to product visibility;
- can expand recommended and alternate workout details;
- can inspect execution-grade prescriptions;
- cannot select, modify, cancel or reschedule workouts;
- cannot submit Athlete Voice or any other state-changing input;
- no enabled-looking mutation controls are rendered.

### Athlete Login
- clearly labelled as the Francois/athlete path;
- requires a simple athlete PIN;
- successful server-side verification establishes an HttpOnly/Secure/SameSite athlete session;
- the PIN is never embedded in HTML/JavaScript, stored in localStorage, or forwarded as the runtime write credential;
- after login the app visibly enters `ATHLETE MODE · EDITING ENABLED`;
- logout/lock/expiry immediately returns the browser to viewer mode.

The landing page is therefore the user-facing role selector; the server-side session remains the actual authorization boundary.

## PIN security contract

A PIN is acceptable for this product because it protects a single athlete's mutation capability rather than broad account administration, **provided it is implemented as a real server-side credential rather than a client-side gate**.

Requirements:
- use at least a 6-digit PIN (4 digits is too small for an internet-facing credential unless aggressively rate-limited);
- store only a modern password hash (e.g. Argon2id/scrypt-equivalent), never plaintext;
- verify server-side over HTTPS;
- rate-limit by device/session/IP and globally for the athlete identity;
- progressive backoff and temporary lock after repeated failed attempts;
- constant/generic failure response so the endpoint does not leak credential state;
- successful login rotates/creates an opaque session ID in an HttpOnly/Secure/SameSite cookie;
- CSRF protection on mutation requests;
- session expiry and explicit logout/revocation;
- optional manual `Lock Athlete Mode` control in the app;
- `FZ_STATE_WRITE_TOKEN` remains server-side only and is never exposed to the browser.

Preferred UX: Francois enters the PIN once on a trusted browser, receives a durable but revocable athlete session, and is not asked for the PIN on every workout selection. A shared/untrusted browser stays in viewer mode by default.

## Viewer line-of-sight without viewer login

Bypassing viewer login is compatible with mutation security, but anonymous viewer mode alone cannot prove which trusted person opened the app.

To preserve line of sight without making viewers authenticate, support **optional per-person read-only share links**:
- each trusted person can receive a unique opaque viewer token/link;
- the token carries no mutation privilege and cannot be upgraded to athlete mode;
- opening the link still bypasses login and enters viewer mode immediately;
- FZ can record last-used timestamp and basic access activity against the share-link label;
- each share link can be revoked independently;
- a generic shared URL remains possible but is recorded only as anonymous viewer access.

Important limitation: a named viewer link identifies the **link used**, not cryptographically the human. If a person forwards their link, subsequent use remains attributed to that link. This is acceptable for lightweight "who has been using the shared view" line of sight, but not equivalent to identity verification.

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
- audit provenance identifies `captureChannel='athlete-browser'`.

## Viewer-mode UI requirements

Viewer mode may show all workout options and details but every mutation affordance is replaced by a clear non-interactive state such as:

`VIEW ONLY · Athlete selection requires Athlete Mode`

The app must not show an enabled-looking button that later fails authorization.

Athlete mode enables:
- `Select this workout`;
- choose date (`Today` default when valid);
- optional start time;
- override reason when selecting outside the recommended lane;
- confirmation step before canonical write.

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

Real mobile browser tests must prove all access paths.

### Landing / Viewer
- new browser lands on explicit Viewer vs Athlete choice;
- Viewer bypasses login and enters the app read-only;
- all pages and workout details remain viewable;
- no selection/input control can mutate state;
- direct POST without athlete session is rejected;
- browser source contains no privileged write token;
- optional named viewer share token cannot be upgraded into mutation authority.

### Athlete PIN / Session
- correct PIN creates secure athlete session;
- wrong PIN does not reveal whether any other security state is valid;
- brute-force/rate-limit controls are enforced;
- athlete mode is visually explicit;
- selecting recommended option creates canonical decision + planned intent;
- selecting alternate lane requires explicit confirmation/override reason as defined by policy;
- duplicate submission is idempotent;
- stale recommendation cannot be selected;
- logout/revoke/lock returns browser to viewer mode;
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
