export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  return res.status(410).json({
    ok: false,
    status: 'DEPRECATED',
    error: 'fitness_ai_custom_client_oauth_unsupported',
    replacement: 'intervals-icu',
    message: 'FZ wellness now uses Garmin data through Intervals.icu.'
  });
}
