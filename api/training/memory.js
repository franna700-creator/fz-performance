import { readTrainingRange } from '../../lib/training-store.js';
import { syncTrainingSources } from '../../lib/training-sync.js';

const TZ = 'Africa/Johannesburg';

function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function boundedInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function shape(range) {
  const eventsBySession = new Map();
  for (const event of range.events) {
    const key = event.session_id || '__context__';
    if (!eventsBySession.has(key)) eventsBySession.set(key, []);
    eventsBySession.get(key).push(event);
  }

  const sourcesBySession = new Map();
  for (const source of range.sources) {
    if (!sourcesBySession.has(source.session_id)) sourcesBySession.set(source.session_id, []);
    sourcesBySession.get(source.session_id).push(source);
  }

  const hydrate = session => ({
    ...session,
    events: eventsBySession.get(session.session_id) || [],
    sources: sourcesBySession.get(session.session_id) || []
  });

  return {
    sessions: range.sessions.filter(session => session.status !== 'SUPERSEDED').map(hydrate),
    supersededSessions: range.sessions.filter(session => session.status === 'SUPERSEDED').map(hydrate),
    contextEvents: eventsBySession.get('__context__') || []
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : todayLocal();
  const backDays = boundedInt(req.query.backDays, 30, 2, 90);
  const forwardDays = boundedInt(req.query.forwardDays, 14, 0, 30);
  const rangeStart = addDays(date, -backDays);
  const rangeEnd = addDays(date, forwardDays);
  const syncStart = addDays(date, -2);
  const syncEnd = addDays(date, 7);

  let sync = null;
  let warning = null;

  if (String(req.query.refresh || '') === '1') {
    try {
      sync = await syncTrainingSources({ startDate: syncStart, endDate: syncEnd });
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }
  }

  try {
    const range = await readTrainingRange(rangeStart, rangeEnd);
    return res.status(200).json({
      ok: true,
      date,
      range: { startDate: rangeStart, endDate: rangeEnd },
      syncWindow: { startDate: syncStart, endDate: syncEnd },
      sync,
      warning,
      ...shape(range)
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: 'training_memory_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
