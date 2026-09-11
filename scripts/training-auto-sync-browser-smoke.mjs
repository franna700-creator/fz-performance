import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
let trainingSynced=false;
let sourceSyncRequests=0;
const trainingSequence=[];

function json(res,value){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}
function staticFile(res,pathname){const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');const file=path.join(dist,rel);if(!file.startsWith(dist)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return}const ext=path.extname(file);const type=ext==='.js'?'text/javascript':ext==='.css'?'text/css':'text/html';res.writeHead(200,{'content-type':`${type}; charset=utf-8`,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);}

const session={
  session_id:'session-auto-sync-1',local_date:'2026-09-09',actual_start_at:'2026-09-09T18:35:00.000Z',planned_start_at:null,
  title:'Evening Zone 2',sport_type:'running',session_kind:'Z2',status:'COMPLETED',reconciliation_state:'MATCHED',
  metrics:{durationSeconds:3600,avgHeartRate:132,maxHeartRate:151,distanceMeters:10000,calories:620,avgPowerWatts:245,paceSecPerKm:360,cadence:168,elevationGainMeters:45},
  evidence:{sourceKeys:['tredict','garmin'],newestAt:'2026-09-09T19:00:00.000Z',hasMetrics:true},
  events:[],sources:[{source_key:'tredict',source_record_id:'td-auto-sync-1',match_method:'SOURCE_NATIVE',match_confidence:1}]
};
const strengthSession={
  session_id:'session-strength-detail-1',local_date:'2026-09-09',actual_start_at:'2026-09-09T17:00:00.000Z',planned_start_at:null,
  title:'Strength Detail',sport_type:'Strength',session_kind:null,status:'COMPLETED',reconciliation_state:'MATCHED',
  metrics:{durationSeconds:2560,avgHeartRate:103,maxHeartRate:146,distanceMeters:null,calories:309,avgPowerWatts:null,paceSecPerKm:null,cadence:null,elevationGainMeters:null,lowHrShare:.9984375},
  workoutDetail:{
    hasDetail:true,
    strength:{
      setCount:2,
      sets:[
        {set:1,exerciseLabel:'Bench Press',reps:15,weightKg:27.5,durationSeconds:42},
        {set:2,exerciseLabel:'Shoulder Press',reps:12,weightKg:20,durationSeconds:36}
      ],
      sourceArtifact:'Garmin Connect',providerActivityId:'24311712786',
      labelSemantics:'Provider labels remain provider evidence until athlete-confirmed.',
      weightSemantics:'Garmin-displayed kg values are preserved verbatim.',
      conflicts:[]
    },
    physiology:{heartRateEffort:33,hrIntensitySeconds:[2556,4,0],hrIntensityShares:{low:.9984375,moderate:.0015625,high:0},cadenceIntensitySeconds:null,cadenceIntensityShares:null,temperatureC:27.2},
    running:null
  },
  evidence:{sourceKeys:['tredict','garmin','conversation'],newestAt:'2026-09-09T17:45:00.000Z',hasMetrics:true,hasWorkoutDetail:true},
  events:[],sources:[{source_key:'conversation',source_record_id:'strength-detail-evidence',match_method:'ATHLETE_SUPPLIED_GARMIN_CONNECT_SCREENSHOT',match_confidence:1}]
};
function trainingPayload(refresh){return {ok:true,date:'2026-09-09',range:{startDate:'2026-07-26',endDate:'2026-09-09'},syncWindow:{startDate:'2026-09-07',endDate:'2026-09-16'},sync:refresh?{tredict:{activities:2},garmin:{activities:2,matched:2}}:null,warning:null,sessions:trainingSynced?[session,strengthSession]:[],supersededSessions:[],contextEvents:[]};}
function wellness(){return {ok:true,date:'2026-09-09',syncStatus:'SYNCED',warning:null,source:{status:'CONNECTED'},wellness:{date:'2026-09-09',sourceAsOf:'2026-09-09T19:05:00.000Z',ingestedAt:'2026-09-09T19:06:00.000Z',freshness:'LIVE',ageMinutes:1,current:{steps:10000,distanceKm:8,activeCalories:650,activeMinutes:75,heartRate:80,restingHeartRate:54,stress:18,stressAvg:22,bodyBattery:42,bodyBatteryHigh:90,bodyBatteryLow:38,hrv:70,sleepScore:82,sleepHours:7.2,respiration:14},series:{body_battery:[['2026-09-09T18:45:00.000Z',43]],stress:[['2026-09-09T18:45:00.000Z',18]],heart_rate:[['2026-09-09T18:45:00.000Z',80]],respiration:[['2026-09-09T18:45:00.000Z',14]]}}};}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/training/memory'){
    if(url.searchParams.get('refresh')==='1'){
      sourceSyncRequests+=1;trainingSequence.push('source');
      await new Promise(resolve=>setTimeout(resolve,180));
      trainingSynced=true;
      return json(res,trainingPayload(true));
    }
    trainingSequence.push('db');return json(res,trainingPayload(false));
  }
  if(url.pathname==='/api/wellness/today')return json(res,wellness());
  if(url.pathname==='/api/runtime-state')return json(res,{ok:true,renderContract:{readiness:{score:82,status:'READY',systemicRecovery:'Systemic recovery is good.',localTissueState:'No material local limiter.',primaryDecision:'Proceed with the current recommendation.',successCriteria:'Reassess when new evidence arrives.'}}});
  if(url.pathname==='/api/trends/current')return json(res,{ok:true,summaries:{},recovery:{wellnessHistory:[]},load:{series:[],rolling7d:{value:null},rolling28d:{value:null},formula:'test'},performance:{matchedAet:[],runningRelationship:[],excludedAet:[]},quality:{loadMissingDates:[]},capabilities:[],provenance:{operationalTruth:'Neon',auditRepresentation:'Drive'}});
  if(url.pathname==='/api/system/status')return json(res,{ok:true,runtime:{masterValidated:true},garmin:{connection:{status:'CONNECTED'},latestWellness:{source_as_of:'2026-09-09T19:05:00.000Z'}},tredict:{configured:true,latestEvidence:trainingSynced?[{local_date:'2026-09-09'}]:[]},trainingEvidence:trainingSynced?[{source_key:'tredict'}]:[],athleteMemory:{events:0}});
  return staticFile(res,url.pathname);
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
function assert(condition,message){if(!condition)throw new Error(message);console.log('PASS',message);}

try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-training-auto-sync]'));
  await page.waitForFunction(()=>document.getElementById('today')?.textContent?.includes('Evening Zone 2'),null,{timeout:5000});
  assert(trainingSequence[0]==='db','persisted canonical training renders before source sync');
  assert(sourceSyncRequests===1,'initial background workout source sync runs once');
  assert((await page.locator('[data-training-sync-status]').textContent()).includes('synced'),'training sync status becomes visible after source persistence');
  assert((await page.locator('#today').textContent()).includes('Evening Zone 2'),'TODAY updates after background source reconciliation');

  await page.locator('[data-page="train"]:visible').first().click();
  await page.waitForSelector('[data-rich-training-lens="ALL"]',{timeout:5000});
  await page.locator('[data-rich-training-lens="ALL"]').click();
  assert((await page.locator('#train').textContent()).includes('Evening Zone 2'),'TRAIN All sessions reflects newly reconciled canonical workout');
  assert((await page.locator('#train').textContent()).includes('132')&&(await page.locator('#train').textContent()).includes('avg HR'),'TRAIN All sessions renders canonical execution metrics without Athlete Voice');
  const strengthCard=page.locator('[data-canonical-session="session-strength-detail-1"]');
  await strengthCard.waitFor({state:'visible'});
  assert((await strengthCard.textContent()).includes('42:40')&&(await strengthCard.textContent()).includes('103')&&(await strengthCard.textContent()).includes('309'),'TRAIN renders canonical Strength summary metrics');
  assert((await strengthCard.textContent()).includes('Workout details · 2 sets'),'TRAIN exposes expandable workout-level detail');
  await strengthCard.locator('details.fz-workout-detail summary').click();
  const strengthText=await strengthCard.textContent();
  assert(strengthText.includes('Bench Press')&&strengthText.includes('15')&&strengthText.includes('27.5 kg'),'TRAIN renders canonical Strength set/reps/load detail');
  assert(strengthText.includes('Heart-rate intensity')&&strengthText.includes('HR effort'),'TRAIN renders canonical physiology detail alongside workout evidence');
  assert(strengthText.includes('No Athlete Voice is linked to this execution.'),'TRAIN workout detail remains valid without Athlete Voice');

  await page.locator('[data-page="today"]:visible').first().click();
  await page.locator('[data-training-sync-now]').click();
  await page.waitForFunction(()=>document.querySelector('[data-training-sync-now]')?.textContent==='Sync workouts');
  assert(sourceSyncRequests===2,'manual Sync workouts performs an explicit source refresh');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'mobile training detail and sync controls introduce no horizontal overflow');
  console.log('PASS training auto-sync browser acceptance');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
