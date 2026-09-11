import { getSql } from './db.js';
import { appendAthleteEvent, linkTrainingSource, readTrainingRange, setTrainingSessionState } from './training-store.js';
import { decorateTrainingRange } from './training-presentation.js';

const TZ='Africa/Johannesburg';
function text(value){return String(value ?? '').trim();}
function upper(value){return text(value).toUpperCase();}
function words(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);}
function localDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function modalitySet(plan){const hints=plan?.payload?.matchHints||{};return new Set([hints.modality,plan?.payload?.modality,...(Array.isArray(hints.alternates)?hints.alternates:[])].map(upper).filter(Boolean));}
function titleTerms(plan){const hints=plan?.payload?.matchHints||{};return Array.isArray(hints.titleTerms)?hints.titleTerms.flatMap(words):[];}
function actualModality(session){return upper(session?.classification?.modality||session?.sport_type);}
function planScore(plan,session){
  if(!session?.actual_start_at)return null;
  const planDate=String(plan.local_date||plan.payload?.plannedForDate||'').slice(0,10),sessionDate=String(session.local_date||'').slice(0,10);
  if(planDate!==sessionDate)return null;
  let score=.4;const reasons=['same local date'];
  const modalities=modalitySet(plan),actual=actualModality(session);
  if(modalities.has(actual)){score+=.38;reasons.push('canonical modality');}
  else if(actual&&modalities.size){score-=.18;reasons.push('modality mismatch');}
  const terms=titleTerms(plan),hay=new Set(words(`${session.title||''} ${session.source_title||''} ${session.session_kind||''}`));
  const hits=terms.filter(term=>hay.has(term)).length;
  if(hits){score+=Math.min(.12,hits*.04);reasons.push('title/session hint');}
  if(plan.payload?.sessionKind&&upper(plan.payload.sessionKind)===upper(session.session_kind)){score+=.08;reasons.push('session kind');}
  if(plan.payload?.plannedStartAt){
    const delta=Math.abs(new Date(plan.payload.plannedStartAt).getTime()-new Date(session.actual_start_at).getTime())/3600000;
    if(delta<=1){score+=.16;reasons.push('start time ≤1 h');}
    else if(delta<=3){score+=.08;reasons.push('start time ≤3 h');}
    else if(delta>6){score-=.12;reasons.push('start time distant');}
  }
  return {score:Math.max(0,Math.min(1,score)),reasons};
}
async function openPlans(startDate,endDate){
  const sql=await getSql();
  return sql`
    SELECT s.session_id,s.local_date::text AS local_date,s.planned_start_at,s.status,s.reconciliation_state,
           r.id AS source_record_pk,r.source_record_id,r.payload,r.source_updated_at,r.ingested_at
    FROM fz_training_sessions s
    JOIN fz_training_session_sources l ON l.session_id=s.session_id AND l.relationship='PLAN'
    JOIN fz_training_source_records r ON r.id=l.source_record_pk
    WHERE s.local_date BETWEEN ${startDate} AND ${endDate}
      AND s.status IN ('PLANNED','RECOMMENDED','ACCEPTED','MODIFIED')
      AND r.source_key='fz-intelligence' AND r.record_type='planned_workout'
      AND r.payload->>'contextType'='FZ_PLANNED_INTENT'
    ORDER BY s.local_date,s.created_at,s.session_id
  `;
}
function alreadyHasFzPlan(session){return (session.sources||[]).some(source=>source.source_key==='fz-intelligence'&&source.record_type==='planned_workout'&&source.payload?.contextType==='FZ_PLANNED_INTENT');}

export async function reconcileFzPlannedIntents({startDate,endDate}={}){
  if(!startDate||!endDate)throw new Error('planned_intent_reconcile_range_required');
  const plans=await openPlans(startDate,endDate);
  if(!plans.length)return {scanned:0,matched:0,ambiguous:0,noCandidate:0,changes:[]};
  const decorated=decorateTrainingRange(await readTrainingRange(startDate,endDate));
  const executions=decorated.sessions.filter(session=>session.actual_start_at&&['COMPLETED','STOPPED_EARLY','ABORTED','IN_PROGRESS'].includes(upper(session.status))&&!alreadyHasFzPlan(session));
  let matched=0,ambiguous=0,noCandidate=0;const changes=[];
  for(const plan of plans){
    const candidates=executions.map(session=>({session,...(planScore(plan,session)||{score:-1,reasons:[]})})).filter(row=>row.score>=0).sort((a,b)=>b.score-a.score);
    const best=candidates[0]||null,second=candidates[1]||null;
    const clear=best&&best.score>=.68&&(!second||best.score-second.score>=.12);
    if(!clear){
      if(best&&best.score>=.55){ambiguous+=1;await setTrainingSessionState(plan.session_id,{reconciliationState:'MATCH_REQUIRED'});}
      else noCandidate+=1;
      continue;
    }
    const actual=best.session;
    await linkTrainingSource({sessionId:actual.session_id,sourceRecordPk:plan.source_record_pk,relationship:'PLAN',matchMethod:'FZ_PLANNED_INTENT_MATCH',matchConfidence:Number(best.score.toFixed(2))});
    await setTrainingSessionState(plan.session_id,{status:'SUPERSEDED',reconciliationState:'MATCHED',parentSessionId:actual.session_id});
    await setTrainingSessionState(actual.session_id,{reconciliationState:'MATCHED'});
    const at=new Date().toISOString();
    const eventKey=`reconcile:fz-plan:${plan.payload?.decisionId||plan.source_record_id}:${actual.session_id}`;
    await appendAthleteEvent({
      eventKey,sessionId:actual.session_id,eventType:'RECONCILED',occurredAt:at,localDate:localDate(actual.actual_start_at)||String(plan.local_date).slice(0,10),
      actor:'SYSTEM',sourceKey:'fz',certainty:'INFERRED',
      summary:'FZ planned intent reconciled to canonical execution',
      payload:{method:'FZ_PLANNED_INTENT_MATCH',confidence:Number(best.score.toFixed(2)),reasons:best.reasons,plannedSessionId:plan.session_id,decisionId:plan.payload?.decisionId||null,optionId:plan.payload?.optionId||null,selectedLane:plan.payload?.lane||null,canonicalExecutionSessionId:actual.session_id,actualModality:actual.classification?.modality||null}
    });
    matched+=1;changes.push({eventKey,plannedSessionId:plan.session_id,sessionId:actual.session_id,decisionId:plan.payload?.decisionId||null,optionId:plan.payload?.optionId||null,confidence:Number(best.score.toFixed(2)),reasons:best.reasons});
  }
  return {scanned:plans.length,matched,ambiguous,noCandidate,changes};
}
