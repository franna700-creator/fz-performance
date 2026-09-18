import { publicIntervalsIcuStatus } from '../../../lib/intervals-icu-client.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  return res.status(200).json({
    ok: true,
    deprecated: true,
    legacySource: 'Fitness AI Connector custom-client OAuth',
    replacement: await publicIntervalsIcuStatus()
  });
}
