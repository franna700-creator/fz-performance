import assert from 'node:assert/strict';
import fs from 'node:fs';
import { affectedNodes } from '../lib/runtime-dependency-graph.js';

const runtimeWrite=fs.readFileSync('api/runtime-state-write.js','utf8');
const runtimeSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
const athleteResponse=fs.readFileSync('lib/athlete-response-capture.js','utf8');

assert.match(runtimeWrite,/recomputeRecommendationShadowSafely/,'canonical runtime publication must have an executable 4.2 shadow trigger');
assert.ok(runtimeWrite.indexOf('publishDatabaseRuntimeState') < runtimeWrite.lastIndexOf('recomputeRecommendationShadowSafely'),'shadow recomputation must be downstream of canonical state publication');
assert.match(runtimeWrite,/RUNTIME_STATE_PUBLISH/,'runtime publication trigger provenance must be explicit');
assert.match(runtimeSync,/MAX\(id\).*fz_training_source_records/s,'training refresh must compare immutable source-ledger versions rather than raw activity counts');
assert.match(runtimeSync,/sourceVersionChanged/,'training refresh must detect whether a new source-record version was actually persisted');
assert.match(runtimeSync,/meaningfulChange=sourceVersionChanged \|\| \(sourceVersionMarkerUnavailable&&sourceActivityObserved\) \|\| \(athleteMemory\.linked\|\|0\)>0/,'training refresh must avoid five-minute no-op shadow recomputation while degrading conservatively if the source-version marker is unavailable');
assert.match(runtimeSync,/recomputeRecommendationShadowSafely/,'meaningful training change must have an executable shadow trigger');
assert.match(athleteResponse,/materiality\.shouldRecomputeRecommendation/,'athlete feedback must remain materiality-gated');
assert.match(athleteResponse,/recomputeRecommendationShadowSafely/,'material athlete feedback must immediately invoke shadow recomputation');

for(const source of ['source.tredict.activity','source.garmin.activity','source.athlete.event','source.athlete.objective']){
  const closure=affectedNodes(source);
  assert.ok(closure.includes('recommendation.shadow'),`${source} must reach recommendation.shadow`);
  assert.ok(!closure.includes('recommendation.current'),`${source} must not reach active recommendation.current during shadow`);
}
console.log('PASS executable 4.2 trigger coverage: scheduled runtime publication, meaningful training change and material athlete feedback reach shadow while TODAY remains isolated');
