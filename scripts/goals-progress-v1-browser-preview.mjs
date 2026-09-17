import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
const out=path.resolve('artifacts/ui-tranche3-goals-v1');
fs.mkdirSync(out,{recursive:true});
const send=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
function staticFile(res,pathname){const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');const file=path.join(dist,rel);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':ext==='.svg'?'image/svg+xml':'text/html';res.writeHead(200,{'content-type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}

const readiness={score:81,status:'CURRENT · MAINTAIN',recommendationLane:'MAINTAIN',systemicRecovery:'Recovery supports controlled useful work.',localTissueState:'No material local limitation is captured.',primaryDecision:'Keep the work useful without adding unnecessary cost.',successCriteria:'Finish with reserve for the next valuable session.'};
const runtime={ok:true,stateId:'preview-goals-v1',masterAsOf:'2026-09-15T06:00:00+02:00',renderContract:{readiness}};
const wellness={ok:true,wellness:{date:'2026-09-15',freshness:'LIVE',sourceAsOf:'2026-09-15T08:00:00.000Z',ingestedAt:'2026-09-15T08:01:00.000Z',current:{steps:5300,distanceKm:4.1,heartRate:63,restingHeartRate:54,stressAvg:23,stress:17,bodyBattery:66,bodyBatteryHigh:91,bodyBatteryLow:45,hrv:71,sleepScore:84,sleepHours:7.3,activeCalories:390,activeMinutes:47,respiration:13.1},series:{body_battery:[],stress:[],heart_rate:[],respiration:[]}}};
const training={ok:true,sessions:[],contextEvents:[],integrity:{sessionsWithCanonicalMetrics:0}};
const trends={ok:true,summaries:{recovery:'Recovery is broadly stable.',performance:'Repeated aerobic evidence is positive.',exposure:'Recent load remains useful.',trajectory:'Aerobic development is the clearest current positive signal.'},recovery:{wellnessHistory:[]},load:{formula:'Normalised Cardio Load',series:[],rolling7d:{value:388},rolling28d:{value:1510}},performance:{matchedAet:[],runningRelationship:[],excludedAet:[]},capabilities:[
  {name:'Aerobic engine',priority:'Foundation',status:'STRONG',evidence:'HIGH',summary:'Repeated aerobic evidence supports a strong current foundation.',next:'Verify transfer under event-specific interaction.'},
  {name:'Compromised running',priority:'Priority 1',status:'EMERGING',evidence:'MODERATE',summary:'Interaction evidence exists but repeatability is not yet proven.',next:'Repeat a fixed station-to-run protocol.'},
  {name:'Station capacity',priority:'Priority 2',status:'MEASUREMENT PENDING',evidence:'LOW',summary:'A baseline exists but progression is not yet established.',next:'Matched station repeat with recovery-cost capture.'},
  {name:'Strength reserve',priority:'Support',status:'MAINTAIN',evidence:'MODERATE',summary:'Strength remains supportive rather than the primary limitation.',next:'Maintain stable race-relevant markers.'}
],quality:{},provenance:{operationalTruth:'Neon canonical runtime',historicalWellnessSeed:'canonical history',auditRepresentation:'audit representation'}};
const currentCapabilities=[
  {id:'running_economy',name:'Running economy',status:'EVIDENCE AVAILABLE',evidence:'3 canonical sessions',summary:'Qualified running evidence is available.',next:'Compare qualified executions and their recovery cost.'},
  {id:'compromised_running',name:'Compromised running',status:'EVIDENCE AVAILABLE',evidence:'1 canonical session',summary:'Qualified run-work evidence is available; improvement is not yet established.',next:'Repeat under comparable conditions.'},
  {id:'station_strength_endurance',name:'Station capacity',status:'UNMEASURED',evidence:'Not yet measured',summary:'No qualified station evidence in the current window.',next:'Capture a qualified execution.'},
  {id:'local_tissue_tolerance',name:'Local tissue tolerance',status:'UNAVAILABLE',evidence:'Unavailable',summary:'Current recovery evidence could not be read.',next:'Refresh canonical evidence.'}
];
const goals={ok:true,generatedAt:'2026-09-15T08:05:00.000Z',contract:'CANONICAL_GOALS_PROGRESS_V1',objective:{primary:{id:'primary-hybrid-event',name:'Primary Hybrid Performance Event',role:'PRIMARY',runwayDays:74,startsOn:'2026-11-28',participationStatus:'CONFIRMED',knowledgeStatus:'QUALIFIED'},relatedEvents:[{id:'validation-event',name:'Validation Event',role:'VALIDATION',runwayDays:5,startsOn:'2026-09-20',knowledgeStatus:'QUALIFIED',overlapToPrimary:.79},{id:'secondary-run',name:'Secondary Running Event',role:'SECONDARY',runwayDays:9,startsOn:'2026-09-24',knowledgeStatus:'QUALIFIED',overlapToPrimary:.44}]},progress:{capabilities:currentCapabilities,measurement:{status:'READY',hierarchyId:'hybrid-primary-v1',measured:[{measurementId:'running.aerobic_efficiency',priority:2,evidence:{status:'MEASURED'}},{measurementId:'strength.reserve',priority:4,evidence:{status:'MEASURED'}}],topGaps:[{measurementId:'running.compromised_repeatability',priority:1,evidence:{status:'UNMEASURED'}},{measurementId:'station.work_rate',priority:2,evidence:{status:'UNMEASURED'}},{measurementId:'running.fade',priority:3,evidence:{status:'UNMEASURED'}}]},evidence:[],uncertainty:{missing:['fixed compromised-running benchmark'],assumptions:[],confidence:'MODERATE'}},provenance:{objectiveSource:'NEON_OBJECTIVE_GRAPH',runtimeStateId:'preview-goals-v1'},rules:{noFabricatedProgressPercentages:true,unknownMeasurementIsNotWeakness:true,directionalOverlapIsNotTrainingValue:true,primaryObjectiveCannotBeDisplacedByProximity:true}};
const intelligence={ok:true,revision:'preview-goals-v1',pendingPropagation:false,pending:{materiality:false,readiness:false,shadowRecommendation:false,activeRecommendation:false},currentReadiness:{status:'READY',score:81,confidence:'MODERATE'},activeRecommendation:null,athleteDecision:null,markers:{}};
const system={ok:true,runtime:{masterValidated:true,stateId:runtime.stateId,masterAsOf:runtime.masterAsOf},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:wellness.wellness.sourceAsOf}},tredict:{configured:true,latestEvidence:[]},trainingEvidence:[],athleteMemory:{events:0,latest_event:null},intelligence:{current:intelligence}};

const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/api/runtime-state')return send(res,runtime);if(url.pathname==='/api/wellness/today')return send(res,wellness);if(url.pathname==='/api/training/memory'||url.pathname==='/api/training/today')return send(res,training);if(url.pathname==='/api/trends/current')return send(res,trends);if(url.pathname==='/api/goals/current')return send(res,goals);if(url.pathname==='/api/system/status')return send(res,system);if(url.pathname==='/api/intelligence/current')return send(res,intelligence);if(url.pathname==='/api/intelligence/refresh')return send(res,{...intelligence,afterRevision:intelligence.revision});if(url.pathname==='/api/training/athlete-event'&&url.searchParams.get('operation')==='athlete-auth-status')return send(res,{ok:true,auth:{configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null}});return staticFile(res,url.pathname);});
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
  const nav=page.locator(`[data-page="goals"]:visible`).first();
  await nav.click();
  await page.waitForSelector('#goals.fz-goals-v1 .fz-goals-primary',{timeout:6000});
  await page.waitForSelector('#goals .fz-goals-capabilities',{timeout:6000});
  const state=await page.evaluate(()=>({
    active:document.querySelector('.page.active')?.id,
    title:document.querySelector('[data-fz2-page-title]')?.textContent,
    primary:document.querySelector('.fz-goals-primary h2')?.textContent,
    events:document.querySelectorAll('.fz-goals-event').length,
    capabilities:document.querySelectorAll('.fz-goals-capability').length,
    measured:document.querySelectorAll('.fz-goals-dot.measured').length,
    gaps:document.querySelectorAll('.fz-goals-dot.gap').length,
    navButtons:document.querySelectorAll('.bottom [data-page]').length
  }));
  if(state.active!=='goals'||state.title!=='Goals')throw new Error(`${suffix} Goals navigation/meta failed`);
  if(state.events!==2||state.capabilities!==4||state.measured!==2||state.gaps!==3)throw new Error(`${suffix} Goals canonical content counts unexpected: ${JSON.stringify(state)}`);
  if(isMobile&&state.navButtons!==5)throw new Error(`mobile navigation expected 5 buttons, got ${state.navButtons}`);
  const capabilityText=await page.locator('#goals .fz-goals-capabilities').innerText();
  assert.ok(capabilityText.includes('Qualified run-work evidence is available'));
  assert.ok(!capabilityText.includes('Aerobic engine'),'GOALS must not render the legacy TRENDS capability snapshot');
  for(const status of ['UNMEASURED','UNAVAILABLE'])assert.equal(await page.locator('#goals .fz-goals-capability .pill.warn').filter({hasText:status}).count(),1,`${status} must not have the measured/positive colour`);
  await assertNoOverflow(page,`${suffix} Goals`);
  await page.screenshot({path:path.join(out,`goals-${suffix}-v1.png`),fullPage:true});
  // A canonical reread must update already-mounted GOALS via the focus event
  // dispatched by intelligence-refresh, without reviving the TRENDS snapshot.
  await page.route('**/api/goals/current',route=>route.fulfill({json:{...goals,progress:{...goals.progress,capabilities:[]}}}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#goals')?.textContent.includes('Capability evidence is not currently available.'));
  assert.equal(await page.locator('#goals .fz-goals-capability').count(),0);
  await page.unroute('**/api/goals/current');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForSelector('#goals .fz-goals-capabilities');
  assert.equal(await page.locator('#goals .fz-goals-capability').count(),4);
  if(errors.length)throw new Error(`${suffix} page errors: ${errors.join(' | ')}`);
  await page.close();
  console.log('CAPTURED',suffix,state);
}

try{
  await capture({width:1440,height:1100},false);
  await capture({width:390,height:844},true);
  console.log('PASS Goals & Progress v1 desktop/mobile visual acceptance capture');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
