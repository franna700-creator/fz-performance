import assert from 'node:assert/strict';
import { evaluateReadiness, mergeCanonicalReadinessIntoContext, READINESS_ENGINE_VERSION } from '../lib/readiness-engine.js';

const history = [
  [63,59,7.88,81,73],[60,61,6.95,80,69],[74,55,8.60,92,100],[63,60,6.35,74,80],[56,60,5.87,67,58],[57,63,5.63,63,55],
  [null,null,null,null,null],[67,56,7.53,87,83],[74,57,7.07,85,88],[58,59,6.52,75,70],[68,57,7.59,80,87],[61,57,6.48,76,75],
  [57,58,7.40,70,76],[66,57,7.40,81,88],[64,57,6.70,81,81],[63,57,6.80,78,89],[70,57,6.18,80,87],[66,55,6.87,82,89],
  [75,56,7.17,91,98],[63,57,7.32,62,88],[33,58,4.73,31,35]
].map(([hrvLastNight,restingHeartRate,sleepHours,sleepScore,bodyBatteryHigh]) => ({hrvLastNight,restingHeartRate,sleepHours,sleepScore,bodyBatteryHigh}));

function current(hrvLastNight,restingHeartRate,sleepHours,sleepScore,bodyBatteryHigh){return{hrvLastNight,restingHeartRate,sleepHours,sleepScore,bodyBatteryHigh};}
function between(value,min,max,message){assert.ok(value>=min&&value<=max,`${message}: ${value} not in ${min}..${max}`);}

const sep7=evaluateReadiness({localDate:'2026-09-07',current:current(81,54,7.78,92,94),history});
between(sep7.score,87,92,'7 Sep systemic calibration remains near the retained strong-recovery anchor');
assert.equal(sep7.band,'PROCEED');

const sep8=evaluateReadiness({localDate:'2026-09-08',current:current(82,52,6.87,86,98),history});
between(sep8.score,86,91,'8 Sep systemic calibration remains near the retained strong-recovery anchor');
assert.equal(sep8.band,'PROCEED');

const sep9=evaluateReadiness({localDate:'2026-09-09',current:current(70,54,7.15,81,93),history});
between(sep9.score,80,86,'9 Sep calibration remains near the retained 80 readiness anchor');
assert.ok(['PROCEED','PROCEED WITH CONTROL'].includes(sep9.band));

const sep10=evaluateReadiness({localDate:'2026-09-10',current:current(66,59,5.21,64,71),history});
between(sep10.score,65,71,'10 Sep calibration remains near retained readiness 68');
assert.ok(['MODIFY','PROCEED WITH CONTROL'].includes(sep10.band));

const sep14=evaluateReadiness({localDate:'2026-09-14',current:current(75,56,7.33,84,81),history});
between(sep14.score,79,85,'14 Sep current physiology produces a plausible controlled-readiness score');
assert.equal(sep14.band,'PROCEED WITH CONTROL');
assert.equal(sep14.confidence,'MODERATE','missing same-day Athlete Voice lowers confidence without deleting the score');
assert.match(sep14.localTissueState,/remains unconfirmed/i);

const highConstraint=evaluateReadiness({
  localDate:'2026-09-14',current:current(75,56,7.33,84,81),history,
  athleteEvent:{summary:'Severe quad soreness today',payload:{memoryCategories:['STATE','RECOVERY','CONSTRAINT']}},
  materiality:{level:'RECOMPUTE_RECOMMENDATION',reasonCodes:['DOMS_HIGH']}
});
assert.ok(highConstraint.score<=54,'direct high local constraint caps readiness despite supportive systemic recovery');
assert.equal(highConstraint.band,'FALL BACK');

const positive=evaluateReadiness({
  localDate:'2026-09-14',current:current(75,56,7.33,84,81),history,
  athleteEvent:{summary:'Legs feel fresh, no pain and feeling really good',payload:{memoryCategories:['STATE','RECOVERY','CONSTRAINT']}},
  materiality:{level:'UPDATE_STATE',reasonCodes:['CONSTRAINT_REPORTED_RESOLVED','ATHLETE_STATE_MATERIAL_POSITIVE']}
});
assert.ok(positive.score>=sep14.score,'direct positive current-state evidence may remove conservative uncertainty rather than lower readiness');
assert.equal(positive.confidence,'HIGH');

const sparse=evaluateReadiness({localDate:'2026-09-14',current:{sleepScore:84},history:[]});
assert.equal(sparse.status,'WITHHELD');assert.equal(sparse.score,null);assert.equal(sparse.band,null);

const canonical={...sep14,inputFingerprint:'fp-14',engineVersion:READINESS_ENGINE_VERSION};
const context=mergeCanonicalReadinessIntoContext({recovery:{readinessScore:null,runtimeReadinessDate:'2026-09-10'},uncertainty:{missing:['current readiness score','x']},evidence:[],provenance:{}},canonical);
assert.equal(context.recovery.readinessScore,sep14.score);
assert.equal(context.recovery.readinessEngineVersion,READINESS_ENGINE_VERSION);
assert.deepEqual(context.uncertainty.missing,['x']);
assert.equal(context.provenance.readinessSource,'FZ_CANONICAL_READINESS');

console.log('PASS canonical readiness engine calibration, local override and adaptive-context projection');
