import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveMeasurementEvidence, PROTOCOL_MEASUREMENT_BINDINGS, MEASUREMENT_EVIDENCE_VERSION } from '../lib/measurement-evidence.js';
import { SESSION_PROTOCOL_FAMILIES } from '../lib/session-protocol-family-registry.js';
import { resolveMeasurementHierarchy, resolvePrimaryObjectiveMeasurementHierarchy } from '../lib/measurement-hierarchy.js';
import { buildIntelligenceCurrent } from '../lib/intelligence-current.js';
import { affectedSurfaces } from '../lib/runtime-dependency-graph.js';
import { recommendationContextFingerprint as contextFingerprint } from '../lib/recommendation-engine.js';

const registry=JSON.parse(fs.readFileSync('config/measurement-hierarchies.json'));
const profile={eventFamily:'HYROX',variant:'SINGLES_OPEN_MEN'};
function fixture(id='synthetic-session',date='2030-02-08') {
  return {
    sessions:[{session_id:id,status:'COMPLETED',actual_start_at:`${date}T16:00:00Z`,local_date:date}],events:[],
    sources:[
      {session_id:id,relationship:'PLAN',record_type:'planned_workout',source_record_pk:'p',payload:{contextType:'FZ_PLANNED_INTENT',protocolFamilyId:'COMPROMISED_RUNNING_REPEATABILITY',protocolVersion:'1.0',comparisonClass:'FAMILY_COMPARABLE'}},
      {session_id:id,relationship:'EXECUTION',record_type:'executed_activity',source_record_pk:'a',ingested_at:`${date}T17:00:00Z`,payload:{runLaps:[268,273,288,287,291].map((durationSeconds,index)=>({round:index+1,durationSeconds,distanceMeters:1000,averageHeartRate:155+index}))}},
      {session_id:id,relationship:'EXECUTION',record_type:'executed_activity',source_record_pk:'b',ingested_at:`${date}T18:00:00Z`,payload:{summary:{duration:3000}}},
      {session_id:id,relationship:'EVIDENCE',record_type:'athlete_feedback',source_record_pk:'c',payload:{comparisonClass:'FAMILY_COMPARABLE',benchmarkExact:false,pm5Evidence:{directlyObservedIntervals:[295,303,305,288].map((averagePowerW,index)=>({round:index+1,durationSeconds:120,averagePowerW})),derivedFifthInterval:{round:5,durationSeconds:120,averagePowerWApprox:285,certainty:'DERIVED'}}}}
    ]
  };
}
function derive(range) { return deriveMeasurementEvidence({range,asOf:'2030-03-01'}); }
function measured(result) { return resolveMeasurementHierarchy({registry,eventProfile:profile,evidence:result.evidence}).measurements.filter(x=>x.evidence.status==='MEASURED').map(x=>x.id); }
const base=fixture(),result=derive(base);
assert.ok(measured(result).includes('running.compromised_repeatability'));
assert.ok(measured(result).includes('running.fade'));
const dbDateObject=fixture('db-date-object');dbDateObject.sessions[0].local_date=new Date('2030-02-08T00:00:00.000Z');
const dbDateResult=derive(dbDateObject);assert.ok(measured(dbDateResult).includes('running.compromised_repeatability'),'PostgreSQL DATE values returned as Date objects must remain in the measurement window');assert.equal(dbDateResult.executions[0].observedOn,'2030-02-08');
assert.equal(result.executions[0].metrics.runSplitDegradation.firstToLastPct,8.582);
assert.equal(result.executions[0].benchmarkExact,false);
assert.equal(result.executions[0].metrics.preFatigueOutput.derived.certainty,'DERIVED');
assert.equal(result.executions[0].metrics.heartRateRecovery,undefined);
assert.deepEqual(measured(derive(fixture('another-athlete-session','2030-02-15'))),measured(result),'no identity/date-specific runtime rules');
assert.equal(derive({...base,sources:[...base.sources,...base.sources]}).fingerprint,result.fingerprint,'duplicates must not increase evidence');
assert.equal(derive({...base,sources:[...base.sources].reverse()}).fingerprint,result.fingerprint,'source retrieval order must not change derivation');
assert.deepEqual(measured(derive(fixture('old-session','2029-12-05'))),[],'window expiry is explicit and deterministic');
for(const status of ['PLANNED','ACCEPTED','SUPERSEDED','ABORTED','IN_PROGRESS']) {
  const x=structuredClone(base);x.sessions[0].status=status;assert.deepEqual(measured(derive(x)),[]);
}
for(const value of [null,0,-2,NaN,Infinity,'bad',false]) {
  const x=structuredClone(base);x.sources[1].payload.runLaps[1].durationSeconds=value;assert.deepEqual(measured(derive(x)),[]);
}
for(const change of ['distance','duplicate-round','missing-prefatigue','training-only','ambiguous']) {
  const x=structuredClone(base);
  if(change==='distance')x.sources[1].payload.runLaps[1].distanceMeters=800;
  if(change==='duplicate-round')x.sources[1].payload.runLaps[1].round=1;
  if(change==='missing-prefatigue')x.sources.pop();
  if(change==='training-only')x.sources[3].payload.comparisonClass='TRAINING_ONLY';
  if(change==='ambiguous')x.sources.push({...x.sources[0],payload:{...x.sources[0].payload,protocolFamilyId:'ERG_EFFICIENCY'}});
  assert.deepEqual(measured(derive(x)),[],change);
}
const generic=deriveMeasurementEvidence({range:{events:[{actor:'ATHLETE',event_type:'POST_SESSION_FEEDBACK',summary:'Felt good'}]},trends:{trainingIntent:{sessions:[{title:'HYROX mixed'}]},recovery:{wellnessHistory:[{},{}]}}});
assert.deepEqual(Object.keys(generic.evidence),[],'unlinked feedback, titles and general wellness are not station measurements');
for (const value of [false,{},[],{count:0},{status:'INVALID'},{status:'PENDING'},{observations:[]},{observations:[null]}]) {
  assert.ok(!measured({evidence:{RUN_WORK_INTERVAL_SPLITS:value}}).includes('running.compromised_repeatability'));
}
const newVersion=structuredClone(base);newVersion.sources[0].payload.protocolVersion='999';assert.deepEqual(measured(derive(newVersion)),[]);
const response=structuredClone(base);response.events=[{session_id:'synthetic-session',actor:'ATHLETE',event_key:'response',event_type:'NEXT_DAY_RESPONSE',summary:'Legs settled'}];
assert.ok(measured(derive(response)).includes('station.recovery_cost'));
assert.ok(!measured(result).includes('station.erg_efficiency'),'pre-fatigue is not a standalone standardised erg benchmark');
const fallback=resolvePrimaryObjectiveMeasurementHierarchy({objectiveContext:{primaryEvent:{id:'other-event',formatProfileId:'other',demands:[{capabilityId:'compromised_running',weight:1}]}},formatRegistry:{profiles:[{id:'other',eventFamily:'OTHER'}]},measurementRegistry:registry,objectiveRegistry:{capabilities:[{id:'compromised_running',name:'Compromised running'}]},evidence:result.evidence});
assert.equal(fallback.measurements[0].evidence.status,'MEASURED','runtime demand hierarchy consumes explicit capability transfers');
assert.equal(fallback.measurements[0].evidence.observations[0].transfer,'CAPABILITY_EVIDENCE_NOT_EVENT_EQUIVALENCE');
assert.deepEqual(Object.keys(PROTOCOL_MEASUREMENT_BINDINGS).sort(),Object.keys(SESSION_PROTOCOL_FAMILIES).sort(),'every protocol family has bindings or an explicit gap');
for(const [id,rules] of Object.entries(PROTOCOL_MEASUREMENT_BINDINGS))for(const rule of rules)for(const metric of rule.metrics)assert.ok(SESSION_PROTOCOL_FAMILIES[id].comparisonMetrics.includes(metric));
const captures={
  STEADY_AEROBIC_EFFICIENCY:{sportType:'running',paceOrPower:280,avgHeartRate:140,duration:1800,distanceOrWork:6000},
  HYBRID_TRANSITION_ECONOMY:{transitionTime:0,transitionTimeWhenMeasured:0},
  ERG_EFFICIENCY:{splitOrPower:[280,282],heartRateCost:[150,152],ergType:'SKIERG',repSplitOrPower:[280,282]},
  WALL_BALL_TOLERANCE:{completionQuality:'VALID',repRateOrSplit:30,heartRateCost:155},
  STATION_WORK_RATE:{stationSplit:120,stationIdentity:'BURPEE_BROAD_JUMP',load:1,workUnit:'80 metres',movementQuality:'VALID'},
  STRENGTH_ENDURANCE_REPEATABILITY:{repCompletion:[10,10,10],qualityDegradation:0,exercise:'squat',load:40,reps:10,sets:3,rest:120}
};
for(const [familyId,capture] of Object.entries(captures)) {
  const x=fixture();x.sources=x.sources.slice(0,2);x.sources[0].payload.protocolFamilyId=familyId;x.sources[1].payload=capture;
  const key=PROTOCOL_MEASUREMENT_BINDINGS[familyId][0].key;
  assert.ok(derive(x).evidence[key],`${familyId} declared observed capture reaches ${key}`);
  x.sources[1].payload={};assert.equal(derive(x).evidence[key],undefined,`${familyId} prescription alone cannot satisfy a measurement`);
}
const oldShadow={payload:{contextSummary:{}}};
assert.equal(buildIntelligenceCurrent({shadowRecommendation:oldShadow}).dependencyState.measurementEvidencePolicyCurrent,false);
assert.equal(buildIntelligenceCurrent({shadowRecommendation:{payload:{contextSummary:{measurementEvidenceVersion:MEASUREMENT_EVIDENCE_VERSION}}}}).dependencyState.measurementEvidencePolicyCurrent,true);
assert.notEqual(contextFingerprint({measurement:{evidenceVersion:'old',evidenceFingerprint:'a'}}),contextFingerprint({measurement:{evidenceVersion:MEASUREMENT_EVIDENCE_VERSION,evidenceFingerprint:'a'}}));
assert.notEqual(contextFingerprint({measurement:{evidenceFingerprint:'a'}}),contextFingerprint({measurement:{evidenceFingerprint:'b'}}),'new values must invalidate context even with unchanged gaps');
for(const trigger of ['source.athlete.feedback','source.tredict.activity','source.athlete.objective'])assert.ok(affectedSurfaces(trigger).includes('GOALS'));
console.log('PASS canonical measurement derivation: execution qualification, database date normalization, sparse/late evidence, numeric validity, provenance, transfer, policy invalidation and GOALS propagation');
