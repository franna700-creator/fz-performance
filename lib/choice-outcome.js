export const CHOICE_OUTCOME_ENGINE_VERSION='4.5.0-outcome.1';
export const CHOICE_OUTCOME_CONTEXT='CHOICE_OUTCOME';

const upper=value=>String(value??'').trim().toUpperCase();
const unique=values=>[...new Set((values||[]).filter(Boolean))];
function reasonCodes(materiality={}){return unique([...(materiality.reasonCodes||[]),...(materiality.materiality?.reasonCodes||[])]).map(upper);}
function levelOf(materiality={}){return upper(materiality.level||materiality.materiality?.level)||null;}

export function classifyChoiceResponse(materiality=null){
  if(!materiality)return 'UNKNOWN';
  const reasons=reasonCodes(materiality),level=levelOf(materiality);
  const positive=reasons.some(code=>['ATHLETE_RESPONSE_MATERIAL_POSITIVE','ATHLETE_STATE_MATERIAL_POSITIVE','CONSTRAINT_REPORTED_RESOLVED'].includes(code));
  const negative=level==='SAFETY_OVERRIDE'||reasons.some(code=>['SAFETY_RED_FLAG','PAIN_HIGH','PAIN_MODERATE','DOMS_HIGH','DOMS_MODERATE','GI_LIMITER_HIGH','CURRENT_CONSTRAINT_HIGH','ATHLETE_RESPONSE_MATERIAL_NEGATIVE','ATHLETE_STATE_MATERIAL_NEGATIVE'].includes(code));
  if(positive&&negative)return 'MIXED';
  if(negative)return 'NEGATIVE';
  if(positive)return 'POSITIVE';
  if(level==='UPDATE_STATE'||level==='RECOMPUTE_RECOMMENDATION')return 'MIXED';
  return 'NEUTRAL_OR_UNRESOLVED';
}

function executionSnapshot(session={}){
  const metrics=session.metrics||{};
  return {
    status:upper(session.status)||null,
    modality:session.classification?.modality||session.sport_type||null,
    sessionKind:session.session_kind||null,
    title:session.title||session.source_title||null,
    actualStartAt:session.actual_start_at||null,
    durationSeconds:metrics.durationSeconds??null,
    distanceMeters:metrics.distanceMeters??null,
    avgHeartRate:metrics.avgHeartRate??null,
    maxHeartRate:metrics.maxHeartRate??null,
    calories:metrics.calories??null,
    avgPowerWatts:metrics.avgPowerWatts??null,
    paceSecPerKm:metrics.paceSecPerKm??null,
    cadence:metrics.cadence??null
  };
}

export function buildChoiceOutcomeObservation({plan,execution,matchConfidence=null,matchReasons=[],athleteEvent=null,materiality=null,previous=null}={}){
  const source=plan?.payload||plan||{};
  if(!source.decisionId)throw new Error('choice_outcome_decision_required');
  if(!source.optionId)throw new Error('choice_outcome_option_required');
  const executionSessionId=String(execution?.session_id||previous?.executionSessionId||'').trim();
  if(!executionSessionId)throw new Error('choice_outcome_execution_required');
  const response=athleteEvent?{
    athleteEventKey:athleteEvent.event_key||athleteEvent.eventKey||null,
    athleteEventId:athleteEvent.event_id??athleteEvent.eventId??null,
    summary:athleteEvent.summary||null,
    certainty:athleteEvent.certainty||null,
    occurredAt:athleteEvent.occurred_at||athleteEvent.occurredAt||null,
    materialityLevel:levelOf(materiality||{}),
    reasonCodes:reasonCodes(materiality||{}),
    direction:classifyChoiceResponse(materiality)
  }:(previous?.response||null);
  const expectedCost=source.expectedCost||previous?.expectedCost||null;
  const possibleUnderprediction=Boolean(response&&response.direction==='NEGATIVE'&&['LOW','LOW_TO_MODERATE'].includes(upper(expectedCost)));
  return {
    schemaVersion:'1.0',contextType:CHOICE_OUTCOME_CONTEXT,engineVersion:CHOICE_OUTCOME_ENGINE_VERSION,
    decisionId:source.decisionId,recommendationVersion:source.recommendationVersion||null,
    recommendedLane:source.recommendedLane||previous?.recommendedLane||null,
    selectedLane:upper(source.lane||source.selectedLane||previous?.selectedLane),optionId:source.optionId,
    plannedSessionId:source.plannedSessionId||plan?.session_id||previous?.plannedSessionId||null,
    executionSessionId,
    localDate:String(execution?.local_date||previous?.localDate||source.plannedForDate||'').slice(0,10)||null,
    observationState:response?'RESPONSE_OBSERVED':'EXECUTION_MATCHED',
    expectedCost,
    execution:{...executionSnapshot(execution),matchConfidence:matchConfidence??previous?.execution?.matchConfidence??null,matchReasons:unique(matchReasons?.length?matchReasons:(previous?.execution?.matchReasons||[]))},
    response,
    calibration:{status:'OBSERVE_ONLY',predictedCost:expectedCost,observedResponseDirection:response?.direction||'UNKNOWN',signal:possibleUnderprediction?'POSSIBLE_COST_UNDERPREDICTION':'INSUFFICIENT_FOR_CALIBRATION'},
    provenance:{decisionId:source.decisionId,reconciliationMethod:'FZ_PLANNED_INTENT_MATCH'},
    rules:{observationOnly:true,doesNotModifyRecommendation:true,noCausalClaimFromSingleOutcome:true,directAthleteResponseOutranksWearableInference:true}
  };
}
