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

function firstValue(row, keys = []) {
  for (const key of keys) {
    if (row?.[key] != null) return row[key];
  }
  return null;
}

function marker(row, idKey = 'id', timeKeys = ['ingested_at']) {
  if (!row) return null;
  return {
    id: row[idKey] == null ? null : String(row[idKey]),
    at: firstValue(row, timeKeys)
  };
}

function epoch(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function newer(upstream, downstream) {
  const up = epoch(upstream);
  const down = epoch(downstream);
  return up > 0 && (down === 0 || up > down);
}

function newest(...values) {
  let best = null;
  let bestEpoch = 0;
  for (const value of values) {
    const time = epoch(value);
    if (time > bestEpoch) {
      best = value;
      bestEpoch = time;
    }
  }
  return best;
}

function materialityMatchesEvent(athleteEvent, materiality) {
  if (!athleteEvent) return true;
  if (!materiality?.payload) return false;
  const eventId = String(athleteEvent.event_id ?? '');
  const assessedEventId = String(materiality.payload.athleteEventId ?? '');
  const eventKey = String(athleteEvent.event_key ?? '');
  const evidenceKey = String(materiality.payload.evidenceKey ?? '');
  return Boolean(
    (eventId && assessedEventId && eventId === assessedEventId) ||
    (eventKey && evidenceKey && eventKey === evidenceKey)
  );
}

export function buildIntelligenceCurrent(rows = {}) {
  const trainingEvidenceAt = firstValue(rows.trainingEvidence, ['ingested_at', 'source_updated_at']);
  const wellnessEvidenceAt = firstValue(rows.wellnessEvidence, ['ingested_at', 'source_as_of']);
  const objectiveAt = firstValue(rows.objective, ['updated_at', 'created_at']);
  const materialityAt = firstValue(rows.materiality, ['ingested_at', 'source_updated_at']);
  const shadowAt = firstValue(rows.shadowRecommendation, ['ingested_at', 'source_updated_at']);
  const activeAt = firstValue(rows.activeRecommendation, ['ingested_at', 'source_updated_at']);
  const materialitySatisfied = materialityMatchesEvent(rows.athleteEvent, rows.materiality);
  const materialityAssessment = materialitySatisfied ? rows.materiality?.payload?.materiality || null : null;
  const materialityDrivesRecommendation = materialityAssessment?.shouldRecomputeRecommendation === true;

  const markers = {
    runtime: rows.runtime ? {
      stateId: rows.runtime.current_state_id || null,
      pointerVersion: Number(rows.runtime.pointer_version || 0),
      updatedAt: rows.runtime.updated_at || null
    } : null,
    athleteEvent: rows.athleteEvent ? {
      id: String(rows.athleteEvent.event_id ?? ''),
      eventKey: rows.athleteEvent.event_key || null,
      at: firstValue(rows.athleteEvent, ['created_at', 'occurred_at'])
    } : null,
    trainingEvidence: marker(rows.trainingEvidence, 'id', ['ingested_at', 'source_updated_at']),
    wellnessEvidence: marker(rows.wellnessEvidence, 'id', ['ingested_at', 'source_as_of']),
    materiality: marker(rows.materiality, 'id', ['ingested_at', 'source_updated_at']),
    shadowRecommendation: marker(rows.shadowRecommendation, 'id', ['ingested_at', 'source_updated_at']),
    activeRecommendation: marker(rows.activeRecommendation, 'id', ['ingested_at', 'source_updated_at']),
    athleteDecision: marker(rows.athleteDecision, 'id', ['ingested_at', 'source_updated_at']),
    objective: rows.objective ? {
      id: String(rows.objective.objective_id ?? rows.objective.id ?? ''),
      updatedAt: objectiveAt
    } : null
  };

  const pendingMateriality = Boolean(rows.athleteEvent) && !materialitySatisfied;
  const nonAthleteDecisionEvidenceAt = newest(trainingEvidenceAt, wellnessEvidenceAt, objectiveAt);
  const materialAthleteEvidenceAt = materialityDrivesRecommendation ? materialityAt : null;
  const decisionEvidenceAt = newest(nonAthleteDecisionEvidenceAt, materialAthleteEvidenceAt);
  const pendingShadow = newer(decisionEvidenceAt, shadowAt);
  const pendingActive = newer(shadowAt, activeAt);

  const pending = {
    materiality: pendingMateriality,
    shadowRecommendation: pendingShadow,
    activeRecommendation: pendingActive
  };

  return {
    revision: intelligenceRevision(markers),
    markers,
    freshness: {
      canonicalEvidenceAt: newest(
        firstValue(rows.athleteEvent, ['created_at', 'occurred_at']),
        trainingEvidenceAt,
        wellnessEvidenceAt,
        objectiveAt
      ),
      materialityAt,
      shadowRecommendationAt: shadowAt,
      activeRecommendationAt: activeAt
    },
    dependencyState: {
      latestAthleteEventAssessed: !pendingMateriality,
      latestMaterialityDrivesRecommendation: materialityDrivesRecommendation
    },
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
    one(sql, db => db`SELECT event_id,event_key,occurred_at,created_at FROM fz_athlete_events ORDER BY event_id DESC LIMIT 1`),
    one(sql, db => db`
      SELECT id,source_updated_at,ingested_at FROM fz_training_source_records
      WHERE source_key <> 'fz-intelligence'
        AND record_type IN ('planned_workout','executed_activity')
      ORDER BY id DESC LIMIT 1
    `),
    one(sql, db => db`SELECT id,source_as_of,ingested_at FROM fz_wellness_snapshots ORDER BY id DESC LIMIT 1`),
    one(sql, db => db`
      SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='event_context'
        AND payload->>'contextType'='MATERIALITY_ASSESSMENT'
        AND payload->>'evidenceKey'=(SELECT event_key FROM fz_athlete_events ORDER BY event_id DESC LIMIT 1)
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='event_context'
        AND payload->>'contextType'='RECOMMENDATION_SHADOW'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='recommendation'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest
      WHERE source_key='fz-intelligence' AND record_type='decision'
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
    `),
    one(sql, db => db`
      SELECT objective_id,role,updated_at,created_at FROM fz_objectives
      WHERE state='ACTIVE'
      ORDER BY CASE role
        WHEN 'PRIMARY' THEN 0
        WHEN 'SECONDARY' THEN 1
        WHEN 'VALIDATION' THEN 2
        ELSE 3
      END, updated_at DESC
      LIMIT 1
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
