import assert from 'node:assert/strict';
import fs from 'node:fs';

const orchestrator = fs.readFileSync('lib/intelligence-refresh.js', 'utf8');
const api = fs.readFileSync('api/intelligence/refresh.js', 'utf8');
const training = fs.readFileSync('lib/training-sync-runtime.js', 'utf8');
const wellness = fs.readFileSync('lib/wellness-sync.js', 'utf8');

assert.match(orchestrator, /syncTrainingSources\(\{[\s\S]*recomputeRecommendation:\s*false/, 'central refresh must prevent nested training recommendation recomputation');
assert.ok(orchestrator.indexOf('repairUnassessedAthleteMateriality') < orchestrator.indexOf('current.pending.shadowRecommendation'), 'Athlete Voice materiality repair must precede recommendation staleness evaluation');
assert.ok(orchestrator.indexOf('current.pending.shadowRecommendation') < orchestrator.indexOf('current.pending.activeRecommendation'), '4.2 shadow convergence must precede 4.3 activation');
assert.match(orchestrator, /persistActiveRecommendationFromShadow/, '4.3 active recommendation must be projected from persisted shadow');
assert.doesNotMatch(orchestrator, /recordAthleteMemory|recordExerciseAthleteResponse|record_type\s*:\s*['"]decision['"]/, 'system refresh may not manufacture Athlete Voice or athlete decisions');

assert.match(training, /assessTrainingSourceChanges/, 'training source evolution must pass through 4.1 materiality');
assert.match(training, /recommendationMateriality/, 'training recomputation must be materiality-gated');
assert.match(training, /source_key <> 'fz-intelligence'/, 'training revision marker must be isolated from intelligence ledger writes');
assert.match(wellness, /assessWellnessCurrentMateriality/, 'Garmin wellness must pass through 4.1 materiality after canonical persistence');

assert.match(api, /req\.method !== 'POST'/, 'state-changing intelligence convergence must be POST-only');
assert.match(api, /input\.sources === true/, 'external source refresh must be explicit in the POST contract rather than automatic on intelligence polling');
assert.match(api, /forceWellness:\s*false/, 'public refresh may not bypass the Garmin wellness throttle');
assert.match(api, /cross_site_refresh_forbidden/, 'cross-site browser refresh requests must be rejected');
assert.match(api, /X-Content-Type-Options/, 'refresh response must retain basic browser hardening');
assert.doesNotMatch(api, /FZ_STATE_WRITE_TOKEN/, '4.3 convergence may not reuse or expose the runtime state-write bearer token');

console.log('PASS Tranche 4.3 intelligence refresh orchestration');
