import { buildDynamicCurrentTrends } from '../../lib/trends-dynamic.js';
import { overlayCanonicalAthleteVoiceOnTrends } from '../../lib/trends-athlete-voice.js';
import { buildAdaptiveContext } from '../../lib/adaptive-context-v44.js';

function capabilityPriority(context, capabilityId) {
  const priorities = (context?.measurement?.gaps || [])
    .filter(gap => (gap.capabilities || []).includes(capabilityId))
    .map(gap => Number(gap.priority))
    .filter(Number.isFinite);
  const value = priorities.length ? Math.max(...priorities) : null;
  if (value === null) return 'CURRENT';
  if (value >= 0.8) return 'HIGH';
  if (value >= 0.5) return 'MEDIUM';
  return 'SUPPORTING';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const days = Math.max(28, Math.min(90, Number.parseInt(String(req.query.days || '45'), 10) || 45));
    const now=new Date();
    const [trends, context] = await Promise.all([
      buildDynamicCurrentTrends({ days }),
      buildAdaptiveContext({now}).catch(() => null)
    ]);
    const capabilities = (context?.capabilityEvidence || []).map(capability => ({
      ...capability,
      priority: capabilityPriority(context, capability.id)
    }));
    const current = {
      ...trends,
      capabilities,
      measurement: context?.measurement || null,
      adaptiveContext:{
        temporal:context?.temporal||null,
        athleteStateFingerprint:context?.athleteState?.inputFingerprint||null,
        readinessInputFingerprint:context?.recovery?.readinessInputFingerprint||null
      },
      provenance: {
        ...(trends.provenance || {}),
        adaptiveContextBuilder:'adaptive-context-v44',
        capabilityProjection: context ? 'current adaptive context + canonical measurement evidence' : 'temporarily unavailable; stale runtime CAP not used'
      }
    };
    return res.status(200).json(await overlayCanonicalAthleteVoiceOnTrends(current));
  } catch (error) {
    console.error('FZ trends contract failed', error instanceof Error ? error.message : String(error));
    return res.status(503).json({ ok: false, error: 'trends_unavailable', detail: error instanceof Error ? error.message : String(error) });
  }
}
