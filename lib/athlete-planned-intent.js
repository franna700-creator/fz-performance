import crypto from 'node:crypto';
import {
  appendAthleteEvent,
  ingestTrainingSourceRecord,
  linkTrainingSource,
  upsertTrainingSession
} from './training-store.js';
import { evaluateMateriality } from './materiality-engine.js';
import { persistMaterialityAssessment } from './materiality-store.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';

export const ATHLETE_PLANNED_INTENT_CONTEXT='ATHLETE_PLANNED_INTENT';
const PROJECT_SCOPE='exercise-project';
const ATHLETE_ID='francois';
const SPEAKER_RESOLUTIONS=new Set(['CONFIRMED','INFERRED_HIGH_CONFIDENCE']);
const TZ='Africa/Johannesburg';

function text(value){return String(value??'').trim();}
function upper(value){return text(value).toUpperCase();}
function date(value,code){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))throw new Error(code);return d;}
function localDate(value){
  const d=date(value,'invalid_planned_intent_date');
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function assertOwnership(input){
  if(text(input.projectScope).toLowerCase()!==PROJECT_SCOPE)throw new Error('exercise_project_scope_required');
  if(text(input.athleteId).toLowerCase()!==ATHLETE_ID)throw new Error('francois_speaker_required');
  if(!SPEAKER_RESOLUTIONS.has(upper(input.speakerResolution)))throw new Error('speaker_resolution_required');
}
function dateOnly(value){
  const v=text(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error('invalid_planned_for_date');
  const d=new Date(v+'T12:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)throw new Error('invalid_planned_for_date');
  return v;
}
function plannedStartAt(value,plannedForDate){
  if(value==null||value==='')return null;
  const d=date(value,'invalid_planned_start_at');
  if(localDate(d)!==plannedForDate)throw new Error('planned_start_date_mismatch');
  return d.toISOString();
}

export function normalizeAthletePlannedIntent(input={}){
  assertOwnership(input);
  const reportedAt=date(input.reportedAt||new Date(),'invalid_reported_at').toISOString();
  const occurredAt=date(input.occurredAt||reportedAt,'invalid_occurred_at').toISOString();
  const plannedForDate=dateOnly(input.plannedForDate||input.localDate);
  const startAt=plannedStartAt(input.plannedStartAt,plannedForDate);
  const title=text(input.title);
  if(!title)throw new Error('planned_intent_title_required');
  const modality=text(input.modality||input.sportType);
  if(!modality)throw new Error('planned_intent_modality_required');
  const sessionKind=text(input.sessionKind)||null;
  const rawText=text(input.rawText);
  const summary=text(input.summary)||`Athlete plans ${title} on ${plannedForDate}.`;
  const occurrencePrecision=text(input.occurrencePrecision||input.timestampPrecision||(input.occurredAt?'athlete-supplied':'report-time'));
  const idempotencyKey=text(input.idempotencyKey);
  const identity=idempotencyKey||digest({
    athleteId:ATHLETE_ID,
    occurredAt,
    plannedForDate,
    plannedStartAt:startAt,
    title,
    modality,
    sessionKind,
    rawText
  }).slice(0,28);
  const intentId=`athlete-plan:${identity.replace(/[^a-zA-Z0-9:_-]+/g,'-').slice(0,96)}`;
  const sessionId=text(input.sessionId)||`plan:athlete:${digest({intentId,plannedForDate}).slice(0,24)}`;
  const matchHints={
    modality:upper(input.matchHints?.modality||modality),
    alternates:Array.isArray(input.matchHints?.alternates)?input.matchHints.alternates.map(upper).filter(Boolean):[],
    titleTerms:Array.isArray(input.matchHints?.titleTerms)?input.matchHints.titleTerms.map(text).filter(Boolean):title.toLowerCase().split(/\s+/).filter(word=>word.length>=4).slice(0,6)
  };
  return {
    projectScope:PROJECT_SCOPE,
    athleteId:ATHLETE_ID,
    speakerResolution:upper(input.speakerResolution),
    reportedAt,
    occurredAt,
    occurrencePrecision,
    intentId,
    sessionId,
    plannedForDate,
    plannedStartAt:startAt,
    title,
    modality,
    sessionKind,
    rawText,
    summary,
    status:'PLANNED',
    matchHints,
    payload:input.payload&&typeof input.payload==='object'&&!Array.isArray(input.payload)?input.payload:{}
  };
}

export async function recordAthletePlannedIntent(input={}){
  const normalized=normalizeAthletePlannedIntent(input);
  const payload={
    ...normalized.payload,
    schemaVersion:'1.0',
    contextType:ATHLETE_PLANNED_INTENT_CONTEXT,
    intentId:normalized.intentId,
    plannedSessionId:normalized.sessionId,
    plannedForDate:normalized.plannedForDate,
    plannedStartAt:normalized.plannedStartAt,
    title:normalized.title,
    modality:normalized.modality,
    sessionKind:normalized.sessionKind,
    matchHints:normalized.matchHints,
    summary:normalized.summary,
    ...(normalized.rawText?{rawText:normalized.rawText}:{}),
    memoryCategories:['SESSION'],
    sourceOrigin:'athlete-planned-intent-v1',
    athleteId:ATHLETE_ID,
    projectScope:PROJECT_SCOPE,
    speakerResolution:normalized.speakerResolution,
    reportedAt:normalized.reportedAt,
    occurredAt:normalized.occurredAt,
    occurrencePrecision:normalized.occurrencePrecision,
    rules:{
      athleteIntentDoesNotImplyFzRecommendation:true,
      noAutomaticSingleSessionAssumption:true,
      lateExecutionBindingAllowed:true
    }
  };
  const planRecord=await ingestTrainingSourceRecord({
    sourceKey:'conversation',
    recordType:'planned_workout',
    sourceRecordId:normalized.intentId,
    sourceUpdatedAt:normalized.reportedAt,
    localDate:normalized.plannedForDate,
    payload
  });
  const session=await upsertTrainingSession({
    sessionId:normalized.sessionId,
    localDate:normalized.plannedForDate,
    plannedStartAt:normalized.plannedStartAt,
    title:normalized.title,
    sportType:normalized.modality,
    sessionKind:normalized.sessionKind,
    status:'PLANNED',
    reconciliationState:'UNMATCHED'
  });
  await linkTrainingSource({
    sessionId:normalized.sessionId,
    sourceRecordPk:planRecord.id,
    relationship:'PLAN',
    matchMethod:'ATHLETE_PLANNED_INTENT',
    matchConfidence:1
  });

  const eventKey=`athlete:intent:${normalized.intentId}`;
  const inserted=await appendAthleteEvent({
    eventKey,
    sessionId:normalized.sessionId,
    eventType:'PLANNED',
    occurredAt:normalized.occurredAt,
    localDate:localDate(normalized.occurredAt),
    actor:'ATHLETE',
    sourceKey:'conversation',
    sourceRecordPk:planRecord.id,
    certainty:'REPORTED',
    summary:normalized.summary,
    payload:{
      ...payload,
      linkResolution:{method:'EXPLICIT_PLANNED_INTENT',confidence:1,reasons:['canonical athlete-described planned intent'],linked:true}
    }
  });

  const assessment=evaluateMateriality({
    sourceType:'ATHLETE_FEEDBACK',
    eventType:'CONTEXT',
    certainty:'REPORTED',
    categories:['SESSION'],
    summary:normalized.summary,
    rawText:normalized.rawText,
    signals:{sequencingChanged:true},
    payload
  });
  const materialityRecord=await persistMaterialityAssessment({
    evidenceKey:eventKey,
    sourceType:'ATHLETE_FEEDBACK',
    sourceKey:'conversation',
    sourceRecordPk:planRecord.id,
    athleteEventId:inserted?.event_id||null,
    occurredAt:normalized.occurredAt,
    summary:normalized.summary,
    assessment
  });
  const propagation=await propagateCanonicalChangeSafely({
    changedNodes:['source.athlete.feedback','athlete.memory','training.session','training.intent'],
    materiality:assessment,
    trigger:{
      type:'ATHLETE_PLANNED_INTENT',
      intentId:normalized.intentId,
      plannedSessionId:normalized.sessionId,
      evidenceKey:eventKey,
      materialityLevel:assessment.level,
      reasonCodes:assessment.reasonCodes
    },
    now:new Date(normalized.reportedAt)
  });
  return {
    ok:true,
    contract:'ATHLETE_PLANNED_INTENT_V1',
    intentId:normalized.intentId,
    plannedSessionId:normalized.sessionId,
    sourceRecordPk:planRecord.id,
    athleteEventId:inserted?.event_id||null,
    eventKey,
    materialityRecordPk:materialityRecord?.id||null,
    materiality:assessment,
    session,
    propagation
  };
}
