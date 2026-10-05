const FZ_TRAINING_AUTO_SYNC = {
  busy: false,
  lastSourceSyncAt: 0,
  originalFetch: window.fetch.bind(window),
  lastResult: null,
  lastError: null
};

function trainingTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

function trainingSection() {
  const today = document.getElementById('today');
  if (!today) return null;
  return [...today.querySelectorAll(':scope > .section')].find(section =>
    (section.querySelector('.section-head h2')?.textContent || '').trim() === 'Training State'
  ) || null;
}

function trainingSyncSummary() {
  if (FZ_TRAINING_AUTO_SYNC.busy) return 'Workout sources · syncing…';
  if (FZ_TRAINING_AUTO_SYNC.lastError) return 'Workout sources · last manual sync failed · scheduled refresh remains active';
  if (!FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt) return 'Workout sources · scheduled 06:00 / 20:00 SAST · manual sync available';
  const sync = FZ_TRAINING_AUTO_SYNC.lastResult?.sync;
  const tredict = Number(sync?.tredict?.activities || 0);
  const garmin = Number(sync?.garmin?.activities || 0);
  const matched = Number(sync?.garmin?.matched || 0);
  const detail = (tredict || garmin || matched) ? ` · Tredict ${tredict} · Garmin ${garmin} · matched ${matched}` : '';
  return `Workout sources · synced ${trainingTime(FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt)} · manual refresh${detail}`;
}

function mountTrainingSyncToolbar() {
  const section = trainingSection();
  if (!section) return;
  const head = section.querySelector('.section-head');
  if (!head) return;
  let toolbar = section.querySelector('[data-training-auto-sync]');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'fz-training-sync-toolbar';
    toolbar.setAttribute('data-training-auto-sync', '');
    toolbar.setAttribute('data-dynamic-source', 'training');
    toolbar.innerHTML = '<span data-training-sync-status></span><button type="button" data-training-sync-now>Sync workouts</button>';
    head.after(toolbar);
  }
  const status = toolbar.querySelector('[data-training-sync-status]');
  const button = toolbar.querySelector('[data-training-sync-now]');
  const nextStatus = trainingSyncSummary();
  if (status && status.textContent !== nextStatus) status.textContent = nextStatus;
  if (button) {
    const nextText = FZ_TRAINING_AUTO_SYNC.busy ? 'Syncing…' : 'Sync workouts';
    button.disabled = FZ_TRAINING_AUTO_SYNC.busy;
    if (button.textContent !== nextText) button.textContent = nextText;
  }
}

function canonicalReread(reason) {
  document.dispatchEvent(new CustomEvent('fz:source-persisted', { detail: { source: 'training', reason } }));
}

async function sourceSyncTraining({ force = false, reason = 'background' } = {}) {
  const now = Date.now();
  if (FZ_TRAINING_AUTO_SYNC.busy) return false;

  FZ_TRAINING_AUTO_SYNC.busy = true;
  FZ_TRAINING_AUTO_SYNC.lastError = null;
  mountTrainingSyncToolbar();

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  try {
    const response = await FZ_TRAINING_AUTO_SYNC.originalFetch('/api/training/memory?backDays=14&forwardDays=14&refresh=1', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: ctrl.signal
    });
    if (!response.ok) throw new Error(`training source sync ${response.status}`);
    const payload = await response.json();
    if (!payload?.ok) throw new Error(payload?.error || 'training source sync invalid payload');
    FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt = Date.now();
    FZ_TRAINING_AUTO_SYNC.lastResult = payload;
    FZ_TRAINING_AUTO_SYNC.lastError = null;
    if (payload?.sync?.meaningfulChange === true || payload?.sync?.propagation?.pendingPropagation === true) canonicalReread(reason);
    return true;
  } catch (error) {
    FZ_TRAINING_AUTO_SYNC.lastError = error instanceof Error ? error.message : String(error);
    return false;
  } finally {
    clearTimeout(timeout);
    FZ_TRAINING_AUTO_SYNC.busy = false;
    mountTrainingSyncToolbar();
  }
}

function startTrainingAutoSync() {
  mountTrainingSyncToolbar();
  document.addEventListener('click', event => {
    if (event.target.closest('[data-training-sync-now]')) sourceSyncTraining({ force: true, reason: 'manual' });
  });

  const today = document.getElementById('today');
  if (today) new MutationObserver(() => queueMicrotask(mountTrainingSyncToolbar)).observe(today, { childList: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTrainingAutoSync, { once: true });
else startTrainingAutoSync();
