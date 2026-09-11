import { classifyTrainingSession } from './training-classifier.js';
import { mergeEvidenceRows, deriveTrainingMetrics } from './training-evidence.js';
import { deriveTrainingWorkoutDetail } from './training-workout-detail.js';

function eventCategories(event){return Array.isArray(event?.payload?.memoryCategories)?event.payload.memoryCategories.map(value=>String(value).toUpperCase()):[];}
function isSessionRelevantAthleteEvent(event){if(event?.actor!=='ATHLETE')return false;if(eventCategories(event).includes('SESSION'))return true;return ['POST_SESSION_FEEDBACK','STOPPED_EARLY','ABORTED','ATHLETE_MODIFIED','NEXT_DAY_RESPONSE'].includes(event?.event_type);}
function requiresSessionLink(event){return event?.actor==='ATHLETE'&&['POST_SESSION_FEEDBACK','STOPPED_EARLY','ABORTED','ATHLETE_MODIFIED','NEXT_DAY_RESPONSE'].includes(event?.event_type);}
function hasMetric(metrics={}){return Object.entries(metrics).some(([key,value])=>key!=='hrIntensitySeconds'&&key!=='lowHrShare'&&value!==null)||(Array.isArray(metrics.hrIntensitySeconds)&&metrics.hrIntensitySeconds.length>0);}

function canonicalSessionEvidence(sources=[]){
  const executed=sources.filter(source=>source.record_type==='executed_activity');
  const planned=sources.filter(source=>source.record_type==='planned_workout');
  const rows=executed.length?executed:planned;
  const merged=mergeEvidenceRows(rows);
  const metrics=deriveTrainingMetrics(merged.payload);
  const workoutDetail=deriveTrainingWorkoutDetail(merged.payload);
  return {
    metrics,
    workoutDetail,
    evidence:{
      recordType:executed.length?'executed_activity':(planned.length?'planned_workout':null),
      sourceKeys:[...new Set(rows.map(row=>row.source_key).filter(Boolean))],
      versions:merged.versions,
      newestAt:merged.newestAt,
      enrichedFromHistory:merged.enrichedFromHistory,
      hasMetrics:hasMetric(metrics),
      hasWorkoutDetail:Boolean(workoutDetail?.hasDetail)
    }
  };
}

export function decorateTrainingRange(range={}){
  const eventsBySession=new Map();for(const event of range.events||[]){const key=event.session_id||'__context__';if(!eventsBySession.has(key))eventsBySession.set(key,[]);eventsBySession.get(key).push(event);}
  const sourcesBySession=new Map();for(const source of range.sources||[]){if(!sourcesBySession.has(source.session_id))sourcesBySession.set(source.session_id,[]);sourcesBySession.get(source.session_id).push(source);}
  const hydrate=session=>{
    const events=eventsBySession.get(session.session_id)||[];
    const sources=sourcesBySession.get(session.session_id)||[];
    const classification=classifyTrainingSession({session,events,sources});
    const canonicalEvidence=canonicalSessionEvidence(sources);
    return {...session,source_title:session.title,source_sport_type:session.sport_type,title:classification.displayTitle||session.title,sport_type:classification.modalityLabel||session.sport_type,classification,metrics:canonicalEvidence.metrics,workoutDetail:canonicalEvidence.workoutDetail,evidence:canonicalEvidence.evidence,events,sources};
  };
  const sessions=(range.sessions||[]).filter(session=>session.status!=='SUPERSEDED').map(hydrate), supersededSessions=(range.sessions||[]).filter(session=>session.status==='SUPERSEDED').map(hydrate), contextEvents=eventsBySession.get('__context__')||[], athleteSessionEvents=(range.events||[]).filter(isSessionRelevantAthleteEvent);
  return {sessions,supersededSessions,contextEvents,integrity:{sessionRelevantAthleteEvents:athleteSessionEvents.length,unlinkedSessionFeedback:(range.events||[]).filter(event=>requiresSessionLink(event)&&!event.session_id).length,inferredTrainingIdentities:sessions.filter(session=>session.classification?.overrodeGenericIdentity).length,lowConfidenceTrainingIdentities:sessions.filter(session=>session.classification?.confidence==='LOW').length,lateLinkedAthleteEvents:athleteSessionEvents.filter(event=>String(event.payload?.linkResolution?.method||'').startsWith('LATE_')).length,sessionsWithCanonicalMetrics:sessions.filter(session=>session.evidence?.hasMetrics).length,sessionsWithCanonicalWorkoutDetail:sessions.filter(session=>session.evidence?.hasWorkoutDetail).length}};
}
