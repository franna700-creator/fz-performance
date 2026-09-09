import crypto from 'node:crypto';
import { getSql } from './db.js';
import {
  ingestTrainingSourceRecord,
  appendAthleteEvent,
  linkTrainingSource,
  setTrainingSessionState
} from './training-store.js';

export const MEMORY_CATEGORIES = Object.freeze(['STATE','SESSION','COST','RECOVERY','FUELING','CONSTRAINT','HYPOTHESIS']);
export const ATHLETE_EVENT_TYPES = Object.freeze(['ATHLETE_MODIFIED','STOPPED_EARLY','ABORTED','SKIPPED','POST_SESSION_FEEDBACK','NEXT_DAY_RESPONSE','CONTEXT']);
const CATEGORY_SET = new Set(MEMORY_CATEGORIES);
const EVENT_TYPE_SET = new Set(ATHLETE_EVENT_TYPES);
const TZ = 'Africa/Johannesburg';

function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function normalizedWords(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
function normalizedPhrase(value) { return normalizedWords(value).join(' '); }
function overlap(left, right) {
  const a = new Set(normalizedWords(left));
  const b = new Set(normalizedWords(right));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

export function johannesburgLocalDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('invalid_occurred_at');
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function classifyAthleteMemory({ summary = '', rawText = '', categories = [], payload = {} } = {}) {
  const supplied = Array.isArray(categories) ? categories.map(upper).filter(Boolean) : [];
  const invalid = supplied.filter(category => !CATEGORY_SET.has(category));
  if (invalid.length) throw new Error(`invalid_memory_categories:${invalid.join(',')}`);
  const out = new Set(supplied);
  const haystack = `${summary} ${rawText} ${JSON.stringify(payload || {})}`.toLowerCase();

  if (!out.size) {
    if (/\b(fresh|energy|headspace|felt good|felt fine|readiness|recovered|recovery estimate|legs (?:good|fresh|heavy)|throat|sleep)\b/.test(haystack)) out.add('STATE');
    if (/\b(session|workout|run|ride|row|ski|bike|aet|hyrox|strength|mobility|zone ?2|training)\b/.test(haystack)) out.add('SESSION');
    if (/\b(hard|tough|fatigue|fatigued|doms|sore|soreness|cramp|pain|heavy legs|difficulty walking|limiter|cost)\b/.test(haystack)) out.add('COST');
    if (/\b(recover|recovered|recovery|next day|next-day|fresh|doms improving|better the next)\b/.test(haystack)) out.add('RECOVERY');
    if (/\b(carb|carbohydrate|banana|fuel|fueling|food|meal|hunger|hydration|water|electrolyte)\b/.test(haystack)) out.add('FUELING');
    if (/\b(hand|finger|hamstring|knee|throat|stomach|gi |gastro|cramp|pain|injury|symptom|constraint|grip)\b/.test(haystack)) out.add('CONSTRAINT');
    if (/\b(maybe|might|possibly|possible cause|suspect|hypothesis|i think it was|could have)\b/.test(haystack)) out.add('HYPOTHESIS');
  }

  if (!out.size) out.add('STATE');
  return MEMORY_CATEGORIES.filter(category => out.has(category));
}

export function inferAthleteEventType({ eventType = '', summary = '', rawText = '', phase = '', categories = [] } = {}) {
  const supplied = upper(eventType);
  if (supplied) {
    if (!EVENT_TYPE_SET.has(supplied)) throw new Error(`invalid_event_type:${supplied}`);
    return supplied;
  }
  const haystack = `${summary} ${rawText} ${phase}`.toLowerCase();
  if (/\b(aborted|abort)\b/.test(haystack)) return 'ABORTED';
  if (/\b(skipped|skip the session|did not train|didn't train)\b/.test(haystack)) return 'SKIPPED';
  if (/\b(stopped early|stopped the|bailed|couldn'?t continue|could not continue|ended early)\b/.test(haystack)) return 'STOPPED_EARLY';
  if (/\b(modified|changed the workout|swapped|substituted|replaced)\b/.test(haystack)) return 'ATHLETE_MODIFIED';
  if (/\b(next day|next-day|following morning|morning after|24h|48h)\b/.test(haystack)) return 'NEXT_DAY_RESPONSE';
  if (/\b(pre-session|before training|before the session|readiness|context)\b/.test(haystack)) return 'CONTEXT';
  if ((categories || []).includes('HYPOTHESIS') && !(categories || []).includes('SESSION')) return 'CONTEXT';
  return 'POST_SESSION_FEEDBACK';
}

export function inferCertainty({ certainty = '', categories = [], summary = '', rawText = '' } = {}) {
  const supplied = upper(certainty);
  if (supplied) {
    if (!['OBSERVED','REPORTED','INFERRED','HYPOTHESIS'].includes(supplied)) throw new Error(`invalid_certainty:${supplied}`);
    return supplied;
  }
  if ((categories || []).includes('HYPOTHESIS') || /\b(maybe|might|possibly|suspect|hypothesis|i think it was|could have)\b/i.test(`${summary} ${rawText}`)) return 'HYPOTHESIS';
  return 'REPORTED';
}

export function athleteEventKey({ idempotencyKey = '', occurredAt, summary = '', rawText = '' }) {
  const seed = text(idempotencyKey) || `${new Date(occurredAt).toISOString()}|${normalizedPhrase(summary)}|${normalizedPhrase(rawText)}`;
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 28);
  return `athlete:forward:${digest}`;
}

export function scoreSessionCandidate(candidate, hint = {}, occurredAt = null, candidateCount = 1) {
  let score = 0;
  const reasons = [];
  const hintDate = text(hint.localDate || hint.date);
  const candidateDate = String(candidate.local_date || '').slice(0, 10);
  if (hintDate && candidateDate === hintDate) { score += 0.3; reasons.push('explicit date'); }
  const hintTitle = text(hint.title);
  if (hintTitle && candidate.title) {
    const exact = normalizedPhrase(hintTitle) === normalizedPhrase(candidate.title);
    const o = overlap(hintTitle, candidate.title);
    if (exact) { score += 0.45; reasons.push('exact title'); }
    else if (o >= 0.66) { score += 0.32; reasons.push('title overlap'); }
    else if (o >= 0.4) { score += 0.18; reasons.push('partial title'); }
  }
  const sport = normalizedPhrase(hint.sportType);
  if (sport && normalizedPhrase(candidate.sport_type) === sport) { score += 0.22; reasons.push('sport'); }
  const kind = normalizedPhrase(hint.sessionKind);
  if (kind && normalizedPhrase(candidate.session_kind) === kind) { score += 0.18; reasons.push('session kind'); }
  if (hintDate && candidateCount === 1) { score += 0.3; reasons.push('only session on referenced date'); }

  if (!hintDate && occurredAt && candidate.actual_start_at) {
    const deltaHours = Math.abs(new Date(occurredAt).getTime() - new Date(candidate.actual_start_at).getTime()) / 3600000;
    if (deltaHours <= 2) { score += 0.22; reasons.push('near event time'); }
    else if (deltaHours <= 6) { score += 0.12; reasons.push('same training window'); }
  }
  return { score: clamp(score, 0, 1), reasons };
}

async function sessionFromSource(sql, sourceKey, sourceRecordId) {
  const rows = await sql`
    SELECT s.*
    FROM fz_training_source_latest r
    JOIN fz_training_session_sources l ON l.source_record_pk=r.id
    JOIN fz_training_sessions s ON s.session_id=l.session_id
    WHERE r.source_key=${sourceKey} AND r.source_record_id=${sourceRecordId}
      AND s.status <> 'SUPERSEDED'
    ORDER BY CASE l.relationship WHEN 'EXECUTION' THEN 0 WHEN 'PLAN' THEN 1 ELSE 2 END,
             l.match_confidence DESC NULLS LAST, s.updated_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function resolveAthleteMemorySession({ sessionId = null, sourceKey = null, sourceRecordId = null, relatedSession = {}, occurredAt } = {}) {
  const sql = await getSql();
  if (sessionId) {
    const rows = await sql`SELECT * FROM fz_training_sessions WHERE session_id=${sessionId} AND status <> 'SUPERSEDED' LIMIT 1`;
    return rows[0] ? { session: rows[0], method: 'EXPLICIT_SESSION_ID', confidence: 1, reasons: ['explicit session id'] } : { session: null, method: 'EXPLICIT_SESSION_ID_NOT_FOUND', confidence: 0, reasons: [] };
  }
  if (sourceKey && sourceRecordId) {
    const session = await sessionFromSource(sql, sourceKey, sourceRecordId);
    return session ? { session, method: 'SOURCE_RECORD_REFERENCE', confidence: 1, reasons: ['source record'] } : { session: null, method: 'SOURCE_RECORD_NOT_FOUND', confidence: 0, reasons: [] };
  }

  const hint = relatedSession && typeof relatedSession === 'object' ? relatedSession : {};
  const hintDate = text(hint.localDate || hint.date);
  const eventDate = johannesburgLocalDate(occurredAt);
  const date = hintDate || eventDate;
  const candidates = await sql`
    SELECT * FROM fz_training_sessions
    WHERE local_date=${date} AND status <> 'SUPERSEDED'
    ORDER BY COALESCE(actual_start_at,planned_start_at), session_id
  `;
  if (!candidates.length) return { session: null, method: 'NO_CANDIDATE', confidence: 0, reasons: [] };
  const ranked = candidates.map(candidate => ({ candidate, ...scoreSessionCandidate(candidate, hint, occurredAt, candidates.length) })).sort((a,b) => b.score-a.score);
  const best = ranked[0];
  const second = ranked[1];
  const explicitHint = Boolean(hintDate || text(hint.title) || text(hint.sportType) || text(hint.sessionKind));
  const threshold = explicitHint ? 0.55 : 0.68;
  const margin = second ? best.score-second.score : best.score;
  if (best.score >= threshold && (!second || margin >= 0.12)) {
    return { session: best.candidate, method: explicitHint ? 'ATHLETE_CONTEXT_MATCH' : 'SAME_DAY_CONTEXT_MATCH', confidence: Number(best.score.toFixed(2)), reasons: best.reasons };
  }
  return { session: null, method: 'AMBIGUOUS_CONTEXT', confidence: Number(best.score.toFixed(2)), reasons: best.reasons, candidates: ranked.slice(0,3).map(row => ({ sessionId: row.candidate.session_id, title: row.candidate.title, score: Number(row.score.toFixed(2)) })) };
}

function statusFromAthleteEvent(eventType, currentStatus) {
  if (eventType === 'STOPPED_EARLY') return 'STOPPED_EARLY';
  if (eventType === 'ABORTED') return 'ABORTED';
  if (eventType === 'SKIPPED') return 'SKIPPED';
  if (eventType === 'ATHLETE_MODIFIED' && ['UNKNOWN','PLANNED','RECOMMENDED','ACCEPTED','MODIFIED'].includes(currentStatus)) return 'MODIFIED';
  return null;
}

export async function recordAthleteMemory(input = {}) {
  const summary = text(input.summary || input.rawText);
  if (!summary) throw new Error('summary_required');
  if (summary.length > 1600) throw new Error('summary_too_long');
  const rawText = text(input.rawText);
  if (rawText.length > 16000) throw new Error('raw_text_too_long');
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error('invalid_occurred_at');
  const localDate = johannesburgLocalDate(occurredAt);
  const categories = classifyAthleteMemory({ summary, rawText, categories: input.categories, payload: input.payload });
  const eventType = inferAthleteEventType({ eventType: input.eventType, summary, rawText, phase: input.phase, categories });
  const certainty = inferCertainty({ certainty: input.certainty, categories, summary, rawText });
  const eventKey = athleteEventKey({ idempotencyKey: input.idempotencyKey, occurredAt, summary, rawText });
  const resolution = await resolveAthleteMemorySession({
    sessionId: input.sessionId,
    sourceKey: input.sourceKey,
    sourceRecordId: input.sourceRecordId,
    relatedSession: input.relatedSession,
    occurredAt
  });

  if (input.sessionId && !resolution.session) throw new Error(`unknown_session:${input.sessionId}`);
  if (input.sourceKey && input.sourceRecordId && !resolution.session) throw new Error(`unknown_source_record:${input.sourceKey}:${input.sourceRecordId}`);

  const payload = {
    ...(input.payload && typeof input.payload === 'object' ? input.payload : {}),
    ...(rawText ? { rawText } : {}),
    summary,
    memoryCategories: categories,
    sourceOrigin: 'forward-athlete-memory-v1',
    linkResolution: {
      method: resolution.method,
      confidence: resolution.confidence,
      reasons: resolution.reasons || [],
      linked: Boolean(resolution.session),
      ...(resolution.candidates ? { candidates: resolution.candidates } : {})
    },
    ...(input.timestampPrecision ? { timestampPrecision: text(input.timestampPrecision) } : {})
  };
  const ingestSourceKey = text(input.ingestSourceKey) || 'conversation';
  const source = await ingestTrainingSourceRecord({
    sourceKey: ingestSourceKey,
    recordType: 'athlete_feedback',
    sourceRecordId: eventKey,
    sourceUpdatedAt: occurredAt.toISOString(),
    localDate,
    payload
  });

  const inserted = await appendAthleteEvent({
    eventKey,
    sessionId: resolution.session?.session_id || null,
    eventType,
    occurredAt: occurredAt.toISOString(),
    localDate,
    actor: 'ATHLETE',
    sourceKey: ingestSourceKey,
    sourceRecordPk: source.id,
    certainty,
    summary,
    payload
  });

  const sql = await getSql();
  let eventId = inserted?.event_id || null;
  if (!eventId) {
    const rows = await sql`SELECT event_id, session_id FROM fz_athlete_events WHERE event_key=${eventKey} LIMIT 1`;
    eventId = rows[0]?.event_id || null;
    if (rows[0] && !rows[0].session_id && resolution.session?.session_id) {
      await sql`
        UPDATE fz_athlete_events
        SET session_id=${resolution.session.session_id}
        WHERE event_key=${eventKey} AND session_id IS NULL
      `;
    }
  }

  if (resolution.session) {
    await linkTrainingSource({
      sessionId: resolution.session.session_id,
      sourceRecordPk: source.id,
      relationship: 'EVIDENCE',
      matchMethod: resolution.method,
      matchConfidence: resolution.confidence
    });
    const nextStatus = statusFromAthleteEvent(eventType, resolution.session.status);
    if (nextStatus) await setTrainingSessionState(resolution.session.session_id, { status: nextStatus });
  }

  return {
    ok: true,
    inserted: Boolean(inserted),
    eventId,
    eventKey,
    sourceRecordPk: source.id,
    occurredAt: occurredAt.toISOString(),
    localDate,
    eventType,
    certainty,
    categories,
    resolution: {
      method: resolution.method,
      confidence: resolution.confidence,
      linkedSession: resolution.session ? {
        sessionId: resolution.session.session_id,
        localDate: String(resolution.session.local_date).slice(0,10),
        title: resolution.session.title,
        sportType: resolution.session.sport_type,
        sessionKind: resolution.session.session_kind,
        status: statusFromAthleteEvent(eventType, resolution.session.status) || resolution.session.status
      } : null,
      candidates: resolution.candidates || null
    }
  };
}
