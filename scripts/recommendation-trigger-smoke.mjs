import assert from 'node:assert/strict';
import fs from 'node:fs';
import { affectedNodes } from '../lib/runtime-dependency-graph.js';

const runtimeWrite=fs.readFileSync('api/runtime-state-write.js','utf8');
const runtimeSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
const athleteResponse=fs.readFileSync('lib/athlete-response-capture.js','utf8');
const shadowStore=fs.readFileSync('lib/recommendation-shadow-store.js','utf8');
const intelligenceRefresh=fs.readFileSync('lib/intelligence-refresh.js','utf8');

assert.match(runtimeWrite,/recomputeRecommendationShadowSafely/,'canonical runtime publication must retain an executable 4.2 shadow trigger');
assert.ok(runtimeWrite.indexOf('publishDatabaseRuntimeState') < runtimeWrite.lastIndexOf('recomputeRecommendationShadowSafely'),'shadow recomputation must remain downstream of canonical state publication');
assert.match(runtimeWrite,/RUNTIME_STATE_PUBLISH/,'runtime publication trigger provenance must be explicit');

assert.match(runtimeSync,/MAX\(id\).*fz_training_source_records/s,'training refresh must compare immutable source-ledger versions');
assert.match(runtimeSync,/source_key <> 'fz-intelligence'/,'training refresh revision must exclude intelligence writes');
assert.match(runtimeSync,/assessTrainingSourceChanges/,'training source changes must enter the 4.1 materiality gate');
assert.match(runtimeSync,/recomputeRecommendation && recommendationMateriality/,'training shadow recomputation must be materiality-gated');

assert.match(athleteResponse,/materiality\.shouldRecomputeRecommendation/,'Athlete Voice must remain materiality-gated');
assert.match(athleteResponse,/recomputeRecommendationShadowSafely/,'material Athlete Voice must immediately invoke immutable 4.2 shadow recomputation');
assert.doesNotMatch(shadowStore,/active-recommendation-store|recordType:\s*['"]recommendation['"]/,'4.2 shadow persistence itself must remain isolated from active recommendation writes');
assert.match(intelligenceRefresh,/persistActiveRecommendationFromShadow/,'4.3 activation must occur only in the explicit systemic propagation layer');

for(const source of ['source.tredict.activity','source.garmin.activity','source.athlete.feedback','source.athlete.objective']){
  const closure=affectedNodes(source);
  assert.ok(closure.includes('recommendation.shadow'),`${source} must reach recommendation.shadow`);
  assert.ok(closure.includes('recommendation.current'),`${source} must reach controlled 4.3 recommendation.current projection`);
  assert.ok(closure.includes('ui.today'),`${source} must reach the athlete-facing TODAY dependency closure in 4.3`);
}
console.log('PASS executable 4.3 trigger coverage: evidence reaches materiality, immutable shadow, controlled active projection and TODAY closure');
