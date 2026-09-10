import { getSql } from './db.js';
import { ingestTrainingSourceRecord } from './training-store.js';
import { MATERIALITY_ENGINE_VERSION } from './materiality-engine.js';

const SOURCE_KEY = 'fz-intelligence';
const CONTEXT_TYPE = 'MATERIALITY_ASSESSMENT';
const TZ = 'Africa/Johannesburg';

function localDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('invalid_materiality_occurred_at');
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function materialitySemanticPayload({
  evidenceKey,
  sourceType,
  sourceKey = null,
  sourceRecordPk = null,
  athleteEventId = null,
  summary = null,
  assessment
}) {
  return {
    contextType: CONTEXT_TYPE,
    evidenceKey,
    evidenceSourceType: sourceType || assessment?.sourceType || null,
    evidenceSourceKey: sourceKey,
    evidenceSourceRecordPk: sourceRecordPk,
    athleteEventId,
    evidenceSummary: summary,
    engineVersion: assessment?.engineVersion || MATERIALITY_ENGINE_VERSION,
    materiality: assessment
  };
}

export async function persistMaterialityAssessment({
  evidenceKey,
  sourceType,
  sourceKey = null,
  sourceRecordPk = null,
  athleteEventId = null,
  occurredAt = null,
  summary = null,
  assessment
}) {
  if (!evidenceKey) throw new Error('materiality_evidence_key_required');
  if (!assessment || typeof assessment !== 'object') throw new Error('materiality_assessment_required');

  // Keep volatile processing time out of the hashed payload. The append-only
  // source ledger is content-addressed by source hash, so including "now" here
  // would manufacture a new canonical assessment on every no-op replay. The
  // actual first persistence time remains available as source_updated_at /
  // ingested_at metadata on the ledger row.
  const payload = materialitySemanticPayload({
    evidenceKey,
    sourceType,
    sourceKey,
    sourceRecordPk,
    athleteEventId,
    summary,
    assessment
  });
  const assessedAt = new Date().toISOString();

  return ingestTrainingSourceRecord({
    sourceKey: SOURCE_KEY,
    recordType: 'event_context',
    sourceRecordId: `materiality:${payload.engineVersion}:${evidenceKey}`,
    sourceUpdatedAt: assessedAt,
    localDate: localDate(occurredAt),
    payload
  });
}

export async function readRecentMaterialityAssessments({ limit = 50 } = {}) {
  const sql = await getSql();
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return sql`
    SELECT id, source_record_id, local_date::text AS local_date, source_updated_at, ingested_at, payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY}
      AND record_type='event_context'
      AND payload->>'contextType'=${CONTEXT_TYPE}
    ORDER BY COALESCE(source_updated_at, ingested_at) DESC, id DESC
    LIMIT ${safeLimit}
  `;
}
