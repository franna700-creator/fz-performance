const FZ_LIVE_PHYSIOLOGY = {
  payload: null,
  refreshBusy: false,
  mountedRoot: null,
  originalFetch: window.fetch.bind(window),
  autoRefreshMs: 300000
};

const LIVE_SERIES = {
  body_battery: { label: 'Body Battery', suffix: '', decimals: 0, filter: value => Number.isFinite(value) },
  stress: { label: 'Stress', suffix: '', decimals: 0, filter: value => Number.isFinite(value) && value >= 0 },
  heart_rate: { label: 'Heart rate', suffix: ' bpm', decimals: 0, filter: value => Number.isFinite(value) },
  respiration: { label: 'Respiration', suffix: ' br/min', decimals: 1, filter: value => Number.isFinite(value) && value > 0 }
};

function isWellnessUrl(input) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw) return false;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/api/wellness/today';
  } catch {
    return false;
  }
}

function sourceRefreshingUrl(input) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw) return input;
  const url = new URL(raw, window.location.origin);
  if (url.pathname === '/api/wellness/today' && url.searchParams.get('refresh') === '0') {
    url.searchParams.delete('refresh');
    return url.pathname + (url.search ? url.search : '');
  }
  return input;
}

function captureWellnessResponse(response) {
  if (!response?.ok) return;
  response.clone().json().then(payload => {
    if (!payload?.ok || !payload?.wellness) return;
    FZ_LIVE_PHYSIOLOGY.payload = payload;
    queueMicrotask(renderLivePhysiology);
  }).catch(() => {});
}

window.fetch = async function fzLivePhysiologyFetch(input, init) {
  const nextInput = isWellnessUrl(input) ? sourceRefreshingUrl(input) : input;
  const response = await FZ_LIVE_PHYSIOLOGY.originalFetch(nextInput, init);
  if (isWellnessUrl(nextInput)) captureWellnessResponse(response);
  return response;
};

function liveSection() {
  const today = document.getElementById('today');
  if (!today) return null;
  return [...today.querySelectorAll(':scope > .section')].find(section =>
    (section.querySelector('.section-head h2')?.textContent || '').trim() === 'Live Physiology'
  ) || null;
}

function fmt(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function timeSast(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function freshnessClass(value) {
  const state = String(value || 'UNKNOWN').toUpperCase();
  if (state === 'LIVE') return 'good';
  if (state === 'DELAYED') return 'warn';
  return 'bad';
}

function cleanSeries(points, key) {
  const rule = LIVE_SERIES[key];
  return (Array.isArray(points) ? points : [])
    .map(point => ({ ts: Date.parse(point?.[0]), value: Number(point?.[1]) }))
    .filter(point => Number.isFinite(point.ts) && rule.filter(point.value));
}

function latestSeriesValue(series, key, fallback = null) {
  const clean = cleanSeries(series?.[key], key);
  if (clean.length) return clean[clean.length - 1].value;
  const n = Number(fallback);
  return LIVE_SERIES[key].filter(n) ? n : null;
}

function physiologyShell(payload) {
  const well = payload?.wellness || {};
  const current = well.current || {};
  const series = well.series || {};
  const freshness = String(well.freshness || 'UNKNOWN').toUpperCase();
  const bb = latestSeriesValue(series, 'body_battery', current.bodyBattery);
  const stress = latestSeriesValue(series, 'stress', current.stress);
  const hr = latestSeriesValue(series, 'heart_rate', current.heartRate);
  const respiration = latestSeriesValue(series, 'respiration', current.respiration);
  const sourceTime = timeSast(well.sourceAsOf);
  const persistedTime = timeSast(well.ingestedAt);
  const syncStatus = String(payload?.syncStatus || 'UNKNOWN').replaceAll('_', ' ');

  return `
    <div class="fz-live-physiology-v3" data-freshness="${freshness}">
      <div class="fz-live-toolbar">
        <div>
          <div class="fz-live-freshness ${freshnessClass(freshness)}"><i></i>${freshness}</div>
          <p>Garmin ${sourceTime} · FZ persisted ${persistedTime} · auto-refresh 5 min · ${syncStatus}</p>
        </div>
        <button type="button" class="fz-live-refresh" data-live-refresh>Refresh Garmin</button>
      </div>
      <div class="fz-live-anchor-row">
        <div><small>Steps</small><b>${fmt(current.steps)}</b><span>${current.distanceKm == null ? 'today' : `${fmt(current.distanceKm, 2)} km`}</span></div>
        <div><small>Active kcal</small><b>${fmt(current.activeCalories)}</b><span>${current.activeMinutes == null ? 'today' : `${fmt(current.activeMinutes, 1)} active min`}</span></div>
        <div><small>HRV</small><b>${fmt(current.hrv)} ms</b><span>overnight anchor</span></div>
        <div><small>Sleep</small><b>${fmt(current.sleepScore)}</b><span>${current.sleepHours == null ? 'score' : `${fmt(current.sleepHours, 2)} h`}</span></div>
      </div>
      <div class="fz-live-chart-grid-v3">
        ${chartShell('body_battery', bb)}
        ${chartShell('stress', stress)}
        ${chartShell('heart_rate', hr, current.restingHeartRate == null ? '' : `Resting ${fmt(current.restingHeartRate)} bpm`)}
        ${chartShell('respiration', respiration, 'Latest valid positive reading')}
      </div>
      <div class="fz-live-footnote">Intraday traces use persisted 15-minute Garmin observations. Drag, hover, tap or use arrow keys to scrub.</div>
    </div>`;
}

function chartShell(key, value, note = '') {
  const spec = LIVE_SERIES[key];
  const display = value == null ? '—' : `${fmt(value, spec.decimals)}${spec.suffix}`;
  return `<article class="fz-live-chart-v3" data-live-key="${key}">
    <div class="fz-live-chart-head"><div><small>${spec.label}</small><b data-live-value>${display}</b></div>${note ? `<span>${note}</span>` : ''}</div>
    <svg viewBox="0 0 320 90" preserveAspectRatio="none" tabindex="0" role="application" aria-label="Interactive ${spec.label} intraday chart"></svg>
    <div class="fz-live-scrub-tip" hidden></div>
  </article>`;
}

function mountSpark(card, points, key) {
  const svg = card?.querySelector('svg');
  const valueNode = card?.querySelector('[data-live-value]');
  const tip = card?.querySelector('.fz-live-scrub-tip');
  if (!svg || !valueNode || !tip) return;
  const spec = LIVE_SERIES[key];
  const clean = cleanSeries(points, key);
  svg.replaceChildren();
  if (clean.length < 2) {
    svg.innerHTML = '<text x="160" y="47" text-anchor="middle" class="fz-live-empty-text">No intraday trace yet</text>';
    return;
  }
  const xs = clean.map(point => point.ts);
  const ys = clean.map(point => point.value);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const spanX = Math.max(1, xmax - xmin), spanY = Math.max(1, ymax - ymin);
  clean.forEach(point => {
    point.x = 8 + ((point.ts - xmin) / spanX) * 304;
    point.y = 78 - ((point.value - ymin) / spanY) * 66;
  });

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', clean.map(point => `${point.x},${point.y}`).join(' '));
  line.setAttribute('class', 'fz-live-series-line');
  svg.appendChild(line);

  const scrub = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  scrub.setAttribute('y1', '7'); scrub.setAttribute('y2', '80');
  scrub.setAttribute('class', 'fz-live-scrub-line'); scrub.setAttribute('visibility', 'hidden');
  svg.appendChild(scrub);

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '4.5'); dot.setAttribute('class', 'fz-live-scrub-dot'); dot.setAttribute('visibility', 'hidden');
  svg.appendChild(dot);

  const latest = clean[clean.length - 1];
  const latestLabel = `${fmt(latest.value, spec.decimals)}${spec.suffix}`;
  valueNode.textContent = latestLabel;
  let currentIndex = clean.length - 1;

  function show(index) {
    currentIndex = Math.max(0, Math.min(clean.length - 1, index));
    const point = clean[currentIndex];
    scrub.setAttribute('x1', point.x); scrub.setAttribute('x2', point.x); scrub.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y); dot.setAttribute('visibility', 'visible');
    const label = `${fmt(point.value, spec.decimals)}${spec.suffix}`;
    const time = timeSast(new Date(point.ts).toISOString());
    valueNode.textContent = `${label} · ${time}`;
    tip.hidden = false;
    tip.innerHTML = `<b>${time}</b><span>${label}</span>`;
    tip.style.left = `${Math.max(12, Math.min(88, (point.x / 320) * 100))}%`;
  }

  function clear() {
    scrub.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true;
    valueNode.textContent = latestLabel;
  }

  function choose(clientX) {
    const rect = svg.getBoundingClientRect();
    const virtualX = (clientX - rect.left) / Math.max(1, rect.width) * 320;
    let best = 0, distance = Infinity;
    clean.forEach((point, index) => {
      const next = Math.abs(point.x - virtualX);
      if (next < distance) { distance = next; best = index; }
    });
    show(best);
  }

  svg.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' || event.buttons || event.pressure > 0) choose(event.clientX);
  });
  svg.addEventListener('pointerdown', event => choose(event.clientX));
  svg.addEventListener('click', event => choose(event.clientX));
  svg.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') clear(); });
  svg.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') clear();
    else show(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
}

function renderLivePhysiology() {
  const payload = FZ_LIVE_PHYSIOLOGY.payload;
  const section = liveSection();
  if (!payload?.wellness || !section) return;
  const legacyGrid = section.querySelector('.fz-live-grid');
  if (legacyGrid) legacyGrid.hidden = true;
  let mount = section.querySelector('.fz-live-physiology-v3');
  const html = physiologyShell(payload);
  if (mount) mount.outerHTML = html;
  else section.insertAdjacentHTML('beforeend', html);
  mount = section.querySelector('.fz-live-physiology-v3');
  const series = payload.wellness.series || {};
  Object.keys(LIVE_SERIES).forEach(key => mountSpark(mount.querySelector(`[data-live-key="${key}"]`), series[key], key));
  FZ_LIVE_PHYSIOLOGY.mountedRoot = mount;
}

async function forceRefresh() {
  if (FZ_LIVE_PHYSIOLOGY.refreshBusy) return;
  FZ_LIVE_PHYSIOLOGY.refreshBusy = true;
  const button = document.querySelector('[data-live-refresh]');
  if (button) { button.disabled = true; button.textContent = 'Refreshing…'; }
  try {
    const response = await FZ_LIVE_PHYSIOLOGY.originalFetch('/api/wellness/today?refresh=1', { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`wellness ${response.status}`);
    const payload = await response.json();
    if (payload?.ok && payload?.wellness) {
      FZ_LIVE_PHYSIOLOGY.payload = payload;
      renderLivePhysiology();
    }
  } catch {
    if (button) button.textContent = 'Refresh failed · retry';
  } finally {
    FZ_LIVE_PHYSIOLOGY.refreshBusy = false;
    const next = document.querySelector('[data-live-refresh]');
    if (next) { next.disabled = false; if (!next.textContent.includes('failed')) next.textContent = 'Refresh Garmin'; }
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-live-refresh]')) forceRefresh();
});

const observer = new MutationObserver(() => {
  if (!FZ_LIVE_PHYSIOLOGY.payload?.wellness) return;
  const section = liveSection();
  if (section && !section.querySelector('.fz-live-physiology-v3')) queueMicrotask(renderLivePhysiology);
});

function startLivePhysiology() {
  const today = document.getElementById('today');
  if (today) observer.observe(today, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startLivePhysiology, { once: true });
else startLivePhysiology();

window.FZ_LIVE_PHYSIOLOGY_REFRESH_MS = FZ_LIVE_PHYSIOLOGY.autoRefreshMs;
