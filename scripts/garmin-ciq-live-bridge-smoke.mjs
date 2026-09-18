import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeGarminCiqPayload } from '../lib/garmin-ciq-client.js';

const now = Date.now();
const normalized = normalizeGarminCiqPayload({
  schemaVersion: '1.0',
  observedAt: Math.floor(now / 1000),
  device: { family: 'fenix8', transport: 'connect-iq' },
  current: { steps: 4321, heartRate: 72, stress: 24, bodyBattery: 68, respiration: 14.2 },
  series: {
    heart_rate: [[Math.floor(now / 1000) - 300, 69], [Math.floor(now / 1000), 72]],
    stress: [[Math.floor(now / 1000) - 300, 20], [Math.floor(now / 1000), 24]],
    body_battery: [[Math.floor(now / 1000) - 300, 69], [Math.floor(now / 1000), 68]],
    respiration: [[Math.floor(now / 1000), 14.2]]
  }
});

assert.equal(normalized.snapshot.sourceKey, 'garmin-ciq');
assert.equal(normalized.snapshot.heartRateCurrent, 72);
assert.equal(normalized.snapshot.stressCurrent, 24);
assert.equal(normalized.snapshot.bodyBatteryCurrent, 68);
assert.equal(normalized.snapshot.respirationCurrent, 14.2);
assert.equal(normalized.snapshot.hrvLastNight, null, 'watch intraday packets must not manufacture overnight HRV');
assert.equal(normalized.snapshot.restingHeartRate, null, 'watch intraday packets must not overwrite daily resting HR');
assert.equal(normalized.snapshot.sleepScore, null, 'watch intraday packets must not overwrite sleep');
assert.equal(normalized.snapshot.bodyBatteryHigh, null, 'watch intraday packets must not masquerade as daily Body Battery high');
assert.ok(normalized.series.length >= 7, 'timestamped intraday evidence must be retained');

const sparseCurrent = normalizeGarminCiqPayload({
  schemaVersion: '1.0',
  observedAt: Math.floor(now / 1000),
  current: { heartRate: 71, stress: 23, bodyBattery: 64, respiration: 13.6, sleepScore: 82 },
  series: {}
});
assert.equal(sparseCurrent.snapshot.sleepScore, 82, 'watch sleep score may be retained as an explicit fallback anchor');
for (const name of ['heart_rate','stress','body_battery','respiration']) {
  assert.ok(sparseCurrent.series.some(row => row.series_name === name), `current ${name} must persist as a timestamped point even when SensorHistory is empty`);
}

assert.throws(() => normalizeGarminCiqPayload({
  observedAt: Math.floor((now - 72 * 60 * 60 * 1000) / 1000),
  current: { heartRate: 70 }
}), /too_old/, 'unbounded historical replay must be rejected');

const client = fs.readFileSync('lib/garmin-ciq-client.js', 'utf8');
const store = fs.readFileSync('lib/wellness-store.js', 'utf8');
const todayApi = fs.readFileSync('api/wellness/today.js', 'utf8');
const todayUi = fs.readFileSync('src/live-physiology.js', 'utf8');
const manifest = fs.readFileSync('watch/fz-live-bridge/manifest.xml', 'utf8');
const app = fs.readFileSync('watch/fz-live-bridge/source/FzLiveBridgeApp.mc', 'utf8');
const service = fs.readFileSync('watch/fz-live-bridge/source/FzLiveBridgeService.mc', 'utf8');
const properties = fs.readFileSync('watch/fz-live-bridge/resources/properties.xml', 'utf8');

assert.match(client, /FZ_CIQ_INGEST_TOKEN/, 'watch bridge authentication secret must remain server-side configuration');
assert.match(client, /timingSafeEqual/, 'bridge token comparison must avoid ordinary string equality');
assert.match(todayApi, /req\.method === 'POST'.*garmin-ciq/s, 'existing wellness endpoint must dispatch authenticated Connect IQ writes');
assert.match(todayApi, /authorizeGarminCiqRequest/, 'Connect IQ ingestion must authenticate before canonical ingestion');
assert.match(todayApi, /ingestNormalizedWellness/, 'watch observations must use the existing canonical wellness store');
assert.match(store, /canonical-wellness-composite/, 'daily and intraday evidence must compose rather than overwrite one another');
assert.match(store, /MAX_INTRADAY_AGE_MINUTES = 60/, 'watch physiology must stop qualifying as current after the delayed window');
assert.match(store, /daily: daily \?/, 'field-level provenance for daily evidence must be retained');
assert.match(store, /intraday: intradayAvailable \?/, 'field-level provenance for intraday evidence must be retained');
assert.doesNotMatch(todayApi, /wellness\s*=\s*synced\.wellness/, 'Intervals refresh must not mask a fresher watch contribution');
assert.match(todayApi, /publicGarminCiqStatus/, 'wellness API must expose live bridge status');
assert.match(todayUi, /Recovery Physiology/, 'UI must degrade to daily recovery semantics when the live bridge is absent');
assert.match(todayUi, /LIVE_INTRADAY/, 'UI must switch to genuine live semantics when watch evidence exists');

assert.match(manifest, /<iq:product id="fenix847mm"\/>/, 'watch project must target the fēnix 8 47\/51 mm AMOLED family');
for (const permission of ['Background', 'Communications', 'SensorHistory']) {
  assert.ok(manifest.includes(`id="${permission}"`), `manifest requires ${permission} permission`);
}
assert.match(app, /registerForTemporalEvent\(new Time\.Duration\(5 \* 60\)\)/, 'watch must register the Garmin minimum five-minute temporal event');
assert.match(service, /getHeartRateHistory/, 'watch must collect intraday HR history');
assert.match(service, /getStressHistory/, 'watch must collect physiological stress history');
assert.match(service, /getBodyBatteryHistory/, 'watch must collect Body Battery history');
assert.match(service, /COMPLICATION_TYPE_BODY_BATTERY/, 'watch must fall back to the native Body Battery complication when history is unavailable');
assert.match(service, /COMPLICATION_TYPE_SLEEP_SCORE/, 'watch must read the native sleep score complication as a daily fallback');
assert.match(service, /appendCurrent\(stress/, 'watch must timestamp current stress so FZ can build a five-minute trend even when stress history is unavailable');
assert.match(service, /respirationRate/, 'watch must collect current respiration');
assert.match(service, /HTTP_REQUEST_METHOD_POST/, 'watch must POST physiology to FZ');
assert.match(service, /Authorization/, 'watch request must carry the bridge credential');
assert.match(service, /Background\.exit/, 'background service must explicitly release its execution window');
assert.ok(properties.includes('https://fz-performance-mvp.vercel.app/api/wellness/today?source=garmin-ciq'), 'production FZ endpoint must be the default watch destination');
assert.ok(!fs.existsSync('api/source/garmin-ciq/ingest.js'), 'Connect IQ must not consume an additional serverless function');
assert.ok(fs.existsSync('watch/fz-live-bridge/resources/images/launcher_icon.png'), 'watch launcher icon must be packaged');

console.log('PASS Garmin Connect IQ live physiology bridge contract');
