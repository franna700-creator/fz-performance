/* FZ UI context recovery v1 — presentation only; canonical truth remains in runtime APIs. */
const api = {
  runtime: '/api/runtime-state',
  intelligence: '/api/intelligence/current',
  trends: '/api/trends/current?days=45',
  training: '/api/training/memory?backDays=45&forwardDays=0'
};

let snapshot = { runtime:null, intelligence:null, trends:null, training:null };
let enhancing = false;
let refreshTimer = null;

const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const words = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const number = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
const fmt = (value, digits=0) => number(value) === null ? '—' : Number(value).toLocaleString('en-ZA',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const minutes = seconds => number(seconds) === null ? null : Number(seconds) / 60;

async function getJson(url) {
  const response = await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function refreshSnapshot() {
  const entries = await Promise.allSettled(Object.entries(api).map(async ([key,url]) => [key,await getJson(url)]));
  for (const item of entries) {
    if (item.status !== 'fulfilled') continue;
    const [key,value] = item.value;
    snapshot[key] = value;
  }
  enhance();
}

function activeRecommendation() { return snapshot.intelligence?.activeRecommendation || null; }
function readiness() { return snapshot.runtime?.renderContract?.readiness || null; }
function recommendation() { return activeRecommendation()?.explanation?.recommendation || {}; }
function athleteFacing() { return activeRecommendation()?.explanation?.athleteFacing || {}; }
function evidence() { return activeRecommendation()?.explanation?.evidence || []; }
function primaryObjectiveFact() { return evidence().find(x => String(x.ref||'').startsWith('objective:'))?.fact || 'Primary objective context is not currently available.'; }
function primaryObjectiveName() {
  const fact = primaryObjectiveFact();
  const marker = ' is the resolved PRIMARY objective';
  return fact.includes(marker) ? fact.split(marker)[0] : 'Primary objective';
}
function eventFacts() { return evidence().filter(x => String(x.ref||'').startsWith('event:')).slice(0,3); }
function first(items, fallback='—') { return Array.isArray(items) && items.length ? items[0] : fallback; }

function insertAfter(reference, node) {
  if (!reference?.parentNode) return;
  reference.parentNode.insertBefore(node, reference.nextSibling);
}
function section(markup, marker) {
  const div = document.createElement('div');
  div.className = 'section fz-context-recovery-section';
  div.dataset.fzContextRecovery = marker;
  div.innerHTML = markup;
  return div;
}

function renderTodayContext() {
  const root = document.getElementById('today');
  if (!root || root.querySelector('[data-fz-context-recovery="today-decision"]')) return;
  const hero = root.querySelector('.fz-clean-hero');
  if (!hero) return;

  const r = readiness();
  const active = activeRecommendation();
  const rec = recommendation();
  const facing = athleteFacing();
  const events = eventFacts();
  const lane = active?.fzRecommendedLane || r?.recommendationLane || '—';
  const confidence = active?.confidence || '—';

  const decision = section(`
    <div class="section-head"><h2>Decision Context</h2><p>Why the current lane exists · what it protects · what changes it</p></div>
    <div class="fz-context-grid">
      <div class="card rich fz-context-card"><div class="eyebrow">WHY NOW</div><h3>${esc(lane)} · ${esc(confidence)} confidence</h3><p>${esc(facing.whyNow || r?.primaryDecision || 'Current decision context is unavailable.')}</p></div>
      <div class="card rich fz-context-card"><div class="eyebrow">SYSTEMIC RECOVERY</div><h3>Current capacity</h3><p>${esc(r?.systemicRecovery || 'No current systemic interpretation available.')}</p></div>
      <div class="card rich fz-context-card"><div class="eyebrow">LOCAL / CONSTRAINT</div><h3>What can still limit execution</h3><p>${esc(r?.localTissueState || first(rec.stopModifyConditions,'No current local constraint has been recorded.'))}</p></div>
      <div class="card rich fz-context-card"><div class="eyebrow">SUCCESS CONDITION</div><h3>What a good decision looks like</h3><p>${esc(first(rec.successConditions,r?.successCriteria || 'Reassess when material new evidence arrives.'))}</p></div>
    </div>`, 'today-decision');
  insertAfter(hero, decision);

  const physiology = [...root.querySelectorAll('.section')].find(x => x.querySelector('h2')?.textContent?.trim() === 'Live Physiology');
  const objective = section(`
    <div class="section-head"><h2>Objective & Event Context</h2><p>Current recommendation stays connected to the race calendar rather than living as a readiness score</p></div>
    <div class="card rich fz-objective-anchor"><div class="eyebrow">PRIMARY OBJECTIVE</div><h3>${esc(facing.objectiveConnection || 'Objective connection')}</h3><p>${esc(primaryObjectiveFact())}</p></div>
    ${events.length ? `<div class="fz-event-context-grid">${events.map(item => `<div class="event-role"><div class="eyebrow">EVENT CONTEXT</div><p>${esc(item.fact)}</p></div>`).join('')}</div>` : ''}
    <div class="fz-decision-foot"><b>Expected benefit</b><span>${esc(rec.expectedBenefit || '—')}</span><b>Expected cost</b><span>${esc(rec.expectedCost || '—')}</span></div>`, 'today-objective');
  if (physiology) insertAfter(physiology, objective);
}

function sourceSummary(session) {
  const sources = Array.isArray(session?.sources) ? session.sources : [];
  const candidates = sources.map(source => ({source, summary:source?.payload?.summary || {}})).filter(x => x.summary && typeof x.summary === 'object');
  candidates.sort((a,b) => {
    const ad = a.source?.payload?.detailLevel === 'activity-detail' ? 1 : 0;
    const bd = b.source?.payload?.detailLevel === 'activity-detail' ? 1 : 0;
    return bd-ad;
  });
  const best = candidates[0]?.summary || {};
  return {
    duration: number(best.durationTotal ?? best.duration ?? session?.events?.find(e=>e.event_type==='EXECUTED')?.payload?.durationSeconds),
    avgHr: number(best.heartrate ?? session?.events?.find(e=>e.event_type==='EXECUTED')?.payload?.averageHeartRate),
    maxHr: number(best.heartrateMax),
    calories: number(best.calories),
    power: number(best.power),
    pace: number(best.pace),
    effort: number(best?.effort?.heartrate),
    zones: Array.isArray(best?.zonesDistribution?.heartrate) ? best.zonesDistribution.heartrate : session?.classification?.physiology?.hrIntensitySeconds || null
  };
}
function athleteEvents(session) {
  return (session?.events || []).filter(e => e.actor === 'ATHLETE').sort((a,b) => new Date(b.occurred_at)-new Date(a.occurred_at));
}
function executionCard(session) {
  const metrics = sourceSummary(session);
  const events = athleteEvents(session);
  const sources = [...new Set((session?.sources || []).map(s=>s.source_key).filter(Boolean))];
  const zoneTotal = Array.isArray(metrics.zones) ? metrics.zones.reduce((a,b)=>a+Number(b||0),0) : 0;
  const lowShare = zoneTotal ? Number(metrics.zones[0]||0)/zoneTotal : null;
  return `<article class="card rich fz-execution-card">
    <div class="fz-execution-head"><div><div class="eyebrow">${esc(String(session.local_date||'').slice(0,10))}</div><h3>${esc(session.title || session.sport_type || 'Training')}</h3></div><span class="pill">${esc(words(session.status))}</span></div>
    <div class="fz-execution-metrics">
      ${metrics.duration!==null?`<span><b>${fmt(minutes(metrics.duration),1)}</b> min</span>`:''}
      ${metrics.avgHr!==null?`<span><b>${fmt(metrics.avgHr)}</b> avg HR</span>`:''}
      ${metrics.maxHr!==null?`<span><b>${fmt(metrics.maxHr)}</b> max HR</span>`:''}
      ${metrics.calories!==null?`<span><b>${fmt(metrics.calories)}</b> kcal</span>`:''}
      ${metrics.effort!==null?`<span><b>${fmt(metrics.effort)}</b> HR effort</span>`:''}
      ${lowShare!==null?`<span><b>${fmt(lowShare*100,0)}%</b> low HR</span>`:''}
    </div>
    <div class="fz-execution-source">${esc(sources.join(' + ') || 'canonical')} · ${esc(words(session.reconciliation_state || 'canonical'))}</div>
    ${events.length?`<div class="fz-execution-voice"><small>ATHLETE VOICE</small><p>${esc(events[0].summary)}</p></div>`:'<p class="muted">No athlete-response event is linked to this execution.</p>'}
  </article>`;
}

function renderTrainContext() {
  const root = document.getElementById('train');
  if (!root || root.querySelector('[data-fz-context-recovery="train-intent"]')) return;
  const firstSection = root.querySelector('.section');
  if (!firstSection) return;
  const active = activeRecommendation();
  const rec = recommendation();
  const facing = athleteFacing();
  const sessions = (snapshot.training?.sessions || []).filter(s=>s.status!=='SUPERSEDED').sort((a,b)=>new Date(b.actual_start_at||b.local_date)-new Date(a.actual_start_at||a.local_date));
  const latest = sessions.slice(0,3);

  const intent = section(`
    <div class="section-head"><h2>Current Training Direction</h2><p>4.3 sets the training lane and guardrails · session composition remains separate</p></div>
    <div class="fz-train-direction">
      <div class="card decision rich"><div class="eyebrow">ACTIVE LANE</div><h3>${esc(active?.fzRecommendedLane || 'AWAITING RECOMMENDATION')}</h3><p>${esc(facing.headline || facing.whyNow || 'Current active recommendation is unavailable.')}</p><div class="microline"><strong>Why:</strong> ${esc(rec.whyThisLane || facing.whyNow || '—')}</div></div>
      <div class="card rich"><div class="eyebrow">OBJECTIVE CONNECTION</div><h3>What this protects</h3><p>${esc(facing.objectiveConnection || primaryObjectiveFact())}</p><div class="microline"><strong>Expected benefit:</strong> ${esc(rec.expectedBenefit || '—')} · <strong>cost:</strong> ${esc(rec.expectedCost || '—')}</div></div>
    </div>
    <div class="fz-train-guardrails">
      <div><small>SUCCESS</small><p>${esc(first(rec.successConditions,'Achieve the intended effect without materially worsening the next valuable training opportunity.'))}</p></div>
      <div><small>MODIFY / STOP</small><p>${esc(first(rec.stopModifyConditions,'Modify when new pain, illness, GI, local-tissue or recovery evidence materially changes tolerance.'))}</p></div>
      <div><small>BOUNDARY</small><p>4.3 does not fabricate a detailed session prescription. Concrete session options belong to the controlled 4.4 composer.</p></div>
    </div>`, 'train-intent');
  root.insertBefore(intent, firstSection);

  if (latest.length) {
    const executions = section(`
      <div class="section-head"><h2>Latest Executions & Response</h2><p>Canonical execution detail + Athlete Voice · not a duplicate activity feed</p></div>
      <div class="fz-execution-grid">${latest.map(executionCard).join('')}</div>`, 'train-executions');
    insertAfter(intent, executions);
  }
}

function tagCapabilities(root) {
  const cards = [...root.querySelectorAll('.fz-clean-cap-grid .cap')];
  for (const card of cards) {
    const priority = card.querySelector('.cap-pri')?.textContent?.trim() || '';
    card.classList.remove('fz-cap-primary','fz-cap-secondary','fz-cap-support');
    if (/Priority [1-3]/i.test(priority)) card.classList.add('fz-cap-primary');
    else if (/Priority [4-5]/i.test(priority)) card.classList.add('fz-cap-secondary');
    else card.classList.add('fz-cap-support');

    if (!card.querySelector('.fz-cap-detail')) {
      const name = card.querySelector('.cap-name')?.textContent?.trim();
      const cap = (snapshot.trends?.capabilities || []).find(x => x.name === name);
      if (cap) {
        const details = document.createElement('details');
        details.className = 'fz-cap-detail';
        details.innerHTML = `<summary>Evidence detail</summary><div><small>Observation</small><p>${esc(cap.obs)}</p><small>Inference</small><p>${esc(cap.inf)}</p><small>Coaching judgement</small><p>${esc(cap.decision)}</p></div>`;
        card.appendChild(details);
      }
    }
  }
}

function enhanceTrends() {
  const root = document.getElementById('trends');
  if (!root) return;
  const sections = [...root.querySelectorAll(':scope > .section')];
  const firstSection = sections[0];
  if (firstSection && !root.querySelector('[data-fz-context-recovery="trends-objective"]')) {
    const active = activeRecommendation();
    const facing = athleteFacing();
    const objectiveName = primaryObjectiveName();
    const objective = section(`
      <div class="section-head"><h2>Primary Objective Lens</h2><p>Primary objective → current lane → biggest unresolved measurement</p></div>
      <div class="fz-objective-lens">
        <div><small>PRIMARY</small><b>${esc(objectiveName)}</b><p>${esc(primaryObjectiveFact())}</p></div>
        <div><small>CURRENT LANE</small><b>${esc(active?.fzRecommendedLane || '—')}</b><p>${esc(facing.whyNow || 'Current recommendation context unavailable.')}</p></div>
        <div><small>OBJECTIVE CONNECTION</small><b>What matters next</b><p>${esc(facing.objectiveConnection || '—')}</p></div>
      </div>`, 'trends-objective');
    insertAfter(firstSection, objective);
  }

  for (const sectionEl of root.querySelectorAll(':scope > .section')) {
    const title = sectionEl.querySelector('.section-head h2')?.textContent?.trim();
    if (['Recovery Response','Exposure Cost','Performance Trajectory'].includes(title)) sectionEl.classList.add('fz-supporting-evidence-section');
    if (title === 'Trajectory & Measurement Gaps') {
      const h2 = sectionEl.querySelector('.section-head h2');
      const p = sectionEl.querySelector('.section-head p');
      if (h2) h2.textContent = 'Primary Objective Capability Priorities';
      if (p) p.textContent = 'Priority hierarchy first · evidence detail available without turning the page into a wall of cards';
    }
  }
  tagCapabilities(root);
}

function enhance() {
  if (enhancing) return;
  enhancing = true;
  try {
    renderTodayContext();
    renderTrainContext();
    enhanceTrends();
  } finally {
    enhancing = false;
  }
}

const observer = new MutationObserver(() => {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(enhance, 30);
});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',refreshSnapshot);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSnapshot();});
setTimeout(refreshSnapshot,0);
setInterval(()=>{if(document.visibilityState==='visible')refreshSnapshot();},60000);
