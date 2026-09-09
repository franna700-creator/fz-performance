const FZ_TRAINING_AUTO_SYNC = {
  busy: false,
  lastSourceSyncAt: 0,
  timer: null,
  pollMs: 300000,
  minWakeMs: 120000,
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
  if (FZ_TRAINING_AUTO_SYNC.lastError) return 'Workout sources · last sync failed · auto-sync 5 min';
  if (!FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt) return 'Workout sources · auto-sync every 5 min';
  const sync = FZ_TRAINING_AUTO_SYNC.lastResult?.sync;
  const tredict = Number(sync?.tredict?.activities || 0);
  const garmin = Number(sync?.garmin?.activities || 0);
  const matched = Number(sync?.garmin?.matched || 0);
  const detail = (tredict || garmin || matched) ? ` · Tredict ${tredict} · Garmin ${garmin} · matched ${matched}` : '';
  return `Workout sources · synced ${trainingTime(FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt)} · auto-sync 5 min${detail}`;
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
    toolbar.innerHTML = '<span data-training-sync-status></span><button type="button" data-training-sync-now>Sync workouts</button>';
    head.after(toolbar);
  }
  const status = toolbar.querySelector('[data-training-sync-status]');
  const button = toolbar.querySelector('[data-training-sync-now]');
  if (status) status.textContent = trainingSyncSummary();
  if (button) {
    button.disabled = FZ_TRAINING_AUTO_SYNC.busy;
    button.textContent = FZ_TRAINING_AUTO_SYNC.busy ? 'Syncing…' : 'Sync workouts';
  }
}

async function sourceSyncTraining({ force = false, reason = 'background' } = {}) {
  const now = Date.now();
  if (FZ_TRAINING_AUTO_SYNC.busy) return false;
  if (!force && FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt && now - FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt < FZ_TRAINING_AUTO_SYNC.minWakeMs) return false;
  if (document.visibilityState !== 'visible' && reason === 'interval') return false;

  FZ_TRAINING_AUTO_SYNC.busy = true;
  FZ_TRAINING_AUTO_SYNC.lastError = null;
  mountTrainingSyncToolbar();

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  try {
    const response = await FZ_TRAINING_AUTO_SYNC.originalFetch('/api/training/memory?backDays=45&forwardDays=0&refresh=1', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: ctrl.signal
    });
    if (!response.ok) throw new Error(`training source sync ${response.status}`);
    const payload = await response.json();
    FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt = Date.now();
    FZ_TRAINING_AUTO_SYNC.lastResult = payload;
    FZ_TRAINING_AUTO_SYNC.lastError = null;

    // app-clean owns canonical rendering. Its focus handler rereads Neon-backed
    // training, trends and system state after this source sync has persisted.
    queueMicrotask(() => window.dispatchEvent(new Event('focus')));
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
  setTimeout(() => sourceSyncTraining({ reason: 'initial' }), 250);

  if (FZ_TRAINING_AUTO_SYNC.timer) clearInterval(FZ_TRAINING_AUTO_SYNC.timer);
  FZ_TRAINING_AUTO_SYNC.timer = setInterval(() => {
    if (document.visibilityState === 'visible') sourceSyncTraining({ reason: 'interval' });
  }, FZ_TRAINING_AUTO_SYNC.pollMs);

  window.addEventListener('focus', () => {
    if (Date.now() - FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt > FZ_TRAINING_AUTO_SYNC.minWakeMs) {
      sourceSyncTraining({ reason: 'focus' });
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - FZ_TRAINING_AUTO_SYNC.lastSourceSyncAt > FZ_TRAINING_AUTO_SYNC.minWakeMs) {
      sourceSyncTraining({ reason: 'visibility' });
    }
  });
  window.addEventListener('online', () => sourceSyncTraining({ reason: 'online' }));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-training-sync-now]')) sourceSyncTraining({ force: true, reason: 'manual' });
  });

  const today = document.getElementById('today');
  if (today) new MutationObserver(() => queueMicrotask(mountTrainingSyncToolbar)).observe(today, { childList: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startTrainingAutoSync, { once: true });
else startTrainingAutoSync();
