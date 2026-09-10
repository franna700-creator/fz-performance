import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html','utf8');
const ui = fs.readFileSync('dist/assets/system-intelligence.js','utf8');
const systemApi = fs.readFileSync('api/system/status.js','utf8');
const materiality = fs.readFileSync('lib/materiality-engine.js','utf8');

const checks = [
  ['4.1 observability asset wired before clean app', html.includes('/assets/system-intelligence.js') && html.indexOf('/assets/system-intelligence.js') < html.indexOf('/assets/app-clean.js')],
  ['observability piggybacks on canonical SYSTEM reads', ui.includes("url.pathname === '/api/system/status'") && ui.includes('captureSystemStatus')],
  ['no new serverless route for observability', !fs.existsSync('api/system/materiality.js')],
  ['SYSTEM backend already exposes materiality', systemApi.includes('readRecentMaterialityAssessments') && systemApi.includes('engineVersion: MATERIALITY_ENGINE_VERSION')],
  ['engine remains Tranche 4.1', materiality.includes("MATERIALITY_ENGINE_VERSION = '4.1.0'")],
  ['all four materiality states remain visible', ['RECORD_ONLY','UPDATE_STATE','RECOMPUTE_RECOMMENDATION','SAFETY_OVERRIDE'].every(x => materiality.includes(x))],
  ['UI keeps 4.2 boundary explicit', ui.includes('4.2 will own actual recomputation') && ui.includes('recommendation recomputation remains a 4.2 boundary')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
console.log('PASS Tranche 4.1 observability contract');
