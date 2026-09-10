import { readIntelligenceCurrent } from '../../lib/intelligence-current.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const current = await readIntelligenceCurrent();
    return res.status(200).json({ ok: true, ...current });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: 'intelligence_current_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
