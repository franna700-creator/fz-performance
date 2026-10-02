import {
  markTredictSourceError,
  markTredictSourceSynced,
  probeTredictActivityRead,
  publicTredictStatus
} from '../../../lib/tredict-client.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const current = await publicTredictStatus();
  if (!current.configured) {
    return res.status(200).json({ ok: true, ...current });
  }

  if (String(req.query.probe || '') !== '1') {
    return res.status(200).json({ ok: true, ...current });
  }

  try {
    const probe = await probeTredictActivityRead();
    await markTredictSourceSynced();
    return res.status(200).json({
      ok: true,
      ...(await publicTredictStatus()),
      activityRead: true,
      sampleCount: probe.count
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markTredictSourceError(message).catch(() => null);
    return res.status(200).json({
      ok: true,
      ...(await publicTredictStatus()),
      activityRead: false,
      error: message
    });
  }
}
