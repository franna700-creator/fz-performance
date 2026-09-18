import { publicIntervalsIcuStatus } from '../../lib/intervals-icu-client.js';
import {
  authorizeGarminCiqRequest,
  markGarminCiqError,
  markGarminCiqSynced,
  normalizeGarminCiqPayload,
  publicGarminCiqStatus
} from '../../lib/garmin-ciq-client.js';
import { getWellnessToday, ingestNormalizedWellness, localDateSast } from '../../lib/wellness-store.js';
import { syncWellnessToday } from '../../lib/wellness-sync.js';

async function ingestGarminCiq(req, res) {
  const auth = authorizeGarminCiqRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const normalized = normalizeGarminCiqPayload(body);
    const persisted = await ingestNormalizedWellness(normalized);
    await markGarminCiqSynced();
    return res.status(200).json({
      ok: true,
      sourceKey: normalized.snapshot.sourceKey,
      observedAt: normalized.snapshot.sourceAsOf,
      pointsAccepted: normalized.series.length,
      localDate: normalized.snapshot.localDate,
      canonical: persisted ? 'persisted' : 'accepted'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markGarminCiqError(message).catch(() => null);
    const status = /invalid|future|too_old|JSON/i.test(message) ? 400 : 500;
    console.error('Garmin Connect IQ ingest failed', message);
    return res.status(status).json({ ok: false, error: 'garmin_ciq_ingest_failed', detail: message.slice(0, 240) });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'POST' && String(req.query?.source || '') === 'garmin-ciq') {
    return ingestGarminCiq(req, res);
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
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
    } catch (error) {
      syncStatus = 'SYNC_FAILED';
      syncWarning = 'Live source could not be refreshed; serving the latest persisted observation.';
      console.warn('FZ wellness sync failed', error instanceof Error ? error.message : String(error));
    }
  }

  try { wellness = await getWellnessToday(date); } catch (error) {
    console.error('FZ wellness read failed', error instanceof Error ? error.message : String(error));
  }

  let dailySource;
  let intradaySource;
  try { dailySource = await publicIntervalsIcuStatus(); } catch { dailySource = { status: 'ERROR' }; }
  try { intradaySource = await publicGarminCiqStatus(); } catch { intradaySource = { status: 'ERROR' }; }

  return res.status(200).json({
    ok: true,
    date,
    syncStatus,
    warning: syncWarning,
    source: { daily: dailySource, intraday: intradaySource },
    wellness
  });
}
