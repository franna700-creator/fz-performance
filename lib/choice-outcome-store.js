import { getSql } from './db.js';
import { ingestTrainingSourceRecord } from './training-store.js';
import { buildChoiceOutcomeObservation } from './choice-outcome.js';

const SOURCE_KEY='fz-intelligence';
const RECORD_TYPE='choice_outcome';
const RESPONSE_CATEGORIES=new Set(['STATE','RECOVERY','CONSTRAINT','COST','SESSION']);
const CHOICE_EVENT_TYPES=new Set(['ATHLETE_ACCEPTED','ATHLETE_MODIFIED']);

function sourceRecordId(decisionId,executionSessionId){return `choice-outcome:${decisionId}:${executionSessionId}`;}
function isResponseEvent(row){
  if(!row||CHOICE_EVENT_TYPES.has(String(row.event_type||'').toUpperCase()))return false;
  const categories=Array.isArray(row.payload?.memoryCategories)?row.payload.memoryCategories.map(value=>String(value||'').toUpperCase()):[];
  return categories.some(category=>RESPONSE_CATEGORIES.has(category));
}

export async function readFzPlanForExecution(sessionId){
  if(!sessionId)return null;
  const sql=await getSql();
  const rows=await sql`
    SELECT r.id AS source_record_pk,r.source_record_id,r.local_date::text AS local_date,r.payload
    FROM fz_training_session_sources l
    JOIN fz_training_source_records r ON r.id=l.source_record_pk
    WHERE l.session_id=${sessionId}
      AND l.relationship='PLAN'
      AND r.source_key='fz-intelligence'
      AND r.record_type='planned_workout'
      AND r.payload->>'contextType'='FZ_PLANNED_INTENT'
    ORDER BY r.id DESC LIMIT 1
  `;
  return rows?.[0]||null;
}

export async function readLatestChoiceOutcome(decisionId,executionSessionId){
  if(!decisionId||!executionSessionId)return null;
  const sql=await getSql();
  const id=sourceRecordId(decisionId,executionSessionId);
  const rows=await sql`
    SELECT id,source_record_id,local_date::text AS local_date,source_updated_at,ingested_at,payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY} AND record_type=${RECORD_TYPE} AND source_record_id=${id}
    LIMIT 1
  `;
  return rows?.[0]||null;
}

export async function readLatestLinkedAthleteResponse(sessionId,actualStartAt=null){
  if(!sessionId)return null;
  const sql=await getSql();
  const rows=await sql`
    SELECT e.event_id,e.event_key,e.event_type,e.occurred_at,e.certainty,e.summary,e.payload,
           m.payload AS materiality_payload
    FROM fz_athlete_events e
    LEFT JOIN LATERAL (
      SELECT payload
      FROM fz_training_source_latest
      WHERE source_key='fz-intelligence'
        AND record_type='event_context'
        AND payload->>'contextType'='MATERIALITY_ASSESSMENT'
        AND payload->>'evidenceKey'=e.event_key
      ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC
      LIMIT 1
    ) m ON TRUE
    WHERE e.session_id=${sessionId}
      AND e.actor='ATHLETE'
      AND (${actualStartAt}::timestamptz IS NULL OR e.occurred_at>=${actualStartAt}::timestamptz)
    ORDER BY e.occurred_at DESC,e.event_id DESC
    LIMIT 25
  `;
  const event=(rows||[]).find(isResponseEvent)||null;
  return event?{athleteEvent:event,materiality:event.materiality_payload?.materiality||null}:null;
}

export async function persistChoiceOutcome({plan,execution,matchConfidence=null,matchReasons=[],athleteEvent=null,materiality=null}={}){
  const source=plan?.payload||plan||{};
  if(!source.decisionId||!execution?.session_id)return {status:'NOT_APPLICABLE',observation:null,row:null,responseRecovered:false};
  const previous=await readLatestChoiceOutcome(source.decisionId,execution.session_id);
  let effectiveAthleteEvent=athleteEvent,effectiveMateriality=materiality,responseRecovered=false;
  if(!effectiveAthleteEvent&&!previous?.payload?.response){
    const recovered=await readLatestLinkedAthleteResponse(execution.session_id,execution.actual_start_at||null);
    if(recovered){effectiveAthleteEvent=recovered.athleteEvent;effectiveMateriality=recovered.materiality;responseRecovered=true;}
  }
  const observation=buildChoiceOutcomeObservation({plan,execution,matchConfidence,matchReasons,athleteEvent:effectiveAthleteEvent,materiality:effectiveMateriality,previous:previous?.payload||null});
  const row=await ingestTrainingSourceRecord({
    sourceKey:SOURCE_KEY,
    recordType:RECORD_TYPE,
    sourceRecordId:sourceRecordId(observation.decisionId,observation.executionSessionId),
    sourceUpdatedAt:observation.response?.occurredAt||execution.actual_start_at||new Date().toISOString(),
    localDate:observation.localDate,
    payload:observation
  });
  return {status:observation.observationState,observation,row,responseRecovered};
}

export async function persistChoiceOutcomeResponse({sessionId,athleteEvent,materiality}={}){
  const plan=await readFzPlanForExecution(sessionId);
  if(!plan)return {status:'NO_FZ_PLAN',observation:null,row:null,responseRecovered:false};
  const sql=await getSql();
  const sessions=await sql`SELECT * FROM fz_training_sessions WHERE session_id=${sessionId} LIMIT 1`;
  const execution=sessions?.[0];
  if(!execution)return {status:'NO_EXECUTION',observation:null,row:null,responseRecovered:false};
  return persistChoiceOutcome({plan,execution,athleteEvent,materiality});
}
