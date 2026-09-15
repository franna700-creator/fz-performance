import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
const out=path.resolve('artifacts/ui-tranche4-system-v1');
fs.mkdirSync(out,{recursive:true});
const send=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
function staticFile(res,pathname){const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');const file=path.join(dist,rel);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.svg'?'image/svg+xml':'text/html';res.writeHead(200,{'content-type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}

const readiness={score:81,status:'CURRENT · MAINTAIN',recommendationLane:'MAINTAIN',systemicRecovery:'Recovery supports controlled useful work.',localTissueState:'No material local limitation is captured.',primaryDecision:'Keep the work useful without adding unnecessary cost.',successCriteria:'Finish with reserve for the next valuable session.'};
const runtime={ok:true,stateId:'preview-system-v1',masterAsOf:'2026-09-15T12:00:00+02:00',renderContract:{readiness}};
const wellness={ok:true,wellness:{date:'2026-09-15',freshness:'LIVE',sourceAsOf:'2026-09-15T12:30:00.000Z',ingestedAt:'2026-09-15T12:31:00.000Z',current:{steps:6800,distanceKm:5.2,heartRate:62,restingHeartRate:54,stressAvg:23,stress:16,bodyBattery:63,bodyBatteryHigh:91,bodyBatteryLow:43,hrv:71,sleepScore:84,sleepHours:7.3,activeCalories:420,activeMinutes:51,respiration:13.1},series:{body_battery:[],stress:[],heart_rate:[],respiration:[]}}};
const training={ok:true,sessions:[],contextEvents:[],integrity:{sessionsWithCanonicalMetrics:9,unlinkedSessionFeedback:0,lateLinkedAthleteEvents:3}};
const trends={ok:true,summaries:{},recovery:{wellnessHistory:[]},load:{formula:'Normalised Cardio Load',series:[],rolling7d:{value:388},rolling28d:{value:1510}},performance:{matchedAet:[],runningRelationship:[],excludedAet:[]},capabilities:[],quality:{loadMissingDates:[],evidencePolicy:'MONOTONIC_BEST_AVAILABLE',historicallyEnrichedSessions:4},freshness:{latestTrainingEvidenceAt:'2026-09-15T11:55:00.000Z'},trainingIntent:{counts:{ABSORB:17,MAINTAIN:19,ADAPT:11}},provenance:{operationalTruth:'Neon canonical runtime'}};
const intelligence={ok:true,revision:'preview-system-v1',pendingPropagation:false,pending:{materiality:false,readiness:false,shadowRecommendation:false,activeRecommendation:false},currentReadiness:{status:'CURRENT',score:81,confidence:'HIGH'},activeRecommendation:{status:'ACTIVE',fzRecommendedLane:'MAINTAIN',shadowRecommendationId:'rec-preview-1',contextFingerprint:'ctx-preview-1'},dependencyState:{activeMatchesShadow:true}};
const system={ok:true,generatedAt:'2026-09-15T12:35:00.000Z',architecture:{operationalTruth:'Neon',recommendationTruth:'Versioned FZ runtime/intelligence state',auditRepresentation:'Google Drive',driveRole:'human-owned audit / flight recorder; not runtime engine',runtimeStoreMode:'DATABASE'},releaseEnvironment:{databaseConfigured:true,writeTokenConfigured:true,athleteBootstrapConfigured:true,previewMustPassBeforePromotion:true,secretsExposed:false},runtime:{source:'database',stateId:runtime.stateId,pointerVersion:1,masterAsOf:runtime.masterAsOf,generatedAt:runtime.masterAsOf,masterValidated:true},sources:[{source_key:'fitness-ai',status:'CONNECTED',last_sync_at:'2026-09-15T12:30:00.000Z',last_error:null},{source_key:'tredict',status:'CONNECTED',last_sync_at:'2026-09-15T11:55:00.000Z',last_error:null}],tredict:{configured:true,latestEvidence:[]},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:wellness.wellness.sourceAsOf}},trainingEvidence:[],athleteMemory:{events:31,latest_event:'2026-09-15T11:36:00.000Z'},intelligence:{current:intelligence,materiality:{engineVersion:'4.1.0',count:1,assessments:[{id:1,assessedAt:'2026-09-15T11:37:00.000Z',sourceType:'ATHLETE_CONTEXT',evidenceSummary:'Race-week context was reconciled without creating a safety override.',materiality:{level:'UPDATE_STATE',shouldUpdateState:true,shouldRecomputeRecommendation:false,blocksExistingRecommendation:false,affectedDomains:['ATHLETE_CONTEXT','EVENT_CONTEXT'],reasonCodes:['CONTEXT_UPDATED']}}]},recommendationShadow:{engineVersion:'4.2.0-shadow.1',mode:'SHADOW',count:1,evaluations:[{id:1,evaluatedAt:'2026-09-15T11:38:00.000Z',recommendationId:'rec-preview-1',status:'ACTIVE',lane:'MAINTAIN',confidence:'HIGH',trigger:{type:'ATHLETE_CONTEXT'},contextSummary:{primaryObjective:{name:'Primary Hybrid Performance Event'},topMeasurementGaps:[]},explanation:{athleteFacing:{whyNow:'Current context supports a controlled maintenance lane.'}}}]}}};

const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/api/runtime-state')return send(res,runtime);if(url.pathname==='/api/wellness/today')return send(res,wellness);if(url.pathname==='/api/training/memory'||url.pathname==='/api/training/today')return send(res,training);if(url.pathname==='/api/trends/current')return send(res,trends);if(url.pathname==='/api/system/status')return send(res,system);if(url.pathname==='/api/intelligence/current')return send(res,intelligence);if(url.pathname==='/api/intelligence/refresh')return send(res,{...intelligence,afterRevision:intelligence.revision});if(url.pathname==='/api/goals/current')return send(res,{ok:true,objective:{primary:null,relatedEvents:[]},progress:{measurement:{status:'UNAVAILABLE',measured:[],topGaps:[]},evidence:[],uncertainty:{missing:[],assumptions:[],confidence:'LOW'}},provenance:{},rules:{}});if(url.pathname==='/api/training/athlete-event'&&url.searchParams.get('operation')==='athlete-auth-status')return send(res,{ok:true,auth:{configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null}});return staticFile(res,url.pathname);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const{port}=server.address();
const browser=await chromium.launch({headless:true});

async function enterViewer(page){const viewer=page.getByRole('button',{name:/Continue in Viewer Mode/i});if(await viewer.count()){try{await viewer.click({timeout:2000});await page.waitForTimeout(200);}catch{}}}
async function assertNoOverflow(page,label){const m=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));if(m.width>m.client+1)throw new Error(`${label} horizontal overflow ${m.width}>${m.client}`);}
async function capture(viewport,isMobile){
  const suffix=isMobile?'mobile':'desktop';
  const page=await browser.newPage({viewport,isMobile,hasTouch:isMobile,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('.fz2-top-shell',{timeout:6000});
  await enterViewer(page);
  await page.locator('[data-page="system"]:visible').first().click();
  await page.waitForSelector('#system .fz-system-v1 .fz-system-hero',{timeout:6000});
  await page.waitForSelector('#system [data-recommendation-shadow]',{timeout:6000});
  const state=await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,title:document.querySelector('[data-fz2-page-title]')?.textContent,trust:document.querySelector('.fz-system-trust-line strong')?.textContent,exceptions:document.querySelectorAll('.fz-system-exception').length,clear:document.querySelectorAll('.fz-system-clear').length,sources:document.querySelectorAll('.fz-system-source').length,statusCards:document.querySelectorAll('#system .status-card').length,navButtons:document.querySelectorAll('.bottom [data-page]').length}));
  if(state.active!=='system'||state.title!=='System')throw new Error(`${suffix} SYSTEM navigation/meta failed: ${JSON.stringify(state)}`);
  if(state.trust!=='TRUSTED'||state.clear!==1||state.exceptions!==0)throw new Error(`${suffix} healthy trust state unexpected: ${JSON.stringify(state)}`);
  if(state.sources!==2||state.statusCards<8)throw new Error(`${suffix} SYSTEM content incomplete: ${JSON.stringify(state)}`);
  if(isMobile&&state.navButtons!==5)throw new Error(`mobile navigation expected 5 buttons, got ${state.navButtons}`);
  await assertNoOverflow(page,`${suffix} SYSTEM`);
  await page.screenshot({path:path.join(out,`system-${suffix}-v1.png`),fullPage:true});
  if(errors.length)throw new Error(`${suffix} page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('CAPTURED',suffix,state);
}

try{
  await capture({width:1440,height:1100},false);
  await capture({width:390,height:844},true);
  console.log('PASS SYSTEM rationalisation v1 desktop/mobile visual acceptance capture');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
