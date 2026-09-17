import assert from 'node:assert/strict';
import fs from 'node:fs';
import { affectedNodes } from '../lib/runtime-dependency-graph.js';

const runtimeWrite=fs.readFileSync('api/runtime-state-write.js','utf8');
const runtimeSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
const athleteResponse=fs.readFileSync('lib/athlete-response-capture.js','utf8');
const canonicalPropagation=fs.readFileSync('lib/canonical-propagation.js','utf8');
const shadowStore=fs.readFileSync('lib/recommendation-shadow-store.js','utf8');
const intelligenceRefresh=fs.readFileSync('lib/intelligence-refresh.js','utf8');

assert.match(runtimeWrite,/propagateCanonicalChangeSafely/,'canonical runtime publication must enter the shared propagation controller');
assert.ok(runtimeWrite.indexOf('publishDatabaseRuntimeState') < runtimeWrite.lastIndexOf('propagateCanonicalChangeSafely'),'runtime propagation must remain downstream of successful canonical state publication');
assert.match(runtimeWrite,/changedNodes:\['source\.fz\.runtime\.publish'\]/,'runtime publication must declare its canonical dependency node');
assert.match(runtimeWrite,/RUNTIME_STATE_PUBLISH/,'runtime publication trigger provenance must be explicit');
assert.doesNotMatch(runtimeWrite,/recomputeRecommendationShadowSafely/,'runtime publication must not bypass canonical propagation with a direct shadow recompute');

assert.match(runtimeSync,/MAX\(id\).*fz_training_source_records/s,'training refresh must compare immutable source-ledger versions');
assert.match(runtimeSync,/source_key <> 'fz-intelligence'/,'training refresh revision must exclude intelligence writes');
assert.match(runtimeSync,/assessTrainingSourceChanges/,'training source changes must enter the 4.1 materiality gate');
assert.match(runtimeSync,/propagateCanonicalChangeSafely/,'training source changes must enter the canonical propagation controller');
assert.match(runtimeSync,/materiality:recommendationMateriality/,'training propagation must carry the recommendation-grade materiality assessment into the controller');
assert.doesNotMatch(runtimeSync,/forceRecommendationRecompute\s*:\s*true/,'ordinary training sync must not bypass the materiality gate');

assert.match(athleteResponse,/evaluateMateriality/,'Athlete Voice must be materially assessed after canonical memory persistence');
assert.match(athleteResponse,/persistMaterialityAssessment/,'Athlete Voice materiality must persist before downstream propagation');
assert.match(athleteResponse,/propagateCanonicalChangeSafely/,'Athlete Voice must enter the same canonical propagation controller as source training evidence');
assert.match(athleteResponse,/materiality,/,'Athlete Voice propagation must carry the materiality assessment');

assert.match(canonicalPropagation,/const recommendationAffected = closure\.includes\('recommendation\.shadow'\)/,'recommendation recomputation must be dependency-closure aware');
assert.match(canonicalPropagation,/materiality\?\.shouldRecomputeRecommendation === true/,'canonical propagation must keep ordinary recommendation recomputation materiality-gated');
assert.match(canonicalPropagation,/const readinessChanged = readiness\?\.changed === true/,'canonical readiness change must be an explicit versioned decision-input trigger');
assert.match(canonicalPropagation,/forceRecommendationRecompute \|\| readinessChanged \|\| materiality\?\.shouldRecomputeRecommendation === true/s,'only explicit systemic convergence, a canonical readiness change, or recommendation-grade materiality may trigger recomputation');
assert.match(canonicalPropagation,/recomputeCurrentReadinessSafely/,'canonical propagation must compute readiness before the recommendation shadow');
assert.ok(canonicalPropagation.indexOf('recomputeCurrentReadinessSafely') < canonicalPropagation.lastIndexOf('recomputeRecommendationShadowSafely'),'readiness must be recomputed upstream of the recommendation shadow');
assert.match(canonicalPropagation,/recomputeRecommendationShadowSafely/,'canonical propagation must own immutable 4.2 shadow recomputation');
assert.match(canonicalPropagation,/persistActiveRecommendationFromShadow/,'canonical propagation must own controlled 4.3 projection when recommendation.current is actually pending');

assert.doesNotMatch(shadowStore,/active-recommendation-store|recordType:\s*['"]recommendation['"]/,'4.2 shadow persistence itself must remain isolated from active recommendation writes');
assert.match(intelligenceRefresh,/current\.pending\?\.readiness/,'systemic refresh must detect a pending canonical readiness derivation');
assert.match(intelligenceRefresh,/INTELLIGENCE_REFRESH_READINESS/,'readiness convergence must retain explicit trigger provenance');
assert.match(intelligenceRefresh,/current\.pending\?\.activeRecommendation/,'systemic refresh must detect a pending active recommendation projection');
assert.match(intelligenceRefresh,/changedNodes:\['recommendation\.shadow'\]/,'systemic refresh must converge pending 4.3 projection through canonical propagation rather than bypassing it');
assert.match(intelligenceRefresh,/forceRecommendationRecompute:true/,'systemic refresh must retain an explicit forced convergence path for stale decision inputs');

for(const source of ['source.tredict.activity','source.garmin.activity','source.athlete.feedback','source.athlete.objective','source.fz.runtime.publish']){
  const closure=affectedNodes(source);
  assert.ok(closure.includes('recommendation.shadow'),`${source} must reach recommendation.shadow`);
  assert.ok(closure.includes('recommendation.current'),`${source} must reach controlled 4.3 recommendation.current projection`);
  assert.ok(closure.includes('ui.today'),`${source} must reach the athlete-facing TODAY dependency closure in 4.3`);
}
for(const source of ['source.garmin.wellness','source.athlete.feedback']){
  const closure=affectedNodes(source);
  assert.ok(closure.includes('readiness.current'),`${source} must reach canonical readiness before adaptive recommendation`);
}
console.log('PASS executable readiness + recommendation trigger coverage: all decision-driving writes enter canonical propagation and reach controlled recommendation projection');
