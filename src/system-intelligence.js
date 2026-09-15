const FZ_SYSTEM_INTELLIGENCE={system:null,training:null,trends:null,originalFetch:window.fetch.bind(window),mountedRoot:null,observer:null,observerConnected:false,renderScheduled:false,rendering:false};

function canonicalRoute(input){
  const raw=typeof input==='string'?input:input?.url;
  if(!raw)return null;
  try{
    const url=new URL(raw,window.location.origin);
    if(url.origin!==window.location.origin)return null;
    if(url.pathname==='/api/system/status')return 'system';
    if(url.pathname==='/api/training/memory')return 'training';
    if(url.pathname==='/api/trends/current')return 'trends';
    return null;
  }catch{return null;}
}

function scheduleRenderObservability(){
  if(FZ_SYSTEM_INTELLIGENCE.renderScheduled)return;
  FZ_SYSTEM_INTELLIGENCE.renderScheduled=true;
  queueMicrotask(()=>{
    FZ_SYSTEM_INTELLIGENCE.renderScheduled=false;
    renderObservability();
  });
}

function captureCanonicalResponse(response,route){
  if(!response?.ok||!route)return;
  response.clone().json().then(payload=>{
    if(!payload?.ok)return;
    FZ_SYSTEM_INTELLIGENCE[route]=payload;
    scheduleRenderObservability();
  }).catch(()=>{});
}

window.fetch=async function fzSystemIntelligenceFetch(input,init){
  const route=canonicalRoute(input);
  const response=await FZ_SYSTEM_INTELLIGENCE.originalFetch(input,init);
  if(route)captureCanonicalResponse(response,route);
  return response;
};

function esc(value){return String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtTime(value){if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';return new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
function words(value){return String(value||'—').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function tone(level){if(level==='SAFETY_OVERRIDE'||level==='ABSORB'||level==='WITHHELD')return 'bad';if(level==='RECOMPUTE_RECOMMENDATION'||level==='MAINTAIN')return 'warn';return 'good';}
function sourceTone(status){const s=String(status||'').toUpperCase();if(/ERROR|FAILED|DISCONNECTED|INVALID/.test(s))return 'bad';if(/PENDING|STALE|DELAYED|UNKNOWN/.test(s))return 'warn';return 'good';}

function trustModel(){
  const system=FZ_SYSTEM_INTELLIGENCE.system||{};
  const training=FZ_SYSTEM_INTELLIGENCE.training||{};
  const trends=FZ_SYSTEM_INTELLIGENCE.trends||{};
  const current=system?.intelligence?.current||{};
  const pending=current?.pending||{};
  const integrity=training?.integrity||{};
  const quality=trends?.quality||{};
  const release=system?.releaseEnvironment||{};
  const sources=Array.isArray(system?.sources)?system.sources:[];
  const exceptions=[];

  if(system?.runtime&&system.runtime.masterValidated!==true)exceptions.push({severity:'bad',title:'Canonical runtime validation',detail:'The current runtime master is not validated.'});
  if(current?.pendingPropagation===true||Object.values(pending).some(Boolean))exceptions.push({severity:'warn',title:'Intelligence propagation',detail:'One or more canonical dependants are still pending reconciliation.'});
  const unresolved=Number(integrity.unlinkedSessionFeedback||0);
  if(unresolved>0)exceptions.push({severity:'warn',title:'Athlete Memory reconciliation',detail:`${unresolved} athlete-response item(s) are not yet linked to a canonical session.`});
  const missingDates=Array.isArray(quality.loadMissingDates)?quality.loadMissingDates:[];
  if(missingDates.length)exceptions.push({severity:'warn',title:'Training evidence completeness',detail:`${missingDates.length} day(s) are waiting for HR-zone detail; they remain gaps, not zeroes.`});
  for(const source of sources){
    if(sourceTone(source?.status)!=='good')exceptions.push({severity:sourceTone(source?.status),title:`${words(source?.source_key)} source`,detail:`Status ${words(source?.status)}${source?.last_error?` · ${source.last_error}`:''}.`});
  }
  if(release.databaseConfigured===false)exceptions.push({severity:'bad',title:'Operational database',detail:'The production runtime database probe is not configured.'});
  if(system?.tredict?.configured===false)exceptions.push({severity:'warn',title:'Tredict source',detail:'Tredict is not configured for this release environment.'});

  const blockers=exceptions.filter(x=>x.severity==='bad').length;
  return {
    exceptions,
    label:blockers?'ATTENTION REQUIRED':exceptions.length?'WATCH':'TRUSTED',
    tone:blockers?'bad':exceptions.length?'warn':'good',
    message:blockers?'A system-integrity blocker is active.':exceptions.length?'Canonical truth is available, with one or more items that still need attention.':'Canonical truth, propagation and source integrity are clear in the current view.'
  };
}

function statusPill(label,value,toneClass='good',note=''){
  return `<div class="fz-system-status-card"><small>${esc(label)}</small><b class="${esc(toneClass)}">${esc(value)}</b>${note?`<p>${esc(note)}</p>`:''}</div>`;
}

function systemTrustShell(){
  const system=FZ_SYSTEM_INTELLIGENCE.system||{};
  const training=FZ_SYSTEM_INTELLIGENCE.training||{};
  const trends=FZ_SYSTEM_INTELLIGENCE.trends||{};
  const trust=trustModel();
  const current=system?.intelligence?.current||{};
  const pending=current?.pending||{};
  const runtime=system?.runtime||{};
  const architecture=system?.architecture||{};
  const release=system?.releaseEnvironment||{};
  const sources=Array.isArray(system?.sources)?system.sources:[];
  const freshness=trends?.freshness||{};
  const integrity=training?.integrity||{};
  const quality=trends?.quality||{};
  const exceptionHtml=trust.exceptions.length?trust.exceptions.map(item=>`<div class="fz-system-exception ${esc(item.severity)}"><span class="fz-system-exception-dot"></span><div><b>${esc(item.title)}</b><p>${esc(item.detail)}</p></div></div>`).join(''):`<div class="fz-system-clear"><span>✓</span><div><b>No active integrity exceptions</b><p>Nothing is currently waiting, stale, invalid or unresolved in the canonical trust chain represented here.</p></div></div>`;
  const sourceHtml=sources.length?sources.map(source=>`<div class="fz-system-source"><div><small>${esc(words(source.source_key))}</small><b>${esc(words(source.status||'UNKNOWN'))}</b></div><span class="pill ${sourceTone(source.status)}">${esc(source.last_sync_at?fmtTime(source.last_sync_at):'No sync')}</span>${source.last_error?`<p>${esc(source.last_error)}</p>`:''}</div>`).join(''):'<div class="fz-system-empty">No source-connection rows are available in the current SYSTEM contract.</div>';
  const pendingCount=Object.values(pending).filter(Boolean).length;
  const unresolved=Number(integrity.unlinkedSessionFeedback||0);
  const missing=Array.isArray(quality.loadMissingDates)?quality.loadMissingDates.length:0;

  return `<div class="fz-system-v1" data-system-rationalized="1">
    <section class="fz-system-hero ${esc(trust.tone)}">
      <div class="fz-system-hero-copy"><div class="eyebrow">SYSTEM TRUST</div><div class="fz-system-trust-line"><span class="fz-system-trust-dot"></span><strong>${esc(trust.label)}</strong></div><h2>Can I trust what FZ is showing right now?</h2><p>${esc(trust.message)}</p></div>
      <div class="fz-system-hero-meta">
        ${statusPill('Runtime',runtime.masterValidated===true?'VALIDATED':'CHECK',runtime.masterValidated===true?'good':'bad',runtime.stateId?`State ${runtime.stateId}`:'No runtime state ID')}
        ${statusPill('Propagation',pendingCount?`${pendingCount} PENDING`:'CLEAR',pendingCount?'warn':'good',current?.revision?`Revision ${current.revision}`:'Current intelligence revision')}
        ${statusPill('Training evidence',missing?`${missing} GAPS`:'CURRENT',missing?'warn':'good',freshness.latestTrainingEvidenceAt?`Latest ${fmtTime(freshness.latestTrainingEvidenceAt)}`:'Latest evidence time unavailable')}
      </div>
    </section>

    <section class="section fz-system-attention"><div class="section-head"><h2>Attention First</h2><p>Only exceptions, stale state and unresolved reconciliation belong at the top of SYSTEM.</p></div><div class="fz-system-exception-list">${exceptionHtml}</div></section>

    <section class="section fz-system-chain"><div class="section-head"><h2>Canonical Trust Chain</h2><p>Source evidence → canonical persistence → reconciliation → intelligence → athlete-facing projection.</p></div><div class="fz-system-chain-grid">
      ${statusPill('Operational truth',architecture.operationalTruth||'—',runtime.masterValidated===true?'good':'warn',runtime.masterAsOf?`Master ${fmtTime(runtime.masterAsOf)}`:'Master timestamp unavailable')}
      ${statusPill('Athlete Memory',unresolved?`${unresolved} UNRESOLVED`:'RECONCILED',unresolved?'warn':'good',system?.athleteMemory?.latest_event?`Latest ${fmtTime(system.athleteMemory.latest_event)}`:`${Number(system?.athleteMemory?.events||0)} canonical event(s)`) }
      ${statusPill('Readiness',current?.currentReadiness?.status||'AVAILABLE',current?.pending?.readiness?'warn':'good',current?.currentReadiness?.score!==undefined?`Score ${current.currentReadiness.score} · ${words(current.currentReadiness.confidence||'')}`:'Canonical readiness state')}
      ${statusPill('TODAY projection',current?.pending?.activeRecommendation?'PENDING':'CURRENT',current?.pending?.activeRecommendation?'warn':'good',current?.activeRecommendation?.fzRecommendedLane?`Lane ${words(current.activeRecommendation.fzRecommendedLane)}`:'Projection state is canonical')}
    </div></section>

    <div data-system-adaptive-anchor></div>
    <div data-system-integrity-anchor></div>

    <section class="section fz-system-sources"><div class="section-head"><h2>Source Health</h2><p>Connectivity and freshness only; source telemetry is subordinate unless it threatens canonical trust.</p></div><div class="fz-system-source-grid">${sourceHtml}</div></section>

    <section class="section fz-system-provenance"><div class="section-head"><h2>Provenance & Release</h2><p>Owner/operator detail remains available without dominating Athlete Mode.</p></div><div class="fz-system-details-grid">
      <details><summary>Runtime provenance</summary><dl><dt>Operational truth</dt><dd>${esc(architecture.operationalTruth||'—')}</dd><dt>Recommendation truth</dt><dd>${esc(architecture.recommendationTruth||'—')}</dd><dt>Audit representation</dt><dd>${esc(architecture.auditRepresentation||'—')} · ${esc(architecture.driveRole||'—')}</dd><dt>Runtime store</dt><dd>${esc(architecture.runtimeStoreMode||'—')}</dd></dl></details>
      <details><summary>Release environment</summary><dl><dt>Database probe</dt><dd>${release.databaseConfigured?'Configured':'Not configured'}</dd><dt>Write-token probe</dt><dd>${release.writeTokenConfigured?'Configured':'Not configured'}</dd><dt>Athlete bootstrap</dt><dd>${release.athleteBootstrapConfigured?'Configured':'Not configured'}</dd><dt>Exact preview gate</dt><dd>${release.previewMustPassBeforePromotion?'Required':'Not asserted'}</dd><dt>Secrets exposed</dt><dd>${release.secretsExposed===false?'No':'Unexpected state'}</dd></dl></details>
    </div></section>
  </div>`;
}

function materialitySection(payload){
  const materiality=payload?.intelligence?.materiality;
  if(!materiality)return null;
  const latest=Array.isArray(materiality.assessments)?materiality.assessments[0]:null;
  const m=latest?.materiality||null;
  const reasons=Array.isArray(m?.reasonCodes)?m.reasonCodes.slice(0,3).map(words).join(' · '):'No materiality assessment persisted yet.';
  const domains=Array.isArray(m?.affectedDomains)?m.affectedDomains.slice(0,4).map(words).join(' · '):'—';
  const summary=latest?.evidenceSummary||'The engine is active and waiting for new canonical evidence.';
  return `<div class="section fz-system-adaptive" data-materiality-observability data-dynamic-source="intelligence"><div class="section-head"><h2>Adaptive Intelligence</h2><p>Materiality is visible and auditable; material evidence can trigger the recommendation pipeline.</p></div><div class="status-grid"><div class="status-card"><small>Materiality engine</small><b class="good">v${esc(materiality.engineVersion||'—')}</b><p>${Number(materiality.count||0)} recent persisted assessment(s) in this view.</p></div><div class="status-card"><small>Latest materiality</small><b class="${tone(m?.level)}">${esc(words(m?.level||'NO ASSESSMENT'))}</b><p>${latest?`Assessed ${esc(fmtTime(latest.assessedAt))}`:'No assessment persisted yet.'}</p></div><div class="status-card"><small>State update</small><b class="${m?.shouldUpdateState?'warn':'good'}">${m?.shouldUpdateState?'REQUESTED':'NO CHANGE'}</b><p>${esc(domains)}</p></div><div class="status-card"><small>Recommendation trigger</small><b class="${m?.blocksExistingRecommendation?'bad':m?.shouldRecomputeRecommendation?'warn':'good'}">${m?.blocksExistingRecommendation?'BLOCKED':m?.shouldRecomputeRecommendation?'RECOMPUTE':'UNCHANGED'}</b><p>Materiality preserves the audit decision before athlete-facing projection.</p></div></div><div class="card rich"><div class="eyebrow">LATEST EVIDENCE ASSESSMENT</div><h3>${esc(words(latest?.sourceType||'Waiting for evidence'))}</h3><p>${esc(summary)}</p><div class="microline"><strong>Why:</strong> ${esc(reasons)}</div></div></div>`;
}

function recommendationShadowSection(payload){
  const shadow=payload?.intelligence?.recommendationShadow;
  if(!shadow)return null;
  const current=payload?.intelligence?.current||null;
  const active=current?.activeRecommendation||null;
  const latest=Array.isArray(shadow.evaluations)?shadow.evaluations[0]:null;
  const objective=latest?.contextSummary?.primaryObjective;
  const gap=latest?.contextSummary?.topMeasurementGaps?.[0];
  const why=latest?.explanation?.athleteFacing?.whyNow||latest?.explanation?.recommendation?.whyThisLane||'No shadow recommendation has been persisted yet.';
  const activeMatches=Boolean(active&&latest?.recommendationId&&active.shadowRecommendationId===latest.recommendationId&&active.contextFingerprint&&current?.dependencyState?.activeMatchesShadow!==false);
  const activeLabel=active?.status==='WITHHELD'?'WITHHELD':active?.fzRecommendedLane||active?.status||'WAITING';
  const activeText=activeMatches?'4.3 projection matches the latest immutable shadow.':active?'Active projection is stale or pending convergence.':'No active 4.3 projection has been persisted yet.';
  return `<div class="section fz-system-audit" data-recommendation-shadow data-dynamic-source="recommendation-shadow"><div class="section-head"><h2>Recommendation Audit</h2><p>4.2 immutable decision trace → Tranche 4.3 controlled athlete-facing projection</p></div><div class="status-grid"><div class="status-card"><small>Shadow engine</small><b class="good">${esc(shadow.engineVersion||'—')}</b><p>${esc(words(shadow.mode||'SHADOW'))} · ${Number(shadow.count||0)} recent evaluation(s).</p></div><div class="status-card"><small>Latest audited lane</small><b class="${tone(latest?.lane)}">${esc(words(latest?.lane||latest?.status||'WAITING'))}</b><p>${latest?`Evaluated ${esc(fmtTime(latest.evaluatedAt))}`:'Waiting for a material recomputation trigger.'}</p></div><div class="status-card"><small>Confidence</small><b class="${latest?.confidence==='LOW'?'warn':'good'}">${esc(words(latest?.confidence||'—'))}</b><p>${gap?`Top unknown: ${esc(words(gap.measurementId))}`:'No top measurement gap recorded in this view.'}</p></div><div class="status-card"><small>Active TODAY projection</small><b class="${activeMatches?'good':active?'warn':'good'}">${esc(words(activeLabel))}</b><p>${esc(activeText)}</p></div></div><div class="card rich"><div class="eyebrow">LATEST AUDITED DECISION</div><h3>${esc(objective?.name||'No active shadow evaluation yet')}</h3><p>${esc(why)}</p><div class="microline"><strong>Trigger:</strong> ${esc(words(latest?.trigger?.materialityLevel||latest?.trigger?.type||'—'))} · <strong>Recommendation ID:</strong> ${esc(latest?.recommendationId||'—')}</div></div></div>`;
}

function dynamicIntegritySection(){
  const training=FZ_SYSTEM_INTELLIGENCE.training;
  const trends=FZ_SYSTEM_INTELLIGENCE.trends;
  if(!training&&!trends)return null;
  const integrity=training?.integrity||{},quality=trends?.quality||{},freshness=trends?.freshness||{},intent=trends?.trainingIntent?.counts||{};
  const pending=Array.isArray(quality.loadMissingDates)?quality.loadMissingDates.length:0,unresolved=Number(integrity.unlinkedSessionFeedback||0),enriched=Number(quality.historicallyEnrichedSessions||0);
  return `<div class="section fz-system-integrity" data-dynamic-integrity data-dynamic-source="runtime-integrity"><div class="section-head"><h2>Dynamic Runtime Integrity</h2><p>Live source evidence → canonical persistence → late reconciliation → Trends derivation · no shell deployment</p></div><div class="status-grid"><div class="status-card"><small>Training evidence</small><b class="good">DYNAMIC</b><p>Latest evidence ${esc(fmtTime(freshness.latestTrainingEvidenceAt))} · persisted-first source reconciliation.</p></div><div class="status-card"><small>Athlete Memory links</small><b class="${unresolved?'warn':'good'}">${unresolved?`${unresolved} UNRESOLVED`:'RECONCILED'}</b><p>${Number(integrity.lateLinkedAthleteEvents||0)} late-bound event(s) in the current memory window.</p></div><div class="status-card"><small>NCL evidence</small><b class="${pending?'warn':'good'}">${pending?`${pending} PENDING`:'COMPLETE'}</b><p>${esc(words(quality.evidencePolicy||'MONOTONIC BEST AVAILABLE'))} · ${enriched} session(s) protected from sparse-source regression.</p></div><div class="status-card"><small>Inferred intent</small><b class="good">A ${Number(intent.ABSORB||0)} · M ${Number(intent.MAINTAIN||0)} · D ${Number(intent.ADAPT||0)}</b><p>Historical lanes remain descriptive evidence; TODAY follows only the current canonical 4.3 projection.</p></div></div></div>`;
}

function placeSection(attribute,html,afterAttribute=null){
  const root=document.getElementById('system');
  if(!root||!html)return false;
  const existing=root.querySelector(`[${attribute}]`);
  if(existing){if(existing.outerHTML!==html)existing.outerHTML=html;return true;}
  const after=afterAttribute?root.querySelector(`[${afterAttribute}]`):null;
  if(after)after.insertAdjacentHTML('afterend',html);
  else{const first=root.querySelector(':scope > .section');if(first)first.insertAdjacentHTML('afterend',html);else root.insertAdjacentHTML('beforeend',html);}
  return true;
}

function ensureRationalizedShell(){
  const root=document.getElementById('system');
  if(!root||!FZ_SYSTEM_INTELLIGENCE.system)return false;
  if(!root.querySelector('[data-system-rationalized]'))root.innerHTML=systemTrustShell();
  root.classList.add('fz-system-page');
  return true;
}

function observeSystemRoot(){
  const root=document.getElementById('system'),observer=FZ_SYSTEM_INTELLIGENCE.observer;
  if(!root||!observer)return;
  observer.disconnect();
  observer.observe(root,{childList:true,subtree:false});
  FZ_SYSTEM_INTELLIGENCE.observerConnected=true;
}

function renderObservability(){
  if(FZ_SYSTEM_INTELLIGENCE.rendering)return;
  FZ_SYSTEM_INTELLIGENCE.rendering=true;
  const observer=FZ_SYSTEM_INTELLIGENCE.observer;
  if(observer)observer.disconnect();
  try{
    if(!ensureRationalizedShell())return;
    placeSection('data-materiality-observability',materialitySection(FZ_SYSTEM_INTELLIGENCE.system),'data-system-adaptive-anchor');
    placeSection('data-recommendation-shadow',recommendationShadowSection(FZ_SYSTEM_INTELLIGENCE.system),'data-materiality-observability');
    placeSection('data-dynamic-integrity',dynamicIntegritySection(),'data-system-integrity-anchor');
    FZ_SYSTEM_INTELLIGENCE.mountedRoot=document.getElementById('system');
  }finally{
    FZ_SYSTEM_INTELLIGENCE.rendering=false;
    observeSystemRoot();
  }
}

const observer=new MutationObserver(()=>{scheduleRenderObservability();});
FZ_SYSTEM_INTELLIGENCE.observer=observer;
function startSystemIntelligence(){observeSystemRoot();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startSystemIntelligence,{once:true});else startSystemIntelligence();
