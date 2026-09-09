import { buildCurrentTrends } from '../../lib/trends-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const days = Math.max(28, Math.min(90, Number.parseInt(String(req.query.days || '45'), 10) || 45));
    const payload = await buildCurrentTrends({ days });
    return res.status(200).json(payload);
  } catch (error) {
    console.error('FZ trends contract failed', error instanceof Error ? error.message : String(error));
    return res.status(503).json({
      ok: false,
      error: 'trends_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
