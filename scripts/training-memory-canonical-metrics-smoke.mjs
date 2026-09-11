import assert from 'node:assert/strict';
import { mergeEvidenceRows, deriveTrainingMetrics } from '../lib/training-evidence.js';
import { decorateTrainingRange } from '../lib/training-presentation.js';

const rows=[
  {source_key:'conversation',record_type:'executed_activity',ingested_at:'2026-09-10T19:49:00Z',payload:{sets:[{set:1,reps:12}],interpretation_notes:{athlete_confirmed_context:'Controlled session.'}}},
  {source_key:'garmin',record_type:'executed_activity',ingested_at:'2026-09-10T17:11:00Z',payload:{duration_s:1523,avg_hr:143,max_hr:177,calories:364,distance_km:4.53904}},
  {source_key:'tredict',record_type:'executed_activity',ingested_at:'2026-09-10T16:54:00Z',payload:{detailLevel:'activity-detail',summary:{durationTotal:1523,heartrate:143,heartrateMax:177,calories:364,distance:4539.04,power:378,pace:336,cadence:149,altitude:{ascent:81},intensityDistribution:{heartrate:{0:1000,1:400,2:123}}}}}
];
const merged=mergeEvidenceRows(rows);
const metrics=deriveTrainingMetrics(merged.payload);
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

const range=decorateTrainingRange({
  sessions:[{session_id:'run-1',local_date:'2026-09-10',actual_start_at:'2026-09-10T16:20:20Z',title:'AET Run',sport_type:'running',session_kind:'AET',status:'COMPLETED',reconciliation_state:'MATCHED'}],
  events:[],
  sources:rows.map((row,index)=>({...row,session_id:'run-1',source_record_pk:index+1,source_record_id:`source-${index+1}`,relationship:'EXECUTION'}))
});
assert.equal(range.sessions.length,1);
assert.equal(range.sessions[0].metrics.distanceMeters,4539.04,'sessions without Athlete Voice still expose canonical distance');
assert.equal(range.sessions[0].metrics.avgHeartRate,143,'sessions without Athlete Voice still expose average HR');
assert.equal(range.sessions[0].metrics.durationSeconds,1523,'sessions without Athlete Voice still expose total time');
assert.equal(range.sessions[0].evidence.hasMetrics,true);
assert.deepEqual(new Set(range.sessions[0].evidence.sourceKeys),new Set(['conversation','garmin','tredict']));

const missing=decorateTrainingRange({
  sessions:[{session_id:'unknown-1',local_date:'2026-09-10',title:'Unknown',sport_type:'misc',status:'COMPLETED',reconciliation_state:'UNMATCHED'}],
  events:[],
  sources:[{session_id:'unknown-1',source_key:'conversation',record_type:'executed_activity',source_record_pk:10,source_record_id:'unknown',ingested_at:'2026-09-10T20:00:00Z',payload:{sets:[{set:1}]}}]
});
assert.equal(missing.sessions[0].metrics.avgHeartRate,null,'unknown HR must remain null, never zero');
assert.equal(missing.sessions[0].metrics.distanceMeters,null,'unknown distance must remain null, never zero');
assert.equal(missing.sessions[0].evidence.hasMetrics,false);

console.log('PASS canonical Training Memory metrics: monotonic evidence -> session.metrics -> all sessions, unknown stays null');
