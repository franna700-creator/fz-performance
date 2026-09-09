import { probeTredictActivityRead, tredictConfigured } from '../../../lib/tredict-client.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const configured = tredictConfigured();
  if (!configured) {
    return res.status(200).json({
      ok: true,
      source: 'Tredict Personal API',
      status: 'DISCONNECTED',
      configured: false,
      validated: false
    });
  }

  if (String(req.query.probe || '') !== '1') {
    return res.status(200).json({
      ok: true,
      source: 'Tredict Personal API',
      status: 'CONFIGURED',
      configured: true,
      validated: false
    });
  }

  try {
    const probe = await probeTredictActivityRead();
    return res.status(200).json({
      ok: true,
      source: 'Tredict Personal API',
      status: 'CONNECTED',
      configured: true,
      validated: true,
      activityRead: true,
      sampleCount: probe.count
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      source: 'Tredict Personal API',
      status: 'ERROR',
      configured: true,
      validated: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
