const FZ_SYSTEM_INTELLIGENCE = {
  system: null,
  training: null,
  trends: null,
  originalFetch: window.fetch.bind(window),
  mountedRoot: null
};

function canonicalRoute(input) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === '/api/system/status') return 'system';
    if (url.pathname === '/api/training/memory') return 'training';
    if (url.pathname === '/api/trends/current') return 'trends';
    return null;
  } catch { return null; }
}

function captureCanonicalResponse(response, route) {
  if (!response?.ok || !route) return;
  response.clone().json().then(payload => {
    if (!payload?.ok) return;
    FZ_SYSTEM_INTELLIGENCE[route] = payload;
    queueMicrotask(renderObservability);
  }).catch(() => {});
}

window.fetch = async function fzSystemIntelligenceFetch(input, init) {
  const route = canonicalRoute(input);
  const response = await FZ_SYSTEM_INTELLIGENCE.originalFetch(input, init);
  if (route) captureCanonicalResponse(response, route);
  return response;
};

function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
function words(value) { return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function tone(level) {
  if (level === 'SAFETY_OVERRIDE') return 'bad';
  if (level === 'RECOMPUTE_RECOMMENDATION') return 'warn';
  return 'good';
}

function materialitySection(payload) {
  const materiality = payload?.intelligence?.materiality;
  if (!materiality) return null;
  const latest = Array.isArray(materiality.assessments) ? materiality.assessments[0] : null;
  const m = latest?.materiality || null;
  const reasons = Array.isArray(m?.reasonCodes) ? m.reasonCodes.slice(0, 3).map(words).join(' · ') : 'No materiality assessment persisted yet.';
  const domains = Array.isArray(m?.affectedDomains) ? m.affectedDomains.slice(0, 4).map(words).join(' · ') : '—';
  const summary = latest?.evidenceSummary || 'The engine is active and waiting for new canonical evidence.';
  return `<div class="section" data-materiality-observability data-dynamic-source="intelligence">
    <div class="section-head"><h2>Adaptive Intelligence</h2><p>Tranche 4.1 materiality · visible and auditable · recommendation recomputation remains a 4.2 boundary</p></div>
    <div class="status-grid">
      <div class="status-card"><small>Materiality engine</small><b class="good">v${materiality.engineVersion || '—'}</b><p>${materiality.count || 0} recent persisted assessment(s) in this view.</p></div>
      <div class="status-card"><small>Latest materiality</small><b class="${tone(m?.level)}">${words(m?.level || 'NO ASSESSMENT')}</b><p>${latest ? `Assessed ${fmtTime(latest.assessedAt)}` : 'No assessment persisted yet.'}</p></div>
      <div class="status-card"><small>State update</small><b class="${m?.shouldUpdateState ? 'warn' : 'good'}">${m?.shouldUpdateState ? 'REQUESTED' : 'NO CHANGE'}</b><p>${domains}</p></div>
      <div class="status-card"><small>Recommendation</small><b class="${m?.blocksExistingRecommendation ? 'bad' : m?.shouldRecomputeRecommendation ? 'warn' : 'good'}">${m?.blocksExistingRecommendation ? 'BLOCKED' : m?.shouldRecomputeRecommendation ? 'RECOMPUTE REQUESTED' : 'UNCHANGED'}</b><p>4.1 records the requirement; 4.2 will own actual recomputation.</p></div>
    </div>
    <div class="card rich"><div class="eyebrow">LATEST EVIDENCE ASSESSMENT</div><h3>${words(latest?.sourceType || 'Waiting for evidence')}</h3><p>${summary}</p><div class="microline"><strong>Why:</strong> ${reasons}</div></div>
  </div>`;
}

function dynamicIntegritySection() {
  const training = FZ_SYSTEM_INTELLIGENCE.training;
  const trends = FZ_SYSTEM_INTELLIGENCE.trends;
  if (!training && !trends) return null;
  const integrity = training?.integrity || {};
  const quality = trends?.quality || {};
  const freshness = trends?.freshness || {};
  const intent = trends?.trainingIntent?.counts || {};
  const pending = Array.isArray(quality.loadMissingDates) ? quality.loadMissingDates.length : 0;
  const unresolved = Number(integrity.unlinkedSessionFeedback || 0);
  const enriched = Number(quality.historicallyEnrichedSessions || 0);
  return `<div class="section" data-dynamic-integrity data-dynamic-source="runtime-integrity">
    <div class="section-head"><h2>Dynamic Runtime Integrity</h2><p>Live source evidence → canonical persistence → late reconciliation → Trends derivation · no shell deployment</p></div>
    <div class="status-grid">
      <div class="status-card"><small>Training evidence</small><b class="good">DYNAMIC</b><p>Latest evidence ${fmtTime(freshness.latestTrainingEvidenceAt)} · persisted-first source reconciliation.</p></div>
      <div class="status-card"><small>Athlete Memory links</small><b class="${unresolved ? 'warn' : 'good'}">${unresolved ? `${unresolved} UNRESOLVED` : 'RECONCILED'}</b><p>${Number(integrity.lateLinkedAthleteEvents || 0)} late-bound event(s) in the current memory window.</p></div>
      <div class="status-card"><small>NCL evidence</small><b class="${pending ? 'warn' : 'good'}">${pending ? `${pending} PENDING` : 'COMPLETE'}</b><p>${words(quality.evidencePolicy || 'MONOTONIC BEST AVAILABLE')} · ${enriched} session(s) protected from sparse-source regression.</p></div>
      <div class="status-card"><small>Inferred intent</small><b class="good">A ${Number(intent.ABSORB || 0)} · M ${Number(intent.MAINTAIN || 0)} · D ${Number(intent.ADAPT || 0)}</b><p>Historical ABSORB / MAINTAIN / ADAPT is descriptive evidence only; athlete choice activates later in Tranche 4.</p></div>
    </div>
  </div>`;
}

function placeSection(attribute, html, afterAttribute = null) {
  const root = document.getElementById('system');
  if (!root || !html) return;
  const existing = root.querySelector(`[${attribute}]`);
  if (existing) { existing.outerHTML = html; return; }
  const after = afterAttribute ? root.querySelector(`[${afterAttribute}]`) : null;
  if (after) after.insertAdjacentHTML('afterend', html);
  else {
    const first = root.querySelector(':scope > .section');
    if (first) first.insertAdjacentHTML('afterend', html);
    else root.insertAdjacentHTML('beforeend', html);
  }
}

function renderObservability() {
  placeSection('data-materiality-observability', materialitySection(FZ_SYSTEM_INTELLIGENCE.system));
  placeSection('data-dynamic-integrity', dynamicIntegritySection(), 'data-materiality-observability');
  FZ_SYSTEM_INTELLIGENCE.mountedRoot = document.getElementById('system');
}

const observer = new MutationObserver(() => {
  if (!FZ_SYSTEM_INTELLIGENCE.system?.ok && !FZ_SYSTEM_INTELLIGENCE.training?.ok && !FZ_SYSTEM_INTELLIGENCE.trends?.ok) return;
  queueMicrotask(renderObservability);
});
function startSystemIntelligence() {
  const root = document.getElementById('system');
  if (root) observer.observe(root, { childList: true, subtree: false });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSystemIntelligence, { once: true });
else startSystemIntelligence();
