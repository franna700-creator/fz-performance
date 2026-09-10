import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildObjectiveContext, eventDateBounds, eventRunwayWindow, persistedEventState, validateObjectiveRegistry } from '../lib/event-objective-model.js';
import { recommendationContextFingerprint } from '../lib/recommendation-engine.js';
import { transferAssessmentIsCurrent } from '../lib/objective-runtime-store.js';

const cap={id:'shared_capability',name:'Shared capability',category:'TEST',description:'Synthetic capability for dynamic-event regression.'};
const primary={id:'primary-dynamic-event',name:'Primary dynamic event',date:'2026-12-01',status:'SCHEDULED',role:'PRIMARY',strategicWeight:1,knowledgeStatus:'QUALIFIED',formatProfileId:'profile-v1',versionToken:'primary:r1:profile-v1',profileVersionToken:'profile-v1@1',demands:[{capabilityId:cap.id,weight:1,transferWeight:1,specificity:'SHARED'}]};
const considering={id:'maybe-event',name:'Maybe event',status:'CANDIDATE',role:'SECONDARY',strategicWeight:0.7,knowledgeStatus:'RESEARCH_REQUIRED',demands:[]};
const approximate={id:'window-event',name:'Window event',startsOn:'2026-11-10',endsOn:'2026-11-17',datePrecision:'WEEK',status:'SCHEDULED',role:'SECONDARY',strategicWeight:0.4,knowledgeStatus:'RESEARCH_REQUIRED',demands:[]};
const registry={version:'1.0',capabilities:[cap],events:[primary,considering,approximate],evergreenObjectives:[]};

const validation=validateObjectiveRegistry(registry);
assert.equal(validation.ok,true,validation.errors.join('; '));
assert.deepEqual(eventDateBounds(considering),{start:null,end:null,precision:'UNKNOWN',exact:false});
assert.equal(persistedEventState('CANDIDATE'),'DORMANT','candidate intake must map to the existing persisted DORMANT state without a schema change');
assert.deepEqual(eventRunwayWindow(approximate,'2026-11-01'),{minDays:9,maxDays:16,precision:'WEEK',exact:false});
const context=buildObjectiveContext(registry,'2026-11-01');
assert.equal(context.primaryEvent.id,primary.id);
assert.equal(context.upcomingEvents.some(event=>event.id===considering.id),false,'considering/CANDIDATE event must not drive planning');
assert.equal(context.upcomingEvents.find(event=>event.id===approximate.id).runwayWindow.maxDays,16,'approximate event date must remain a range');

const moved=buildObjectiveContext({...registry,events:registry.events.map(event=>event.id===approximate.id?{...event,startsOn:'2026-11-20',endsOn:'2026-11-27'}:event)},'2026-11-01');
assert.equal(moved.upcomingEvents.find(event=>event.id===approximate.id).runwayDays,19,'event date change must be evaluated from runtime data, not a hard-coded date');

const objectiveStore=fs.readFileSync('lib/objective-runtime-store.js','utf8');
const adaptive=fs.readFileSync('lib/adaptive-context.js','utf8');
const runtimeSources=[objectiveStore,adaptive,fs.readFileSync('lib/recommendation-engine.js','utf8'),fs.readFileSync('lib/event-objective-model.js','utf8')].join('\n');
for(const forbidden of ['hyrox-johannesburg-2026-11-28','deadly-dozen-uj-2026-09-20','hoka-half-pretoria-2026-09-24']) {
  assert.equal(runtimeSources.includes(forbidden),false,`runtime logic must not hard-code current event id ${forbidden}`);
}
for(const forbiddenConfig of ['objective-seed.json','event-format-profiles.json','CONFIG_SEED_FALLBACK','reference.transferRules']) {
  assert.equal(objectiveStore.includes(forbiddenConfig),false,`runtime objective loader must not contain static event fallback/reference: ${forbiddenConfig}`);
}
assert.equal(objectiveStore.includes('fz_event_transfer_assessments'),true,'live transfer calibration must come from Neon assessment history');
assert.equal(objectiveStore.includes('fz_event_source_evidence'),true,'runtime event provenance must include athlete/research source evidence');
assert.equal(adaptive.includes('eventDataIsRuntimeVariable:true'),true,'adaptive context must declare runtime-variable event semantics');
assert.equal(adaptive.includes("event:${event.id}:${event.versionToken||'unversioned'}"),true,'event revision/version must enter shadow decision evidence');

const tokens=new Map([['profile-a','profile-a:current'],['profile-b','profile-b:current']]);
const updated=new Map([['profile-a','2026-09-10T10:00:00.000Z'],['profile-b','2026-09-10T10:00:00.000Z']]);
assert.equal(transferAssessmentIsCurrent({source_profile_id:'profile-a',target_profile_id:'profile-b',transfer_score:0.7,effective_at:'2026-09-10T09:00:00.000Z',assessment:{}},{profileTokens:tokens,profileUpdatedAt:updated}),false,'assessment older than current profile must be rejected');
assert.equal(transferAssessmentIsCurrent({source_profile_id:'profile-a',target_profile_id:'profile-b',transfer_score:0.7,effective_at:'2026-09-10T11:00:00.000Z',assessment:{sourceProfileVersionToken:'profile-a:old'}},{profileTokens:tokens,profileUpdatedAt:updated}),false,'assessment bound to an old profile version token must be rejected');
assert.equal(transferAssessmentIsCurrent({source_profile_id:'profile-a',target_profile_id:'profile-b',transfer_score:0.7,effective_at:'2026-09-10T11:00:00.000Z',assessment:{sourceProfileVersionToken:'profile-a:current',targetProfileVersionToken:'profile-b:current'}},{profileTokens:tokens,profileUpdatedAt:updated}),true,'assessment for current profile versions should remain eligible');

const baseDecision={
  primaryObjective:{id:'primary-dynamic-event',role:'PRIMARY',runwayDays:30,knowledgeStatus:'QUALIFIED'},
  recovery:{readinessScore:70},load:{rolling7d:100,rolling28d:400,recentAdaptCount:0},sequencing:{},
  eventPressure:[{id:'window-event',role:'SECONDARY',runwayDays:9,knowledgeStatus:'QUALIFIED'}],
  measurement:{status:'READY',hierarchyId:'generic-test',topGaps:[]},materiality:null,uncertainty:{missing:[],assumptions:[]},
  evidence:[{ref:'objective:primary-dynamic-event:r1',fact:'x',provenance:'test',quality:'DIRECT'},{ref:'event:window-event:r1:overlap:0.4',fact:'x',provenance:'test',quality:'DERIVED'}]
};
const revisedDecision={...baseDecision,evidence:[baseDecision.evidence[0],{...baseDecision.evidence[1],ref:'event:window-event:r2:overlap:0.7'}]};
assert.notEqual(recommendationContextFingerprint(baseDecision),recommendationContextFingerprint(revisedDecision),'event revision/overlap evidence must change recommendation identity');

console.log('PASS event runtime variability: no static runtime event seed, dynamic dates/participation, Neon transfer provenance, revision-sensitive shadow identity');
