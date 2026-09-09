import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const app=fs.readFileSync('dist/assets/app-clean.js','utf8');
const css=fs.readFileSync('dist/assets/clean.css','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const trendsStore=fs.readFileSync('lib/trends-store.js','utf8');
const checks=[
 ['neutral static TODAY',html.includes('Loading current athlete state')&&!html.includes('STRONG SYSTEMIC REBOUND')],
 ['neutral static TRENDS',html.includes('Loading canonical longitudinal data')&&!html.includes('current day explicit zero')],
 ['clean app only',html.includes('/assets/app-clean.js')&&!html.includes('<script src="/assets/app.js" type="module"></script>')],
 ['clean css',html.includes('/assets/clean.css')&&css.includes('FZ Performance consolidation layer')],
 ['four product pages',['today','trends','train','system'].every(id=>html.includes(`id="${id}"`))],
 ['two-slot cadence only',html.includes('06:00 / 20:00 SAST')&&!html.includes('06:00 / 13:00 / 20:00')&&app.includes('const slots=[6,20]')],
 ['runtime-owned data',app.includes("getJson('/api/runtime-state')")&&app.includes("getJson('/api/trends/current?days=45')")&&app.includes("getJson('/api/training/memory?backDays=45&forwardDays=0')")],
 ['recommendation semantics',app.includes('CURRENT FZ RECOMMENDATION')&&!app.includes('Final FZ Performance Call')],
 ['athlete memory categories',['STATE','SESSION','COST','RECOVERY','FUELING','CONSTRAINT','HYPOTHESIS'].every(x=>app.includes(x))],
 ['missing load not zero',app.includes('missing detail is never plotted as zero')&&trendsStore.includes("state: 'PENDING_DETAIL'"))],
 ['dynamic AET and run maps',app.includes('cleanAetChart')&&app.includes('cleanRunScatter')],
 ['canonical AET expectation',trendsStore.includes("'2026-07-27','2026-08-04','2026-08-17','2026-08-25','2026-08-31'")&&trendsStore.includes('expectedMatchedAetMissing')],
 ['athlete voice can identify AET',trendsStore.includes("/\\b(run\\s+)?aet\\b/.test(text)")],
 ['canonical system architecture',app.includes('Operational truth')&&app.includes('NEON')&&app.includes('flight recorder')],
 ['safe area preserved',css.includes('safe-area-inset-top')&&css.includes('safe-area-inset-bottom')],
 ['legacy injector tower removed from active build',!pkg.scripts.build.includes('longitudinal-trends-v4')&&!pkg.scripts.build.includes('tranche3-option-b-ui')&&!pkg.scripts.build.includes('tranche2-live-wellness')],
 ['canonical APIs',fs.existsSync('api/trends/current.js')&&fs.existsSync('api/system/status.js')&&fs.existsSync('lib/trends-store.js')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
console.log('PASS consolidated FZ build');
