import assert from 'node:assert/strict';
import { mergeEvidenceRows, deriveTrainingMetrics } from '../lib/training-evidence.js';
import { deriveTrainingWorkoutDetail } from '../lib/training-workout-detail.js';
import { decorateTrainingRange } from '../lib/training-presentation.js';

const rows=[
  {source_key:'conversation',record_type:'athlete_feedback',ingested_at:'2026-09-10T19:49:00Z',payload:{summary:'Controlled session.',interpretation_notes:{athlete_confirmed_context:'Controlled session.'}}},
  {source_key:'garmin',record_type:'executed_activity',ingested_at:'2026-09-10T17:11:00Z',payload:{duration_s:1523,avg_hr:143,max_hr:177,calories:364,distance_km:4.53904}},
  {source_key:'tredict',record_type:'executed_activity',ingested_at:'2026-09-10T16:54:00Z',payload:{detailLevel:'activity-detail',summary:{durationTotal:1523,heartrate:143,heartrateMax:177,calories:364,distance:4539.04,power:378,powerMax:769,pace:336,cadence:149,cadenceMax:200,altitude:{ascent:81},groundContactTime:237,flightTime:145,stepLength:115,runningEffectiveness:.69,walkingDuration:480,effort:{heartrate:43},intensityDistribution:{heartrate:{0:1000,1:400,2:123}}}}}
];
const merged=mergeEvidenceRows(rows.filter(row=>row.record_type==='executed_activity'));
const metrics=deriveTrainingMetrics(merged.payload);
const runDetail=deriveTrainingWorkoutDetail(merged.payload);
assert.equal(metrics.durationSeconds,1523);
assert.equal(metrics.avgHeartRate,143);
assert.equal(metrics.maxHeartRate,177);
assert.equal(metrics.distanceMeters,4539.04);
assert.equal(metrics.calories,364);
assert.equal(metrics.avgPowerWatts,378);
assert.equal(metrics.paceSecPerKm,336);
assert.equal(metrics.cadence,149);
assert.equal(metrics.elevationGainMeters,81);
assert.equal(metrics.hrIntensitySeconds[0],1000);
assert.ok(metrics.lowHrShare>0&&metrics.lowHrShare<1);
assert.equal(merged.enrichedFromHistory,true,'new sparse evidence must be enriched without erasing richer valid detail');
assert.equal(runDetail.running.groundContactTimeMs,237);
assert.equal(runDetail.running.flightTimeMs,145);
assert.equal(runDetail.running.stepLengthCm,115);
assert.equal(runDetail.running.runningEffectiveness,.69);
assert.equal(runDetail.physiology.heartRateEffort,43);

const range=decorateTrainingRange({
  sessions:[{session_id:'run-1',local_date:'2026-09-10',actual_start_at:'2026-09-10T16:20:20Z',title:'AET Run',sport_type:'running',session_kind:'AET',status:'COMPLETED',reconciliation_state:'MATCHED'}],
  events:[],
  sources:rows.filter(row=>row.record_type==='executed_activity').map((row,index)=>({...row,session_id:'run-1',source_record_pk:index+1,source_record_id:`source-${index+1}`,relationship:'EXECUTION'}))
});
assert.equal(range.sessions.length,1);
assert.equal(range.sessions[0].metrics.distanceMeters,4539.04,'sessions without Athlete Voice still expose canonical distance');
assert.equal(range.sessions[0].metrics.avgHeartRate,143,'sessions without Athlete Voice still expose average HR');
assert.equal(range.sessions[0].metrics.durationSeconds,1523,'sessions without Athlete Voice still expose total time');
assert.equal(range.sessions[0].workoutDetail.running.groundContactTimeMs,237,'running dynamics must be exposed server-side');
assert.equal(range.sessions[0].workoutDetail.physiology.heartRateEffort,43,'physiology detail must be exposed server-side');
assert.equal(range.sessions[0].evidence.hasMetrics,true);
assert.equal(range.sessions[0].evidence.hasWorkoutDetail,true);
assert.deepEqual(new Set(range.sessions[0].evidence.sourceKeys),new Set(['garmin','tredict']));

const strengthPayload={
  sets:[
    {set:1,reps:15,weight_kg:27.5,duration_s:42,exercise_label:'Bench Press'},
    {set:2,reps:12,weight_kg:20,duration_s:36,exercise_label:'Shoulder Press'}
  ],
  set_count:2,
  source_artifact:'athlete-supplied Garmin Connect screenshots',
  garmin_activity_id:'24311712786',
  interpretation_notes:{
    conflicts:["Set 2 provider label remains unresolved."],
    weight_semantics:'Garmin-displayed kg values preserved verbatim; per-dumbbell vs combined load is not inferred.',
    exercise_label_semantics:'Labels are provider labels and are not automatically athlete-confirmed movement identity.'
  },
  summary:{durationTotal:2560,heartrate:103,heartrateMax:146,calories:309,effort:{heartrate:33},intensityDistribution:{heartrate:{0:2556,1:4,2:0}}}
};
const strengthDetail=deriveTrainingWorkoutDetail(strengthPayload);
assert.equal(strengthDetail.strength.setCount,2);
assert.equal(strengthDetail.strength.sets[0].exerciseLabel,'Bench Press');
assert.equal(strengthDetail.strength.sets[0].weightKg,27.5);
assert.equal(strengthDetail.strength.sets[0].durationSeconds,42);
assert.match(strengthDetail.strength.weightSemantics,/preserved verbatim/);
assert.equal(strengthDetail.strength.conflicts.length,1);

const strengthRange=decorateTrainingRange({
  sessions:[{session_id:'strength-1',local_date:'2026-09-10',actual_start_at:'2026-09-10T15:58:01Z',title:'Strength',sport_type:'strength_training',status:'COMPLETED',reconciliation_state:'MATCHED'}],
  events:[],
  sources:[{session_id:'strength-1',source_key:'conversation',record_type:'executed_activity',source_record_pk:20,source_record_id:'strength-evidence',ingested_at:'2026-09-10T19:49:00Z',payload:strengthPayload,relationship:'EVIDENCE'}]
});
assert.equal(strengthRange.sessions[0].workoutDetail.strength.sets.length,2,'strength set detail must not depend on Athlete Voice');
assert.equal(strengthRange.sessions[0].events.length,0,'workout detail remains valid when no Athlete Voice is linked');

const missing=decorateTrainingRange({
  sessions:[{session_id:'unknown-1',local_date:'2026-09-10',title:'Unknown',sport_type:'misc',status:'COMPLETED',reconciliation_state:'UNMATCHED'}],
  events:[],
  sources:[{session_id:'unknown-1',source_key:'conversation',record_type:'executed_activity',source_record_pk:10,source_record_id:'unknown',ingested_at:'2026-09-10T20:00:00Z',payload:{sets:[{set:1}]}}]
});
assert.equal(missing.sessions[0].metrics.avgHeartRate,null,'unknown HR must remain null, never zero');
assert.equal(missing.sessions[0].metrics.distanceMeters,null,'unknown distance must remain null, never zero');
assert.equal(missing.sessions[0].workoutDetail.strength.sets[0].reps,null,'unknown reps must remain null, never zero');
assert.equal(missing.sessions[0].workoutDetail.strength.sets[0].weightKg,null,'unknown load must remain null, never zero');
assert.equal(missing.sessions[0].evidence.hasMetrics,false);
assert.equal(missing.sessions[0].evidence.hasWorkoutDetail,true);

console.log('PASS canonical Training Memory: monotonic evidence -> summary metrics + modality-specific workout detail, unknown stays null');
