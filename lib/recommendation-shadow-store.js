import { ingestTrainingSourceRecord } from './training-store.js';
import { getSql } from './db.js';
import { RECOMMENDATION_ENGINE_VERSION } from './recommendation-engine.js';

const SOURCE_KEY='fz-intelligence';
const CONTEXT_TYPE='RECOMMENDATION_SHADOW';
const TZ='Africa/Johannesburg';

function localDate(value){
  const date=value?new Date(value):new Date();
  if(Number.isNaN(date.getTime())) throw new Error('invalid_shadow_recommendation_time');
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

export async function persistRecommendationShadow({evaluation,context,trigger={}}={}){
  if(!evaluation?.recommendationId) throw new Error('shadow_recommendation_id_required');
  if(evaluation.mode!=='SHADOW') throw new Error('shadow_mode_required');
  const payload={
    contextType:CONTEXT_TYPE,
    engineVersion:evaluation.engineVersion||RECOMMENDATION_ENGINE_VERSION,
    mode:'SHADOW',
    recommendationId:evaluation.recommendationId,
    contextFingerprint:evaluation.contextFingerprint,
    status:evaluation.status,
    lane:evaluation.lane,
    confidence:evaluation.confidence,
    reasonCode:evaluation.reasonCode||null,
    reason:evaluation.reason||null,
    scores:evaluation.scores||null,
    explanation:evaluation.explanation||null,
    rules:evaluation.rules||{},
    trigger:{
      type:trigger.type||'MANUAL_OR_SYSTEM',
      evidenceKey:trigger.evidenceKey||null,
      materialityLevel:trigger.materialityLevel||context?.materiality?.level||null,
      reasonCodes:trigger.reasonCodes||context?.materiality?.reasonCodes||[]
    },
    contextSummary:{
      asOf:context?.asOf||localDate(),
      objectiveSource:context?.provenance?.objectiveSource||null,
      primaryObjective:context?.primaryObjective?{id:context.primaryObjective.id,name:context.primaryObjective.name,role:context.primaryObjective.role,runwayDays:context.primaryObjective.runwayDays}:null,
      measurementHierarchyId:context?.measurement?.hierarchyId||null,
      topMeasurementGaps:(context?.measurement?.topGaps||[]).slice(0,3),
      recovery:context?.recovery||null,
      load:context?.load||null,
      sequencing:context?.sequencing||null,
      uncertainty:context?.uncertainty||null
    }
  };
  return ingestTrainingSourceRecord({
    sourceKey:SOURCE_KEY,
    recordType:'event_context',
    sourceRecordId:`recommendation-shadow:${payload.engineVersion}:${evaluation.recommendationId}`,
    sourceUpdatedAt:new Date().toISOString(),
    localDate:localDate(context?.asOf),
    payload
  });
}

export async function readRecentRecommendationShadows({limit=25}={}){
  const sql=await getSql();
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||25));
  return sql`
    SELECT id,source_record_id,local_date::text AS local_date,source_updated_at,ingested_at,payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY}
      AND record_type='event_context'
      AND payload->>'contextType'=${CONTEXT_TYPE}
    ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC
    LIMIT ${safeLimit}
  `;
}
