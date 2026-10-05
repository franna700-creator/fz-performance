import fs from 'node:fs';

const app=fs.readFileSync('dist/assets/app-clean.js','utf8');
const live=fs.readFileSync('dist/assets/live-physiology.js','utf8');
const training=fs.readFileSync('dist/assets/training-auto-sync.js','utf8');
const intelligence=fs.readFileSync('dist/assets/intelligence-refresh.js','utf8');
const systemUi=fs.readFileSync('dist/assets/system-intelligence.js','utf8');
const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const trendsApi=fs.readFileSync('api/trends/current.js','utf8');
const trainingApi=fs.readFileSync('api/training/memory.js','utf8');
const sourceRefresh=fs.readFileSync('.github/workflows/canonical-source-refresh.yml','utf8');
const convergence=fs.readFileSync('.github/workflows/intelligence-convergence.yml','utf8');

const checks=[
  ['canonical app rereads all runtime domains',['/api/runtime-state','/api/wellness/today?refresh=0','/api/training/memory?backDays=45&forwardDays=0','/api/trends/current?days=45','/api/system/status'].every(x=>app.includes(x))],
  ['canonical app has no five-minute database polling',!app.includes("setInterval(()=>{if(document.visibilityState==='visible')loadAll()},300000)")&&app.includes('FZ_CANONICAL_WAKE_MS=30*60*1000')],
  ['canonical app refreshes immediately after persisted source or intelligence events',app.includes("fz:source-persisted")&&app.includes("fz:intelligence-reconciled")],
  ['physiology source refresh cadence is thirty minutes',live.includes('autoRefreshMs: 1800000')&&live.includes('minWakeMs: 1800000')],
  ['training source refresh is manual or scheduled rather than browser-polled',!training.includes('setInterval')&&!training.includes("reason: 'initial'")&&training.includes('backDays=14&forwardDays=14&refresh=1')],
  ['intelligence browser polling is event-driven with a thirty-minute wake guard',!intelligence.includes('},60000)')&&intelligence.includes('FZ_INTELLIGENCE_WAKE_MS = 30 * 60 * 1000')&&intelligence.includes("fz:source-persisted")],
  ['system observes training/trends/materiality integrity from canonical reads',systemUi.includes('captureCanonicalResponse')&&systemUi.includes('Dynamic Runtime Integrity')],
  ['training refresh owns late relationship reconciliation',trainingApi.includes('training-sync-runtime')],
  ['Trends uses systemic dynamic evidence builder',trendsApi.includes('buildDynamicCurrentTrends')],
  ['dynamic API families are no-store',['/api/wellness/today','/api/training/(.*)','/api/trends/(.*)','/api/system/(.*)','/api/intelligence/(.*)'].every(path=>vercel.headers.some(rule=>rule.source===path&&JSON.stringify(rule.headers).includes('no-store')))],
  ['closed-PWA source cadence uses bounded Neon-native refresh',sourceRefresh.includes("cron: '0 4,18 * * *'")&&sourceRefresh.includes("JSON.stringify({sources})")&&sourceRefresh.includes("postRefresh(true)")&&sourceRefresh.includes("/api/intelligence/current")&&!sourceRefresh.includes("/api/system/status")],
  ['convergence backstop probes before repair and avoids SYSTEM health reads',convergence.includes("phase: 'probe'")&&convergence.includes('/api/intelligence/current')&&!convergence.includes('/api/system/status')],
  ['scheduled source refresh does not deploy or call Vercel',!sourceRefresh.includes('vercel@')&&!sourceRefresh.includes('deploy_to_vercel')],
  ['Git auto-deploy is permanently disabled; releases use one staged Production build then no-rebuild traffic promotion',vercel.git?.deploymentEnabled===false]
];

let bad=0;
for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++;}
if(bad)process.exit(1);
console.log('PASS dynamic runtime + free-tier steady-state contract');
