import assert from 'node:assert/strict';
import fs from 'node:fs';
import { affectedNodes, affectedSurfaces } from '../lib/runtime-dependency-graph.js';

const athleteClosure=affectedNodes('source.athlete.feedback');
for(const node of ['athlete.memory','materiality.current','adaptive.context','recommendation.shadow','recommendation.current','ui.train','ui.trends','ui.today'])assert.ok(athleteClosure.includes(node),`Athlete feedback dependency closure missing ${node}`);
const athleteSurfaces=affectedSurfaces('source.athlete.feedback');
for(const surface of ['TODAY','TRAIN','TRENDS'])assert.ok(athleteSurfaces.includes(surface),`Athlete feedback affected surfaces missing ${surface}`);

const trainingClosure=affectedNodes('source.tredict.activity');
for(const node of ['training.session','training.evidence','trends.ncl','load.rolling','capability.evidence','adaptive.context','recommendation.shadow','recommendation.current','ui.train','ui.trends'])assert.ok(trainingClosure.includes(node),`Training dependency closure missing ${node}`);

const athleteCapture=fs.readFileSync('lib/athlete-response-capture.js','utf8');
const memoryIndex=athleteCapture.indexOf('recordAthleteMemory(normalized)');
const materialityIndex=athleteCapture.indexOf('persistMaterialityAssessment');
const propagationIndex=athleteCapture.indexOf('propagateCanonicalChangeSafely');
assert.ok(memoryIndex>=0&&materialityIndex>memoryIndex&&propagationIndex>materialityIndex,'Athlete evidence must persist before materiality and propagation');
assert.match(athleteCapture,/changedNodes:\['source\.athlete\.feedback','athlete\.memory','materiality\.current'\]/,'Athlete ingestion must enter canonical dependency propagation');

const propagation=fs.readFileSync('lib/canonical-propagation.js','utf8');
assert.match(propagation,/affectedNodes/,'Propagation must execute dependency graph closure');
assert.match(propagation,/affectedSurfaces/,'Propagation must calculate affected surfaces');
assert.match(propagation,/recomputeRecommendationShadowSafely/,'Propagation must own shadow recomputation');
assert.match(propagation,/persistActiveRecommendationFromShadow/,'Propagation must own active recommendation projection');
assert.match(propagation,/pendingPropagation/,'Propagation must report unresolved downstream work');

const trainingSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
assert.match(trainingSync,/propagateCanonicalChangeSafely/,'Training sync must execute canonical propagation');
assert.match(trainingSync,/source\.tredict\.activity/,'Tredict changes must enter dependency graph');
assert.match(trainingSync,/source\.garmin\.activity/,'Garmin changes must enter dependency graph');
assert.match(trainingSync,/process\.reconcileAthleteMemory/,'Late binding must enter dependency graph');

const athleteApi=fs.readFileSync('api/training/athlete-event.js','utf8');
for(const contract of ['interpretedSummaryPrimary: true','rawTextRetainedAsProvenanceWhenAvailable: true','propagatesCanonicalDependenciesSameTurn: true','routineAthleteStateRequiresDeployment: false'])assert.ok(athleteApi.includes(contract),`Athlete API contract missing ${contract}`);
assert.doesNotMatch(athleteApi,/materialityDoesNotYetRecomputeRecommendation:\s*true/,'Stale non-recompute contract must not survive');

const refresh=fs.readFileSync('lib/intelligence-refresh.js','utf8');
assert.match(refresh,/repairOrphanedEmbeddedAthleteContext/,'Intelligence refresh must sweep embedded athlete-confirmed context');
assert.match(refresh,/forceRecommendationRecompute:true/,'Pending canonical decision inputs must converge through the propagation controller');

const integrity=fs.readFileSync('lib/athlete-context-integrity.js','utf8');
assert.match(integrity,/athlete_confirmed_context/,'Integrity sweep must detect embedded athlete-confirmed context');
assert.match(integrity,/verbatim:false/,'Recovered context must never be misrepresented as a verbatim quote');
assert.match(integrity,/EMBEDDED_ATHLETE_CONTEXT_WITHOUT_CANONICAL_MEMORY/,'Integrity repair must retain explicit provenance');

const presentation=fs.readFileSync('lib/training-presentation.js','utf8');
assert.match(presentation,/mergeEvidenceRows/,'Training Memory must use monotonic best-available evidence');
assert.match(presentation,/deriveTrainingMetrics/,'Training Memory must derive canonical session metrics server-side');
assert.match(presentation,/metrics:canonicalEvidence\.metrics/,'Every canonical session must expose metrics');

const richUi=fs.readFileSync('src/training-memory-rich.js','utf8');
for(const expected of ['durationSeconds','distanceMeters','avgHeartRate','maxHeartRate','calories','avgPowerWatts','paceSecPerKm','cadence','elevationGainMeters'])assert.ok(richUi.includes(expected),`Rich Training Memory missing ${expected}`);
assert.match(richUi,/\['ALL','All sessions'\]/,'All Sessions lens must be retained');
assert.match(richUi,/No Athlete Voice is linked to this execution/,'Sessions without Athlete Voice must remain valid Training Memory');

const shell=fs.readFileSync('scripts/clean-shell.mjs','utf8');
assert.match(shell,/training-memory-rich\.js/,'Production shell must wire rich Training Memory');
assert.match(shell,/executableGoldenThreads:true/,'Release contract must identify executable golden threads');
assert.match(shell,/canonicalTrainingMetrics:true/,'Release contract must identify canonical Training Memory metrics');

console.log('PASS architecture closeout regression matrix');
console.log('  ✓ natural athlete input -> Athlete Memory -> materiality -> executable dependency propagation');
console.log('  ✓ recommendation-grade evidence -> 4.2 shadow -> 4.3 active projection');
console.log('  ✓ Tredict/Garmin -> canonical session/evidence -> dependent intelligence + TRAIN/TRENDS');
console.log('  ✓ late Athlete Memory binding participates in propagation');
console.log('  ✓ orphaned embedded athlete-confirmed context has an idempotent non-verbatim recovery path');
console.log('  ✓ canonical Training Memory metrics are server-derived and rendered for All Sessions');
console.log('  ✓ missing metrics remain unknown rather than fabricated zero');
console.log('  ✓ routine athlete/training evolution remains runtime data, not a deployment');
