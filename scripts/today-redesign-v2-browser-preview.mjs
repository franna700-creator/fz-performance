import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
const out=path.resolve('artifacts/ui-tranche1-v2');
fs.mkdirSync(out,{recursive:true});
const send=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
function staticFile(res,pathname){const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');const file=path.join(dist,rel);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.png'?'image/png':ext==='.svg'?'image/svg+xml':'text/html';res.writeHead(200,{'content-type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}
const readiness={score:84,status:'CURRENT · MAINTAIN',recommendationLane:'MAINTAIN',systemicRecovery:'Recovery is supportive. Sleep, HRV and resting heart rate are aligned for controlled useful work.',localTissueState:'No material local limitation is currently captured.',primaryDecision:'Use the available readiness for controlled aerobic quality.',successCriteria:'Finish with stable mechanics, controlled effort and enough reserve for the next valuable training opportunity.',canonicalReadinessCurrent:true,readinessEngineVersion:'5.0.0-readiness.1'};
const runtime={ok:true,stateId:'2026-09-14T20:00:00+02:00',masterAsOf:'2026-09-14T20:00:00+02:00',renderContract:{readiness}};
const wellness={ok:true,wellness:{date:'2026-09-14',mode:'LIVE_INTRADAY',capabilities:{intraday:true,heartRateCurrent:true,stressCurrent:true,bodyBatteryCurrent:true,respirationCurrent:true,overnightRecovery:true},sources:{daily:{sourceKey:'intervals-icu',sourceAsOf:'2026-09-14T05:30:00.000Z'},intraday:{sourceKey:'garmin-ciq',sourceAsOf:'2026-09-14T17:55:00.000Z'}},freshness:'LIVE',sourceAsOf:'2026-09-14T17:55:00.000Z',ingestedAt:'2026-09-14T17:56:00.000Z',current:{steps:8274,distanceKm:6.43,heartRate:67,restingHeartRate:54,stressAvg:24,stress:18,bodyBattery:56,bodyBatteryHigh:91,bodyBatteryLow:42,hrv:75,sleepScore:84,sleepHours:7.33,activeCalories:574,activeMinutes:71.4,respiration:13.1},series:{body_battery:[],stress:[],heart_rate:[],respiration:[]}}};
const training={ok:true,sessions:[{session_id:'preview:run',local_date:'2026-09-14',actual_start_at:'2026-09-14T05:30:00.000Z',title:'Controlled Aerobic Run',sport_type:'Running',status:'COMPLETED',session_kind:'AEROBIC',events:[{actor:'ATHLETE',occurred_at:'2026-09-14T06:30:00.000Z',summary:'Felt controlled throughout. Legs stayed good and there were no GI issues.'}],sources:[{source_key:'garmin'},{source_key:'tredict'}]}],contextEvents:[],integrity:{sessionsWithCanonicalMetrics:1}};
const trends={ok:true,summaries:{recovery:'Recovery supportive.',performance:'Performance stable.',exposure:'Exposure controlled.',trajectory:'Trajectory positive.'},recovery:{wellnessHistory:[]},load:{formula:'NCL',series:[],rolling7d:{value:412.4},rolling28d:{value:1648.7}},performance:{matchedAet:[],runningRelationship:[],excludedAet:[],latestMatchedAet:null},capabilities:[],quality:{loadMissingDates:[]},provenance:{operationalTruth:'Neon',historicalWellnessSeed:'canonical history',auditRepresentation:'source evidence'}};
const currentReadiness={schemaVersion:'1.0',contextType:'READINESS_STATE',engineVersion:'5.0.0-readiness.1',localDate:'2026-09-14',status:'READY',score:84,band:'PROCEED WITH CONTROL',confidence:'HIGH',inputFingerprint:'preview-ready',systemicState:readiness.systemicRecovery,localTissueState:readiness.localTissueState};
const activeRecommendation={status:'READY',localDate:'2026-09-14',fzRecommendedLane:'MAINTAIN',confidence:'HIGH',recommendationVersion:'preview-rec-2',shadowRecommendationId:'preview-shadow-2',sessionOptionComposerVersion:'4.4.0-composer.1',explanation:{athleteFacing:{headline:'Controlled quality is appropriate today.',summary:readiness.primaryDecision,whyNow:'Recovery and live physiology are supportive without requiring maximal work.',objectiveConnection:'Preserve broad hybrid capacity while keeping tomorrow available.'},recommendation:{successConditions:[readiness.successCriteria]}},lanes:{ABSORB:[],MAINTAIN:[],ADAPT:[]}};
const intelligence={ok:true,revision:'preview-v2',pendingPropagation:false,pending:{materiality:false,readiness:false,shadowRecommendation:false,activeRecommendation:false},currentReadiness,activeRecommendation,athleteDecision:null};
const system={ok:true,runtime:{masterValidated:true,stateId:runtime.stateId,masterAsOf:runtime.masterAsOf},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:wellness.wellness.sourceAsOf}},tredict:{configured:true,latestEvidence:[]},trainingEvidence:[],athleteMemory:{events:1,latest_event:'2026-09-14T06:30:00.000Z'},intelligence:{current:intelligence}};

const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/api/runtime-state')return send(res,runtime);if(url.pathname==='/api/wellness/today')return send(res,wellness);if(url.pathname==='/api/training/memory'||url.pathname==='/api/training/today')return send(res,training);if(url.pathname==='/api/trends/current')return send(res,trends);if(url.pathname==='/api/system/status')return send(res,system);if(url.pathname==='/api/intelligence/current')return send(res,intelligence);if(url.pathname==='/api/intelligence/refresh')return send(res,{...intelligence,afterRevision:intelligence.revision});if(url.pathname==='/api/training/athlete-event'&&url.searchParams.get('operation')==='athlete-auth-status')return send(res,{ok:true,auth:{configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null}});return staticFile(res,url.pathname);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const{port}=server.address();
const browser=await chromium.launch({headless:true});
async function capture(name,viewport,isMobile=false){
  const page=await browser.newPage({viewport,isMobile,hasTouch:isMobile,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('.fz2-top-shell',{timeout:6000});
  await page.waitForSelector('#today.fz-today-v2 .fz2-stage',{timeout:6000});
  await page.waitForSelector('#today .fz2-thought',{timeout:6000});
  await page.waitForSelector('#today .fz2-phys-summary',{timeout:6000});
  const viewerButton=page.getByRole('button',{name:/Continue in Viewer Mode/i});
  if(await viewerButton.count()){try{await viewerButton.click({timeout:2000});await page.waitForTimeout(250);}catch{}}
  await page.waitForTimeout(900);
  const metrics=await page.evaluate(({isMobile})=>{const legacy=document.querySelector('#today .fz-clean-hero');const overlay=document.querySelector('.fz-mode-overlay');const side=document.querySelector('.side');const thought=document.querySelector('.fz2-thought');const physiology=document.querySelector('#today .fz2-phys-summary');const bottom=document.querySelector('.bottom');return{width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,decision:document.querySelector('.fz2-decision h2')?.textContent?.trim(),thought:thought?.querySelector('blockquote')?.textContent?.trim(),photo:!!document.querySelector('.fz2-photo'),topShell:!!document.querySelector('.fz2-top-shell'),topNavButtons:document.querySelectorAll('.fz2-topnav [data-page]').length,bottomNavButtons:document.querySelectorAll('.bottom [data-page]').length,liveIcons:document.querySelectorAll('.fz2-legacy-live .fz2-live-icon').length,summaryMetrics:document.querySelectorAll('.fz2-summary-metric').length,legacyVisible:legacy?getComputedStyle(legacy).display!=='none':false,sideVisible:side?getComputedStyle(side).display!=='none':false,overlayVisible:overlay?getComputedStyle(overlay).display!=='none'&&!overlay.hidden:false,bottomVisible:bottom?getComputedStyle(bottom).display!=='none':false,thoughtBeforePhysiology:thought&&physiology?thought.getBoundingClientRect().top<physiology.getBoundingClientRect().top:false,isMobile};},{isMobile});
  if(metrics.width>metrics.client+1)throw new Error(`${name} horizontal overflow ${metrics.width}>${metrics.client}`);
  if(!metrics.decision||!metrics.thought||!metrics.photo||!metrics.topShell)throw new Error(`${name} missing v2 content`);
  if(metrics.topNavButtons!==5)throw new Error(`${name} missing five-surface topside navigation contract`);
  if(metrics.bottomNavButtons!==5)throw new Error(`${name} missing five-surface bottom navigation contract`);
  if(metrics.liveIcons<4)throw new Error(`${name} semantic physiology icons did not mount`);
  if(metrics.summaryMetrics!==6)throw new Error(`${name} compact physiology summary is incomplete`);
  if(metrics.legacyVisible)throw new Error(`${name} legacy TODAY hero is still visibly competing with v2`);
  if(metrics.sideVisible)throw new Error(`${name} legacy left rail remains visible`);
  if(metrics.overlayVisible)throw new Error(`${name} access overlay obscures visual QA`);
  if(isMobile&&!metrics.bottomVisible)throw new Error(`${name} mobile bottom navigation is not visible`);
  if(isMobile&&!metrics.thoughtBeforePhysiology)throw new Error(`${name} mobile Daily FZ Thought is not promoted ahead of physiology summary`);
  if(errors.length)throw new Error(`${name} page errors: ${errors.join(' | ')}`);
  await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
  await page.close();console.log('CAPTURED',name,metrics);
}
try{await capture('today-desktop-v2',{width:1440,height:1100},false);await capture('today-mobile-v2',{width:390,height:844},true);console.log('PASS TODAY v2 desktop/mobile five-surface visual capture');}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
