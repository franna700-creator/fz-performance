import { finishFitnessAiAuthorization } from '../../../lib/fitness-ai-client.js';

function redirect(res, location) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Location', location);
  return res.status(302).end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const url = new URL(req.url, 'https://fz-performance-mvp.vercel.app');
    await finishFitnessAiAuthorization(url.searchParams);
    return redirect(res, '/?source=connected');
  } catch (error) {
    console.error('Fitness AI OAuth callback failed', error instanceof Error ? error.message : String(error));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(400).send('FZ could not complete the Garmin live-source authorization. Please return to FZ and try connecting again.');
  }
}
