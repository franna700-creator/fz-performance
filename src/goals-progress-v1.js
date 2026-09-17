/* FZ Performance — Goals & Progress v1
   Canonical objective + measurement presentation. No athlete truth is stored here. */

const FZ_GOALS_V1={goals:null,busy:false,mounted:false};
const gpEsc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gpNum=value=>Number.isFinite(Number(value))?Number(value):null;
const gpWords=value=>String(value||'').replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function gpDate(value){if(!value)return'—';const d=new Date(String(value).length===10?`${value}T12:00:00Z`:value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'short',year:'numeric'}).format(d)}
function gpTone(value=''){const s=String(value).toUpperCase();if(/UNMEASURED|UNAVAILABLE|PENDING|UNRESOLVED|LOW|GAP|UNKNOWN/.test(s))return'warn';if(/REAL POSITIVE|STRONG|MEASURED|HIGH|READY|QUALIFIED|PRIMARY/.test(s))return'good';return'neutral'}
async function gpJson(url){const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}

function gpPrimaryCard(primary,measurement,uncertainty){
  if(!primary)return `<section class="fz-goals-primary fz-goals-empty"><div><span class="fz-goals-kicker">PRIMARY OBJECTIVE</span><h2>No canonical primary objective is currently resolved.</h2><p>Goals remains evidence-led; it will not substitute static UI truth for a missing runtime objective.</p></div></section>`;
  const days=gpNum(primary.runwayDays);
  const runway=days===null?'Runway unresolved':`${days} day${days===1?'':'s'} to earliest active date`;
  const date=primary.startsOn?gpDate(primary.startsOn):'Date pending';
  const measured=(measurement?.measured||[]).length;
  const gaps=(measurement?.topGaps||[]).length;
  return `<section class="fz-goals-primary">
    <div class="fz-goals-primary-copy"><div class="fz-goals-primary-top"><span class="fz-goals-kicker">PRIMARY OBJECTIVE</span><span class="fz-goals-role">${gpEsc(primary.role||'PRIMARY')}</span></div><h2>${gpEsc(primary.name||'Primary objective')}</h2><p>${gpEsc(runway)} · ${gpEsc(date)}</p><div class="fz-goals-primary-meta"><span>${gpEsc(gpWords(primary.participationStatus||'active'))}</span><span>${gpEsc(gpWords(primary.knowledgeStatus||'knowledge pending'))}</span><span>Evidence confidence ${gpEsc(uncertainty?.confidence||'—')}</span></div></div>
    <div class="fz-goals-runway"><strong>${days===null?'—':gpEsc(days)}</strong><span>DAYS</span><small>Objective runway</small></div>
    <div class="fz-goals-evidence-count"><div><strong>${gpEsc(measured)}</strong><span>measured</span></div><div><strong>${gpEsc(gaps)}</strong><span>priority gaps</span></div></div>
  </section>`;
}
function gpFocusCard(measurement){
  const gap=(measurement?.topGaps||[])[0];
  if(!gap)return `<article class="fz-goals-focus"><span class="fz-goals-kicker">WHAT MATTERS NOW</span><h3>No unresolved high-priority measurement is currently exposed.</h3><p>FZ will keep the state explicit rather than inventing a weakness.</p></article>`;
  return `<article class="fz-goals-focus"><span class="fz-goals-kicker">WHAT MATTERS NOW</span><h3>${gpEsc(gpWords(gap.measurementId||'Measurement gap'))}</h3><p>This is the highest-priority unresolved measurement in the current objective hierarchy. <strong>Unknown is not weakness.</strong></p><div class="fz-goals-focus-foot"><span>Priority ${gpEsc(gap.priority??'—')}</span><span>${gpEsc(gpWords(gap.evidence?.status||'measurement pending'))}</span></div></article>`;
}
function gpEventCard(event){
  const days=gpNum(event?.runwayDays);const overlap=gpNum(event?.overlapToPrimary);
  return `<article class="fz-goals-event"><div class="fz-goals-event-head"><span class="pill ${gpTone(event?.role)}">${gpEsc(gpWords(event?.role||'CONTEXT'))}</span><strong>${days===null?'—':gpEsc(days)}<small> days</small></strong></div><h3>${gpEsc(event?.name||'Event')}</h3><p>${event?.startsOn?gpEsc(gpDate(event.startsOn)):'Date pending'} · ${gpEsc(gpWords(event?.knowledgeStatus||'knowledge pending'))}</p>${overlap===null?'':`<div class="fz-goals-overlap"><span>Directional overlap</span><b>${gpEsc(Math.round(overlap*100))}%</b><small>Context only · not training priority or net training value.</small></div>`}</article>`;
}
function gpCapabilityCard(cap){
  return `<article class="fz-goals-capability"><div class="fz-goals-cap-head"><div><span class="fz-goals-kicker">${gpEsc(cap.priority||'CAPABILITY')}</span><h3>${gpEsc(cap.name||'Capability')}</h3></div><span class="pill ${gpTone(cap.status)}">${gpEsc(cap.status||'UNRESOLVED')}</span></div><p>${gpEsc(cap.summary||cap.inf||'No canonical capability interpretation available.')}</p><div class="fz-goals-cap-grid"><div><small>EVIDENCE</small><strong>${gpEsc(cap.evidence||'—')}</strong></div><div><small>NEXT EVIDENCE</small><span>${gpEsc(cap.next||'Not yet defined')}</span></div></div></article>`;
}
function gpMeasurementCard(row,type){
  const id=row?.measurementId||row?.id||'measurement';
  const status=row?.evidence?.status||(type==='measured'?'MEASURED':'MEASUREMENT PENDING');
  return `<article class="fz-goals-measurement"><span class="fz-goals-dot ${type}"></span><div><strong>${gpEsc(gpWords(id))}</strong><small>${gpEsc(gpWords(status))}${row?.priority!==undefined?` · priority ${gpEsc(row.priority)}`:''}</small></div></article>`;
}
function gpConfidence(goals){
  const u=goals?.progress?.uncertainty||{};const missing=u.missing||[];const assumptions=u.assumptions||[];
  return `<section class="fz-goals-confidence"><div><span class="fz-goals-kicker">CONFIDENCE & UNCERTAINTY</span><h3>${gpEsc(u.confidence||'—')} confidence</h3><p>${missing.length?`${gpEsc(missing.length)} unresolved input${missing.length===1?'':'s'} remain visible.`:'No unresolved canonical input is currently reported by this contract.'}</p></div><div class="fz-goals-confidence-detail">${missing.length?`<div><small>MISSING / UNRESOLVED</small>${missing.map(x=>`<span>${gpEsc(x)}</span>`).join('')}</div>`:''}${assumptions.length?`<div><small>ASSUMPTIONS</small>${assumptions.map(x=>`<span>${gpEsc(x)}</span>`).join('')}</div>`:''}</div></section>`;
}
function gpRender(){
  const root=document.getElementById('goals');if(!root)return;
  const goals=FZ_GOALS_V1.goals;
  if(!goals?.ok){root.innerHTML='<div class="section"><div class="card rich"><h3>Goals & Progress is temporarily unavailable.</h3><p>The canonical objective contract could not be read. No fallback goal truth has been substituted.</p></div></div>';return}
  const primary=goals.objective?.primary||null;const events=goals.objective?.relatedEvents||[];const measurement=goals.progress?.measurement||{};const capabilities=goals.progress?.capabilities||[];
  root.classList.add('fz-goals-v1');
  root.innerHTML=`<div class="fz-goals-stage">
    ${gpPrimaryCard(primary,measurement,goals.progress?.uncertainty)}
    <div class="fz-goals-two">${gpFocusCard(measurement)}<article class="fz-goals-principle"><span class="fz-goals-kicker">PROGRESS PRINCIPLE</span><h3>Evidence before percentage.</h3><p>FZ shows what is improving, stable, unresolved or still waiting for measurement. It does not manufacture completion bars where no defensible progress derivation exists.</p></article></div>
    <section class="fz-goals-section"><header><div><span>EVENT RUNWAY</span><h2>What is coming next</h2></div><p>Near events influence sequencing without automatically replacing the primary objective.</p></header>${events.length?`<div class="fz-goals-events">${events.map(gpEventCard).join('')}</div>`:'<div class="fz-goals-empty-line">No additional qualified events are currently resolved.</div>'}</section>
    <section class="fz-goals-section"><header><div><span>CAPABILITY PROGRESS</span><h2>What the evidence says</h2></div><p>Current qualified capability evidence and next observations. Evidence availability does not establish improvement.</p></header>${capabilities.length?`<div class="fz-goals-capabilities">${capabilities.map(gpCapabilityCard).join('')}</div>`:'<div class="fz-goals-empty-line">Capability evidence is not currently available.</div>'}</section>
    <section class="fz-goals-section"><header><div><span>MEASUREMENT MAP</span><h2>Known versus unresolved</h2></div><p>${gpEsc(measurement.hierarchyId||'Primary objective measurement hierarchy pending')}</p></header><div class="fz-goals-measurements"><div class="fz-goals-measure-col"><h3>Measured</h3>${(measurement.measured||[]).length?(measurement.measured||[]).map(x=>gpMeasurementCard(x,'measured')).join(''):'<p>No measurements are currently marked measured.</p>'}</div><div class="fz-goals-measure-col"><h3>Priority gaps</h3>${(measurement.topGaps||[]).length?(measurement.topGaps||[]).map(x=>gpMeasurementCard(x,'gap')).join(''):'<p>No high-priority gaps are currently exposed.</p>'}</div></div></section>
    ${gpConfidence(goals)}
    <section class="fz-goals-provenance"><b>Objective truth</b><span>${gpEsc(goals.provenance?.objectiveSource||'—')}</span><b>Runtime state</b><span>${gpEsc(goals.provenance?.runtimeStateId||'—')}</span><b>Progress contract</b><span>${gpEsc(goals.contract||'—')}</span></section>
  </div>`;
  FZ_GOALS_V1.mounted=true;
}
async function gpLoad(){
  if(FZ_GOALS_V1.busy)return;FZ_GOALS_V1.busy=true;
  try{
    const [goals]=await Promise.allSettled([gpJson('/api/goals/current')]);
    if(goals.status==='fulfilled')FZ_GOALS_V1.goals=goals.value;
    gpRender();
  }finally{FZ_GOALS_V1.busy=false}
}

function gpSchedule(){queueMicrotask(()=>{if(document.querySelector('.page.active')?.id==='goals'&&!FZ_GOALS_V1.busy&&!FZ_GOALS_V1.mounted)gpLoad();})}
new MutationObserver(gpSchedule).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('click',event=>{if(event.target.closest('[data-page],[data-open-page]'))setTimeout(gpSchedule,0)});
window.addEventListener('fz:intelligence-updated',()=>{FZ_GOALS_V1.mounted=false;gpLoad()});
window.addEventListener('focus',()=>{FZ_GOALS_V1.mounted=false;gpSchedule()});
gpLoad();
