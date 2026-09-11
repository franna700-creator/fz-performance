import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildActiveRecommendationPayload, activeRecommendationSemanticHash } from '../lib/active-recommendation-store.js';
import { SESSION_OPTION_COMPOSER_VERSION } from '../lib/session-option-composer.js';

const schema=JSON.parse(fs.readFileSync('schemas/active-recommendation.schema.json','utf8'));
assert.equal(schema.properties.contextType.const,'ACTIVE_RECOMMENDATION');
assert.deepEqual(schema.$defs.lane.enum,['ABSORB','MAINTAIN','ADAPT']);
assert.equal(schema.$defs.laneOptions.maxItems,3);

const readyShadow={
  contextType:'RECOMMENDATION_SHADOW',engineVersion:'4.2.0-shadow.1',mode:'SHADOW',recommendationId:'shadow:4.2.0-shadow.1:abc123',contextFingerprint:'abc123',status:'READY',lane:'MAINTAIN',confidence:'HIGH',
  explanation:{safety:{override:false},athleteFacing:{headline:'Maintain.'}},rules:{safetyOverridesLaneScoring:true},
  contextSummary:{asOf:'2026-09-11',objectiveSource:'NEON_OBJECTIVE_GRAPH',primaryObjective:{id:'hyrox-jhb',name:'HYROX Johannesburg',role:'PRIMARY',runwayDays:78},measurementHierarchyId:'hyrox-singles-v1',topMeasurementGaps:[{measurementId:'running.compromised_repeatability',priority:1}],recovery:{constraintSeverity:'LOW'},uncertainty:{assumptions:[]}},trigger:{type:'TRAINING_SYNC'}
};
const ready=buildActiveRecommendationPayload(readyShadow);
assert.equal(ready.status,'READY');assert.equal(ready.fzRecommendedLane,'MAINTAIN');assert.equal(ready.athleteSelection,null,'projection must not manufacture athlete choice');
assert.equal(ready.sessionOptionComposerVersion,SESSION_OPTION_COMPOSER_VERSION);assert.equal(ready.rules.sessionOptionsDeferredToTranche44,false);
assert.ok(ready.lanes.MAINTAIN.length>=1&&ready.lanes.MAINTAIN.length<=3,'recommended lane must expose concrete options');
assert.ok(ready.lanes.MAINTAIN.every(option=>option.optionId&&option.dose&&option.whyNow),'options must be executable and explainable');
assert.equal(ready.provenance.sourceRecommendationId,readyShadow.recommendationId);assert.equal(ready.rules.shadowAuditImmutable,true);assert.equal(ready.rules.athleteChoiceDoesNotRewriteRecommendation,true);assert.equal(Object.hasOwn(ready,'generatedAt'),false);
const sameDecisionDifferentTrigger={...readyShadow,trigger:{type:'MANUAL_REFRESH'}};
assert.equal(activeRecommendationSemanticHash(readyShadow),activeRecommendationSemanticHash(sameDecisionDifferentTrigger),'active recommendation identity must ignore invocation metadata');
const withheld=buildActiveRecommendationPayload({...readyShadow,recommendationId:'shadow:def',contextFingerprint:'def',status:'WITHHELD',lane:null,confidence:'LOW'});
assert.equal(withheld.fzRecommendedLane,null);assert.deepEqual(withheld.lanes,{ABSORB:[],MAINTAIN:[],ADAPT:[]});
const safety=buildActiveRecommendationPayload({...readyShadow,recommendationId:'shadow:safety',contextFingerprint:'safety',lane:'ABSORB',explanation:{safety:{override:true}}});
assert.equal(safety.fzRecommendedLane,'ABSORB');assert.equal(safety.safetyOverride,true);assert.equal(safety.lanes.MAINTAIN.length,0);assert.equal(safety.lanes.ADAPT.length,0);assert.ok(safety.lanes.ABSORB.length>0);
console.log('PASS Tranche 4.4 active recommendation + concrete option projection');
