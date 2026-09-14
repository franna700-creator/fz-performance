import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
let configured=false,authenticated=false,csrfToken=null,choice=null;
const pageErrors=[];
function json(res,status,value,headers={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(value));}
function body(req){
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data',chunk=>{raw+=chunk;});
    req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(error){reject(error);}});
    req.on('error',reject);
  });
}
function option(){return {
  optionId:'option:4.4.0-composer.1:adapt:matched-run-aet:fixture',title:'Matched Run AET',objective:'Extend the standardized running-efficiency series.',dose:'3 sets × 13 rounds · 30 s work / 15 s recovery · 4:00 between sets',whyNow:'Comparable running evidence is useful now.',modality:'RUNNING',expectedCost:'MODERATE_TO_HIGH',targetedGaps:['running.controlled_efficiency'],confidence:'HIGH',successCondition:'Complete the prescribed structure with controlled HR.',stopCondition:'Stop for new pain, gait change, severe GI symptoms or dizziness.',evidenceBasis:['Existing matched AET protocol'],
  prescription:{protocolFamilyId:'MATCHED_RUN_AET',protocolVersion:'1.1',measurementPriority:'VERY_HIGH',comparisonClass:'FAMILY_COMPARABLE',selectionReady:true,releaseStatus:'READY',releaseReason:null,preSessionGate:[{label:'Proceed if',instructions:'Easy running feels mechanically normal.'}],equipment:['Running route or treadmill','Garmin HR recording'],warmup:[{label:'MH1.1',instructions:'Complete the established nine-minute warm-up.'}],mainSet:[{label:'3 sets × 13 rounds',instructions:'30 s running work / 15 s recovery for 13 rounds.',target:'85–88% max HR'},{label:'Between sets',instructions:'Exactly 4:00 controlled recovery.'}],decisionRules:['Adjust speed rather than changing recovery.'],successCriteria:['Preserve output from Set 1 to Set 3.'],coolDown:[{label:'5–10 min',instructions:'Easy walk/jog.'}],postSessionReport:['Output/distance for each set','Average and peak HR for each set'],prescriptionFingerprint:'fixture-fingerprint'}
};}
function intelligence(){return {ok:true,revision:choice?'r2':'r1',pendingPropagation:false,markers:{sessionOptionComposerVersion:'4.4.0-composer.1'},activeRecommendation:{status:'READY',localDate:'2026-09-14',fzRecommendedLane:'ADAPT',confidence:'HIGH',recommendationVersion:'rec-fixture',shadowRecommendationId:'shadow-fixture',sessionOptionComposerVersion:'4.4.0-composer.1',sessionPrescriptionComposerVersion:'4.6.0-prescription.2',explanation:{athleteFacing:{headline:'There is room for a deliberate adaptation stimulus.',whyNow:'Comparable running evidence is useful now.',objectiveConnection:'Primary HYROX objective.'}},lanes:{ABSORB:[],MAINTAIN:[],ADAPT:[option()]}},athleteDecision:choice};}
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/adaptive-choice.css"><style>body{margin:0;background:#070707;color:#f3f3ee;font-family:Arial,sans-serif}.main{padding:12px}.topbar{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.mast{flex:1}.page{padding:12px 0}.card{border:1px solid #333;border-radius:14px;padding:14px}.section{margin-top:12px}.section-head h2{margin-bottom:4px}.section-head p,.muted,.microline{color:#aaa}.eyebrow{font-size:11px;color:#ffe500}.pill{font-size:10px}.logo{font-weight:900}button{font-size:14px}</style></head><body><div class="main"><div class="topbar"><div class="mast"><div class="eyebrow">FZ Performance</div><h1>Athlete Command Centre</h1></div></div><section id="today" class="page"><div class="fz-clean-recommendation card"></div></section><section id="train" class="page"><div class="section"><div class="section-head"><h2>Training Memory</h2></div></div></section><section id="system" class="page"><div data-recommendation-shadow class="section"><div class="card rich">old technical card</div></div></section></div><script type="module" src="/assets/adaptive-choice.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/') {res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(html);}
  if(url.pathname==='/assets/adaptive-choice.js'||url.pathname==='/assets/adaptive-choice.css'){
    const file=path.join(dist,url.pathname.replace(/^\//,''));res.writeHead(200,{'content-type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});return fs.createReadStream(file).pipe(res);
  }
  if(url.pathname==='/api/intelligence/current')return json(res,200,intelligence());
  if(url.pathname==='/api/training/athlete-event'&&req.method==='GET')return json(res,200,{ok:true,auth:{configured,authenticated,mode:authenticated?'ATHLETE':'VIEWER',csrfToken:authenticated?csrfToken:null,expiresAt:authenticated?'2026-09-15T00:00:00.000Z':null,authVersion:'4.6.0-auth.1'}});
  if(url.pathname==='/api/training/athlete-event'&&req.method==='POST'){
    const payload=await body(req);
    if(payload.kind==='ATHLETE_AUTH'&&(payload.action==='SETUP'||payload.action==='RESET')){
      if(payload.bootstrapProof!=='proof-1'||payload.pin!=='123456')return json(res,401,{ok:false,error:'setup_proof_invalid',detail:'invalid'});
      configured=true;authenticated=true;csrfToken='csrf-setup';return json(res,200,{ok:true,auth:{configured:true,authenticated:true,mode:'ATHLETE',csrfToken,expiresAt:'2026-09-15T00:00:00.000Z',authVersion:'4.6.0-auth.1'}},{'set-cookie':'fz_athlete_session=mock; Path=/; HttpOnly; SameSite=Strict'});
    }
    if(payload.kind==='ATHLETE_AUTH'&&payload.action==='LOGIN'){
      if(payload.pin!=='123456')return json(res,401,{ok:false,error:'login_failed',detail:'Unable to authenticate Athlete Mode.'});
      authenticated=true;csrfToken='csrf-login';return json(res,200,{ok:true,auth:{configured:true,authenticated:true,mode:'ATHLETE',csrfToken,expiresAt:'2026-09-15T00:00:00.000Z',authVersion:'4.6.0-auth.1'}});
    }
    if(payload.kind==='ATHLETE_AUTH'&&payload.action==='LOGOUT'){
      if(req.headers['x-fz-csrf']!==csrfToken)return json(res,403,{ok:false,error:'athlete_write_rejected'});
      authenticated=false;csrfToken=null;return json(res,200,{ok:true,auth:{configured:true,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null,authVersion:'4.6.0-auth.1'}});
    }
    if(payload.kind==='ADAPTIVE_CHOICE'){
      if(!authenticated||req.headers['x-fz-csrf']!==csrfToken||String(req.headers['x-fz-idempotency-key']||'').length<16)return json(res,403,{ok:false,error:'athlete_write_rejected'});
      if(payload.choice?.optionId!==option().optionId||payload.choice?.lane!=='ADAPT'||payload.choice?.recommendationVersion!=='rec-fixture')return json(res,400,{ok:false,error:'bad_choice'});
      choice={decisionId:'decision-fixture',selectedLane:'ADAPT',optionId:option().optionId,option:{title:'Matched Run AET'},matchesFzRecommendation:true,plannedForDate:'2026-09-14',plannedSessionId:'plan-fixture'};
      return json(res,200,{ok:true,choice});
    }
  }
  res.writeHead(404);res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
function assert(value,message){if(!value)throw new Error(message);console.log('PASS',message);}
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:5000});
  await page.waitForSelector('[data-fz-mode-overlay]:not([hidden])',{timeout:3000});
  assert((await page.locator('[data-fz-mode-overlay]').innerText()).includes('Set up Athlete Access'),'first-use landing offers secure Athlete Access setup');
  await page.locator('[data-open-auth]').click();
  await page.locator('input[name="bootstrapProof"]').fill('proof-1');
  await page.locator('input[name="pin"]').fill('123456');
  await page.locator('input[name="confirmPin"]').fill('123456');
  await page.locator('[data-athlete-auth-form]').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>document.body.innerText.includes('ATHLETE MODE · EDITING ENABLED'),null,{timeout:3000});
  assert((await page.locator('.fz-athlete-mode-control').innerText()).includes('ATHLETE MODE · EDITING ENABLED'),'setup establishes Athlete Mode without exposing a permanent PIN in chat');
  assert(await page.locator('input[name="pin"]').count()===0,'PIN form is removed from DOM after successful authentication');
  await page.locator('.fz-execution-prescription summary').click();
  const rx=await page.locator('.fz-execution-prescription').innerText();
  assert(rx.includes('MATCHED_RUN_AET'),'execution surface identifies the protocol family');
  assert(rx.includes('v1.1'),'execution surface identifies the exact protocol version');
  assert(rx.includes('3 sets × 13 rounds'),'execution surface exposes the full main-set prescription');
  assert(rx.includes('Exactly 4:00 controlled recovery'),'execution surface exposes fixed recovery rather than a summary-only dose');
  await page.locator('[data-select-option]').click();
  await page.waitForFunction(()=>document.querySelector('#train')?.innerText.includes('Matched Run AET')&&document.querySelector('#train')?.innerText.includes('plan-fixture'),null,{timeout:3000});
  assert((await page.locator('#train').innerText()).includes('accepted FZ direction'),'secure browser selection is persisted into the athlete-decision surface');
  await page.locator('[data-lock-athlete]').click();
  await page.waitForFunction(()=>document.body.innerText.includes('VIEWER MODE')&&!document.body.innerText.includes('ATHLETE MODE · EDITING ENABLED'),null,{timeout:3000});
  assert((await page.locator('.fz-athlete-mode-control').innerText()).includes('VIEWER MODE'),'Lock Athlete Mode revokes editing and returns to Viewer Mode');
  await page.locator('.fz-athlete-mode-control [data-athlete-login]').click();
  await page.locator('input[name="pin"]').fill('123456');
  await page.locator('[data-athlete-auth-form]').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>document.body.innerText.includes('ATHLETE MODE · EDITING ENABLED'),null,{timeout:3000});
  assert((await page.locator('.fz-athlete-mode-control').innerText()).includes('ATHLETE MODE · EDITING ENABLED'),'subsequent PIN login restores Athlete Mode');
  assert(pageErrors.length===0,`Athlete Mode browser flow has no page errors (${pageErrors.join(' | ')||'none'})`);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Athlete Mode mobile surface has no horizontal overflow');
  console.log('PASS Tranche 4.6 real-browser Athlete Mode: setup, secure selection, revocation, login and prescription expansion');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
