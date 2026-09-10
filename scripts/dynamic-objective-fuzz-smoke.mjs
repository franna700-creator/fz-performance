import assert from 'node:assert/strict';
import { buildObjectiveContext } from '../lib/event-objective-model.js';
import { resolvePrimaryObjectiveMeasurementHierarchy } from '../lib/measurement-hierarchy.js';
import { evaluateRecommendation, recommendationContextFingerprint } from '../lib/recommendation-engine.js';
import { buildEventIntelligenceContext } from '../lib/event-intelligence.js';

let seed=0x5f3759df;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/2**32;}
function ri(a,b){return Math.floor(rnd()*(b-a+1))+a;}
function id(prefix,i){return `${prefix}-${i}-${Math.floor(rnd()*1e9).toString(36)}`;}
function day(offset){const d=new Date('2026-09-10T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
const measurementRegistry={version:'1.0',hierarchies:[]};

for(let i=0;i<2000;i++){
  const caps=Array.from({length:ri(2,7)},(_,j)=>({id:id('cap',j),name:`Capability ${j}`,category:'TEST',description:'Synthetic runtime capability'}));
  const primaryId=id('primary',i),profileId=`profile-${primaryId}`;
  const demands=caps.map(c=>({capabilityId:c.id,weight:Math.max(.05,Math.round(rnd()*100)/100),transferWeight:Math.round(rnd()*100)/100,specificity:rnd()<.2?'EVENT_SPECIFIC':'SHARED'}));
  const primary={id:primaryId,name:`Arbitrary Primary ${i}`,date:day(ri(5,120)),status:'SCHEDULED',role:'PRIMARY',strategicWeight:1,knowledgeStatus:'QUALIFIED',formatProfileId:profileId,versionToken:`${primaryId}:r${ri(1,20)}`,demands};
  const secondary={id:id('secondary',i),name:`Near Secondary ${i}`,date:day(ri(1,4)),status:'SCHEDULED',role:'SECONDARY',strategicWeight:.95,knowledgeStatus:'QUALIFIED',formatProfileId:`profile-secondary-${i}`,versionToken:`secondary:r${ri(1,20)}`,demands:demands.slice(0,Math.max(1,ri(1,demands.length)))};
  const candidate={id:id('candidate',i),name:'Maybe',status:'CANDIDATE',role:'SECONDARY',strategicWeight:1,knowledgeStatus:'RESEARCH_REQUIRED',demands:[]};
  const registry={version:'1.0',capabilities:caps,events:[secondary,candidate,primary],evergreenObjectives:[]};
  const objective=buildObjectiveContext(registry,'2026-09-10');
  assert.equal(objective.primaryEvent.id,primaryId,'proximity/candidate must never displace explicit primary');
  assert.ok(!objective.upcomingEvents.some(e=>e.id===candidate.id),'candidate event must never enter current planning');
  const secondaryProfile={id:secondary.formatProfileId,eventFamily:`SECONDARY_${i}`,variant:`V_${i}`,sourceAuthority:'ATHLETE_CONFIRMED_STRUCTURE',sourceRefs:['athlete'],format:{sequence:'RUN_WORK',runSegments:ri(2,10),runSegmentMeters:ri(200,1500),totalRunMeters:ri(1500,9000),stationCount:2,transitionDensity:rnd()<.5?'HIGH':'VERY_HIGH'},stations:[{name:'C',movement:rnd()<.5?'SQUAT':'CARRY',tags:['LOWER']},{name:'D',movement:rnd()<.5?'ERG':'SLED',tags:['AEROBIC']}],dominantDemands:['MIXED']};
  const primaryProfile={id:profileId,eventFamily:`FAMILY_${i}`,variant:`VARIANT_${i}`,sourceAuthority:'ATHLETE_CONFIRMED_STRUCTURE',sourceRefs:['athlete'],format:{sequence:'RUN_WORK',runSegments:ri(2,10),runSegmentMeters:ri(200,1500),totalRunMeters:ri(2000,10000),stationCount:2,transitionDensity:rnd()<.5?'HIGH':'VERY_HIGH'},stations:[{name:'A',movement:'SQUAT',tags:['LOWER']},{name:'B',movement:'ERG',tags:['AEROBIC']}],dominantDemands:['MIXED']};
  const formats={version:'1.0',profiles:[primaryProfile,secondaryProfile],transferRules:[]};
  const intel=buildEventIntelligenceContext({objectiveRegistry:registry,formatRegistry:formats,nowDate:'2026-09-10'});
  assert.equal(intel.primaryEvent.id,primaryId);
  const secondaryKnowledge=intel.eventKnowledge.find(x=>x.eventId===secondary.id);
  assert.equal(secondaryKnowledge.knowledgeStatus,'QUALIFIED');
  assert.equal(secondaryKnowledge.overlapToPrimary.status,'READY');
  assert.ok(secondaryKnowledge.overlapToPrimary.score>=0&&secondaryKnowledge.overlapToPrimary.score<=1);
  const hierarchy=resolvePrimaryObjectiveMeasurementHierarchy({objectiveContext:intel,formatRegistry:formats,measurementRegistry,objectiveRegistry:registry,evidence:{}});
  assert.equal(hierarchy.status,'READY');
  assert.equal(hierarchy.hierarchySource,'RUNTIME_PRIMARY_EVENT_DEMAND');
  assert.equal(hierarchy.measurements.length,demands.length);
  const adaptive={primaryObjective:{id:primary.id,name:primary.name,role:'PRIMARY',runwayDays:objective.primaryEvent.runwayDays,knowledgeStatus:'QUALIFIED'},eventPressure:[{id:secondary.id,role:'SECONDARY',runwayDays:ri(1,4),knowledgeStatus:'QUALIFIED'}],recovery:{readinessScore:ri(45,95),constraintSeverity:'NONE'},load:{rolling7d:ri(50,300),rolling28d:ri(200,1000),ratio7dTo28dQuarter:.8+2*rnd(),recentAdaptCount:ri(0,3)},sequencing:{},measurement:{status:'READY',hierarchyId:hierarchy.hierarchyId,topGaps:hierarchy.gaps.slice(0,5)},materiality:null,uncertainty:{missing:[],assumptions:[]},evidence:[{ref:`objective:${primary.id}:${primary.versionToken}`,fact:'runtime primary',provenance:'runtime',quality:'DIRECT'}]};
  const result=evaluateRecommendation(adaptive);
  assert.equal(result.status,'READY');
  assert.ok(['ABSORB','MAINTAIN','ADAPT'].includes(result.lane));
  const renamed={...adaptive,primaryObjective:{...adaptive.primaryObjective,name:`Renamed ${i}`}};
  assert.deepEqual(evaluateRecommendation(renamed).scores,result.scores,'event display name must not change decision scoring');
  const revised={...adaptive,evidence:[{...adaptive.evidence[0],ref:`objective:${primary.id}:${primary.versionToken}:revision-${i}`}]};
  assert.notEqual(recommendationContextFingerprint(adaptive),recommendationContextFingerprint(revised),'event revision evidence must invalidate recommendation identity');
}
console.log('PASS 2000 deterministic randomized runtime-event/objective/measurement/recommendation cases');
