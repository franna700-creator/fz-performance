/* FZ Performance — TODAY redesign v2
   New presentation composition. Existing runtime contracts remain authoritative. */

const FZ_TODAY_V2={runtime:null,wellness:null,training:null,busy:false,mounted:false,shellMounted:false};
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
function v2DayOrdinal(){const [year,month,day]=v2Date().split('-').map(Number);return Math.floor(Date.UTC(year,month-1,day)/86400000)}
function v2Quote(){return FZ_TODAY_V2_QUOTES[Math.abs(v2DayOrdinal())%FZ_TODAY_V2_QUOTES.length]}
function v2Time(value){if(!value)return'—';const d=new Date(value);if(Number.isNaN(d.getTime()))return'—';return new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
function v2SleepHours(value){const n=Number(value);if(!Number.isFinite(n))return'—';const total=Math.round(n*60);return`${Math.floor(total/60)}h ${String(total%60).padStart(2,'0')}m`}
function v2Icon(name){
  const common='viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const icons={
    pulse:`<svg ${common}><path d="M3 12h4l2-5 3 10 2-5h7"/></svg>`,
    home:`<svg ${common}><path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z"/></svg>`,
    trends:`<svg ${common}><path d="M5 19V11M12 19V5M19 19v-8"/></svg>`,
    train:`<svg ${common}><path d="M7 5h10M5 8v8M19 8v8M8 9v6M16 9v6M7 12h10"/></svg>`,
    system:`<svg ${common}><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>`,
    heart:`<svg ${common}><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z"/></svg>`,
    moon:`<svg ${common}><path d="M18 16.5A7.5 7.5 0 0 1 8 6a7 7 0 1 0 10 10.5Z"/></svg>`,
    battery:`<svg ${common}><rect x="4" y="7" width="14" height="10" rx="2"/><path d="M20 10v4M7 10h8v4H7z"/></svg>`,
    bolt:`<svg ${common}><path d="m13 2-7 12h5l-1 8 8-13h-5z"/></svg>`,
    steps:`<svg ${common}><ellipse cx="9" cy="8" rx="2.5" ry="4"/><ellipse cx="15.5" cy="16" rx="2.5" ry="4"/></svg>`,
    quote:`<svg ${common}><path d="M5 13h5l-2 6H4l1-6Zm9 0h5l-2 6h-4l1-6ZM5 11c0-4 2-6 5-7M14 11c0-4 2-6 5-7"/></svg>`,
    target:`<svg ${common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m14 10 6-6"/></svg>`,
    refresh:`<svg ${common}><path d="M20 7v5h-5M4 17v-5h5M18.5 10A7 7 0 0 0 6 7M5.5 14A7 7 0 0 0 18 17"/></svg>`
  };
  return icons[name]||icons.pulse;
}
function v2Glyph(name){return({pulse:'∿',heart:'♥',moon:'☾',battery:'▣',bolt:'ϟ',steps:'••'}[name]||'•')}
function v2PageMeta(page){
  const map={today:['Today','Your data. Your decision.'],trends:['Trends','Change over time, interpreted.'],train:['Training','Execution, memory and response.'],goals:['Goals','Objective runway, capability evidence and progress.'],system:['System','Source truth and provenance.']};
  return map[page]||map.today;
}
function v2TopNavButton(page,label,icon,tone){return `<button type="button" data-page="${page}" class="fz2-topnav-button tone-${tone}"><span class="fz2-topnav-icon">${v2Icon(icon)}</span><span>${label}</span></button>`}
function v2SetText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function v2MountTopShell(){
  const main=document.querySelector('.main');if(!main)return;
  document.body.classList.add('fz2-topside-active');
  let shell=main.querySelector(':scope > .fz2-top-shell');
  if(!shell){
    shell=document.createElement('header');shell.className='fz2-top-shell';
    shell.innerHTML=`<div class="fz2-brand"><div class="fz2-brand-mark">FZ</div><div><strong>PERFORMANCE</strong><small>TRAIN SMARTER. GO FURTHER.</small></div></div><div class="fz2-page-context"><small data-fz2-date></small><strong data-fz2-page-title>Today</strong><span data-fz2-page-subtitle>Your data. Your decision.</span></div><nav class="fz2-topnav" aria-label="Primary navigation">${v2TopNavButton('today','Today','home','yellow')}${v2TopNavButton('trends','Trends','trends','cyan')}${v2TopNavButton('train','Training','train','green')}${v2TopNavButton('goals','Goals','target','yellow')}${v2TopNavButton('system','System','system','violet')}</nav><div class="fz2-shell-ops"><div class="fz2-countdown-slot"></div><div class="fz2-auth-slot"></div></div>`;
    main.prepend(shell);
  }
  const legacyTop=main.querySelector(':scope > .topbar');
  if(legacyTop)legacyTop.classList.add('fz2-legacy-topbar');
  const fresh=legacyTop?.querySelector('.fresh')||document.getElementById('countdown')?.closest('.fresh');
  const countdownSlot=shell.querySelector('.fz2-countdown-slot');
  if(fresh&&countdownSlot&&!shell.contains(fresh))countdownSlot.append(fresh);
  const athleteControl=document.querySelector('.fz-athlete-mode-control');
  const authSlot=shell.querySelector('.fz2-auth-slot');
  if(athleteControl&&authSlot&&!shell.contains(athleteControl))authSlot.append(athleteControl);
  v2SyncTopShell();
  FZ_TODAY_V2.shellMounted=true;
}
function v2SyncTopShell(){
  const shell=document.querySelector('.fz2-top-shell');if(!shell)return;
  const page=document.querySelector('.page.active')?.id||'today';
  const [title,subtitle]=v2PageMeta(page);
  const date=new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',weekday:'short',day:'2-digit',month:'long',year:'numeric'}).format(new Date());
  v2SetText(shell.querySelector('[data-fz2-date]'),date);
  v2SetText(shell.querySelector('[data-fz2-page-title]'),title);
  v2SetText(shell.querySelector('[data-fz2-page-subtitle]'),subtitle);
}
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
function v2Readiness(r){
  const score=Number.isFinite(Number(r?.score))?Number(r.score):null;
  const deg=score===null?0:Math.max(0,Math.min(100,score))*3.6;
  const local=r?.localTissueState?`<p class="fz2-local-state">${v2Esc(r.localTissueState)}</p>`:'';
  return `<aside class="fz2-readiness"><div class="fz2-readiness-score" style="--fz2-score:${deg}deg"><strong>${score??'—'}</strong><span>READINESS</span></div><div class="fz2-readiness-copy"><small>${v2Esc(r?.status||'CURRENT STATE')}</small><p>${v2Esc(r?.systemicRecovery||'Current recovery interpretation is unavailable.')}</p>${local}</div></aside>`;
}
function v2Recommendation(r){
  const lane=r?.recommendationLane||String(r?.status||'').replace(/^CURRENT\s*·\s*/i,'')||'CURRENT';
  const decision=r?.primaryDecision||'Current recommendation is unavailable until the next validated intelligence state.';
  const success=r?.successCriteria||'Reassess when new athlete or source evidence arrives.';
  return `<section class="fz2-decision"><div class="fz2-decision-kicker"><span class="fz2-kicker-icon">${v2Icon('pulse')}</span><span>FZ DECISION</span><b>${v2Esc(lane)}</b></div><h2>${v2Esc(decision)}</h2><div class="fz2-decision-foot"><div><small>SUCCESS CONDITION</small><p>${v2Esc(success)}</p></div><button type="button" class="fz2-refresh" data-refresh-fz>REFRESH FZ</button></div></section>`;
}
function v2SummaryMetric(label,value,unit,detail,icon,tone){return `<article class="fz2-summary-metric tone-${tone}"><span class="fz2-summary-icon">${v2Icon(icon)}</span><small>${v2Esc(label)}</small><strong>${v2Esc(value)}${unit?`<em>${v2Esc(unit)}</em>`:''}</strong><p>${v2Esc(detail||'')}</p></article>`}
function v2PhysiologySummary(well){
  const w=well?.current||{};
  const freshness=String(well?.freshness||'UNKNOWN').toUpperCase();
  const source=v2Time(well?.sourceAsOf);
  return `<section class="fz2-phys-summary"><header><div><span class="fz2-phys-title"><i></i>Live Physiology</span><small>${v2Esc(freshness)} · ${v2Esc(source)}</small></div><button type="button" class="fz2-view-details" data-fz2-live-details aria-expanded="false">View details →</button></header><div class="fz2-summary-grid">${v2SummaryMetric('HRV',v2Fmt(w.hrv),'ms','overnight','pulse','green')}${v2SummaryMetric('Resting HR',v2Fmt(w.restingHeartRate),'bpm','morning anchor','heart','cyan')}${v2SummaryMetric('Sleep',v2SleepHours(w.sleepHours),'',Number.isFinite(Number(w.sleepScore))?`score ${v2Fmt(w.sleepScore)}`:'duration','moon','violet')}${v2SummaryMetric('Body Battery',v2Fmt(w.bodyBattery),'',Number.isFinite(Number(w.bodyBatteryHigh))?`high ${v2Fmt(w.bodyBatteryHigh)}`:'current','battery','green')}${v2SummaryMetric('Stress',v2Fmt(w.stress),'',Number.isFinite(Number(w.stressAvg))?`avg ${v2Fmt(w.stressAvg)}`:'current','bolt','yellow')}${v2SummaryMetric('Steps',v2Fmt(w.steps),'',Number.isFinite(Number(w.distanceKm))?`${v2Fmt(w.distanceKm,1)} km`:'today','steps','cyan')}</div></section>`;
}
function v2Training(focus){
  if(!focus)return `<section class="fz2-training"><div><span class="fz2-card-kicker"><i>${v2Icon('train')}</i> TRAINING</span><h3>No current canonical training session.</h3></div><button type="button" class="fz2-sync-workouts" data-training-sync-now aria-label="Sync workouts">${v2Icon('refresh')}</button></section>`;
  const event=(focus.events||[]).filter(e=>e.actor==='ATHLETE').sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))[0];
  return `<section class="fz2-training"><div><span class="fz2-card-kicker"><i>${v2Icon('train')}</i> LAST KEY EXECUTION</span><h3>${v2Esc(focus.title||focus.sport_type||'Training')}</h3>${event?`<p>${v2Esc(event.summary)}</p>`:''}</div><div class="fz2-training-actions"><button class="fz2-open-train" data-open-page="train">OPEN TRAIN →</button><button type="button" class="fz2-sync-workouts" data-training-sync-now aria-label="Sync workouts">${v2Icon('refresh')}</button></div></section>`;
}
function v2Thought(){const[type,text]=v2Quote();return `<section class="fz2-thought"><div><span class="fz2-card-kicker"><i>${v2Icon('quote')}</i> FZ THOUGHT · ${v2Esc(type)}</span><blockquote>${v2Esc(text)}</blockquote></div><small>${v2Esc(v2Date())}</small></section>`}
function v2Photo(){return `<section class="fz2-photo" aria-label="Hybrid training image"><div class="fz2-photo-overlay"><span>HYBRID PERFORMANCE</span><strong>Built for the work between strength and endurance.</strong></div></section>`}
function v2ShellHtml(r,well,focus){return `<div class="fz2-stage"><div class="fz2-hero-copy"><div class="fz2-date">${v2Esc(new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',weekday:'long',day:'2-digit',month:'long'}).format(new Date()).toUpperCase())}</div>${v2Recommendation(r)}${v2Readiness(r)}</div>${v2Photo()}</div>${v2PhysiologySummary(well)}<div class="fz2-lower">${v2Training(focus)}${v2Thought()}</div>`}
function v2LiveKind(text=''){
  const value=String(text).toLowerCase();
  if(value.includes('hrv'))return['pulse','green'];
  if(value.includes('heart')||value.includes('resting'))return['heart','cyan'];
  if(value.includes('sleep'))return['moon','violet'];
  if(value.includes('battery'))return['battery','green'];
  if(value.includes('stress'))return['bolt','yellow'];
  if(value.includes('step')||value.includes('distance'))return['steps','cyan'];
  if(value.includes('respir'))return['pulse','violet'];
  return['pulse','yellow'];
}
function v2DecorateLive(root){
  for(const item of root.querySelectorAll('.fz2-legacy-live .fz-live-anchor-row>div,.fz2-legacy-live .fz-live-chart-v3')){
    if(item.querySelector(':scope > .fz2-live-icon'))continue;
    const [icon,tone]=v2LiveKind(item.textContent||'');
    const badge=document.createElement('span');badge.className=`fz2-live-icon tone-${tone}`;badge.setAttribute('aria-hidden','true');badge.textContent=v2Glyph(icon);item.prepend(badge);
  }
}
function v2ClassifyLegacy(root){
  for(const section of root.querySelectorAll(':scope > .section')){
    const title=(section.querySelector('.section-head h2')?.textContent||'').trim();
    section.classList.toggle('fz2-legacy-live',title==='Live Physiology');
    section.classList.toggle('fz2-legacy-training',title==='Training State');
    section.classList.toggle('fz2-legacy-hidden',title!=='Live Physiology'&&title!=='Training State');
  }
  const hero=root.querySelector(':scope > .fz-clean-hero');if(hero)hero.classList.add('fz2-legacy-hidden');
  v2DecorateLive(root);
}
function v2SyncDetailButton(root){const button=root?.querySelector('[data-fz2-live-details]');if(!button)return;const open=root.classList.contains('fz2-live-detail-open');button.setAttribute('aria-expanded',String(open));v2SetText(button,open?'Hide details ↑':'View details →')}
function v2ToggleLiveDetails(){const root=document.getElementById('today');if(!root)return;root.classList.toggle('fz2-live-detail-open');v2SyncDetailButton(root);if(root.classList.contains('fz2-live-detail-open'))setTimeout(()=>root.querySelector(':scope > .fz2-legacy-live')?.scrollIntoView({behavior:'smooth',block:'start'}),20)}
function v2Mount(){
  v2MountTopShell();
  const root=document.getElementById('today');if(!root)return;
  const r=FZ_TODAY_V2.runtime?.renderContract?.readiness||null;
  const well=FZ_TODAY_V2.wellness?.wellness||null;
  const sessions=(FZ_TODAY_V2.training?.sessions||[]).filter(s=>s.status!=='SUPERSEDED');
  const focus=sessions.map(s=>({s,ts:new Date(s.actual_start_at||s.planned_start_at||s.local_date||0).getTime()})).sort((a,b)=>b.ts-a.ts)[0]?.s||null;
  root.classList.add('fz-today-v2');
  let shell=root.querySelector(':scope > .fz2-shell');
  if(!shell){shell=document.createElement('div');shell.className='fz2-shell';root.prepend(shell)}
  shell.innerHTML=v2ShellHtml(r,well,focus);
  v2ClassifyLegacy(root);v2SyncDetailButton(root);
  FZ_TODAY_V2.mounted=true;
}
function scheduleV2Load(delay=80){clearTimeout(scheduleV2Load.timer);scheduleV2Load.timer=setTimeout(v2Load,delay)}
let v2ClassifyQueued=false;
const v2Observer=new MutationObserver(()=>{
  if(v2ClassifyQueued)return;v2ClassifyQueued=true;
  queueMicrotask(()=>{v2ClassifyQueued=false;v2MountTopShell();v2SyncTopShell();const root=document.getElementById('today');if(!root)return;v2ClassifyLegacy(root);v2SyncDetailButton(root);if(!root.querySelector(':scope > .fz2-shell')&&!FZ_TODAY_V2.busy)scheduleV2Load(30)});
});
v2Observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{if(event.target.closest('[data-fz2-live-details]')){v2ToggleLiveDetails();return}if(event.target.closest('[data-page],[data-open-page]'))queueMicrotask(v2SyncTopShell)});
document.addEventListener('fz:source-persisted',()=>scheduleV2Load(80));
window.addEventListener('online',()=>scheduleV2Load(80));
window.addEventListener('focus',()=>scheduleV2Load(140));
v2MountTopShell();
setTimeout(v2Load,160);