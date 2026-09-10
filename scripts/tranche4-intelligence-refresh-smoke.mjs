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

assert.match(api, /req\.method !== 'GET'/, 'refresh endpoint must expose one bounded method');
assert.match(api, /const refreshSources = flag\(req\.query\?\.sources\)/, 'external source refresh must be explicit rather than automatic on every intelligence poll');
assert.match(api, /X-Content-Type-Options/, 'refresh response must retain basic browser hardening');

console.log('PASS Tranche 4.3 intelligence refresh orchestration');
