import { getSql } from './db.js';
import { ingestTrainingSourceRecord, sourceHash } from './training-store.js';

export const ATHLETE_CURRENT_STATE_CONTEXT='ATHLETE_CURRENT_STATE';
export const ATHLETE_CURRENT_STATE_ENGINE_VERSION='5.0.0-athlete-state.2';
const SOURCE_KEY='fz-intelligence';
const RECORD_TYPE='event_context';
const SOURCE_RECORD_ID='athlete-current-state:francois';
const TZ='Africa/Johannesburg';
const DEFAULT_CONSTRAINT_STALE_AFTER_DAYS=21;
const TRANSIENT_DOMS_STALE_AFTER_DAYS=7;
const GI_STALE_AFTER_DAYS=7;
const ILLNESS_STALE_AFTER_DAYS=10;
const RECENT_STATE_HOURS=36;
const RECENT_RECOVERY_HOURS=72;
const RECENT_COST_HOURS=72;

const SUBJECT_PATTERNS=Object.freeze([
  ['HAND_FINGER_GRIP',/\b(?:finger|hand|grip|thumb|wrist)\b/i],
  ['GI',/\b(?:gi|gastro|stomach|abdominal|nausea|cramp|cramps|bloat|bloating)\b/i],
  ['HAMSTRING',/\bhamstring\b/i],
  ['CALF',/\b(?:calf|calves)\b/i],
  ['KNEE',/\bknee\b/i],
  ['ANKLE_FOOT',/\b(?:ankle|foot|feet)\b/i],
  ['QUAD_DOMS',/\b(?:quad|quads|thigh|thighs)\b/i],
  ['SHOULDER_UPPER',/\b(?:shoulder|shoulders|delt|delts|trap|traps|upper back)\b/i],
  ['BACK',/\b(?:lower back|back pain)\b/i],
  ['ILLNESS_RESPIRATORY',/\b(?:throat|cold|flu|illness|sick|fever|cough)\b/i]
]);
const SUBJECT_IDS=new Set(SUBJECT_PATTERNS.map(([id])=>id));
const ACTIVE_CUE=/\b(?:sore|soreness|pain|painful|hurts?|niggle|uncomfortable|cramp|cramps|cramping|bloat|bloating|nausea|tight|tightness|stiff|stiffness|weird|limiter|limited|limiting|injury|injured|symptom|symptomatic|doms|not fully recovered|not recovered|worse|worsening)\b/i;
const ADVERSE_REASON_CODES=new Set(['SAFETY_RED_FLAG','PAIN_HIGH','DOMS_HIGH','GI_LIMITER_HIGH','CURRENT_CONSTRAINT_HIGH','ATHLETE_RESPONSE_MATERIAL_NEGATIVE','PAIN_MODERATE','DOMS_MODERATE','ATHLETE_STATE_MATERIAL_NEGATIVE']);

function text(value){return String(value??'').trim();}
function upper(value){return text(value).toUpperCase();}
function date(value){const d=value instanceof Date?value:new Date(value);return Number.isNaN(d.getTime())?null:d;}
function localDate(value){const d=date(value)||new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function hoursBetween(later,earlier){const a=date(later)?.getTime(),b=date(earlier)?.getTime();return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,(a-b)/3600000):Infinity;}
function unique(values=[]){return [...new Set(values.filter(Boolean))];}
function categories(row){return Array.isArray(row?.payload?.memoryCategories)?row.payload.memoryCategories.map(upper):[];}
function materiality(row){return row?.materiality_payload?.materiality||row?.materiality||null;}
function reasonCodes(row){return unique((materiality(row)?.reasonCodes||[]).map(upper));}
function sourceText(row){return `${text(row?.summary)} ${text(row?.payload?.rawText)}`.trim();}
function segments(row){return sourceText(row).split(/(?:[.!?;]+|\s+[—–-]\s+|\b(?:but|while|however|although)\b)/i).map(text).filter(Boolean);}
function severity(row,explicit=null){
  const supplied=upper(explicit);
  if(['SAFETY','HIGH','MODERATE','REPORTED'].includes(supplied))return supplied;
  const reasons=reasonCodes(row);
  if(reasons.includes('SAFETY_RED_FLAG'))return 'SAFETY';
  if(reasons.some(code=>['PAIN_HIGH','DOMS_HIGH','GI_LIMITER_HIGH','CURRENT_CONSTRAINT_HIGH'].includes(code)))return 'HIGH';
  if(reasons.some(code=>['PAIN_MODERATE','DOMS_MODERATE'].includes(code)))return 'MODERATE';
  return 'REPORTED';
}
function observation(row){
  return {
    eventId:row?.event_id==null?null:Number(row.event_id),
    eventKey:row?.event_key||null,
    occurredAt:row?.occurred_at||null,
    localDate:String(row?.local_date||'').slice(0,10)||null,
    eventType:row?.event_type||null,
    summary:row?.summary||null,
    categories:categories(row),
    materiality:materiality(row)
  };
}
function structuredConstraintObservations(row){
  const supplied=Array.isArray(row?.payload?.constraintObservations)?row.payload.constraintObservations:[];
  const out=[];
  for(const item of supplied){
    const subject=upper(item?.subject);
    const state=upper(item?.state||item?.status);
    if(!SUBJECT_IDS.has(subject)||!['ACTIVE','RESOLVED'].includes(state))continue;
    out.push({subject,state,severity:severity(row,item?.severity),source:'STRUCTURED'});
  }
  return out;
}
function subjectSegments(row,pattern){return segments(row).filter(segment=>pattern.test(segment));}
function explicitlyHealthy(segment,pattern){
  const before=new RegExp(`\\bno\\b[^.;]{0,28}${pattern.source}`,'i');
  const after=new RegExp(`${pattern.source}[^.;]{0,55}\\b(?:fine|normal|resolved|fully recovered|recovered|pain[- ]?free|symptom[- ]?free|no issues?|no problems?|no symptoms?|no pain|feels? good|felt good)\\b`,'i');
  return before.test(segment)||after.test(segment);
}
function explicitlyActive(segment,pattern){
  const after=new RegExp(`${pattern.source}[^.;]{0,55}${ACTIVE_CUE.source}`,'i');
  const before=new RegExp(`${ACTIVE_CUE.source}[^.;]{0,40}${pattern.source}`,'i');
  return after.test(segment)||before.test(segment);
}
function inferredConstraintObservations(row){
  const reasons=reasonCodes(row);
  const adverse=reasons.some(code=>ADVERSE_REASON_CODES.has(code));
  const explicitlyResolved=reasons.includes('CONSTRAINT_REPORTED_RESOLVED');
  const observations=[];
  for(const [subject,pattern] of SUBJECT_PATTERNS){
    const hits=subjectSegments(row,pattern);
    if(!hits.length)continue;
    let state=null;
    for(const segment of hits){
      const healthy=explicitlyHealthy(segment,pattern);
      const active=explicitlyActive(segment,pattern);
      // Subject-specific healthy/negated wording wins over unrelated adverse wording
      // in the same athlete message (for example: "no GI issues, hand still sore").
      if(healthy)state='RESOLVED';
      else if(active)state='ACTIVE';
      else if(explicitlyResolved)state='RESOLVED';
      else if(adverse)state='ACTIVE';
    }
    if(state)observations.push({subject,state,severity:severity(row),source:'TEXT_FALLBACK'});
  }
  return observations;
}
function constraintObservations(row){
  const structured=structuredConstraintObservations(row);
  if(structured.length)return structured;
  return inferredConstraintObservations(row);
}
function staleAfterDays(subject,row){
  const reasons=reasonCodes(row),haystack=sourceText(row).toLowerCase();
  if(reasons.some(code=>code.startsWith('DOMS_'))||/\bdoms\b/.test(haystack))return TRANSIENT_DOMS_STALE_AFTER_DAYS;
  if(subject==='GI')return GI_STALE_AFTER_DAYS;
  if(subject==='ILLNESS_RESPIRATORY')return ILLNESS_STALE_AFTER_DAYS;
  return DEFAULT_CONSTRAINT_STALE_AFTER_DAYS;
}
function latestRelevant(rows,category,asOf,hours){
  const cutoff=rows.filter(row=>categories(row).includes(category)&&hoursBetween(asOf,row.occurred_at)<=hours);
  return cutoff.length?observation(cutoff[cutoff.length-1]):null;
}
function governingObservation(activeConstraints,recentState,recentRecovery){
  const rank={SAFETY:4,HIGH:3,MODERATE:2,REPORTED:1};
  const active=activeConstraints.slice().sort((a,b)=>(rank[b.severity]||0)-(rank[a.severity]||0)||new Date(b.lastConfirmedAt)-new Date(a.lastConfirmedAt))[0];
  if(active)return {event:active.lastObservation,materiality:active.lastObservation?.materiality||null,reason:'ACTIVE_CONSTRAINT',constraint:{subject:active.subject,severity:active.severity,lastConfirmedAt:active.lastConfirmedAt}};
  const recent=recentState||recentRecovery;
  return recent?{event:recent,materiality:recent.materiality||null,reason:'RECENT_STATE',constraint:null}:{event:null,materiality:null,reason:'NO_CURRENT_ATHLETE_STATE',constraint:null};
}

export function buildCurrentAthleteState({events=[],asOf=new Date()}={}){
  const asOfDate=date(asOf)||new Date();
  const rows=(events||[]).filter(row=>row?.occurred_at&&date(row.occurred_at)&&date(row.occurred_at)<=asOfDate).slice().sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at)||Number(a.event_id||0)-Number(b.event_id||0));
  const active=new Map();
  const resolutionLog=[];
  for(const row of rows){
    for(const constraint of constraintObservations(row)){
      const subject=constraint.subject;
      if(constraint.state==='RESOLVED'){
        const existing=active.get(subject);
        if(!existing)continue;
        resolutionLog.push({subject,resolvedBy:observation(row),introducedAt:existing.introducedAt});
        active.delete(subject);
        continue;
      }
      const existing=active.get(subject);
      const obs=observation(row);
      active.set(subject,{
        subject,
        status:'ACTIVE',
        severity:constraint.severity,
        introducedAt:existing?.introducedAt||row.occurred_at,
        lastConfirmedAt:row.occurred_at,
        lastObservation:obs,
        staleAfterDays:staleAfterDays(subject,row),
        sourceEventKeys:unique([...(existing?.sourceEventKeys||[]),row.event_key])
      });
    }
  }

  const activeConstraints=[];
  const staleConstraints=[];
  for(const item of active.values()){
    const ageDays=hoursBetween(asOfDate,item.lastConfirmedAt)/24;
    const projected={...item,ageDays:Number(ageDays.toFixed(2))};
    if(ageDays>item.staleAfterDays)staleConstraints.push({...projected,status:'STALE_UNCONFIRMED'});
    else activeConstraints.push(projected);
  }
  activeConstraints.sort((a,b)=>a.subject.localeCompare(b.subject));
  staleConstraints.sort((a,b)=>a.subject.localeCompare(b.subject));

  const recentState=latestRelevant(rows,'STATE',asOfDate,RECENT_STATE_HOURS);
  const recentRecovery=latestRelevant(rows,'RECOVERY',asOfDate,RECENT_RECOVERY_HOURS);
  const recentCost=latestRelevant(rows,'COST',asOfDate,RECENT_COST_HOURS);
  const governing=governingObservation(activeConstraints,recentState,recentRecovery);
  const fingerprintBasis={
    engineVersion:ATHLETE_CURRENT_STATE_ENGINE_VERSION,
    asOfLocalDate:localDate(asOfDate),
    activeConstraints:activeConstraints.map(item=>({subject:item.subject,severity:item.severity,introducedAt:item.introducedAt,lastConfirmedAt:item.lastConfirmedAt,staleAfterDays:item.staleAfterDays,eventKey:item.lastObservation?.eventKey||null})),
    staleConstraints:staleConstraints.map(item=>({subject:item.subject,severity:item.severity,lastConfirmedAt:item.lastConfirmedAt,staleAfterDays:item.staleAfterDays,eventKey:item.lastObservation?.eventKey||null})),
    recentState:recentState?.eventKey||null,
    recentRecovery:recentRecovery?.eventKey||null,
    recentCost:recentCost?.eventKey||null,
    governingEventKey:governing.event?.eventKey||null,
    governingConstraint:governing.constraint
  };
  return {
    schemaVersion:'1.0',
    contextType:ATHLETE_CURRENT_STATE_CONTEXT,
    engineVersion:ATHLETE_CURRENT_STATE_ENGINE_VERSION,
    athleteId:'francois',
    asOf:asOfDate.toISOString(),
    localDate:localDate(asOfDate),
    status:'CURRENT',
    activeConstraints,
    staleConstraints,
    recent:{state:recentState,recovery:recentRecovery,cost:recentCost},
    readinessContext:{source:governing.reason,athleteEvent:governing.event,materiality:governing.materiality,activeConstraint:governing.constraint},
    resolutionLog:resolutionLog.slice(-20),
    inputFingerprint:sourceHash(fingerprintBasis),
    provenance:{eventCount:rows.length,latestEventKey:rows.at(-1)?.event_key||null,latestEventAt:rows.at(-1)?.occurred_at||null},
    policy:{
      defaultConstraintStaleAfterDays:DEFAULT_CONSTRAINT_STALE_AFTER_DAYS,
      transientDomsStaleAfterDays:TRANSIENT_DOMS_STALE_AFTER_DAYS,
      giStaleAfterDays:GI_STALE_AFTER_DAYS,
      illnessStaleAfterDays:ILLNESS_STALE_AFTER_DAYS,
      recentStateHours:RECENT_STATE_HOURS,recentRecoveryHours:RECENT_RECOVERY_HOURS,recentCostHours:RECENT_COST_HOURS,
      unrelatedFeedbackDoesNotResolveConstraint:true,
      constraintMentionDoesNotImplyActiveConstraint:true,
      negatedHealthyObservationResolvesSubject:true,
      structuredConstraintObservationsPreferred:true
    }
  };
}

async function readStateEvents({asOf=new Date(),lookbackDays=60}={}){
  const sql=await getSql();
  const start=new Date((date(asOf)||new Date()).getTime()-Math.max(1,Number(lookbackDays)||60)*86400000).toISOString();
  return sql`
    SELECT e.event_id,e.event_key,e.event_type,e.occurred_at,e.local_date::text AS local_date,e.certainty,e.summary,e.payload,
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
    WHERE e.actor='ATHLETE'
      AND e.occurred_at>=${start}
      AND e.occurred_at<=${(date(asOf)||new Date()).toISOString()}
    ORDER BY e.occurred_at,e.event_id
  `;
}

export async function readCurrentAthleteState(){
  const sql=await getSql();
  const rows=await sql`
    SELECT id,source_record_id,source_updated_at,ingested_at,local_date::text AS local_date,payload
    FROM fz_training_source_latest
    WHERE source_key=${SOURCE_KEY}
      AND record_type=${RECORD_TYPE}
      AND source_record_id=${SOURCE_RECORD_ID}
      AND payload->>'contextType'=${ATHLETE_CURRENT_STATE_CONTEXT}
    ORDER BY COALESCE(source_updated_at,ingested_at) DESC,id DESC
    LIMIT 1
  `;
  return rows?.[0]||null;
}

export async function recomputeCurrentAthleteState({now=new Date(),persist=true}={}){
  const before=await readCurrentAthleteState();
  const events=await readStateEvents({asOf:now});
  const payload=buildCurrentAthleteState({events,asOf:now});
  const changed=before?.payload?.engineVersion!==payload.engineVersion||before?.payload?.inputFingerprint!==payload.inputFingerprint;
  if(!persist)return {status:'CURRENT',changed,before:before?.payload||null,row:null,payload};
  const row=await ingestTrainingSourceRecord({
    sourceKey:SOURCE_KEY,
    recordType:RECORD_TYPE,
    sourceRecordId:SOURCE_RECORD_ID,
    sourceUpdatedAt:payload.provenance.latestEventAt||now.toISOString(),
    localDate:payload.localDate,
    payload
  });
  return {status:'CURRENT',changed,before:before?.payload||null,row,payload};
}

export async function recomputeCurrentAthleteStateSafely(options={}){
  try{return await recomputeCurrentAthleteState(options);}catch(error){return {status:'ERROR',changed:false,error:error instanceof Error?error.message:String(error),payload:null,row:null};}
}
