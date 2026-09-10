import { refreshIntelligence } from '../../lib/intelligence-refresh.js';

function flag(value) {
  return String(value || '') === '1';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const refreshSources = flag(req.query?.sources);
    const result = await refreshIntelligence({
      refreshSources,
      forceWellness: refreshSources && flag(req.query?.forceWellness),
      now: new Date()
    });
    return res.status(result.pendingPropagation ? 202 : 200).json(result);
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: 'intelligence_refresh_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
