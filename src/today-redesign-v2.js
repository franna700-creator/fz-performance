/* FZ Performance — TODAY redesign v2
   New presentation composition. Existing runtime contracts remain authoritative. */

const FZ_TODAY_V2_QUOTES = [
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

const todayV2Esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayV2Fmt = (value, decimals = 0) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-ZA',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) : '—';

function todayV2LocalDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function todayV2Quote(){
  const date=todayV2LocalDate();
  const seed=[...date].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  return FZ_TODAY_V2_QUOTES[seed%FZ_TODAY_V2_QUOTES.length];
}
function todayV2Metric(label,value,unit='',detail=''){
  return `<div class="fz2-metric"><span>${todayV2Esc(label)}</span><b>${todayV2Esc(value)}${unit?`<small>${todayV2Esc(unit)}</small>`:''}</b>${detail?`<em>${todayV2Esc(detail)}</em>`:''}</div>`;
}
function todayV2Readiness(r){
  const score=Number.isFinite(Number(r?.score))?Number(r.score):null;
  return `<aside class="fz2-readiness">
    <div class="fz2-readiness-score"><strong>${score??'—'}</strong><span>READINESS</span></div>
    <div class="fz2-readiness-copy"><small>${todayV2Esc(r?.status||'CURRENT STATE')}</small><p>${todayV2Esc(r?.systemicRecovery||'Current recovery interpretation is unavailable.')}</p></div>
  </aside>`;
}
function todayV2Recommendation(r){
  const lane=r?.recommendationLane||String(r?.status||'').replace(/^CURRENT\s*·\s*/i,'')||'CURRENT';
  const decision=r?.primaryDecision||'Current recommendation is unavailable until the next validated intelligence state.';
  const success=r?.successCriteria||'Reassess when new athlete or source evidence arrives.';
  return `<section class="fz2-decision">
    <div class="fz2-decision-kicker"><span>FZ DECISION</span><b>${todayV2Esc(lane)}</b></div>
    <h2>${todayV2Esc(decision)}</h2>
    <div class="fz2-decision-foot"><div><small>SUCCESS CONDITION</small><p>${todayV2Esc(success)}</p></div><button type="button" class="fz2-refresh" data-refresh-fz>REFRESH FZ</button></div>
  </section>`;
}
function todayV2Physiology(w,well){
  const freshness=String(well?.freshness||'UNKNOWN').toUpperCase();
  const source=well?.sourceAsOf?new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(well.sourceAsOf)):'—';
  return `<section class="fz2-physiology">
    <header><div><span>LIVE PHYSIOLOGY</span><h3>What your body is saying now</h3></div><div class="fz2-live"><i></i>${todayV2Esc(freshness)} · ${todayV2Esc(source)}</div></header>
    <div class="fz2-metric-strip">
      ${todayV2Metric('HRV',todayV2Fmt(w?.hrv),'ms','overnight')}
      ${todayV2Metric('RESTING HR',todayV2Fmt(w?.restingHeartRate),'bpm','morning anchor')}
      ${todayV2Metric('SLEEP',todayV2Fmt(w?.sleepScore),'',w?.sleepHours!=null?`${todayV2Fmt(w.sleepHours,1)} h`:'score')}
      ${todayV2Metric('BODY BATTERY',todayV2Fmt(w?.bodyBattery),'',w?.bodyBatteryHigh!=null?`high ${todayV2Fmt(w.bodyBatteryHigh)}`:'current')}
      ${todayV2Metric('STRESS',todayV2Fmt(w?.stress),'',w?.stressAvg!=null?`avg ${todayV2Fmt(w.stressAvg)}`:'current')}
      ${todayV2Metric('STEPS',todayV2Fmt(w?.steps),'',w?.distanceKm!=null?`${todayV2Fmt(w.distanceKm,1)} km`:'today')}
    </div>
  </section>`;
}
function todayV2Training(focus){
  if(!focus)return `<section class="fz2-training"><span>TRAINING</span><h3>No current canonical training session.</h3></section>`;
  const event=(focus.events||[]).filter(e=>e.actor==='ATHLETE').sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))[0];
  return `<section class="fz2-training">
    <div><span>LAST KEY EXECUTION</span><h3>${todayV2Esc(focus.title||focus.sport_type||'Training')}</h3>${event?`<p>${todayV2Esc(event.summary)}</p>`:''}</div>
    <button class="fz2-open-train" data-open-page="train">OPEN TRAIN →</button>
  </section>`;
}
function todayV2Thought(){
  const [type,text]=todayV2Quote();
  return `<section class="fz2-thought"><div><span>FZ THOUGHT · ${todayV2Esc(type)}</span><blockquote>${todayV2Esc(text)}</blockquote></div><small>${todayV2Esc(todayV2LocalDate())}</small></section>`;
}
function todayV2Photo(){
  return `<section class="fz2-photo" aria-label="Hybrid training image"><div class="fz2-photo-overlay"><span>HYBRID PERFORMANCE</span><strong>Built for the work between strength and endurance.</strong></div></section>`;
}

function mountTodayV2(){
  const root=document.getElementById('today');
  if(!root||!window.FZ)return;
  const r=window.FZ.runtime?.renderContract?.readiness||null;
  const well=window.FZ.wellness?.wellness||null;
  const w=well?.current||null;
  const sessions=(window.FZ.training?.sessions||[]).filter(s=>s.status!=='SUPERSEDED');
  const focus=sessions.map(s=>({s,ts:new Date(s.actual_start_at||s.planned_start_at||s.local_date||0).getTime()})).sort((a,b)=>b.ts-a.ts)[0]?.s||null;
  root.className='page active fz-today-v2';
  root.innerHTML=`<div class="fz2-stage">
    <div class="fz2-hero-copy">
      <div class="fz2-date" id="fz2Date"></div>
      ${todayV2Recommendation(r)}
      ${todayV2Readiness(r)}
    </div>
    ${todayV2Photo()}
  </div>
  ${todayV2Physiology(w,well)}
  <div class="fz2-lower">${todayV2Training(focus)}${todayV2Thought()}</div>`;
  const dateNode=document.getElementById('fz2Date');
  if(dateNode)dateNode.textContent=new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toUpperCase();
}

function todayV2Ready(){
  if(window.FZ?.runtime){mountTodayV2();return true}
  return false;
}
const todayV2Observer=new MutationObserver(()=>{if(document.getElementById('today')?.classList.contains('fz-today-v2'))return;if(todayV2Ready())queueMicrotask(mountTodayV2)});
todayV2Observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('fz:source-persisted',()=>queueMicrotask(mountTodayV2));
window.addEventListener('focus',()=>setTimeout(mountTodayV2,120));
setTimeout(todayV2Ready,50);
