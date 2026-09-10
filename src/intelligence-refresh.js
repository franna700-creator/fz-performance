const nativeFetch = window.fetch.bind(window);
const READ_PATHS = new Set(['/api/runtime-state','/api/wellness/today','/api/training/memory','/api/trends/current','/api/system/status']);
const responseCache = new Map();
const stalePaths = new Set();
let intelligence = null;
let revision = null;
let converging = false;
let refreshButtonBusy = false;
let initialIntelligenceApplied = false;
let intelligenceError = false;

function requestUrl(input) {
  try { return new URL(typeof input === 'string' ? input : input.url, window.location.href); }
  catch { return null; }
}
function methodOf(input, init = {}) { return String(init.method || input?.method || 'GET').toUpperCase(); }
function cloneJson(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function setText(element, value) { if (element && element.textContent !== value) element.textContent = value; }
function jsonResponse(payload, original, extraHeaders = {}) {
  const headers = new Headers(original?.headers || {});
  headers.set('Content-Type','application/json; charset=utf-8');
  for (const [key,value] of Object.entries(extraHeaders)) headers.set(key,value);
  return new Response(JSON.stringify(payload), { status: 200, statusText: 'OK', headers });
}
function activeText(active) {
  if (!active) return null;
  if (active.status === 'WITHHELD') return active.reason || 'FZ recommendation is withheld until the required decision context is available.';
  return active.explanation?.athleteFacing?.summary || active.explanation?.athleteFacing?.headline || active.reason || `FZ recommends ${String(active.fzRecommendedLane || '').toLowerCase()}.`;
}
function overlayRuntime(payload) {
  const active = intelligence?.activeRecommendation;
  if (!active || !payload?.renderContract?.readiness) return payload;
  const next = cloneJson(payload);
  const readiness = next.renderContract.readiness;
  readiness.primaryDecision = activeText(active) || readiness.primaryDecision;
  readiness.recommendationLane = active.fzRecommendedLane || null;
  readiness.recommendationVersion = active.recommendationVersion || null;
  readiness.recommendationStatus = active.status || null;
  return next;
}
function cachedPayload(path) {
  const raw = responseCache.get(path);
  return path === '/api/runtime-state' ? overlayRuntime(raw) : cloneJson(raw);
}

window.fetch = async function fzFailStaleFetch(input, init = {}) {
  const url = requestUrl(input);
  const method = methodOf(input, init);
  const path = url?.pathname || '';
  if (method !== 'GET' || !READ_PATHS.has(path)) return nativeFetch(input, init);
  try {
    const response = await nativeFetch(input, init);
    if (response.ok) {
      try {
        const payload = await response.clone().json();
        responseCache.set(path, payload);
        stalePaths.delete(path);
        const outgoing = path === '/api/runtime-state' ? overlayRuntime(payload) : payload;
        return jsonResponse(outgoing, response);
      } catch {
        return response;
      }
    }
    if (responseCache.has(path)) {
      stalePaths.add(path);
      queueMicrotask(decorateRecommendation);
      return jsonResponse(cachedPayload(path), response, { 'X-FZ-Fail-Stale': '1' });
    }
    return response;
  } catch (error) {
    if (responseCache.has(path)) {
      stalePaths.add(path);
      queueMicrotask(decorateRecommendation);
      return jsonResponse(cachedPayload(path), null, { 'X-FZ-Fail-Stale': '1' });
    }
    throw error;
  }
};

async function nativeJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await nativeFetch(url, { cache: 'no-store', signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    if (!response.ok && response.status !== 202) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function dispatchCanonicalReread() {
  window.dispatchEvent(new Event('focus'));
}

async function converge({ sources = false } = {}) {
  if (converging) return null;
  converging = true;
  decorateRecommendation();
  try {
    const suffix = sources ? '?sources=1' : '';
    const result = await nativeJson(`/api/intelligence/refresh${suffix}`, sources ? 45000 : 20000);
    intelligenceError = false;
    if (result?.afterRevision) revision = result.afterRevision;
    if (result?.activeRecommendation) {
      intelligence = { ...(intelligence || {}), activeRecommendation: result.activeRecommendation, pendingPropagation: result.pendingPropagation, pending: result.pending, revision: result.afterRevision, affectedSurfaces: result.affectedSurfaces };
    }
    dispatchCanonicalReread();
    return result;
  } finally {
    converging = false;
    decorateRecommendation();
  }
}

async function pollIntelligence() {
  try {
    const next = await nativeJson('/api/intelligence/current', 12000);
    intelligenceError = false;
    const previousRevision = revision;
    intelligence = next;
    revision = next.revision || revision;
    if (next.pendingPropagation) {
      await converge({ sources: false });
      return;
    }
    const changed = Boolean(previousRevision && next.revision && previousRevision !== next.revision);
    if (changed || (!initialIntelligenceApplied && next.activeRecommendation)) dispatchCanonicalReread();
    initialIntelligenceApplied = true;
    decorateRecommendation();
  } catch {
    intelligenceError = true;
    decorateRecommendation();
  }
}

function statusText() {
  if (refreshButtonBusy) return 'Refreshing canonical sources and intelligence…';
  if (converging) return 'Reconciling new evidence through FZ intelligence…';
  if (stalePaths.size) return `Showing last known canonical state · ${stalePaths.size} live read${stalePaths.size === 1 ? '' : 's'} unavailable.`;
  if (intelligenceError) return 'Intelligence refresh is temporarily unavailable · current canonical display retained.';
  if (intelligence?.pendingPropagation) return 'New evidence detected · recommendation propagation pending.';
  if (intelligence?.activeRecommendation?.status === 'WITHHELD') return 'Recommendation withheld by the intelligence contract · no stale lane substituted.';
  if (intelligence?.activeRecommendation) return 'Active recommendation reconciled to canonical truth.';
  return 'Active recommendation is not yet available.';
}

function decorateRecommendation() {
  const card = document.querySelector('.fz-clean-recommendation');
  if (!card) return;
  const active = intelligence?.activeRecommendation || null;
  const heading = card.querySelector('h3');
  const paragraph = card.querySelector('p');
  if (active && heading) setText(heading, active.status === 'WITHHELD' ? 'RECOMMENDATION WITHHELD' : (active.fzRecommendedLane || 'FZ RECOMMENDATION'));
  if (active && paragraph) setText(paragraph, activeText(active));
  let controls = card.querySelector('[data-fz-intelligence-controls]');
  if (!controls) {
    controls = document.createElement('div');
    controls.dataset.fzIntelligenceControls = '1';
    controls.className = 'fz-intelligence-controls';
    controls.innerHTML = '<div class="fz-intelligence-status muted" aria-live="polite"></div><button class="fz-link-button" type="button" data-refresh-fz>Refresh FZ</button>';
    card.appendChild(controls);
  }
  const status = controls.querySelector('.fz-intelligence-status');
  const button = controls.querySelector('[data-refresh-fz]');
  setText(status, statusText());
  if (button) {
    const disabled = refreshButtonBusy || converging;
    if (button.disabled !== disabled) button.disabled = disabled;
    setText(button, refreshButtonBusy ? 'Refreshing…' : 'Refresh FZ');
  }
}

async function manualRefresh() {
  if (refreshButtonBusy || converging) return;
  refreshButtonBusy = true;
  decorateRecommendation();
  try {
    await converge({ sources: true });
    await pollIntelligence();
  } catch {
    intelligenceError = true;
    decorateRecommendation();
  } finally {
    refreshButtonBusy = false;
    decorateRecommendation();
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-refresh-fz]')) {
    event.preventDefault();
    manualRefresh();
  }
});

const observer = new MutationObserver(() => queueMicrotask(decorateRecommendation));
observer.observe(document.documentElement, { childList: true, subtree: true });

setTimeout(pollIntelligence, 0);
setInterval(() => { if (document.visibilityState === 'visible') pollIntelligence(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollIntelligence(); });
window.addEventListener('online', pollIntelligence);
