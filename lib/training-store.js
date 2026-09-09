import crypto from 'node:crypto';
import { getSql } from './db.js';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function sourceHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

export async function ingestTrainingSourceRecord({
  sourceKey,
  recordType,
  sourceRecordId,
  sourceUpdatedAt = null,
  localDate,
  payload
}) {
  const sql = await getSql();
  const hash = sourceHash(payload);
  const inserted = await sql`
    INSERT INTO fz_training_source_records
      (source_key, record_type, source_record_id, source_updated_at, local_date, source_hash, payload)
    VALUES
      (${sourceKey}, ${recordType}, ${sourceRecordId}, ${sourceUpdatedAt}, ${localDate}, ${hash}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (source_key, record_type, source_record_id, source_hash) DO NOTHING
    RETURNING id, source_hash
  `;
  if (inserted[0]) return inserted[0];
  const existing = await sql`
    SELECT id, source_hash
    FROM fz_training_source_records
    WHERE source_key=${sourceKey} AND record_type=${recordType}
      AND source_record_id=${sourceRecordId} AND source_hash=${hash}
    LIMIT 1
  `;
  return existing[0];
}

export async function upsertTrainingSession({
  sessionId,
  localDate,
  plannedStartAt = null,
  actualStartAt = null,
  title = null,
  sportType = null,
  sessionKind = null,
  status = 'UNKNOWN',
  reconciliationState = 'UNMATCHED',
  parentSessionId = null
}) {
  const sql = await getSql();
  const rows = await sql`
    INSERT INTO fz_training_sessions
      (session_id, local_date, planned_start_at, actual_start_at, title, sport_type, session_kind, status, reconciliation_state, parent_session_id)
    VALUES
      (${sessionId}, ${localDate}, ${plannedStartAt}, ${actualStartAt}, ${title}, ${sportType}, ${sessionKind}, ${status}, ${reconciliationState}, ${parentSessionId})
    ON CONFLICT (session_id) DO UPDATE SET
      local_date = EXCLUDED.local_date,
      planned_start_at = COALESCE(EXCLUDED.planned_start_at, fz_training_sessions.planned_start_at),
      actual_start_at = COALESCE(EXCLUDED.actual_start_at, fz_training_sessions.actual_start_at),
      title = COALESCE(NULLIF(EXCLUDED.title,''), fz_training_sessions.title),
      sport_type = COALESCE(NULLIF(EXCLUDED.sport_type,''), fz_training_sessions.sport_type),
      session_kind = COALESCE(NULLIF(EXCLUDED.session_kind,''), fz_training_sessions.session_kind),
      status = CASE
        WHEN fz_training_sessions.status IN ('STOPPED_EARLY','ABORTED','SKIPPED','SUPERSEDED') THEN fz_training_sessions.status
        ELSE EXCLUDED.status
      END,
      reconciliation_state = CASE
        WHEN fz_training_sessions.reconciliation_state='MANUAL' THEN 'MANUAL'
        ELSE EXCLUDED.reconciliation_state
      END,
      parent_session_id = COALESCE(EXCLUDED.parent_session_id, fz_training_sessions.parent_session_id),
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0];
}

export async function setTrainingSessionState(sessionId, { status = null, reconciliationState = null, parentSessionId = null } = {}) {
  const sql = await getSql();
  const rows = await sql`
    UPDATE fz_training_sessions SET
      status = COALESCE(${status}, status),
      reconciliation_state = COALESCE(${reconciliationState}, reconciliation_state),
      parent_session_id = COALESCE(${parentSessionId}, parent_session_id),
      updated_at = NOW()
    WHERE session_id=${sessionId}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function linkTrainingSource({ sessionId, sourceRecordPk, relationship, matchMethod = 'SOURCE_NATIVE', matchConfidence = null }) {
  const sql = await getSql();
  await sql`
    INSERT INTO fz_training_session_sources
      (session_id, source_record_pk, relationship, match_method, match_confidence)
    VALUES (${sessionId}, ${sourceRecordPk}, ${relationship}, ${matchMethod}, ${matchConfidence})
    ON CONFLICT (session_id, source_record_pk, relationship) DO UPDATE SET
      match_method=EXCLUDED.match_method,
      match_confidence=EXCLUDED.match_confidence
  `;
}

export async function appendAthleteEvent({
  eventKey,
  sessionId = null,
  eventType,
  occurredAt,
  localDate,
  actor,
  sourceKey = null,
  sourceRecordPk = null,
  certainty = 'OBSERVED',
  summary = null,
  payload = {}
}) {
  const sql = await getSql();
  const rows = await sql`
    INSERT INTO fz_athlete_events
      (event_key, session_id, event_type, occurred_at, local_date, actor, source_key, source_record_pk, certainty, summary, payload)
    VALUES
      (${eventKey}, ${sessionId}, ${eventType}, ${occurredAt}, ${localDate}, ${actor}, ${sourceKey}, ${sourceRecordPk}, ${certainty}, ${summary}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (event_key) DO NOTHING
    RETURNING event_id
  `;
  return rows[0] || null;
}

export async function latestSourceRecords({ sourceKey, recordType, startDate, endDate }) {
  const sql = await getSql();
  return sql`
    SELECT * FROM fz_training_source_latest
    WHERE source_key=${sourceKey} AND record_type=${recordType}
      AND local_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY local_date, source_record_id
  `;
}

export async function findSessionBySourceRecord(sourceRecordPk) {
  const sql = await getSql();
  const rows = await sql`
    SELECT s.*, l.relationship, l.match_method, l.match_confidence
    FROM fz_training_session_sources l
    JOIN fz_training_sessions s ON s.session_id=l.session_id
    WHERE l.source_record_pk=${sourceRecordPk}
    ORDER BY l.linked_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function readTrainingRange(startDate, endDate) {
  const sql = await getSql();
  const sessions = await sql`
    SELECT * FROM fz_training_sessions
    WHERE local_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY local_date, COALESCE(actual_start_at, planned_start_at), session_id
  `;
  const events = await sql`
    SELECT * FROM fz_athlete_events
    WHERE local_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY occurred_at, event_id
  `;
  const sources = await sql`
    SELECT l.session_id, l.relationship, l.match_method, l.match_confidence,
           r.id AS source_record_pk, r.source_key, r.record_type, r.source_record_id,
           r.source_updated_at, r.local_date, r.payload, r.ingested_at
    FROM fz_training_session_sources l
    JOIN fz_training_source_records r ON r.id=l.source_record_pk
    JOIN fz_training_sessions s ON s.session_id=l.session_id
    WHERE s.local_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY s.local_date, l.session_id, r.ingested_at
  `;
  return { sessions, events, sources };
}
