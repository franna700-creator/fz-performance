import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
const out=path.resolve('artifacts/ui-tranche2-v1');
fs.mkdirSync(out,{recursive:true});
const send=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
function staticFile(res,pathname){const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');const file=path.join(dist,rel);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.svg'?'image/svg+xml':'text/html';res.writeHead(200,{'content-type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}

const readiness={score:82,status:'CURRENT · MAINTAIN',recommendationLane:'MAINTAIN',systemicRecovery:'Recovery is supportive for controlled useful work.',localTissueState:'No material local limitation is captured.',primaryDecision:'Use the available readiness for controlled aerobic quality.',successCriteria:'Finish controlled with stable mechanics and reserve for the next valuable session.'};
const runtime={ok:true,stateId:'preview-phase2',masterAsOf:'2026-09-15T06:00:00+02:00',renderContract:{readiness}};
const wellness={ok:true,wellness:{date:'2026-09-15',freshness:'LIVE',sourceAsOf:'2026-09-15T07:40:00.000Z',ingestedAt:'2026-09-15T07:41:00.000Z',current:{steps:6234,distanceKm:4.8,heartRate:64,restingHeartRate:53,stressAvg:22,stress:16,bodyBattery:68,bodyBatteryHigh:92,bodyBatteryLow:46,hrv:72,sleepScore:86,sleepHours:7.42,activeCalories:442,activeMinutes:54,respiration:13.2},series:{body_battery:[],stress:[],heart_rate:[],respiration:[]}}};
const athleteEvent=(id,occurred,summary,categories)=>({event_id:id,event_key:id,actor:'ATHLETE',certainty:'REPORTED',event_type:'ATHLETE_FEEDBACK',occurred_at:occurred,summary,payload:{memoryCategories:categories}});
const sessions=[
  {session_id:'preview:aet',local_date:'2026-09-14',actual_start_at:'2026-09-14T16:30:00.000Z',title:'Run AET',sport_type:'Running',status:'COMPLETED',session_kind:'AET',metrics:{durationSeconds:2480,distanceMeters:8040,avgHeartRate:146,maxHeartRate:168,avgPowerWatts:371,paceSecPerKm:249,cadence:174},events:[athleteEvent('voice:aet','2026-09-14T17:20:00.000Z','The session felt controlled and mechanically good.',['SESSION','STATE'])],sources:[{source_key:'garmin'},{source_key:'tredict'}],evidence:{sourceKeys:['garmin','tredict'],newestAt:'2026-09-14T17:30:00.000Z'},reconciliation_state:'CANONICAL'},
  {session_id:'preview:strength',local_date:'2026-09-12',actual_start_at:'2026-09-12T15:00:00.000Z',title:'Hybrid Strength',sport_type:'Strength',status:'COMPLETED',session_kind:'STRENGTH',metrics:{durationSeconds:3300,avgHeartRate:121,calories:508},events:[athleteEvent('voice:strength','2026-09-12T16:05:00.000Z','Good session with manageable local fatigue afterwards.',['SESSION','COST'])],sources:[{source_key:'garmin'}],evidence:{sourceKeys:['garmin'],newestAt:'2026-09-12T16:10:00.000Z'},reconciliation_state:'CANONICAL'},
  {session_id:'preview:changed',local_date:'2026-09-10',actual_start_at:'2026-09-10T16:10:00.000Z',title:'Aerobic Run',sport_type:'Running',status:'STOPPED_EARLY',session_kind:'AEROBIC',metrics:{durationSeconds:1280,distanceMeters:3900,avgHeartRate:142},events:[athleteEvent('voice:changed','2026-09-10T16:35:00.000Z','Stopped early when the session stopped being useful.',['SESSION','COST'])],sources:[{source_key:'garmin'}],evidence:{sourceKeys:['garmin'],newestAt:'2026-09-10T16:40:00.000Z'},reconciliation_state:'CANONICAL'}
];
const training={ok:true,sessions,contextEvents:[athleteEvent('voice:standalone','2026-09-15T08:05:00.000Z','Energy is good this morning and legs feel fresh.',['STATE'])],integrity:{sessionsWithCanonicalMetrics:3}};
const days=['09 Sep','10 Sep','11 Sep','12 Sep','13 Sep','14 Sep'];
const trends={ok:true,summaries:{recovery:'Recovery has stabilised after the latest training exposures.',performance:'Matched running evidence is moving in a favourable direction.',exposure:'Recent load is useful, but local cost still matters for sequencing.',trajectory:'The strongest current evidence is aerobic durability and running economy.'},recovery:{wellnessHistory:days.map((dateLabel,i)=>({dateLabel,hrv:[58,61,65,63,69,72][i],sleepScore:[74,77,80,78,84,86][i],status:'observed'}))},load:{formula:'Normalised Cardio Load',series:days.map((dateLabel,i)=>({dateLabel,value:[46,71,55,63,88,74][i],state:'observed'})),rolling7d:{value:397.2},rolling28d:{value:1534.8}},performance:{latestMatchedAet:{date:'2026-09-14',powerHr:2.541,avgPower:371,avgHeartRate:146,paceSecPerKm:249},matchedAet:[{date:'2026-08-31',powerHr:2.49,comparison:'MATCHED'},{date:'2026-09-14',powerHr:2.541,comparison:'MATCHED'}],runningRelationship:[{date:'2026-08-31',avgPower:365,paceSecPerKm:253,comparisonClass:'MATCHED'},{date:'2026-09-07',avgPower:338,paceSecPerKm:276,comparisonClass:'CONTEXTUAL'},{date:'2026-09-14',avgPower:371,paceSecPerKm:249,comparisonClass:'MATCHED'}],excludedAet:[]},capabilities:[{name:'Aerobic durability',priority:'HIGH',status:'STRONG',evidence:'High',summary:'Repeated running evidence supports useful durability.',next:'Confirm under compromised running.'},{name:'Compromised running',priority:'HIGH',status:'MEASUREMENT GAP',evidence:'Limited',summary:'Direct race-specific evidence remains incomplete.',next:'Validated mixed run/work exposure.'},{name:'Station repeatability',priority:'MEDIUM',status:'UNRESOLVED',evidence:'Emerging',summary:'Some station evidence exists but repeatability is not mature.',next:'Matched station retest.'}],quality:{loadMissingDates:['2026-09-08']},provenance:{operationalTruth:'Neon canonical runtime',historicalWellnessSeed:'canonical history',auditRepresentation:'source evidence / audit representation'}};
const option={optionId:'preview-maintain-1',title:'Controlled aerobic quality',objective:'Preserve aerobic quality without creating unnecessary recovery cost.',dose:'45–60 min controlled aerobic work',whyNow:'Recovery is supportive and the current objective benefits from repeatable aerobic quality.',expectedCost:'LOW_MODERATE',confidence:'HIGH',evidenceBasis:['current readiness','recent running response'],targetedGaps:['aerobic durability'],successCondition:'Stable mechanics and controlled effort throughout.',stopCondition:'Modify if new pain, GI or recovery evidence changes tolerance.',prescription:{selectionReady:true,comparisonClass:'TRAINING_ONLY',protocolFamilyId:'AEROBIC_QUALITY',protocolVersion:'1',measurementPriority:'MODERATE',preSessionGate:['No new material symptoms.'],equipment:['Running shoes','HR strap if available'],warmup:['10 min progressive easy running'],mainSet:[{label:'Main set',instructions:'30–40 min controlled aerobic running',target:'conversational to steady'}],decisionRules:['Keep mechanics smooth; do not chase pace.'],successCriteria:['Finish with reserve.'],coolDown:['5–10 min easy'],postSessionReport:['Report perceived cost and any local limitation.']}};
const activeRecommendation={status:'READY',localDate:'2026-09-15',fzRecommendedLane:'MAINTAIN',confidence:'HIGH',recommendationVersion:'preview-p2',shadowRecommendationId:'preview-shadow-p2',sessionOptionComposerVersion:'4.4.0-composer.1',sessionPrescriptionComposerVersion:'4.6.0-prescription.1',explanation:{athleteFacing:{headline:'Controlled quality is appropriate today.',whyNow:'Recovery and recent execution support useful work without forcing maximal load.',objectiveConnection:'Maintain aerobic quality while protecting the next valuable training opportunity.'},recommendation:{whyThisLane:'Current evidence supports useful controlled work.'}},lanes:{ABSORB:[],MAINTAIN:[option],ADAPT:[]}};
const intelligence={ok:true,revision:'preview-phase2',pendingPropagation:false,pending:{materiality:false,readiness:false,shadowRecommendation:false,activeRecommendation:false},currentReadiness:{status:'READY',score:82,confidence:'HIGH'},activeRecommendation,athleteDecision:null,markers:{sessionOptionComposerVersion:'4.4.0-composer.1'}};
const system={ok:true,runtime:{masterValidated:true,stateId:runtime.stateId,masterAsOf:runtime.masterAsOf},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:wellness.wellness.sourceAsOf}},tredict:{configured:true,latestEvidence:[]},trainingEvidence:[],athleteMemory:{events:4,latest_event:'2026-09-15T08:05:00.000Z'},intelligence:{current:intelligence}};

const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/api/runtime-state')return send(res,runtime);if(url.pathname==='/api/wellness/today')return send(res,wellness);if(url.pathname==='/api/training/memory'||url.pathname==='/api/training/today')return send(res,training);if(url.pathname==='/api/trends/current')return send(res,trends);if(url.pathname==='/api/system/status')return send(res,system);if(url.pathname==='/api/intelligence/current')return send(res,intelligence);if(url.pathname==='/api/intelligence/refresh')return send(res,{...intelligence,afterRevision:intelligence.revision});if(url.pathname==='/api/training/athlete-event'&&url.searchParams.get('operation')==='athlete-auth-status')return send(res,{ok:true,auth:{configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null}});return staticFile(res,url.pathname);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const{port}=server.address();
const browser=await chromium.launch({headless:true});

async function enterViewer(page){const viewer=page.getByRole('button',{name:/Continue in Viewer Mode/i});if(await viewer.count()){try{await viewer.click({timeout:2000});await page.waitForTimeout(200);}catch{}}}
async function openPage(page,name){const button=page.locator(`[data-page="${name}"]:visible`).first();await button.click();await page.waitForTimeout(250);}
async function assertNoOverflow(page,label){const m=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));if(m.width>m.client+1)throw new Error(`${label} horizontal overflow ${m.width}>${m.client}`);}
async function capture(viewport,isMobile){
  const suffix=isMobile?'mobile':'desktop';
  const page=await browser.newPage({viewport,isMobile,hasTouch:isMobile,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('.fz2-top-shell',{timeout:6000});
  await enterViewer(page);

  await openPage(page,'trends');
  await page.waitForSelector('#trends .fz-phase2-lead-trends',{timeout:6000});
  await page.waitForSelector('#trends .fz-phase2-summary',{timeout:6000});
  await page.waitForSelector('#trends .fz-phase2-gaps',{timeout:6000});
  const trendOrder=await page.evaluate(()=>{const root=document.getElementById('trends');const lead=root.querySelector('.fz-phase2-lead');const summary=root.querySelector('.fz-phase2-summary');const gaps=root.querySelector('.fz-phase2-gaps');const recovery=root.querySelector('.fz-phase2-recovery');return[lead,summary,gaps,recovery].map(node=>node?.getBoundingClientRect().top??Infinity);});
  if(!(trendOrder[0]<=trendOrder[1]&&trendOrder[1]<=trendOrder[2]&&trendOrder[2]<=trendOrder[3]))throw new Error(`${suffix} TRENDS hierarchy is out of order`);
  if(!isMobile){const chart=page.locator('#cleanHrvChart svg');await chart.hover({position:{x:120,y:80}});await page.waitForTimeout(80);const tip=await page.locator('#cleanHrvChart .fz-chart-tooltip').textContent();if(!tip?.trim())throw new Error('desktop TRENDS chart scrub did not produce detail');}
  await assertNoOverflow(page,`${suffix} TRENDS`);
  await page.screenshot({path:path.join(out,`trends-${suffix}-v1.png`),fullPage:true});

  await openPage(page,'train');
  await page.waitForSelector('#train .fz-phase2-lead-train',{timeout:6000});
  await page.waitForSelector('#train .fz44-choice-section',{timeout:6000});
  await page.waitForSelector('#train .fz-phase2-training-memory',{timeout:6000});
  await page.waitForSelector('#train .fz-phase2-athlete-memory',{timeout:6000});
  const trainOrder=await page.evaluate(()=>{const root=document.getElementById('train');const lead=root.querySelector('.fz-phase2-lead');const choice=root.querySelector('.fz44-choice-section');const training=root.querySelector('.fz-phase2-training-memory');const athlete=root.querySelector('.fz-phase2-athlete-memory');return{tops:[lead,choice,training,athlete].map(node=>node?.getBoundingClientRect().top??Infinity),prescription:!!choice?.querySelector('.fz-execution-prescription'),cards:training?.querySelectorAll('.fz-training-card').length||0};});
  if(!(trainOrder.tops[0]<=trainOrder.tops[1]&&trainOrder.tops[1]<=trainOrder.tops[2]&&trainOrder.tops[2]<=trainOrder.tops[3]))throw new Error(`${suffix} TRAIN hierarchy is out of order`);
  if(!trainOrder.prescription)throw new Error(`${suffix} TRAIN exact prescription is not available from the current choice surface`);
  if(trainOrder.cards<2)throw new Error(`${suffix} TRAIN canonical memory did not render`);
  await assertNoOverflow(page,`${suffix} TRAIN`);
  await page.screenshot({path:path.join(out,`train-${suffix}-v1.png`),fullPage:true});

  if(errors.length)throw new Error(`${suffix} page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('CAPTURED',suffix,{trendOrder,trainOrder});
}

try{
  await capture({width:1440,height:1100},false);
  await capture({width:390,height:844},true);
  console.log('PASS TRENDS + TRAIN v1 desktop/mobile visual acceptance capture');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
