import assert from 'node:assert/strict';
import { composeSessionOptions, SESSION_OPTION_COMPOSER_VERSION } from '../lib/session-option-composer.js';

function shadow(overrides={}){return {
  contextType:'RECOMMENDATION_SHADOW',recommendationId:'shadow:test',contextFingerprint:'ctx',status:'READY',lane:'ADAPT',confidence:'HIGH',
  rules:{safetyOverridesLaneScoring:true},explanation:{safety:{override:false}},
  contextSummary:{primaryObjective:{id:'hyrox',name:'HYROX',runwayDays:78},topMeasurementGaps:[{measurementId:'running.compromised_repeatability',priority:1}],recovery:{constraintSeverity:'LOW'},uncertainty:{assumptions:[]}},...overrides
};}
const options=composeSessionOptions(shadow());
assert.ok(options.ADAPT.length>=1&&options.ADAPT.length<=3);
assert.match(options.ADAPT[0].title,/Compromised running/i);
assert.equal(options.ADAPT[0].targetedGaps[0],'running.compromised_repeatability');
assert.equal(options.ADAPT[0].composerVersion,SESSION_OPTION_COMPOSER_VERSION);
assert.ok(options.ADAPT[0].dose.includes('1 km'));
assert.ok(options.ABSORB.length>0&&options.MAINTAIN.length>0,'athlete agency may expose qualified alternatives');
const constrained=composeSessionOptions(shadow({lane:'ABSORB',contextSummary:{primaryObjective:{id:'hyrox',name:'HYROX',runwayDays:78},topMeasurementGaps:[{measurementId:'running.compromised_repeatability'}],recovery:{constraintSeverity:'HIGH',status:'POST-SESSION ABSORPTION'}}}));
assert.equal(constrained.ADAPT.length,0,'high-constraint ABSORB context must not expose hidden quality');
const safety=composeSessionOptions(shadow({lane:'ABSORB',explanation:{safety:{override:true}}}));
assert.ok(safety.ABSORB.length>0);assert.equal(safety.MAINTAIN.length,0);assert.equal(safety.ADAPT.length,0);
const nearEvent=composeSessionOptions(shadow({contextSummary:{primaryObjective:{id:'hyrox',name:'HYROX',runwayDays:2},topMeasurementGaps:[{measurementId:'running.fade'}],recovery:{constraintSeverity:'LOW'}}}));
assert.equal(nearEvent.ADAPT.length,0,'very near event runway must gate high-cost adaptive options');
const withheld=composeSessionOptions(shadow({status:'WITHHELD',lane:null}));assert.deepEqual(withheld,{ABSORB:[],MAINTAIN:[],ADAPT:[]});
console.log('PASS Tranche 4.4 deterministic session option composer');
