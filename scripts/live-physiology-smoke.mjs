import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const live = fs.readFileSync('dist/assets/live-physiology.js', 'utf8');
const css = fs.readFileSync('dist/assets/live-physiology.css', 'utf8');
const app = fs.readFileSync('dist/assets/app-clean.js', 'utf8');
const wellnessApi = fs.readFileSync('api/wellness/today.js', 'utf8');
const wellnessSync = fs.readFileSync('lib/wellness-sync.js', 'utf8');

const checks = [
  ['live component loads before clean app', html.includes('/assets/live-physiology.js') && html.indexOf('/assets/live-physiology.js') < html.indexOf('/assets/app-clean.js')],
  ['live component stylesheet wired', html.includes('/assets/live-physiology.css') && css.includes('.fz-live-chart-v3')],
  ['db-only app request is intercepted', app.includes("getJson('/api/wellness/today?refresh=0')") && live.includes("url.searchParams.get('refresh') === '0'") && live.includes("url.searchParams.delete('refresh')")],
  ['automatic cadence remains five minutes', app.includes('300000') && live.includes('autoRefreshMs: 300000')],
  ['manual Garmin refresh exists', live.includes("'/api/wellness/today?refresh=1'") && live.includes('Refresh Garmin')],
  ['all four intraday scrub graphs restored', ['body_battery','stress','heart_rate','respiration'].every(key => live.includes(key)) && live.includes('fz-live-scrub-line') && live.includes('ArrowLeft') && live.includes('pointerdown')],
  ['respiration excludes zero placeholders', live.includes("respiration: { label: 'Respiration'") && live.includes('value > 0')],
  ['freshness is explicit not hard-coded live per card', live.includes('freshnessClass') && live.includes('data-freshness') && css.includes('.fz-live-freshness.bad')],
  ['source and persistence timestamps visible', live.includes('Garmin ${sourceTime}') && live.includes('FZ persisted ${persistedTime}')],
  ['backend source refresh path retained', wellnessApi.includes('const dbOnly') && wellnessApi.includes('syncWellnessToday') && wellnessSync.includes('MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000')],
  ['no extra serverless route added for UI correction', !fs.existsSync('api/wellness/live-physiology.js')]
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) bad += 1;
}
if (bad) process.exit(1);
console.log('PASS Live Physiology regression correction');
