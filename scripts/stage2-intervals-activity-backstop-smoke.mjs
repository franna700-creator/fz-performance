import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeIntervalsActivityRecord } from '../lib/intervals-icu-client.js';
import { deriveNcl, deriveTrainingMetrics } from '../lib/training-evidence.js';
import { affectedNodes } from '../lib/runtime-dependency-graph.js';

const sample={
  id:'i12345',
  name:'Morning Run',
  type:'Run',
  source:'GARMIN_CONNECT',
  start_date:'2026-10-02T03:05:00Z',
  start_date_local:'2026-10-02T05:05:00',
  moving_time:3600,
  elapsed_time:3660,
  distance:10000,
  average_heartrate:145,
  max_heartrate:168,
  average_watts:302,
  average_cadence:176,
  calories:760,
  total_elevation_gain:92,
  icu_hr_zone_times:[480,1380,1020,540,180],
  icu_training_load:72,
  icu_intensity:0.83,
  updated:'2026-10-02T05:15:00Z'
};

const activity=normalizeIntervalsActivityRecord(sample);
assert.equal(activity.id,'i12345');
assert.equal(activity.startAt,'2026-10-02T03:05:00.000Z');
assert.equal(activity.localDate,'2026-10-02');
assert.equal(activity.title,'Morning Run');
assert.equal(activity.sportType,'Run');
assert.equal(activity.durationSeconds,3600);
assert.equal(activity.source,'GARMIN_CONNECT');
assert.equal(activity.sourceUpdatedAt,'2026-10-02T05:15:00.000Z');
assert.equal(activity.payload.distance_m,10000);
assert.equal(activity.payload.avg_hr,145);
assert.equal(activity.payload.max_hr,168);
assert.deepEqual(activity.payload.intervalsIcuHrZoneTimes,[480,1380,1020,540,180]);

const metrics=deriveTrainingMetrics(activity.payload);
assert.equal(metrics.durationSeconds,3600);
assert.equal(metrics.distanceMeters,10000);
assert.equal(metrics.avgHeartRate,145);
assert.equal(metrics.maxHeartRate,168);
assert.equal(metrics.avgPowerWatts,302);
assert.equal(metrics.cadence,176);
assert.equal(deriveNcl(activity.payload),null,
  'Intervals HR-zone arrays must not be silently collapsed into the existing three-bucket Tredict NCL model');

const nearMidnight=normalizeIntervalsActivityRecord({
  id:'i-midnight',
  type:'Run',
  start_date:'2026-10-01T22:30:00Z',
  distance:5000,
  moving_time:1800
});
assert.equal(nearMidnight.localDate,'2026-10-02','UTC activity time must resolve to the Johannesburg athlete date');

assert.throws(()=>normalizeIntervalsActivityRecord({type:'Run',start_date:'2026-10-02T03:00:00Z'}),/invalid_intervals_icu_activity_identity/);
assert.throws(()=>normalizeIntervalsActivityRecord({id:'x'}),/invalid_intervals_icu_activity_identity/);

const trainingSync=fs.readFileSync('lib/training-sync.js','utf8');
assert.match(trainingSync,/fetchIntervalsActivityRange/);
assert.match(trainingSync,/sourceKey: 'intervals-icu'/);
assert.match(trainingSync,/activityTransport: intervalsHealthy \? 'INTERVALS_ICU' : 'FITNESS_AI_FALLBACK'/);
assert.match(trainingSync,/if \(!intervalsHealthy\)/,'Fitness AI may only be used as fallback when Intervals activity sync is unavailable');
assert.match(trainingSync,/upstreamSource: activity\.source \|\| null/,'upstream activity source provenance must remain explicit');
assert.match(trainingSync,/actor: 'SYSTEM'/,'Intervals transport must not be mislabeled as Garmin actor evidence');

const runtimeSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
assert.match(runtimeSync,/source\.intervals\.activity/);
assert.match(runtimeSync,/source\?\.intervalsIcu\?\.activities/);

const closure=affectedNodes('source.intervals.activity');
for(const node of ['training.session','training.evidence','process.reconcilePlannedIntent','materiality.current','adaptive.context','recommendation.shadow','recommendation.current','ui.train','ui.trends']){
  assert.ok(closure.includes(node),`Intervals activity source must reach ${node}`);
}

console.log('PASS Stage 2 Intervals.icu activity backstop v1');
console.log('  ✓ activity summary maps into canonical training evidence');
console.log('  ✓ original upstream source remains provenance');
console.log('  ✓ HR zone detail is retained without inventing a Tredict-compatible NCL mapping');
console.log('  ✓ Fitness AI is fallback only');
console.log('  ✓ Intervals activity mutations reach the full training/intelligence dependency closure');
