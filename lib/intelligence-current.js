import crypto from 'node:crypto';
import { getSql } from './db.js';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function intelligenceRevision(markers = {}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stable(markers)))
    .digest('hex');
}

function marker(row, idKey = 'id', timeKey = 'at') {
  if (!row) return null;
  return {
    id: row[idKey] == null ? null : String(row[idKey]),
    at: row[timeKey] || null
  };
}

export function buildIntelligenceCurrent(rows = {}) {
  const markers = {
    runtime: rows.runtime ? {
      stateId: rows.runtime.current_state_id || null,
      pointerVersion: Number(rows.runtime.pointer_version || 0),
      updatedAt: rows.runtime.updated_at || null
    } : null,
    athleteEvent: marker(rows.athleteEvent, 'event_id', 'occurred_at'),
    trainingEvidence: marker(rows.trainingEvidence, 'id', 'ingested_at'),
    wellnessEvidence: marker(rows.wellnessEvidence, 'id', 'source_as_of'),
    materiality: marker(rows.materiality, 'id', 'source_updated_at'),
    shadowRecommendation: marker(rows.shadowRecommendation, 'id', 'source_updated_at'),
    activeRecommendation: marker(rows.activeRecommendation, 'id', 'source_updated_at'),
    athleteDecision: marker(rows.athleteDecision, 'id', 'source_updated_at'),
    objective: rows.objective ? {
      id: String(rows.objective.objective_id ?? rows.objective.id ?? ''),
      updatedAt: rows.objective.updated_at || rows.objective.created_at || null
    } : null
  };

  const latestInputId = Math.max(
    Number(rows.athleteEvent?.event_id || 0),
    Number(rows.trainingEvidence?.id || 0),
    Number(rows.wellnessEvidence?.id || 0)
  );
  const latestAssessmentId = Number(rows.materiality?.id || 0);
  const latestShadowId = Number(rows.shadowRecommendation?.id || 0);
  const latestActiveId = Number(rows.activeRecommendation?.id || 0);

  const pending = {
    materiality: latestInputId > 0 && latestAssessmentId === 0,
    shadowRecommendation: latestAssessmentId > 0 && latestShadowId === 0,
    activeRecommendation: latestShadowId > 0 && latestActiveId === 0
  };

  return {
    revision: intelligenceRevision(markers),
    markers,
    pending,
    pendingPropagation: Object.values(pending).some(Boolean),
    activeRecommendation: rows.activeRecommendation?.payload || null,
    athleteDecision: rows.athleteDecision?.payload || null,
    affectedSurfaces: ['TODAY', 'TRAIN', 'TRENDS', 'SYSTEM']
  };
}

async function one(sql, query) {
  const rows = await query(sql);
  return rows?.[0] || null;
}

export async function readIntelligenceCurrent() {
  const sql = await getSql();
  const [runtime, athleteEvent, trainingEvidence, wellnessEvidence, materiality, shadowRecommendation, activeRecommendation, athleteDecision, objective] = await Promise.all([
    one(sql, db => db`SELECT current_state_id,pointer_version,updated_at FROM fz_runtime_state_pointer WHERE id=1`),
    one(sql, db => db`SELECT event_id,occurred_at FROM fz_athlete_events ORDER BY event_id DESC LIMIT 1`),
    one(sql, db => db`
      SELECT id,ingested_at FROM fz_training_source_records
      WHERE source_key <> 'fz-intelligence'
      ORDER BY id DESC LIMIT 1
    `),
    one(sql, db => db`SELECT id,source_as_of FROM fz_wellness_snapshots ORDER BY id DESC LIMIT 1`),
    one(sql, db => db`
      SELECT id,source_updated_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='event_context'
        AND payload->>'contextType'='MATERIALITY_ASSESSMENT'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='event_context'
        AND payload->>'contextType'='RECOMMENDATION_SHADOW'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='recommendation'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='decision'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT objective_id,updated_at,created_at FROM fz_objectives
      WHERE status='ACTIVE'
      ORDER BY priority ASC,updated_at DESC LIMIT 1
    `).catch(() => null)
  ]);

  return buildIntelligenceCurrent({
    runtime,
    athleteEvent,
    trainingEvidence,
    wellnessEvidence,
    materiality,
    shadowRecommendation,
    activeRecommendation,
    athleteDecision,
    objective
  });
}
