# Tranche 4.6 — Secure Athlete Choice + Execution-Grade Session Prescription

Status: RELEASE CANDIDATE. Production promotion is not authorized by this document.

## Product objective

Allow Francois to select a recommended or alternate FZ workout directly inside the PWA while preserving frictionless read-only access for viewers and preventing any viewer from changing athlete state.

At the same time, upgrade session presentation from a short training suggestion to an **execution-grade prescription** that can be followed without inventing missing work, recovery, pacing or capture structure.

## Access invariant

**Anyone with the shared link may remain a viewer. Only an authenticated athlete session may perform the supported browser mutation.**

Possession of the URL never grants mutation rights.

## Implemented access model

### Viewer Mode
- no login required;
- full read access to the existing FZ surfaces;
- prescription details may be expanded;
- no canonical selection write is permitted without Athlete Mode;
- the browser never receives `FZ_STATE_WRITE_TOKEN`.

### Athlete Mode
- athlete chooses a 6–12 digit PIN inside the FZ origin;
- first setup/reset requires the one-time `FZ_ATHLETE_BOOTSTRAP_TOKEN` proof through the trusted administrative/runtime path;
- only a salted scrypt PIN hash is stored;
- successful authentication creates an opaque HttpOnly/Secure/SameSite=Strict session;
- UI visibly shows `ATHLETE MODE · EDITING ENABLED`;
- `Lock Athlete Mode` revokes the session and returns to Viewer Mode;
- wrong attempts use progressive backoff and temporary lockout.

The permanent PIN is never supplied by ChatGPT and is never transmitted through ordinary chat.

## Browser write boundary

The implementation deliberately reuses `/api/training/athlete-event` rather than creating another serverless function.

Authenticated browser mutation is limited to canonical `ADAPTIVE_CHOICE` selection. The write requires:
- authenticated athlete session;
- same-origin request;
- CSRF token;
- per-write idempotency/replay nonce;
- current recommendation/version validation;
- current option membership validation;
- safety-override enforcement;
- prescription readiness validation.

The selected decision persists the exact protocol family, protocol version, comparison class and prescription fingerprint into planned intent.

`ATHLETE_RESPONSE` remains on the trusted ChatGPT/runtime ingestion path. Athlete Mode is **not** a general browser writer for Athlete Memory.

## Dedicated auth persistence

Authentication state is operational security data and is not mixed into canonical Athlete Memory.

Migration `006_athlete_auth.sql` adds:
- `fz_athlete_auth_credentials`;
- `fz_athlete_auth_sessions`;
- `fz_athlete_auth_nonces`.

The database stores hashes rather than reusable PIN/session/nonce secrets.

## Execution-grade prescription

Each released option can expose:
- protocol family and version;
- measurement priority;
- comparison class;
- pre-session gate;
- equipment;
- exact warm-up;
- exact main-set work/recovery structure;
- pacing/intensity anchor;
- modify/stop rules;
- success criteria;
- cool-down;
- post-session capture requirements.

Unsupported protocols fail closed rather than presenting an arbitrary workout as measurable evidence.

## Comparison classes

- `BENCHMARK_EXACT` — direct comparison is valid inside the same protocol version/invariants.
- `FAMILY_COMPARABLE` — same measurement family, but declared variables differ; only the listed metrics are comparable.
- `TRAINING_ONLY` — useful training but not direct longitudinal performance evidence.

## Released/recovered protocol examples

### Matched Run AET v1.1
- established MH1.1 preparation;
- progressive running preparation to ~75% measured maximum HR;
- 3 sets × 13 rounds;
- 30 s work / 15 s recovery;
- exactly 4:00 between sets;
- work at 85–88% measured maximum HR;
- `FAMILY_COMPARABLE` because historical route/terrain/footwear were not invariant.

### Wall Ball Tolerance v2.0
- 6 kg HYROX Open Men race load;
- consistent target height;
- 3 sets × 13 rounds;
- 30 s work / 15 s recovery;
- exactly 4:00 between sets;
- controlled predominantly at 85–88% measured maximum HR;
- future invariant v2.0 repeats are `BENCHMARK_EXACT`;
- the 2 September 2026 baseline remains `FAMILY_COMPARABLE` because its load changed from 14 lb to 5 kg late in Set 3.

Generic station work-rate and unresolved objective-qualified hybrid variants remain withheld until their movement/load assumptions are authoritative.

## Athlete-facing flow

### First use
1. Open FZ.
2. Choose Viewer Mode or `Set up Athlete Access`.
3. For Athlete Access, enter the one-time setup/recovery proof.
4. Choose and confirm a PIN inside FZ.
5. Enter Athlete Mode.

### Normal use
1. Open FZ.
2. If the session remains valid, Athlete Mode resumes.
3. Otherwise choose `Athlete Login` and enter the PIN.
4. Expand the exact prescription and select a released session.
5. FZ persists the exact selected prescription as planned intent.

### Lock/reset
- `Lock Athlete Mode` revokes the active session.
- reset requires a new trusted recovery proof, changes credential version and revokes existing sessions.

## Acceptance coverage

The RC is gated by:
- repository quality suite;
- protocol-family coverage regression;
- deterministic prescription/fingerprint regression;
- Athlete Mode security regression;
- real mobile-browser Viewer/Athlete flow;
- setup → Athlete Mode → prescription expansion → authenticated selection → lock/revocation → PIN login;
- live physiology browser acceptance;
- training auto-sync browser acceptance;
- viewport stability.

## Release prerequisites not yet applied to production

Before production promotion:
1. apply migration `006_athlete_auth.sql` through the controlled release process;
2. configure `FZ_ATHLETE_BOOTSTRAP_TOKEN` in the required Vercel environments;
3. validate the staged Production candidate using secret-safe environment probes and immutable-deployment browser/runtime acceptance;
4. promote only the exact accepted staged deployment, without rebuilding.

Production remains unchanged until that separate release authorization occurs.

## Roadmap relationship

Tranche 4.6 closes the human decision loop inside the product:

`recommendation → secure athlete selection → exact planned prescription → execution → Athlete Voice → choice outcome`

The next adaptive layer should be conservative response learning, with repeated comparable outcomes influencing expected cost/suitability only behind explicit sample-size, comparability and confidence gates.
