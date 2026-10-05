import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const sync=fs.readFileSync('dist/assets/training-auto-sync.js','utf8');
const css=fs.readFileSync('dist/assets/training-auto-sync.css','utf8');
const api=fs.readFileSync('api/training/memory.js','utf8');
const runtimeSync=fs.readFileSync('lib/training-sync-runtime.js','utf8');
const app=fs.readFileSync('dist/assets/app-clean.js','utf8');
const trainingSource=fs.readFileSync('lib/training-sync.js','utf8');
const tredictClient=fs.readFileSync('lib/tredict-client.js','utf8');
const systemApi=fs.readFileSync('api/system/status.js','utf8');

const checks=[
  ['training auto-sync asset wired before clean app',html.includes('/assets/training-auto-sync.js')&&html.indexOf('/assets/training-auto-sync.js')<html.indexOf('/assets/app-clean.js')],
  ['training auto-sync stylesheet wired',html.includes('/assets/training-auto-sync.css')&&css.includes('.fz-training-sync-toolbar')],
  ['persisted training still renders first',app.includes("getJson('/api/training/memory?backDays=45&forwardDays=0')")],
  ['manual source refresh uses bounded canonical endpoint',sync.includes("/api/training/memory?backDays=14&forwardDays=14&refresh=1")],
  ['browser does not poll workout sources automatically',!sync.includes('pollMs:')&&!sync.includes('setInterval')&&!sync.includes("reason: 'initial'")],
  ['focus visibility and online do not trigger source sync',!sync.includes("window.addEventListener('focus'")&&!sync.includes("document.addEventListener('visibilitychange'")&&!sync.includes("window.addEventListener('online'")],
  ['scheduled refresh responsibility is explicit in the toolbar',sync.includes('scheduled 06:00 / 20:00 SAST')],
  ['manual workout sync exists',sync.includes('Sync workouts')&&sync.includes('[data-training-sync-now]')],
  ['successful payload is validated',sync.includes("if (!payload?.ok) throw new Error")],
  ['canonical UI reread follows successful persistence without synthetic focus events',sync.includes("fz:source-persisted")&&sync.includes("source: 'training'")&&!sync.includes("new Event('focus')")],
  ['training source sync remains server-side',api.includes('syncTrainingSources')&&api.includes("String(req.query.refresh || '') === '1'")],
  ['successful source sync triggers late Athlete Memory binding',api.includes('training-sync-runtime')&&runtimeSync.includes('reconcileUnlinkedAthleteEvents')],
  ['Tredict sync persists source health',trainingSource.includes('markTredictSourceSynced')&&trainingSource.includes('markTredictSourceError')],
  ['Tredict public health is persisted and secret-safe',tredictClient.includes('publicTredictStatus')&&tredictClient.includes("WHERE source_key='tredict'")&&!tredictClient.includes('TREDICT_API_TOKEN:')],
  ['SYSTEM exposes Tredict connection health rather than configuration alone',systemApi.includes('publicTredictStatus')&&systemApi.includes('...tredictStatus')&&!systemApi.includes('tredict:{configured:tredictConfigured()')],
  ['SYSTEM UI renders actual Tredict status',app.includes('statusTone(t.status)')&&app.includes("t.lastError")&&!app.includes("t.configured?'CONNECTED':'NOT CONFIGURED'")],
  ['no direct source calls from browser',!sync.includes('tredict.com')&&!sync.includes('fitness-ai')&&!sync.includes('garmin.com')],
  ['no additional serverless route added',!fs.existsSync('api/training/auto-sync.js')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
console.log('PASS training auto-sync dynamic runtime contract');
