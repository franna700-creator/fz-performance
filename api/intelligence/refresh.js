import { refreshIntelligence } from '../../lib/intelligence-refresh.js';

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

function crossSiteBrowser(req) {
  const site = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  return site === 'cross-site';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (crossSiteBrowser(req)) {
    return res.status(403).json({ ok: false, error: 'cross_site_refresh_forbidden' });
  }

  const input = body(req);
  if (input === null) return res.status(400).json({ ok: false, error: 'invalid_json' });
  const refreshSources = input.sources === true;

  try {
    const result = await refreshIntelligence({
      refreshSources,
      forceWellness: false,
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
