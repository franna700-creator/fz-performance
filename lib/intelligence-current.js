import crypto from 'node:crypto';
import { getSql } from './db.js';
import { SESSION_OPTION_COMPOSER_VERSION } from './session-option-composer.js';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

export function intelligenceRevision(markers = {}) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(markers))).digest('hex');
}
function firstValue(row, keys = []) { for (const key of keys) if (row?.[key] != null) return row[key]; return null; }
function marker(row, idKey = 'id', timeKeys = ['ingested_at']) { if (!row) return null; return { id: row[idKey] == null ? null : String(row[idKey]), at: firstValue(row, timeKeys) }; }
function epoch(value) { if (!value) return 0; const time = new Date(value).getTime(); return Number.isFinite(time) ? time : 0; }
function newer(upstream, downstream) { const up=epoch(upstream),down=epoch(downstream); return up>0&&(down===0||up>down); }
function newest(...values) { let best=null,bestEpoch=0; for(const value of values){const time=epoch(value);if(time>bestEpoch){best=value;bestEpoch=time;}} return best; }
function materialityMatchesEvent(athleteEvent, materiality) {
  if (!athleteEvent) return true;
  if (!materiality?.payload) return false;
  const eventId=String(athleteEvent.event_id??''),assessedEventId=String(materiality.payload.athleteEventId??''),eventKey=String(athleteEvent.event_key??''),evidenceKey=String(materiality.payload.evidenceKey??'');
  return Boolean((eventId&&assessedEventId&&eventId===assessedEventId)||(eventKey&&evidenceKey&&eventKey===evidenceKey));
}
function activeMatchesShadow(shadowRecommendation, activeRecommendation) {
  if (!shadowRecommendation) return true;
  if (!activeRecommendation?.payload || !shadowRecommendation?.payload) return false;
  const shadow=shadowRecommendation.payload,active=activeRecommendation.payload;
  return Boolean(
    shadow.recommendationId && active.shadowRecommendationId===shadow.recommendationId && active.contextFingerprint===shadow.contextFingerprint &&
    active.status===(shadow.status==='READY'?'READY':'WITHHELD') &&
    active.sessionOptionComposerVersion===SESSION_OPTION_COMPOSER_VERSION
  );
}

export function buildIntelligenceCurrent(rows = {}) {
  const runtimeAt=firstValue(rows.runtime,['updated_at']),trainingEvidenceAt=firstValue(rows.trainingEvidence,['source_updated_at','ingested_at']),wellnessEvidenceAt=firstValue(rows.wellnessEvidence,['source_as_of','ingested_at']),objectiveAt=firstValue(rows.objective,['updated_at','created_at']),materialityAt=firstValue(rows.materiality,['source_updated_at','ingested_at']),decisionMaterialityAt=firstValue(rows.decisionMateriality,['source_updated_at','ingested_at']),shadowAt=firstValue(rows.shadowRecommendation,['source_updated_at','ingested_at']),activeAt=firstValue(rows.activeRecommendation,['source_updated_at','ingested_at']);
  const materialitySatisfied=materialityMatchesEvent(rows.athleteEvent,rows.materiality),materialityAssessment=materialitySatisfied?rows.materiality?.payload?.materiality||null:null,materialityDrivesRecommendation=materialityAssessment?.shouldRecomputeRecommendation===true;
  const markers={
    runtime:rows.runtime?{stateId:rows.runtime.current_state_id||null,pointerVersion:Number(rows.runtime.pointer_version||0),updatedAt:rows.runtime.updated_at||null}:null,
    athleteEvent:rows.athleteEvent?{id:String(rows.athleteEvent.event_id??''),eventKey:rows.athleteEvent.event_key||null,at:firstValue(rows.athleteEvent,['occurred_at','created_at'])}:null,
    trainingEvidence:marker(rows.trainingEvidence,'id',['source_updated_at','ingested_at']),wellnessEvidence:marker(rows.wellnessEvidence,'id',['source_as_of','ingested_at']),materiality:marker(rows.materiality,'id',['source_updated_at','ingested_at']),decisionMateriality:marker(rows.decisionMateriality,'id',['source_updated_at','ingested_at']),shadowRecommendation:marker(rows.shadowRecommendation,'id',['source_updated_at','ingested_at']),activeRecommendation:marker(rows.activeRecommendation,'id',['source_updated_at','ingested_at']),athleteDecision:marker(rows.athleteDecision,'id',['source_updated_at','ingested_at']),objective:rows.objective?{id:String(rows.objective.objective_id??rows.objective.id??''),updatedAt:objectiveAt}:null,
    sessionOptionComposerVersion:SESSION_OPTION_COMPOSER_VERSION
  };
  const pendingMateriality=Boolean(rows.athleteEvent)&&!materialitySatisfied,decisionEvidenceAt=newest(runtimeAt,objectiveAt,decisionMaterialityAt),pendingShadow=newer(decisionEvidenceAt,shadowAt),pendingActive=Boolean(rows.shadowRecommendation)&&!activeMatchesShadow(rows.shadowRecommendation,rows.activeRecommendation);
  const pending={materiality:pendingMateriality,shadowRecommendation:pendingShadow,activeRecommendation:pendingActive};
  return {
    revision:intelligenceRevision(markers),markers,
    freshness:{canonicalEvidenceAt:newest(runtimeAt,firstValue(rows.athleteEvent,['occurred_at','created_at']),trainingEvidenceAt,wellnessEvidenceAt,objectiveAt),materialityAt,decisionMaterialityAt,decisionEvidenceAt,shadowRecommendationAt:shadowAt,activeRecommendationAt:activeAt},
    dependencyState:{latestAthleteEventAssessed:!pendingMateriality,latestMaterialityDrivesRecommendation:materialityDrivesRecommendation,recommendationInvalidationOwnedByMateriality:true,activeMatchesShadow:!pendingActive,sessionOptionComposerCurrent:!pendingActive},
    pending,pendingPropagation:Object.values(pending).some(Boolean),activeRecommendation:rows.activeRecommendation?.payload||null,athleteDecision:rows.athleteDecision?.payload||null,affectedSurfaces:['TODAY','TRAIN','TRENDS','SYSTEM']
  };
}

async function one(sql, query) { const rows=await query(sql); return rows?.[0]||null; }
export async function readIntelligenceCurrent() {
  const sql=await getSql();
  const [runtime,athleteEvent,trainingEvidence,wellnessEvidence,materiality,decisionMateriality,shadowRecommendation,activeRecommendation,athleteDecision,objective]=await Promise.all([
    one(sql,db=>db`SELECT current_state_id,pointer_version,updated_at FROM fz_runtime_state_pointer WHERE id=1`),
    one(sql,db=>db`SELECT event_id,event_key,occurred_at,created_at FROM fz_athlete_events WHERE actor='ATHLETE' ORDER BY event_id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at FROM fz_training_source_latest WHERE source_key <> 'fz-intelligence' AND record_type IN ('planned_workout','executed_activity') ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_as_of,ingested_at FROM fz_wellness_snapshots ORDER BY source_as_of DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest WHERE source_key='fz-intelligence' AND record_type='event_context' AND payload->>'contextType'='MATERIALITY_ASSESSMENT' AND payload->>'evidenceKey'=(SELECT event_key FROM fz_athlete_events WHERE actor='ATHLETE' ORDER BY event_id DESC LIMIT 1) ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest WHERE source_key='fz-intelligence' AND record_type='event_context' AND payload->>'contextType'='MATERIALITY_ASSESSMENT' AND payload->'materiality'->>'shouldRecomputeRecommendation'='true' ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest WHERE source_key='fz-intelligence' AND record_type='event_context' AND payload->>'contextType'='RECOMMENDATION_SHADOW' ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest WHERE source_key='fz-intelligence' AND record_type='recommendation' AND payload->>'contextType'='ACTIVE_RECOMMENDATION' ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT id,source_updated_at,ingested_at,payload FROM fz_training_source_latest WHERE source_key='fz-intelligence' AND record_type='decision' ORDER BY source_updated_at DESC NULLS LAST,ingested_at DESC,id DESC LIMIT 1`),
    one(sql,db=>db`SELECT objective_id,role,updated_at,created_at FROM fz_objectives WHERE state='ACTIVE' ORDER BY CASE role WHEN 'PRIMARY' THEN 0 WHEN 'SECONDARY' THEN 1 WHEN 'VALIDATION' THEN 2 ELSE 3 END,updated_at DESC LIMIT 1`).catch(()=>null)
  ]);
  return buildIntelligenceCurrent({runtime,athleteEvent,trainingEvidence,wellnessEvidence,materiality,decisionMateriality,shadowRecommendation,activeRecommendation,athleteDecision,objective});
}
