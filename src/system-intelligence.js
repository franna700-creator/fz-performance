const FZ_SYSTEM_INTELLIGENCE = {
  payload: null,
  originalFetch: window.fetch.bind(window),
  mountedRoot: null
};

function systemStatusUrl(input) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/api/system/status' ? url : null;
  } catch {
    return null;
  }
}

function captureSystemStatus(response) {
  if (!response?.ok) return;
  response.clone().json().then(payload => {
    if (!payload?.ok) return;
    FZ_SYSTEM_INTELLIGENCE.payload = payload;
    queueMicrotask(renderMaterialityObservability);
  }).catch(() => {});
}

window.fetch = async function fzSystemIntelligenceFetch(input, init) {
  const requestUrl = systemStatusUrl(input);
  const response = await FZ_SYSTEM_INTELLIGENCE.originalFetch(input, init);
  if (requestUrl) captureSystemStatus(response);
  return response;
};

function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d);
}

function words(value) {
  return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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
  const level = m?.level || 'NO ASSESSMENT';
  const reasons = Array.isArray(m?.reasonCodes) ? m.reasonCodes.slice(0, 3).map(words).join(' · ') : 'No materiality assessment persisted yet.';
  const domains = Array.isArray(m?.affectedDomains) ? m.affectedDomains.slice(0, 4).map(words).join(' · ') : '—';
  const summary = latest?.evidenceSummary || 'The engine is active and waiting for new canonical evidence.';
  return `
    <div class="section" data-materiality-observability data-dynamic-source="intelligence">
      <div class="section-head"><h2>Adaptive Intelligence</h2><p>Tranche 4.1 materiality · visible and auditable · recommendation recomputation remains a 4.2 boundary</p></div>
      <div class="status-grid">
        <div class="status-card"><small>Materiality engine</small><b class="good">v${materiality.engineVersion || '—'}</b><p>${materiality.count || 0} recent persisted assessment(s) in this view.</p></div>
        <div class="status-card"><small>Latest materiality</small><b class="${tone(m?.level)}">${words(level)}</b><p>${latest ? `Assessed ${fmtTime(latest.assessedAt)}` : 'No assessment persisted yet.'}</p></div>
        <div class="status-card"><small>State update</small><b class="${m?.shouldUpdateState ? 'warn' : 'good'}">${m?.shouldUpdateState ? 'REQUESTED' : 'NO CHANGE'}</b><p>${domains}</p></div>
        <div class="status-card"><small>Recommendation</small><b class="${m?.blocksExistingRecommendation ? 'bad' : m?.shouldRecomputeRecommendation ? 'warn' : 'good'}">${m?.blocksExistingRecommendation ? 'BLOCKED' : m?.shouldRecomputeRecommendation ? 'RECOMPUTE REQUESTED' : 'UNCHANGED'}</b><p>4.1 records the requirement; 4.2 will own actual recomputation.</p></div>
      </div>
      <div class="card rich"><div class="eyebrow">LATEST EVIDENCE ASSESSMENT</div><h3>${words(latest?.sourceType || 'Waiting for evidence')}</h3><p>${summary}</p><div class="microline"><strong>Why:</strong> ${reasons}</div></div>
    </div>`;
}

function renderMaterialityObservability() {
  const root = document.getElementById('system');
  const html = materialitySection(FZ_SYSTEM_INTELLIGENCE.payload);
  if (!root || !html) return;
  const existing = root.querySelector('[data-materiality-observability]');
  if (existing) existing.outerHTML = html;
  else {
    const first = root.querySelector(':scope > .section');
    if (first) first.insertAdjacentHTML('afterend', html);
    else root.insertAdjacentHTML('beforeend', html);
  }
  FZ_SYSTEM_INTELLIGENCE.mountedRoot = root.querySelector('[data-materiality-observability]');
}

const observer = new MutationObserver(() => {
  if (!FZ_SYSTEM_INTELLIGENCE.payload?.ok) return;
  const root = document.getElementById('system');
  if (root && !root.querySelector('[data-materiality-observability]')) queueMicrotask(renderMaterialityObservability);
});

function startSystemIntelligence() {
  const root = document.getElementById('system');
  if (root) observer.observe(root, { childList: true, subtree: false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSystemIntelligence, { once: true });
else startSystemIntelligence();
