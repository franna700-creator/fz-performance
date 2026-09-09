import { createHash, timingSafeEqual } from 'node:crypto';
import { publishDatabaseRuntimeState } from '../lib/runtime-store.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

function validRuntimeState(state) {
  return !!(
    state &&
    typeof state === 'object' &&
    typeof state.schemaVersion === 'string' &&
    typeof state.stateId === 'string' && state.stateId.length >= 8 &&
    state.masterValidated === true &&
    typeof state.nextRefreshAt === 'string' &&
    state.pages &&
    ['today', 'trends', 'train', 'system'].every(key => typeof state.pages[key] === 'string' && state.pages[key].length >= 32) &&
    state.datasets &&
    ['AET', 'WELL', 'LOAD', 'RUNS', 'CAP'].every(key => Array.isArray(state.datasets[key]))
  );
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const expectedToken = process.env.FZ_STATE_WRITE_TOKEN;
  if (!expectedToken || !secureEqual(bearerToken(req), expectedToken)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const declaredLength = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'payload_too_large' });
  }

  try {
    const state = parseBody(req);
    if (!validRuntimeState(state)) {
      return res.status(400).json({ ok: false, error: 'runtime_state_contract_failure' });
    }

    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ ok: false, error: 'payload_too_large' });
    }

    const payloadSha256 = createHash('sha256').update(serialized).digest('hex');
    const pointer = await publishDatabaseRuntimeState({
      state,
      payloadSha256,
      sourceClass: String(req.headers?.['x-fz-source-class'] || 'FZ_RUNTIME_INGEST')
    });

    return res.status(200).json({
      ok: true,
      stateId: state.stateId,
      payloadSha256,
      pointer
    });
  } catch (error) {
    console.error('FZ database runtime publish failed', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ ok: false, error: 'runtime_state_publish_failed' });
  }
}
