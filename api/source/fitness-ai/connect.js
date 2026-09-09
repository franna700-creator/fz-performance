import { beginFitnessAiAuthorization } from '../../../lib/fitness-ai-client.js';
import { loadSourceConnection } from '../../../lib/source-connection-store.js';

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
    const current = await loadSourceConnection({ includeSecrets: false });
    if (current?.status === 'CONNECTED') return redirect(res, '/?source=connected');

    const result = await beginFitnessAiAuthorization();
    if (result.status === 'CONNECTED') return redirect(res, '/?source=connected');
    if (!result.authorizationUrl) throw new Error('Fitness AI authorization URL was not provided');
    return redirect(res, result.authorizationUrl);
  } catch (error) {
    console.error('Fitness AI connect failed', error instanceof Error ? error.message : String(error));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(503).send('FZ could not start the Garmin live-source connection. Please return to FZ and try again.');
  }
}
