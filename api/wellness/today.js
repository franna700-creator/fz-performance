import { publicSourceStatus } from '../../lib/source-connection-store.js';
import { getWellnessToday, localDateSast } from '../../lib/wellness-store.js';
import { syncWellnessToday } from '../../lib/wellness-sync.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const date = typeof req.query?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : localDateSast();
  const force = String(req.query?.refresh || '') === '1';
  const dbOnly = String(req.query?.refresh || '') === '0';

  let syncStatus = dbOnly ? 'DB_ONLY' : 'NOT_ATTEMPTED';
  let syncWarning = null;
  let wellness = null;

  if (!dbOnly) {
    try {
      const synced = await syncWellnessToday({ force, date });
      syncStatus = synced.status;
      wellness = synced.wellness;
    } catch (error) {
      syncStatus = 'SYNC_FAILED';
      syncWarning = 'Live source could not be refreshed; serving the latest persisted observation.';
      console.warn('FZ wellness sync failed', error instanceof Error ? error.message : String(error));
    }
  }

  if (!wellness) {
    try { wellness = await getWellnessToday(date); } catch (error) {
      console.error('FZ wellness read failed', error instanceof Error ? error.message : String(error));
    }
  }

  let source;
  try { source = await publicSourceStatus(); } catch { source = { status: 'ERROR' }; }

  return res.status(200).json({
    ok: true,
    date,
    syncStatus,
    warning: syncWarning,
    source,
    wellness
  });
}
