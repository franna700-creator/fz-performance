import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist = path.resolve('dist');
const requestCounts = new Map();
const wellnessRequestModes = [];
let backgroundRefreshes = 0;
let forcedRefreshes = 0;
let persistedReads = 0;
let sourceRefreshed = false;

function count(pathname){requestCounts.set(pathname,(requestCounts.get(pathname)||0)+1);}
function json(res,value){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function staticFile(res,pathname){
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(dist,rel);
  if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  const ext=path.extname(file);
  const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':'text/html';
  res.writeHead(200,{'content-type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`,'cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
}

const stale={ok:true,wellness:{date:'2026-09-13',freshness:'STALE',sourceAsOf:'2026-09-13T18:00:00.000Z',ingestedAt:'2026-09-13T18:01:00.000Z',current:{steps:12000,distanceKm:8.4,bodyBattery:5,bodyBatteryHigh:24,bodyBatteryLow:5,stress:28,stressAvg:46,heartRate:78,restingHeartRate:60,hrv:41,sleepScore:39,sleepHours:5.81,activeCalories:640,activeMinutes:72,respiration:13.8},series:{body_battery:[['2026-09-13T08:00:00.000Z',18],['2026-09-13T12:00:00.000Z',11],['2026-09-13T18:00:00.000Z',5]],stress:[['2026-09-13T08:00:00.000Z',37],['2026-09-13T12:00:00.000Z',52],['2026-09-13T18:00:00.000Z',28]],heart_rate:[['2026-09-13T08:00:00.000Z',72],['2026-09-13T12:00:00.000Z',89],['2026-09-13T18:00:00.000Z',78]],respiration:[['2026-09-13T08:00:00.000Z',12.8],['2026-09-13T12:00:00.000Z',14.2],['2026-09-13T18:00:00.000Z',13.8]]}}};
const live={ok:true,wellness:{...stale.wellness,freshness:'LIVE',sourceAsOf:'2026-09-13T18:45:00.000Z',ingestedAt:'2026-09-13T18:45:30.000Z',current:{...stale.wellness.current,heartRate:71,bodyBattery:9,stress:20},series:{...stale.wellness.series,heart_rate:[['2026-09-13T08:00:00.000Z',72],['2026-09-13T12:00:00.000Z',89],['2026-09-13T18:00:00.000Z',78],['2026-09-13T18:45:00.000Z',71]]}}};
const runtime={ok:true,stateId:'live-browser',masterAsOf:'2026-09-13T20:45:00+02:00',renderContract:{readiness:{score:70,status:'CURRENT · MAINTAIN',recommendationLane:'MAINTAIN',systemicRecovery:'Current systemic recovery is usable.',localTissueState:'No material local limitation is captured.',primaryDecision:'Use controlled useful work.',successCriteria:'Finish with reserve.'}}};
const training={ok:true,sessions:[],contextEvents:[],integrity:{}};
const trends={ok:true,summaries:{},recovery:{wellnessHistory:[]},load:{series:[]},performance:{},capabilities:[],quality:{},provenance:{}};
const currentReadiness={schemaVersion:'1.0',contextType:'READINESS_STATE',engineVersion:'5.0.0-readiness.1',localDate:'2026-09-13',status:'READY',score:70,band:'PROCEED WITH CONTROL',confidence:'HIGH',inputFingerprint:'live-browser',systemicState:'Current systemic recovery is usable.',localTissueState:'No material local limitation is captured.'};
const activeRecommendation={status:'READY',localDate:'2026-09-13',fzRecommendedLane:'MAINTAIN',confidence:'HIGH',recommendationVersion:'live-browser-rec',shadowRecommendationId:'live-browser-shadow',sessionOptionComposerVersion:'4.4.0-composer.1',explanation:{athleteFacing:{headline:'Controlled useful work is appropriate.',summary:'Use controlled useful work.',whyNow:'Current physiology is usable.',objectiveConnection:'Preserve useful capacity.'},recommendation:{successConditions:['Finish with reserve.']}},lanes:{ABSORB:[],MAINTAIN:[],ADAPT:[]}};
const intelligence={ok:true,revision:'live-browser-r1',pendingPropagation:false,pending:{materiality:false,readiness:false,shadowRecommendation:false,activeRecommendation:false},currentReadiness,activeRecommendation,athleteDecision:null};
const system={ok:true,runtime:{masterValidated:true,stateId:runtime.stateId,masterAsOf:runtime.masterAsOf},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:live.wellness.sourceAsOf}},tredict:{configured:true,latestEvidence:[]},trainingEvidence:[],athleteMemory:{events:0},intelligence:{current:intelligence}};

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');count(url.pathname);
  if(url.pathname==='/api/runtime-state')return json(res,runtime);
  if(url.pathname==='/api/training/memory'||url.pathname==='/api/training/today')return json(res,training);
  if(url.pathname==='/api/trends/current')return json(res,trends);
  if(url.pathname==='/api/system/status')return json(res,system);
  if(url.pathname==='/api/intelligence/current')return json(res,intelligence);
  if(url.pathname==='/api/intelligence/refresh')return json(res,{...intelligence,afterRevision:intelligence.revision});
  if(url.pathname==='/api/wellness/today'){
    const refresh=url.searchParams.get('refresh');
    if(refresh==='1'){
      wellnessRequestModes.push('forced');
      forcedRefreshes++;
      sourceRefreshed=true;
      return json(res,live);
    }
    if(refresh==='0'){
      wellnessRequestModes.push('persisted');
      persistedReads++;
      return json(res,sourceRefreshed?live:stale);
    }
    wellnessRequestModes.push('background');
    backgroundRefreshes++;
    sourceRefreshed=true;
    return json(res,live);
  }
  return staticFile(res,url.pathname);
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const{port}=server.address();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
function assert(condition,message){if(!condition)throw new Error(message);console.log('PASS',message);}
async function waitForNode(predicate,timeoutMs=2500){const started=Date.now();while(Date.now()-started<timeoutMs){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,25));}return false;}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  assert(await waitForNode(()=>wellnessRequestModes.includes('persisted'),1500),'persisted wellness is requested on initial render');
  await page.waitForSelector('.fz2-phys-summary',{timeout:2500});
  assert((await page.locator('.fz2-phys-summary').innerText()).includes('HRV'),'compact athlete-facing physiology summary renders');
  await page.waitForSelector('.fz-live-physiology-v3',{state:'attached',timeout:2500});
  assert(await page.locator('.fz-live-grid').evaluate(el=>el.hidden),'legacy static physiology grid is hidden by the live detail layer');
  assert(await page.locator('.fz-live-chart-v3').count()===4,'four Live Physiology scrub graphs render in the detail layer');
  assert((await page.locator('[data-live-key="respiration"] [data-live-value]').textContent()).startsWith('13.8'),'respiration zero placeholders are excluded');
  await page.locator('[data-fz2-live-details]').click();
  assert(await page.locator('[data-fz2-live-details]').getAttribute('aria-expanded')==='true','physiology detail opens explicitly');
  assert(await waitForNode(()=>backgroundRefreshes===1,2000),'one background Garmin source refresh occurs');
  const persistedIndex=wellnessRequestModes.indexOf('persisted');
  const backgroundIndex=wellnessRequestModes.indexOf('background');
  assert(persistedIndex>=0&&backgroundIndex>persistedIndex,'persisted wellness read precedes background source refresh');
  await page.waitForSelector('.fz-live-physiology-v3[data-freshness="LIVE"]',{timeout:2500});
  assert((await page.locator('.fz-live-toolbar').innerText()).includes('20:45'),'successful source refresh repaints LIVE physiology with the SAST source time');
  const chart=page.locator('.fz-live-chart-v3').nth(2);
  const svg=chart.locator('svg');
  const box=await svg.boundingBox();
  await svg.dispatchEvent('pointerdown',{pointerType:'mouse',clientX:box.x+box.width*.25,clientY:box.y+30,buttons:1,pressure:.5});
  assert((await page.locator('[data-live-key="heart_rate"] [data-live-value]').textContent()).includes('·'),'pointer scrubbing exposes timestamped value');
  await page.locator('[data-live-refresh]:visible').click();
  await page.waitForFunction(()=>document.querySelector('.fz-live-toolbar')?.textContent?.includes('20:45'));
  assert(forcedRefreshes===1,'Refresh Garmin performs explicit forced source refresh');
  assert(wellnessRequestModes.at(-1)==='forced','manual refresh uses the forced source path');
  assert(pageErrors.length===0,`no browser page errors occur (${pageErrors.join(' | ')||'none'})`);
  console.log('PASS live physiology browser acceptance');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
