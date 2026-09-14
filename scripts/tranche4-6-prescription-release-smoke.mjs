import assert from 'node:assert/strict';
import { attachSessionPrescriptions, SESSION_PRESCRIPTION_COMPOSER_VERSION } from '../lib/session-prescription-resolver.js';

function option(lane,key,title,targetedGaps=[]){return {optionId:`option:4.4.0-composer.1:${lane.toLowerCase()}:${key}:fixture`,title,objective:'fixture objective',dose:'fixture dose',expectedCost:lane==='ADAPT'?'MODERATE_TO_HIGH':'LOW_TO_MODERATE',targetedGaps,confidence:'HIGH',successCondition:'fixture success',stopCondition:'fixture stop',evidenceBasis:['fixture']};}
const lanes={ABSORB:[],MAINTAIN:[option('MAINTAIN','hybrid-technique','Controlled hybrid technique')],ADAPT:[option('ADAPT','matched-run-aet','Matched Run AET',['running.controlled_efficiency']),option('ADAPT','wall-ball-tolerance','Standardised Wall Ball tolerance',['station.wall_ball_tolerance']),option('ADAPT','station-work-rate','Standardised station work-rate',['station.sled_capability'])]};
const first=attachSessionPrescriptions(lanes,{}),second=attachSessionPrescriptions(lanes,{});
assert.equal(SESSION_PRESCRIPTION_COMPOSER_VERSION,'4.6.0-prescription.2');
const run=first.ADAPT[0].prescription,wall=first.ADAPT[1].prescription,station=first.ADAPT[2].prescription,hybrid=first.MAINTAIN[0].prescription;
assert.equal(run.protocolFamilyId,'MATCHED_RUN_AET');
assert.equal(run.protocolVersion,'1.1');
assert.equal(run.selectionReady,true);
assert.equal(run.comparisonClass,'FAMILY_COMPARABLE');
assert.match(run.mainSet[0].instructions,/30 s running work \/ 15 s recovery/);
assert.match(run.mainSet[1].instructions,/4:00/);
assert(run.benchmarkInvariants.includes('85–88% max-HR work control'));
assert(run.requiredCapture.includes('terrainOrTreadmillContext'));
assert.equal(run.prescriptionFingerprint,second.ADAPT[0].prescription.prescriptionFingerprint,'matched Run AET fingerprint must be deterministic');
assert.equal(wall.protocolFamilyId,'WALL_BALL_TOLERANCE');
assert.equal(wall.protocolVersion,'2.0');
assert.equal(wall.selectionReady,true);
assert.equal(wall.comparisonClass,'BENCHMARK_EXACT');
assert(wall.equipment.includes('6 kg wall ball'));
assert.match(wall.declaredVariantChanges[0],/2 Sep baseline began with a 14 lb ball and reduced to 5 kg/);
assert.equal(wall.prescriptionFingerprint,second.ADAPT[1].prescription.prescriptionFingerprint,'wall-ball benchmark fingerprint must be deterministic');
assert.equal(station.selectionReady,false,'generic station work-rate remains withheld until station/load are qualified');
assert.equal(station.comparisonClass,'TRAINING_ONLY');
assert.equal(hybrid.selectionReady,false,'hybrid technique remains withheld until objective-qualified event settings are resolved');
console.log('PASS Tranche 4.6 prescription release: recovered AET protocols are executable and unsupported generic protocols remain withheld');
