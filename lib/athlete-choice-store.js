import crypto from 'node:crypto';
import { getSql } from './db.js';
import {
  appendAthleteEvent,
  ingestTrainingSourceRecord,
  linkTrainingSource,
  upsertTrainingSession
} from './training-store.js';
import { evaluateMateriality } from './materiality-engine.js';
import { persistMaterialityAssessment } from './materiality-store.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';

const SOURCE_KEY='fz-intelligence';
const DECISION_CONTEXT='ATHLETE_DECISION';
const PLAN_CONTEXT='FZ_PLANNED_INTENT';
const TZ='Africa/Johannesburg';

function text(value){return String(value ?? '').trim();}
function upper(value){return text(value).toUpperCase();}
function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(!value||typeof value!=='object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function localDate(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('invalid_choice_time');
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(text(value));}
async function latestActiveRecommendation(){
  const sql=await getSql();
  const rows=await sql`
    SELECT id,source_record_id,source_updated_at,ingested_at,local_date::text AS local_date,payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY} AND record_type='recommendation'
      AND payload->>'contextType'='ACTIVE_RECOMMENDATION'
    ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC LIMIT 1
  `;
  return rows?.[0]||null;
}
function findOption(active,lane,optionId){
  const options=active?.lanes?.[lane];
  if(!Array.isArray(options))return null;
  return options.find(option=>option?.optionId===optionId)||null;
}
function normalizeChoice(input,activeRow){
  const active=activeRow?.payload||{};
  if(active.status!=='READY'||!active.fzRecommendedLane)throw new Error('active_recommendation_not_ready');
  const recommendationVersion=text(input.recommendationVersion||active.recommendationVersion);
  if(!recommendationVersion||recommendationVersion!==active.recommendationVersion)throw new Error('stale_recommendation_version');
  const lane=upper(input.lane);
  if(!['ABSORB','MAINTAIN','ADAPT'].includes(lane))throw new Error('invalid_choice_lane');
  const optionId=text(input.optionId);
  if(!optionId)throw new Error('choice_option_required');
  const option=findOption(active,lane,optionId);
  if(!option)throw new Error('choice_option_not_in_active_recommendation');
  if(active.safetyOverride===true&&lane!=='ABSORB')throw new Error('safety_override_cannot_be_bypassed');
  const selectedAt=input.selectedAt?new Date(input.selectedAt):new Date();
  if(Number.isNaN(selectedAt.getTime()))throw new Error('invalid_selected_at');
  const plannedForDate=text(input.plannedForDate)||active.localDate||localDate(selectedAt);
  if(!validDate(plannedForDate))throw new Error('invalid_planned_for_date');
  const plannedStartAt=text(input.plannedStartAt)||null;
  if(plannedStartAt&&Number.isNaN(new Date(plannedStartAt).getTime()))throw new Error('invalid_planned_start_at');
  const overrideReason=text(input.overrideReason)||null;
  const matchesFzRecommendation=lane===active.fzRecommendedLane;
  return {active,recommendationVersion,lane,optionId,option,selectedAt,plannedForDate,plannedStartAt,overrideReason,matchesFzRecommendation};
}
function decisionIdentity(choice){
  return `decision:4.4:${digest({recommendationVersion:choice.recommendationVersion,lane:choice.lane,optionId:choice.optionId,plannedForDate:choice.plannedForDate,plannedStartAt:choice.plannedStartAt,overrideReason:choice.overrideReason}).slice(0,20)}`;
}
function summaryFor(choice){
  const prefix=choice.matchesFzRecommendation?'Accepted FZ training option':'Modified FZ training direction';
  return `${prefix}: ${choice.option.title} (${choice.lane})${choice.overrideReason?` — ${choice.overrideReason}`:''}.`;
}

export async function recordAthleteChoice(input={}){
  const activeRow=await latestActiveRecommendation();
  if(!activeRow)throw new Error('active_recommendation_missing');
  const choice=normalizeChoice(input,activeRow);
  const decisionId=decisionIdentity(choice);
  const selectedAt=choice.selectedAt.toISOString();
  const eventType=choice.matchesFzRecommendation?'ATHLETE_ACCEPTED':'ATHLETE_MODIFIED';
  const planSessionId=`plan:fz:${decisionId}`;
  const decisionPayload={
    schemaVersion:'1.0',contextType:DECISION_CONTEXT,decisionId,
    recommendationVersion:choice.recommendationVersion,
    shadowRecommendationId:choice.active.shadowRecommendationId||null,
    recommendedLane:choice.active.fzRecommendedLane,
    selectedLane:choice.lane,optionId:choice.optionId,
    option:choice.option,
    matchesFzRecommendation:choice.matchesFzRecommendation,
    overrideReason:choice.overrideReason,
    selectedAt,plannedForDate:choice.plannedForDate,plannedStartAt:choice.plannedStartAt,
    plannedSessionId:planSessionId,
    provenance:{sourceContract:'ACTIVE_RECOMMENDATION',sourceRecordPk:activeRow.id,sourceContextFingerprint:choice.active.contextFingerprint,captureChannel:text(input.captureChannel)||'authenticated-runtime'},
    rules:{doesNotRewriteRecommendation:true,safetyOverrideCannotBeBypassed:true}
  };
  const decisionRecord=await ingestTrainingSourceRecord({
    sourceKey:SOURCE_KEY,recordType:'decision',sourceRecordId:decisionId,
    sourceUpdatedAt:selectedAt,localDate:choice.plannedForDate,payload:decisionPayload
  });
  const planPayload={
    contextType:PLAN_CONTEXT,decisionId,recommendationVersion:choice.recommendationVersion,
    plannedSessionId:planSessionId,plannedForDate:choice.plannedForDate,plannedStartAt:choice.plannedStartAt,
    status:choice.matchesFzRecommendation?'ACCEPTED':'MODIFIED',
    lane:choice.lane,optionId:choice.optionId,title:choice.option.title,modality:choice.option.modality,
    sessionKind:choice.option.sessionKind||null,dose:choice.option.dose,objective:choice.option.objective,
    expectedCost:choice.option.expectedCost,targetedGaps:choice.option.targetedGaps||[],matchHints:choice.option.matchHints||{},
    provenance:{decisionRecordPk:decisionRecord.id,recommendationVersion:choice.recommendationVersion,composerVersion:choice.option.composerVersion||choice.active.sessionOptionComposerVersion||null}
  };
  const planRecord=await ingestTrainingSourceRecord({
    sourceKey:SOURCE_KEY,recordType:'planned_workout',sourceRecordId:planSessionId,
    sourceUpdatedAt:selectedAt,localDate:choice.plannedForDate,payload:planPayload
  });
  await upsertTrainingSession({
    sessionId:planSessionId,localDate:choice.plannedForDate,plannedStartAt:choice.plannedStartAt,
    title:choice.option.title,sportType:choice.option.modality,sessionKind:choice.option.sessionKind||null,
    status:choice.matchesFzRecommendation?'ACCEPTED':'MODIFIED',reconciliationState:'UNMATCHED'
  });
  await linkTrainingSource({sessionId:planSessionId,sourceRecordPk:planRecord.id,relationship:'PLAN',matchMethod:'FZ_ATHLETE_CHOICE',matchConfidence:1});
  const summary=summaryFor(choice);
  const eventKey=`athlete:choice:${decisionId}`;
  const eventPayload={
    summary,memoryCategories:['SESSION'],decisionId,recommendationVersion:choice.recommendationVersion,
    recommendedLane:choice.active.fzRecommendedLane,selectedLane:choice.lane,optionId:choice.optionId,
    optionTitle:choice.option.title,plannedSessionId:planSessionId,plannedForDate:choice.plannedForDate,
    matchesFzRecommendation:choice.matchesFzRecommendation,overrideReason:choice.overrideReason,
    sourceOrigin:'adaptive-choice-v4.4',provenance:{decisionRecordPk:decisionRecord.id,planRecordPk:planRecord.id}
  };
  const insertedEvent=await appendAthleteEvent({
    eventKey,sessionId:planSessionId,eventType,occurredAt:selectedAt,localDate:choice.plannedForDate,
    actor:'ATHLETE',sourceKey:SOURCE_KEY,sourceRecordPk:decisionRecord.id,certainty:'REPORTED',summary,payload:eventPayload
  });
  const sql=await getSql();
  let athleteEventId=insertedEvent?.event_id||null;
  if(!athleteEventId){
    const rows=await sql`SELECT event_id FROM fz_athlete_events WHERE event_key=${eventKey} LIMIT 1`;
    athleteEventId=rows?.[0]?.event_id||null;
  }
  const assessment=evaluateMateriality({
    sourceType:'ATHLETE_FEEDBACK',eventType,certainty:'REPORTED',categories:['SESSION'],summary,
    signals:{recommendationConflict:!choice.matchesFzRecommendation,sequencingChanged:true},payload:eventPayload
  });
  const materialityRecord=await persistMaterialityAssessment({
    evidenceKey:eventKey,sourceType:'ATHLETE_FEEDBACK',sourceKey:SOURCE_KEY,sourceRecordPk:decisionRecord.id,
    athleteEventId,occurredAt:selectedAt,summary,assessment
  });
  const propagation=await propagateCanonicalChangeSafely({
    changedNodes:['source.athlete.choice','adaptive.choice','training.session'],materiality:assessment,
    trigger:{type:'ATHLETE_CHOICE',decisionId,evidenceKey:eventKey,materialityLevel:assessment.level,reasonCodes:assessment.reasonCodes},
    now:choice.selectedAt
  });
  return {
    ok:true,decisionId,decisionRecordPk:decisionRecord.id,planRecordPk:planRecord.id,plannedSessionId:planSessionId,
    athleteEventId,eventKey,eventType,materialityRecordPk:materialityRecord?.id||null,materiality:assessment,
    recommendationVersion:choice.recommendationVersion,recommendedLane:choice.active.fzRecommendedLane,
    selectedLane:choice.lane,optionId:choice.optionId,matchesFzRecommendation:choice.matchesFzRecommendation,
    plannedForDate:choice.plannedForDate,propagation
  };
}
