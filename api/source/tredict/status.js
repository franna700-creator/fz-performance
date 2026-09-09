import { tredictConfigured } from '../../../lib/tredict-client.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  return res.status(200).json({
    ok: true,
    source: 'Tredict MCP',
    status: tredictConfigured() ? 'CONFIGURED' : 'DISCONNECTED',
    configured: tredictConfigured()
  });
}
