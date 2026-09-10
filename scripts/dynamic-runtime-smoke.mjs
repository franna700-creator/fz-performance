import fs from 'node:fs';

const app = fs.readFileSync('dist/assets/app-clean.js','utf8');
const live = fs.readFileSync('dist/assets/live-physiology.js','utf8');
const training = fs.readFileSync('dist/assets/training-auto-sync.js','utf8');
const systemUi = fs.readFileSync('dist/assets/system-intelligence.js','utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json','utf8'));

const checks = [
  ['canonical app rereads all runtime domains', ['/api/runtime-state','/api/wellness/today?refresh=0','/api/training/memory?backDays=45&forwardDays=0','/api/trends/current?days=45','/api/system/status'].every(x => app.includes(x))],
  ['canonical app rereads every five minutes while visible', app.includes("setInterval(()=>{if(document.visibilityState==='visible')loadAll()},300000)")],
  ['physiology source refresh cadence is five minutes', live.includes('autoRefreshMs: 300000')],
  ['training source refresh cadence is five minutes', training.includes('pollMs: 300000')],
  ['source persistence triggers immediate canonical reread', live.includes("window.dispatchEvent(new Event('focus'))") && training.includes("window.dispatchEvent(new Event('focus'))")],
  ['system materiality updates with canonical system reads', systemUi.includes('captureSystemStatus')],
  ['dynamic API families are no-store', ['/api/wellness/today','/api/training/(.*)','/api/trends/(.*)','/api/system/(.*)'].every(path => vercel.headers.some(rule => rule.source === path && JSON.stringify(rule.headers).includes('no-store')))],
  ['automatic Git deployments disabled', vercel.git?.deploymentEnabled === false]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
console.log('PASS v0.7 dynamic runtime + deployment-separation contract');
