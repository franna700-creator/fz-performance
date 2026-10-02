import assert from 'node:assert/strict';
import { buildCurrentAthleteState } from '../lib/athlete-current-state.js';
import { buildFzPlanSequencing } from '../lib/adaptive-context-v44.js';
import { evaluateRecommendation, recommendationContextFingerprint, RECOMMENDATION_ENGINE_VERSION } from '../lib/recommendation-engine.js';

function event({id,key,at,summary,categories=[],reasons=[],constraintObservations=null,currentContextObservations=null}){
  return {
    event_id:id,event_key:key,event_type:'CONTEXT',occurred_at:at,local_date:at.slice(0,10),summary,
    payload:{
      rawText:summary,memoryCategories:categories,
      ...(constraintObservations?{constraintObservations}:{}),
      ...(currentContextObservations?{currentContextObservations}:{})
    },
    materiality_payload:{materiality:{level:'UPDATE_STATE',reasonCodes:reasons,shouldRecomputeRecommendation:false}}
  };
}

const forearm=event({
  id:1,key:'athlete:forearm:1',at:'2026-09-22T16:00:00.000Z',
  summary:'My forearm is inflamed and painful after training.',
  categories:['CONSTRAINT','COST'],reasons:['PAIN_MODERATE']
});
const forearmState=buildCurrentAthleteState({events:[forearm],asOf:new Date('2026-09-22T18:00:00.000Z')});
assert.ok(forearmState.activeConstraints.some(item=>item.subject==='FOREARM'),'forearm must be a first-class local-tissue subject');
assert.ok(!forearmState.activeConstraints.some(item=>item.subject==='HAND_FINGER_GRIP'),'forearm must not be forced into hand/finger/grip');

const travel=event({
  id:2,key:'athlete:travel:1',at:'2026-10-02T05:00:00.000Z',
  summary:'Travelling for work; hotel gym has no sled or strength setup.',
  categories:['STATE'],
  currentContextObservations:[{
    domain:'TRAVEL',key:'work-trip',state:'ACTIVE',impact:'HARD_CONSTRAINT',
    summary:'Work travel materially limits training setup.',
    staleAfterHours:72,
    details:{blockedModalities:['STRENGTH','HYROX_MIXED']}
  }]
});
const unrelated=event({
  id:3,key:'athlete:recovery:1',at:'2026-10-02T06:00:00.000Z',
  summary:'Slept well and feel fresh.',
  categories:['STATE','RECOVERY']
});
const travelState=buildCurrentAthleteState({events:[travel,unrelated],asOf:new Date('2026-10-02T10:00:00.000Z')});
assert.equal(travelState.activeContexts.length,1,'unrelated feedback must not erase active current context');
assert.equal(travelState.activeContexts[0].contextKey,'TRAVEL:work-trip');
assert.equal(travelState.activeContexts[0].impact,'HARD_CONSTRAINT');
assert.deepEqual(travelState.activeContexts[0].details.blockedModalities,['STRENGTH','HYROX_MIXED']);

const travelExpired=buildCurrentAthleteState({events:[travel],asOf:new Date('2026-10-05T06:01:00.000Z')});
assert.equal(travelExpired.activeContexts.length,0,'bounded travel context must expire');
assert.equal(travelExpired.staleContexts[0]?.status,'STALE_OR_EXPIRED');

const travelResolved=event({
  id:4,key:'athlete:travel:resolved',at:'2026-10-02T18:00:00.000Z',
  summary:'Back home; normal training setup is available again.',
  categories:['STATE'],
  currentContextObservations:[{
    domain:'TRAVEL',key:'work-trip',state:'RESOLVED',impact:'INFORMATIONAL',
    summary:'Work-trip constraint resolved.'
  }]
});
const resolvedState=buildCurrentAthleteState({events:[travel,travelResolved],asOf:new Date('2026-10-02T19:00:00.000Z')});
assert.equal(resolvedState.activeContexts.length,0,'explicit current-context resolution must clear the matching key');
assert.equal(resolvedState.contextResolutionLog.at(-1)?.contextKey,'TRAVEL:work-trip');

const preference=event({
  id:5,key:'athlete:preference:1',at:'2026-10-02T05:00:00.000Z',
  summary:'I prefer the SkiErg to rowing when either works for the session.',
  categories:['STATE'],
  currentContextObservations:[{
    domain:'PREFERENCE',key:'erg-choice',state:'ACTIVE',impact:'PREFERENCE',
    summary:'Prefer SkiErg over RowErg when training value is otherwise equivalent.',
    details:{preferredModalities:['SKI_ERG'],deprioritizedModalities:['ROWING']}
  }]
});
const preferenceState=buildCurrentAthleteState({events:[preference],asOf:new Date('2027-01-01T05:00:00.000Z')});
assert.equal(preferenceState.activeContexts[0]?.domain,'PREFERENCE','durable preference must survive beyond transient context windows');

const athletePlan={
  session_id:'plan:athlete:test',local_date:'2026-10-03',planned_start_at:'2026-10-03T03:00:00.000Z',
  title:'Easy aerobic run',sport_type:'Running',session_kind:'Zone 2',
  payload:{contextType:'ATHLETE_PLANNED_INTENT',plannedForDate:'2026-10-03',title:'Easy aerobic run',modality:'Running',sessionKind:'Zone 2'}
};
const seq=buildFzPlanSequencing(athletePlan,{now:new Date('2026-10-02T06:00:00.000Z'),asOf:'2026-10-02'});
assert.equal(seq.nextPlannedLane,null,'athlete-described intent must not fabricate an FZ lane');
assert.equal(seq.source,'ATHLETE_PLANNED_INTENT');
assert.equal(seq.nextPlannedModality,'RUNNING');

const baseContext={
  primaryObjective:{id:'hyrox',name:'HYROX',role:'PRIMARY',runwayDays:50,knowledgeStatus:'QUALIFIED'},
  recovery:{readinessScore:80,status:'READY',systemicState:'Supportive',localConstraint:null,constraintSeverity:'NONE'},
  load:{rolling7d:100,rolling28d:420,ratio7dTo28dQuarter:.95,recentAdaptCount:0},
  sequencing:{},
  eventPressure:[],
  measurement:{status:'READY',hierarchyId:'hyrox',evidenceVersion:'1',evidenceFingerprint:'m1',topGaps:[{measurementId:'station.work_rate',priority:.95,tier:'PRIMARY'}]},
  materiality:{level:'UPDATE_STATE',reasonCodes:[],blocksExistingRecommendation:false},
  uncertainty:{missing:[],assumptions:[]},
  evidence:[{ref:'test',fact:'test',provenance:'test',quality:'DIRECT'}],
  athleteState:{engineVersion:'5.0.0-athlete-state.3',inputFingerprint:'state-base',activeContexts:[]}
};
const hardContext={...baseContext,athleteState:{...baseContext.athleteState,inputFingerprint:'state-hard',activeContexts:travelState.activeContexts}};
const baseEval=evaluateRecommendation(baseContext);
const hardEval=evaluateRecommendation(hardContext);
assert.equal(RECOMMENDATION_ENGINE_VERSION,'4.2.0-shadow.2');
assert.notEqual(recommendationContextFingerprint(baseContext),recommendationContextFingerprint(hardContext),'active context must enter recommendation identity');
assert.ok(hardEval.scores.ADAPT<baseEval.scores.ADAPT,'hard current context must reduce new high-cost adaptation bias');
assert.ok(hardEval.scores.MAINTAIN>baseEval.scores.MAINTAIN,'hard current context must increase lower-friction continuity bias');

console.log('PASS Stage 2 Current Athlete Context + FOREARM semantics');
console.log('  ✓ FOREARM is distinct from hand/finger/grip');
console.log('  ✓ travel/equipment/schedule/fuelling-style context can persist, resolve and expire deterministically');
console.log('  ✓ athlete-described plan affects sequencing without inventing an FZ lane');
console.log('  ✓ active hard context changes recommendation identity and scoring');
