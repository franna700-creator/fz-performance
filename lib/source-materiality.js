import { getSql } from './db.js';
import { evaluateMateriality, MATERIALITY_ENGINE_VERSION } from './materiality-engine.js';
import { persistMaterialityAssessment } from './materiality-store.js';
import { deriveNcl } from './training-evidence.js';
import { sourceHash } from './training-store.js';

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values = []) {
  const xs = values.map(n).filter(value => value !== null).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function pctDelta(value, baseline) {
  const x = n(value);
  const b = n(baseline);
  if (x === null || b === null || b === 0) return null;
  return Math.round(((x - b) / Math.abs(b)) * 1000) / 10;
}

function absoluteDelta(value, baseline) {
  const x = n(value);
  const b = n(baseline);
  if (x === null || b === null) return null;
  return Math.round((x - b) * 10) / 10;
}

function occurredAtForTraining(row) {
  const candidate = row?.payload?.date || row?.source_updated_at || row?.ingested_at;
  const parsed = candidate ? new Date(candidate) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const localDate = String(row?.local_date || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? `${localDate}T12:00:00.000Z` : new Date().toISOString();
}

function aggregateRecommendationMateriality(items = []) {
  const material = items.map(item => item.assessment).filter(assessment => assessment?.shouldRecomputeRecommendation);
  if (!material.length) return null;
  const highest = material.slice().sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0))[0];
  return {
    engineVersion: MATERIALITY_ENGINE_VERSION,
    level: highest.level,
    rank: highest.rank,
    sourceType: 'SYSTEM_RECONCILIATION',
    reasonCodes: [...new Set(material.flatMap(item => item.reasonCodes || []))],
    affectedDomains: [...new Set(material.flatMap(item => item.affectedDomains || []))],
    shouldUpdateState: true,
    shouldRecomputeRecommendation: true,
    blocksExistingRecommendation: material.some(item => item.blocksExistingRecommendation === true),
    certainty: 'OBSERVED',
    signals: Object.assign({}, ...material.map(item => item.signals || {}))
  };
}

export async function assessTrainingSourceChanges({ afterId = 0, limit = 500 } = {}) {
  const sql = await getSql();
  const floor = Math.max(0, Number(afterId) || 0);
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 500));
  const rows = await sql`
    SELECT r.id,r.source_key,r.record_type,r.source_record_id,r.source_updated_at,
           r.local_date::text AS local_date,r.source_hash,r.payload,r.ingested_at,
           p.payload AS previous_payload,
           EXISTS (
             SELECT 1
             FROM fz_training_session_sources current_link
             JOIN fz_training_session_sources plan_link
               ON plan_link.session_id=current_link.session_id
              AND plan_link.relationship='PLAN'
             WHERE current_link.source_record_pk=r.id
               AND current_link.relationship='EXECUTION'
           ) AS has_plan_link
    FROM fz_training_source_records r
    JOIN fz_training_source_latest canonical ON canonical.id=r.id
    LEFT JOIN LATERAL (
      SELECT previous.payload
      FROM fz_training_source_records previous
      WHERE previous.source_key=r.source_key
        AND previous.record_type=r.record_type
        AND previous.source_record_id=r.source_record_id
        AND previous.id < r.id
      ORDER BY previous.source_updated_at DESC NULLS LAST, previous.ingested_at DESC, previous.id DESC
      LIMIT 1
    ) p ON TRUE
    WHERE r.id > ${floor}
      AND r.source_key <> 'fz-intelligence'
      AND r.record_type IN ('planned_workout','executed_activity')
    ORDER BY r.id ASC
    LIMIT ${safeLimit}
  `;

  const assessments = [];
  for (const row of rows || []) {
    const planned = row.record_type === 'planned_workout';
    const currentNcl = planned ? null : deriveNcl(row.payload || {});
    const previousNcl = planned || !row.previous_payload ? null : deriveNcl(row.previous_payload || {});
    const evidenceGapResolved = !planned && Boolean(row.previous_payload) && previousNcl === null && currentNcl !== null;
    const sequencingChanged = planned || (!planned && row.has_plan_link === true);
    const sourceType = planned ? 'SYSTEM_RECONCILIATION' : 'TRAINING_EXECUTION';
    const eventType = planned ? 'CONTEXT' : 'EXECUTED';
    const title = String(row.payload?.title || row.payload?.name || '').trim();
    const summary = planned
      ? `Canonical training plan changed${title ? `: ${title}` : ''}.`
      : `Canonical executed training evidence changed${title ? `: ${title}` : ''}.`;
    const assessment = evaluateMateriality({
      sourceType,
      eventType,
      certainty: 'OBSERVED',
      summary,
      signals: { sequencingChanged, evidenceGapResolved },
      payload: {
        sourceKey: row.source_key,
        recordType: row.record_type,
        sourceRecordId: row.source_record_id,
        nclAvailable: currentNcl !== null,
        evidenceGapResolved,
        sequencingChanged
      }
    });
    const evidenceKey = `training:${row.source_key}:${row.record_type}:${row.source_record_id}:${row.source_hash}`;
    const persisted = await persistMaterialityAssessment({
      evidenceKey,
      sourceType,
      sourceKey: row.source_key,
      sourceRecordPk: row.id,
      occurredAt: occurredAtForTraining(row),
      summary,
      assessment
    });
    assessments.push({
      evidenceKey,
      sourceRecordPk: Number(row.id),
      sourceKey: row.source_key,
      recordType: row.record_type,
      ncl: currentNcl,
      evidenceGapResolved,
      sequencingChanged,
      assessment,
      materialityRecordPk: persisted?.id || null
    });
  }

  return {
    scanned: rows?.length || 0,
    assessments,
    recommendationMateriality: aggregateRecommendationMateriality(assessments)
  };
}

export function wellnessDecisionSignature(row = {}) {
  return {
    localDate: String(row.local_date || '').slice(0, 10) || null,
    hrvLastNight: n(row.hrv_last_night),
    restingHeartRate: n(row.resting_heart_rate),
    sleepScore: n(row.sleep_score),
    bodyBatteryHigh: n(row.body_battery_high)
  };
}

export function wellnessSignalsAgainstBaseline(current = {}, history = []) {
  const usable = (history || []).filter(Boolean);
  const hrvBaseline = median(usable.map(row => row.hrv_last_night));
  const rhrBaseline = median(usable.map(row => row.resting_heart_rate));
  const sleepBaseline = median(usable.map(row => row.sleep_score));
  const batteryBaseline = median(usable.map(row => row.body_battery_high));
  return {
    hrvDeltaPct: usable.filter(row => n(row.hrv_last_night) !== null).length >= 3 ? pctDelta(current.hrv_last_night, hrvBaseline) : null,
    rhrDeltaBpm: usable.filter(row => n(row.resting_heart_rate) !== null).length >= 3 ? absoluteDelta(current.resting_heart_rate, rhrBaseline) : null,
    sleepScoreDelta: usable.filter(row => n(row.sleep_score) !== null).length >= 3 ? absoluteDelta(current.sleep_score, sleepBaseline) : null,
    bodyBatteryDelta: usable.filter(row => n(row.body_battery_high) !== null).length >= 3 ? absoluteDelta(current.body_battery_high, batteryBaseline) : null
  };
}

export async function assessWellnessCurrentMateriality({ date } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('wellness_materiality_date_required');
  const sql = await getSql();
  const currentRows = await sql`
    SELECT id,source_key,local_date::text AS local_date,source_as_of,source_hash,
           hrv_last_night,resting_heart_rate,sleep_score,body_battery_high,ingested_at
    FROM fz_wellness_current
    WHERE local_date=${date}::date
    ORDER BY source_as_of DESC,ingested_at DESC,id DESC
    LIMIT 1
  `;
  const current = currentRows?.[0] || null;
  if (!current) return { status: 'NO_WELLNESS', assessment: null, materialityRecordPk: null };

  const history = await sql`
    SELECT local_date::text AS local_date,hrv_last_night,resting_heart_rate,sleep_score,body_battery_high
    FROM fz_wellness_current
    WHERE source_key=${current.source_key}
      AND local_date < ${date}::date
      AND local_date >= (${date}::date - INTERVAL '14 days')
    ORDER BY local_date DESC
    LIMIT 7
  `;
  const signature = wellnessDecisionSignature(current);
  const decisionHash = sourceHash(signature);
  const signals = wellnessSignalsAgainstBaseline(current, history || []);
  const assessment = evaluateMateriality({
    sourceType: 'WELLNESS_OBSERVATION',
    eventType: 'CONTEXT',
    certainty: 'OBSERVED',
    summary: `Garmin wellness decision signals for ${date}.`,
    signals,
    payload: { decisionSignature: signature, baselineDays: Math.min(7, history?.length || 0) }
  });
  const evidenceKey = `wellness:${current.source_key}:${date}:${decisionHash}`;
  const persisted = await persistMaterialityAssessment({
    evidenceKey,
    sourceType: 'WELLNESS_OBSERVATION',
    sourceKey: current.source_key,
    sourceRecordPk: null,
    occurredAt: current.source_as_of || current.ingested_at,
    summary: `Garmin wellness decision signals for ${date}.`,
    assessment
  });
  return {
    status: 'ASSESSED',
    evidenceKey,
    decisionHash,
    sourceSnapshotId: Number(current.id),
    baselineDays: Math.min(7, history?.length || 0),
    signals,
    assessment,
    materialityRecordPk: persisted?.id || null
  };
}
