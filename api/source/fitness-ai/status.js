import { publicSourceStatus } from '../../../lib/source-connection-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    return res.status(200).json({ ok: true, ...(await publicSourceStatus()) });
  } catch (error) {
    console.error('Fitness AI status failed', error instanceof Error ? error.message : String(error));
    return res.status(503).json({ ok: false, status: 'ERROR' });
  }
}
