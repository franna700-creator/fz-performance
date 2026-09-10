import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const app=fs.readFileSync('dist/assets/app-clean.js','utf8');
const css=fs.readFileSync('dist/assets/clean.css','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const trendsStore=fs.readFileSync('lib/trends-store.js','utf8');
const systemStatus=fs.readFileSync('api/system/status.js','utf8');
const objectiveSeed=JSON.parse(fs.readFileSync('config/objective-seed.json','utf8'));
const staticFiles=['dist/index.html',...fs.readdirSync('dist/assets').filter(name=>/\.(?:js|css)$/.test(name)).map(name=>`dist/assets/${name}`)];
const staticText=staticFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const seededAthleteEventTokens=[...new Set((objectiveSeed.events||[]).flatMap(event=>[event.id,event.name,event.date]).filter(value=>typeof value==='string'&&value.trim().length>=6))];
const seededAthleteTruthLeaks=seededAthleteEventTokens.filter(token=>staticText.includes(token));
const checks=[
 ['neutral static TODAY',html.includes('Loading current athlete state')&&!html.includes('STRONG SYSTEMIC REBOUND')],
 ['neutral static TRENDS',html.includes('Loading canonical longitudinal data')&&!html.includes('current day explicit zero')],
 ['clean app only',html.includes('/assets/app-clean.js')&&!html.includes('<script src="/assets/app.js" type="module"></script>')],
 ['legacy app asset physically absent',!fs.existsSync('dist/assets/app.js')],
 ['objective-neutral static shell',html.includes('Adaptive Performance System')&&!html.includes('HYROX System')],
 ['no seeded athlete event truth in static dist',seededAthleteTruthLeaks.length===0],
 ['clean css',html.includes('/assets/clean.css')&&css.includes('FZ Performance consolidation layer')],
 ['four product pages',['today','trends','train','system'].every(id=>html.includes(`id="${id}"`))],
 ['two-slot cadence only',html.includes('06:00 / 20:00 SAST')&&!html.includes('06:00 / 13:00 / 20:00')&&app.includes('const slots=[6,20]')],
 ['runtime-owned data',app.includes("getJson('/api/runtime-state')")&&app.includes("getJson('/api/trends/current?days=45')")&&app.includes("getJson('/api/training/memory?backDays=45&forwardDays=0')")],
 ['recommendation semantics',app.includes('CURRENT FZ RECOMMENDATION')&&!app.includes('Final FZ Performance Call')],
 ['TODAY interpretation is not duplicated',!app.includes('Why this matters now')],
 ['athlete memory categories',['STATE','SESSION','COST','RECOVERY','FUELING','CONSTRAINT','HYPOTHESIS'].every(x=>app.includes(x))],
 ['missing load not zero',app.includes('missing detail is never plotted as zero')&&trendsStore.includes("state: 'PENDING_DETAIL'")],
 ['historical NCL is runtime-owned',trendsStore.includes("contextType'='HISTORICAL_DAILY_NCL")&&trendsStore.includes('historicalNclMap')],
 ['historical NCL newest-per-day',trendsStore.includes('SELECT DISTINCT ON (local_date)')&&trendsStore.includes('ORDER BY local_date,ingested_at DESC')],
 ['historical daily NCL outranks incomplete activity inventory',trendsStore.includes('if (historicalLoad.has(date))')&&trendsStore.includes("state: 'HISTORICAL_RECONCILED'")],
 ['rolling NCL keeps two-decimal precision',trendsStore.includes('round(tail.reduce((sum, point) => sum + Number(point.value || 0), 0), 2)')],
 ['dynamic AET and run maps',app.includes('cleanAetChart')&&app.includes('cleanRunScatter')],
 ['canonical AET expectation',trendsStore.includes("'2026-07-27','2026-08-04','2026-08-17','2026-08-25','2026-08-31'")&&trendsStore.includes('expectedMatchedAetMissing')],
 ['athlete voice can identify AET',trendsStore.includes("/\\b(run\\s+)?aet\\b/.test(text)")],
 ['canonical system architecture',app.includes('Operational truth')&&app.includes('NEON')&&app.includes('flight recorder')],
 ['Fitness AI source key is truthful',/source_key\s*===\s*['"]fitness-ai['"]/.test(systemStatus)],
 ['safe area preserved',css.includes('safe-area-inset-top')&&css.includes('safe-area-inset-bottom')],
 ['legacy injector tower removed from active build',!pkg.scripts.build.includes('longitudinal-trends-v4')&&!pkg.scripts.build.includes('tranche3-option-b-ui')&&!pkg.scripts.build.includes('tranche2-live-wellness')],
 ['canonical APIs',fs.existsSync('api/trends/current.js')&&fs.existsSync('api/system/status.js')&&fs.existsSync('lib/trends-store.js')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok){bad++;if(name==='no seeded athlete event truth in static dist')console.error('Static athlete-truth leaks:',seededAthleteTruthLeaks.join(', '));}}if(bad)process.exit(1);
console.log('PASS consolidated FZ build');
