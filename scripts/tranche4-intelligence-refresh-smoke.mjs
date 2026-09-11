import assert from 'node:assert/strict';
import fs from 'node:fs';

const orchestrator = fs.readFileSync('lib/intelligence-refresh.js', 'utf8');
const propagation = fs.readFileSync('lib/canonical-propagation.js', 'utf8');
const current = fs.readFileSync('lib/intelligence-current.js', 'utf8');
const api = fs.readFileSync('api/system/status.js', 'utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const training = fs.readFileSync('lib/training-sync-runtime.js', 'utf8');
const materiality = fs.readFileSync('lib/source-materiality.js', 'utf8');
const wellness = fs.readFileSync('lib/wellness-sync.js', 'utf8');

assert.match(orchestrator, /syncTrainingSources\(\{[\s\S]*recomputeRecommendation:\s*false/, 'central refresh must prevent nested training recommendation recomputation');
assert.ok(orchestrator.indexOf('repairUnassessedAthleteMateriality') < orchestrator.indexOf('current.pending.shadowRecommendation'), 'Athlete Voice materiality repair must precede recommendation staleness evaluation');
assert.ok(orchestrator.indexOf('current.pending.shadowRecommendation') < orchestrator.indexOf('current.pending.activeRecommendation'), '4.2 shadow convergence must precede 4.3 activation');
assert.match(orchestrator, /propagateCanonicalChangeSafely/, 'systemic refresh must converge through the canonical propagation controller');
assert.match(orchestrator, /changedNodes:\['recommendation\.shadow'\]/, 'pending 4.3 projection must be requested from persisted shadow through canonical propagation');
assert.match(propagation, /persistActiveRecommendationFromShadow/, 'canonical propagation must own 4.3 projection from persisted shadow');
assert.doesNotMatch(orchestrator, /recordAthleteMemory|recordExerciseAthleteResponse|record_type\s*:\s*['"]decision['"]/, 'system refresh may not manufacture Athlete Voice or athlete decisions');

assert.match(training, /assessTrainingSourceChanges/, 'training source evolution must pass through 4.1 materiality');
assert.match(training, /recommendationMateriality/, 'training recomputation must be materiality-gated');
assert.match(training, /source_key <> 'fz-intelligence'/, 'training revision marker must be isolated from intelligence ledger writes');
assert.match(materiality, /JOIN\s+fz_training_source_latest\s+canonical\s+ON\s+canonical\.id=r\.id/, 'materiality must only assess the canonical latest source revision');
assert.match(materiality, /ORDER BY previous\.source_updated_at DESC NULLS LAST, previous\.ingested_at DESC, previous\.id DESC/, 'materiality comparison must use canonical revision ordering rather than insertion order');
assert.match(current, /FROM\s+fz_training_source_latest[\s\S]*record_type IN \('planned_workout','executed_activity'\)[\s\S]*ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1/, 'intelligence freshness must read canonical training revisions and prefer source freshness over observation time');
assert.match(current, /const trainingEvidenceAt = firstValue\(rows\.trainingEvidence, \['source_updated_at', 'ingested_at'\]\)/, 'training freshness must prefer source time');
assert.match(current, /const wellnessEvidenceAt = firstValue\(rows\.wellnessEvidence, \['source_as_of', 'ingested_at'\]\)/, 'wellness freshness must prefer source time');
assert.match(wellness, /assessWellnessCurrentMateriality/, 'Garmin wellness must pass through 4.1 materiality after canonical persistence');

assert.match(api, /operation === 'intelligence-current'/, 'consolidated SYSTEM function must dispatch read-only intelligence current');
assert.match(api, /operation === 'intelligence-refresh'/, 'consolidated SYSTEM function must dispatch intelligence convergence');
assert.match(api, /req\.method !== 'POST'/, 'state-changing intelligence convergence must be POST-only');
assert.match(api, /input\.sources === true/, 'external source refresh must be explicit in the POST contract rather than automatic on intelligence polling');
assert.match(api, /forceWellness:\s*false/, 'public refresh may not bypass the Garmin wellness throttle');
assert.match(api, /cross_site_refresh_forbidden/, 'cross-site browser refresh requests must be rejected');
assert.match(api, /X-Content-Type-Options/, 'refresh response must retain basic browser hardening');
assert.doesNotMatch(api, /process\.env\.FZ_STATE_WRITE_TOKEN\s*[!=]=?\s*req|authorization.*FZ_STATE_WRITE_TOKEN/i, '4.3 convergence may not reuse or expose the runtime state-write bearer token');

const rewriteMap = new Map((vercel.rewrites || []).map(rule => [rule.source, rule.destination]));
assert.equal(rewriteMap.get('/api/intelligence/current'), '/api/system/status?operation=intelligence-current', 'public intelligence-current contract must be rewritten to the consolidated SYSTEM function');
assert.equal(rewriteMap.get('/api/intelligence/refresh'), '/api/system/status?operation=intelligence-refresh', 'public intelligence-refresh contract must be rewritten to the consolidated SYSTEM function');
assert.equal(fs.existsSync('api/intelligence/current.js'), false, 'standalone current function must stay removed to preserve Hobby function budget');
assert.equal(fs.existsSync('api/intelligence/refresh.js'), false, 'standalone refresh function must stay removed to preserve Hobby function budget');

console.log('PASS Tranche 4.3 intelligence refresh orchestration + centralized propagation + consolidated Vercel routing');
