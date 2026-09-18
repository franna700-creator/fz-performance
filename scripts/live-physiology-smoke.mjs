import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const live = fs.readFileSync('dist/assets/live-physiology.js', 'utf8');
const css = fs.readFileSync('dist/assets/live-physiology.css', 'utf8');
const app = fs.readFileSync('dist/assets/app-clean.js', 'utf8');
const wellnessApi = fs.readFileSync('api/wellness/today.js', 'utf8');
const wellnessSync = fs.readFileSync('lib/wellness-sync.js', 'utf8');
const todayV2 = fs.readFileSync('src/today-redesign-v2.js', 'utf8');

const checks = [
  ['live component loads before clean app', html.includes('/assets/live-physiology.js') && html.indexOf('/assets/live-physiology.js') < html.indexOf('/assets/app-clean.js')],
  ['live component stylesheet wired', html.includes('/assets/live-physiology.css') && css.includes('.fz-live-chart-v3')],
  ['persisted wellness paints first', app.includes("getJson('/api/wellness/today?refresh=0')") && live.includes('captureWellnessResponse')],
  ['source refresh is explicit rather than DB-read side effect', !live.includes("requestUrl?.searchParams.get('refresh') === '0'") && live.includes("setTimeout(() => refreshSource({ reason: 'initial' })")],
  ['background refresh uses source endpoint', live.includes("const url = force ? '/api/wellness/today?refresh=1' : '/api/wellness/today'")],
  ['automatic source cadence is five minutes', live.includes('autoRefreshMs: 300000') && live.includes('setInterval')],
  ['focus visibility and online wake checks exist', live.includes("window.addEventListener('focus'") && live.includes("document.addEventListener('visibilitychange'") && live.includes("window.addEventListener('online'")],
  ['wake source checks are throttled', live.includes('minWakeMs: 120000')],
  ['manual wellness refresh exists', live.includes("'/api/wellness/today?refresh=1'") && live.includes('Refresh wellness')],
  ['source persistence invalidates canonical views', live.includes("new Event('focus')") && live.includes("source: 'wellness'")],
  ['intraday mode retains all four scrub graphs', ['body_battery','stress','heart_rate','respiration'].every(key => live.includes(key)) && live.includes('fz-live-scrub-line') && live.includes('ArrowLeft') && live.includes('pointerdown')],
  ['daily-only mode degrades honestly', live.includes("'Recovery Physiology'") && live.includes('watch bridge not reporting') && live.includes('does not fabricate intraday values')],
  ['respiration excludes zero placeholders', live.includes("respiration: { label: 'Respiration'") && live.includes('value > 0')],
  ['freshness is explicit', live.includes('freshnessClass') && live.includes('data-freshness') && css.includes('.fz-live-freshness.bad')],
  ['source and persistence timestamps visible', live.includes('fēnix 8 bridge') && live.includes('Garmin via Intervals.icu') && live.includes('FZ persisted ${persistedTime}')],
  ['backend source refresh path retained', wellnessApi.includes('const dbOnly') && wellnessApi.includes('syncWellnessToday') && wellnessSync.includes('MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000')],
  ['missing wellness values remain unknown rather than rendering as zero', todayV2.includes("if(value===null||value===undefined||value==='')return null") && todayV2.includes("v2Num(w.sleepScore)!==null") && todayV2.includes("v2SleepHours(value){const n=v2Num(value);if(n===null)return'—'")],
  ['no extra serverless route added for UI correction', !fs.existsSync('api/wellness/live-physiology.js')]
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) bad += 1;
}
if (bad) process.exit(1);
console.log('PASS Live Physiology dynamic runtime contract');
