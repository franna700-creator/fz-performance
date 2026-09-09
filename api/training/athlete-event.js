import { timingSafeEqual } from 'node:crypto';
import { MEMORY_CATEGORIES, ATHLETE_EVENT_TYPES } from '../../lib/athlete-memory-ingest.js';
import {
  recordExerciseAthleteResponse,
  EXERCISE_PROJECT_SCOPE,
  FZ_ATHLETE_ID,
  SPEAKER_RESOLUTIONS
} from '../../lib/athlete-response-capture.js';

const MAX_BODY_BYTES = 64 * 1024;

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

function contract() {
  return {
    version: 'exercise-athlete-response-v3.1',
    projectScope: EXERCISE_PROJECT_SCOPE,
    athleteId: FZ_ATHLETE_ID,
    speakerResolutions: SPEAKER_RESOLUTIONS,
    memoryCategories: MEMORY_CATEGORIES,
    eventTypes: ATHLETE_EVENT_TYPES,
    requiredCaptureFields: ['projectScope', 'athleteId', 'speakerResolution'],
    behavior: {
      chatIsPrimaryInput: true,
      projectWideAcrossChats: true,
      preservesReportedAt: true,
      preservesOccurredAt: true,
      supportsOccurrencePrecision: true,
      supportsStandaloneContext: true,
      linksWhenConfident: true,
      ambiguousSpeakerRequiresConfirmation: true,
      idempotentEventKey: true
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      writeConfigured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL) && Boolean(process.env.FZ_STATE_WRITE_TOKEN),
      contract: contract()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
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
    const body = parseBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'invalid_body' });
    }
    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ ok: false, error: 'payload_too_large' });
    }

    const result = await recordExerciseAthleteResponse(body);
    return res.status(200).json({
      ok: true,
      contract: contract(),
      memory: result
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const badInput = /^(summary_required|summary_too_long|raw_text_too_long|invalid_|unknown_session|unknown_source_record|memory_category|required|invalid_event_type|exercise_project_scope_required|francois_speaker_required|speaker_resolution_required)/.test(detail);
    console.error('FZ athlete response ingest failed', detail);
    return res.status(badInput ? 400 : 500).json({
      ok: false,
      error: badInput ? 'athlete_response_contract_failure' : 'athlete_response_ingest_failed',
      detail
    });
  }
}
