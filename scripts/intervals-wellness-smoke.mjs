import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeIntervalsWellnessRecord } from '../lib/intervals-icu-client.js';

const normalized = normalizeIntervalsWellnessRecord({
  id: '2026-09-18',
  updated: '2026-09-18T04:00:00.000Z',
  restingHR: 56,
  hrv: 79,
  sleepSecs: 23520,
  sleepScore: 78,
  steps: 385,
  customFields: { BodyBatteryMax: 89, BodyBatteryMin: 25 },
  stress: 4
});

assert.equal(normalized.snapshot.sourceKey, 'intervals-icu');
assert.equal(normalized.snapshot.localDate, '2026-09-18');
assert.equal(normalized.snapshot.restingHeartRate, 56);
assert.equal(normalized.snapshot.hrvLastNight, 79);
assert.equal(normalized.snapshot.sleepScore, 78);
assert.equal(normalized.snapshot.sleepHours, 23520 / 3600);
assert.equal(normalized.snapshot.steps, 385);
assert.equal(normalized.snapshot.bodyBatteryHigh, 89);
assert.equal(normalized.snapshot.bodyBatteryLow, 25);
assert.equal(normalized.snapshot.stressAvg, null, 'Intervals subjective stress must not be relabelled as Garmin physiological stress');
assert.equal(normalized.snapshot.stressCurrent, null, 'Intervals daily wellness does not provide Garmin intraday stress');

const client = fs.readFileSync('lib/intervals-icu-client.js', 'utf8');
const sync = fs.readFileSync('lib/wellness-sync.js', 'utf8');
const store = fs.readFileSync('lib/wellness-store.js', 'utf8');
const system = fs.readFileSync('api/system/status.js', 'utf8');
const today = fs.readFileSync('src/today-redesign-v2.js', 'utf8');

assert.match(client, /INTERVALS_ICU_API_KEY/, 'API key must remain server-side environment configuration');
assert.match(client, /INTERVALS_ICU_ATHLETE_ID/, 'athlete id must remain environment configuration');
assert.match(client, /API_KEY:\$\{apiKey\(\)\}/, 'personal API key authentication must use Intervals.icu Basic Auth username API_KEY');
assert.match(client, /BodyBatteryMax/, 'optional Garmin Body Battery max custom wellness field must be supported');
assert.match(client, /BodyBatteryMin/, 'optional Garmin Body Battery min custom wellness field must be supported');
assert.match(sync, /BASELINE_LOOKBACK_DAYS = 14/, 'wellness sync must backfill enough history to seed recovery baselines');
assert.match(sync, /sourceOrigin: 'GARMIN'/, 'canonical propagation must retain Garmin as source origin');
assert.match(sync, /transport: 'INTERVALS_ICU'/, 'canonical propagation must identify Intervals.icu as transport');
assert.match(sync, /source\.garmin\.wellness/, 'existing Tranche 5 dependency node must remain the wellness origin node');
assert.match(store, /SOURCE_PRIORITY = \[INTERVALS_ICU_SOURCE_KEY, FITNESS_AI_SOURCE_KEY\]/, 'Intervals.icu must become preferred canonical wellness source without deleting legacy history');
assert.match(system, /Garmin via Intervals\.icu/, 'SYSTEM provenance must expose the actual wellness bridge');
assert.match(today, /Garmin via Intervals\.icu/, 'TODAY must expose the actual wellness bridge');
assert.doesNotMatch(sync, /callFitnessAiTool/, 'runtime wellness sync must no longer depend on unsupported Fitness AI custom-client OAuth');

console.log('PASS Intervals.icu canonical wellness adapter');
