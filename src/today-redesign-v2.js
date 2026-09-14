/* FZ Performance — TODAY redesign v2
   New presentation composition. Existing runtime contracts remain authoritative. */

const FZ_TODAY_V2={runtime:null,wellness:null,training:null,busy:false,mounted:false};
const FZ_TODAY_V2_QUOTES=[
  ['EXECUTION','Consistency is not loud. It is simply there again tomorrow.'],
  ['DISCIPLINE','Do the work that makes the next session possible.'],
  ['PERSPECTIVE','Fitness is built in the space between effort and recovery.'],
  ['ADAPTATION','The goal is not to survive every session. It is to absorb it.'],
  ['PATIENCE','Strong training is often the result of knowing when not to force it.'],
  ['PROCESS','You do not need a perfect day. You need a useful one.'],
  ['RECOVERY','Recovery is not time away from training. It is where training becomes useful.'],
  ['EXECUTION','Control first. Speed later. Repeatability always.'],
  ['DISCIPLINE','Do enough today that tomorrow remains valuable.'],
  ['PERSPECTIVE','One session is noise. A pattern is information.'],
  ['ADAPTATION','The body responds to the dose you can recover from, not the dose you can endure once.'],
  ['PROCESS','Build the athlete you want to be by repeating the behaviours that athlete requires.']
];
const v2Esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v2Fmt=(value,decimals=0)=>Number.isFinite(Number(value))?Number(value).toLocaleString('en-ZA',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):'—';
function v2Date(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function v2Quote(){const seed=[...v2Date()].reduce((sum,char)=>sum+char.charCodeAt(0),0);return FZ_TODAY_V2_QUOTES[seed%FZ_TODAY_V2_QUOTES.length]}
async function v2Json(url){const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${response.status}`);return response.json()}
async function v2Load(){
  if(FZ_TODAY_V2.busy)return;
  FZ_TODAY_V2.busy=true;
  try{
    const [runtime,wellness,training]=await Promise.allSettled([
      v2Json('/api/runtime-state'),v2Json('/api/wellness/today?refresh=0'),v2Json('/api/training/memory?backDays=45&forwardDays=0')
    ]);
    if(runtime.status==='fulfilled')FZ_TODAY_V2.runtime=runtime.value;
    if(wellness.status==='fulfilled')FZ_TODAY_V2.wellness=wellness.value;
    if(training.status==='fulfilled')FZ_TODAY_V2.training=training.value;
    v2Mount();
  }finally{FZ_TODAY_V2.busy=false}
}
function v2Metric(label,value,unit='',detail=''){return `<div class="fz2-metric"><span>${v2Esc(label)}</span><b>${v2Esc(value)}${unit?`<small>${v2Esc(unit)}</small>`:''}</b>${detail?`<em>${v2Esc(detail)}</em>`:''}</div>`}
function v2Readiness(r){
  const score=Number.isFinite(Number(r?.score))?Number(r.score):null;
  return `<aside class="fz2-readiness"><div class="fz2-readiness-score"><strong>${score??'—'}</strong><span>READINESS</span></div><div class="fz2-readiness-copy"><small>${v2Esc(r?.status||'CURRENT STATE')}</small><p>${v2Esc(r?.systemicRecovery||'Current recovery interpretation is unavailable.')}</p></div></aside>`;
}
function v2Recommendation(r){
  const lane=r?.recommendationLane||String(r?.status||'').replace(/^CURRENT\s*·\s*/i,'')||'CURRENT';
  const decision=r?.primaryDecision||'Current recommendation is unavailable until the next validated intelligence state.';
  const success=r?.successCriteria||'Reassess when new athlete or source evidence arrives.';
  return `<section class="fz2-decision"><div class="fz2-decision-kicker"><span>FZ DECISION</span><b>${v2Esc(lane)}</b></div><h2>${v2Esc(decision)}</h2><div class="fz2-decision-foot"><div><small>SUCCESS CONDITION</small><p>${v2Esc(success)}</p></div><button type="button" class="fz2-refresh" data-refresh-fz>REFRESH FZ</button></div></section>`;
}
function v2Physiology(w,well){
  const freshness=String(well?.freshness||'UNKNOWN').toUpperCase();
  const source=well?.sourceAsOf?new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(well.sourceAsOf)):'—';
  return `<section class="fz2-physiology"><header><div><span>LIVE PHYSIOLOGY</span><h3>What your body is saying now</h3></div><div class="fz2-live"><i></i>${v2Esc(freshness)} · ${v2Esc(source)}</div></header><div class="fz2-metric-strip">${v2Metric('HRV',v2Fmt(w?.hrv),'ms','overnight')}${v2Metric('RESTING HR',v2Fmt(w?.restingHeartRate),'bpm','morning anchor')}${v2Metric('SLEEP',v2Fmt(w?.sleepScore),'',w?.sleepHours!=null?`${v2Fmt(w.sleepHours,1)} h`:'score')}${v2Metric('BODY BATTERY',v2Fmt(w?.bodyBattery),'',w?.bodyBatteryHigh!=null?`high ${v2Fmt(w.bodyBatteryHigh)}`:'current')}${v2Metric('STRESS',v2Fmt(w?.stress),'',w?.stressAvg!=null?`avg ${v2Fmt(w.stressAvg)}`:'current')}${v2Metric('STEPS',v2Fmt(w?.steps),'',w?.distanceKm!=null?`${v2Fmt(w.distanceKm,1)} km`:'today')}</div></section>`;
}
function v2Training(focus){
  if(!focus)return `<section class="fz2-training"><div><span>TRAINING</span><h3>No current canonical training session.</h3></div></section>`;
  const event=(focus.events||[]).filter(e=>e.actor==='ATHLETE').sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))[0];
  return `<section class="fz2-training"><div><span>LAST KEY EXECUTION</span><h3>${v2Esc(focus.title||focus.sport_type||'Training')}</h3>${event?`<p>${v2Esc(event.summary)}</p>`:''}</div><button class="fz2-open-train" data-open-page="train">OPEN TRAIN →</button></section>`;
}
function v2Thought(){const [type,text]=v2Quote();return `<section class="fz2-thought"><div><span>FZ THOUGHT · ${v2Esc(type)}</span><blockquote>${v2Esc(text)}</blockquote></div><small>${v2Esc(v2Date())}</small></section>`}
function v2Photo(){return `<section class="fz2-photo" aria-label="Hybrid training image"><div class="fz2-photo-overlay"><span>HYBRID PERFORMANCE</span><strong>Built for the work between strength and endurance.</strong></div></section>`}
function v2Mount(){
  const root=document.getElementById('today');if(!root)return;
  const r=FZ_TODAY_V2.runtime?.renderContract?.readiness||null;
  const well=FZ_TODAY_V2.wellness?.wellness||null;
  const w=well?.current||null;
  const sessions=(FZ_TODAY_V2.training?.sessions||[]).filter(s=>s.status!=='SUPERSEDED');
  const focus=sessions.map(s=>({s,ts:new Date(s.actual_start_at||s.planned_start_at||s.local_date||0).getTime()})).sort((a,b)=>b.ts-a.ts)[0]?.s||null;
  const active=root.classList.contains('active');
  root.className=`page${active?' active':''} fz-today-v2`;
  root.innerHTML=`<div class="fz2-stage"><div class="fz2-hero-copy"><div class="fz2-date">${v2Esc(new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toUpperCase())}</div>${v2Recommendation(r)}${v2Readiness(r)}</div>${v2Photo()}</div>${v2Physiology(w,well)}<div class="fz2-lower">${v2Training(focus)}${v2Thought()}</div>`;
  FZ_TODAY_V2.mounted=true;
}
function scheduleV2Load(delay=80){clearTimeout(scheduleV2Load.timer);scheduleV2Load.timer=setTimeout(v2Load,delay)}
const v2Observer=new MutationObserver(()=>{const root=document.getElementById('today');if(root&&!root.classList.contains('fz-today-v2')&&!FZ_TODAY_V2.busy)scheduleV2Load(30)});
v2Observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('fz:source-persisted',()=>scheduleV2Load(80));
window.addEventListener('online',()=>scheduleV2Load(80));
window.addEventListener('focus',()=>scheduleV2Load(140));
setTimeout(v2Load,160);
