import { buildAdaptiveContext as buildBaseAdaptiveContext } from './adaptive-context.js';
import { getSql } from './db.js';
import { readCurrentReadiness } from './readiness-store.js';
import { readCurrentAthleteState } from './athlete-current-state.js';
import { mergeCanonicalReadinessIntoContext } from './readiness-engine.js';

const TZ='Africa/Johannesburg';
function upper(value){return String(value??'').trim().toUpperCase();}
function localDate(value){const d=value instanceof Date?value:new Date(value);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function localHour(value){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))throw new Error('invalid_temporal_context_time');
  return Number(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',hour12:false}).format(d));
}
function decisionWindow(value){const date=localDate(value),hour=localHour(value);return `${date}T${String(hour).padStart(2,'0')}`;}
function hoursBetween(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(y-x)/3600000):null;}
function dateDistanceDays(fromDate,toDate){const a=new Date(`${fromDate}T12:00:00Z`).getTime(),b=new Date(`${toDate}T12:00:00Z`).getTime();return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;}

export function buildTemporalContext(now=new Date()){
  const d=now instanceof Date?now:new Date(now);
  if(Number.isNaN(d.getTime()))throw new Error('invalid_temporal_context_time');
  return {timeZone:TZ,localDate:localDate(d),localHour:localHour(d),decisionWindowKey:decisionWindow(d),observedAt:d.toISOString()};
}

export function buildFzPlanSequencing(plan,{now=new Date(),asOf=null}={}){
  if(!plan)return null;
  const planContext=String(plan.payload?.contextType||'').trim();
  if(!['FZ_PLANNED_INTENT','ATHLETE_PLANNED_INTENT'].includes(planContext))return null;
  const suppliedLane=upper(plan.payload?.lane);
  const lane=['ABSORB','MAINTAIN','ADAPT'].includes(suppliedLane)?suppliedLane:null;
  if(planContext==='FZ_PLANNED_INTENT'&&!lane)return null;
  const nowDate=now instanceof Date?now:new Date(now);
  if(Number.isNaN(nowDate.getTime()))throw new Error('invalid_fz_plan_sequencing_time');
  const currentDate=asOf||localDate(nowDate);
  const planDate=String(plan.local_date||plan.payload?.plannedForDate||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(planDate))return null;
  const plannedStartAt=plan.planned_start_at?new Date(plan.planned_start_at).toISOString():null;
  const plannedWithinHours=plannedStartAt?hoursBetween(nowDate.toISOString(),plannedStartAt):null;
  return {
    nextPlannedLane:lane,
    nextPlannedWithinHours:plannedWithinHours===null?null:Math.round(plannedWithinHours*10)/10,
    nextPlannedSessionId:plan.session_id,
    nextPlannedDate:planDate,
    nextPlannedWithinDays:dateDistanceDays(currentDate,planDate),
    nextPlannedModality:upper(plan.payload?.modality||plan.sport_type)||null,
    nextPlannedSessionKind:upper(plan.payload?.sessionKind||plan.session_kind)||null,
    nextPlannedTitle:String(plan.payload?.title||plan.title||'').trim()||null,
    timingPrecision:plannedStartAt?'EXACT_START':'DATE_ONLY',
    source:planContext==='ATHLETE_PLANNED_INTENT'?'ATHLETE_PLANNED_INTENT':'FZ_ATHLETE_CHOICE',
    planContext
  };
}

async function latestOpenFzPlan(asOf){
  const sql=await getSql();
  const rows=await sql`
    SELECT s.session_id,s.local_date::text AS local_date,s.planned_start_at,s.status,s.title,s.sport_type,s.session_kind,r.source_key,r.payload
    FROM fz_training_sessions s
    JOIN fz_training_session_sources l ON l.session_id=s.session_id AND l.relationship='PLAN'
    JOIN fz_training_source_records r ON r.id=l.source_record_pk
    WHERE s.local_date >= ${asOf}
      AND s.status IN ('ACCEPTED','MODIFIED','PLANNED','RECOMMENDED')
      AND r.record_type='planned_workout'
      AND r.payload->>'contextType' IN ('FZ_PLANNED_INTENT','ATHLETE_PLANNED_INTENT')
    ORDER BY s.local_date, s.planned_start_at NULLS LAST, s.created_at
    LIMIT 1
  `;
  return rows?.[0]||null;
}

export async function buildAdaptiveContext(options={}){
  const now=options.now||new Date(),nowDate=now instanceof Date?now:new Date(now);
  const temporal=buildTemporalContext(nowDate);
  const baseContext=await buildBaseAdaptiveContext(options);
  const asOf=baseContext.asOf||temporal.localDate;
  const [plan,athleteStateRow]=await Promise.all([
    latestOpenFzPlan(asOf).catch(()=>null),
    readCurrentAthleteState().catch(()=>null)
  ]);
  const sequencing=buildFzPlanSequencing(plan,{now:nowDate,asOf});
  const athleteState=athleteStateRow?.payload||null;
  let context={...baseContext,temporal,athleteState};
  if(sequencing){
    const plannedStartAt=plan.planned_start_at?new Date(plan.planned_start_at).toISOString():null;
    const planDescription=sequencing.source==='ATHLETE_PLANNED_INTENT'
      ? `Athlete-described planned intent${sequencing.nextPlannedTitle?` (${sequencing.nextPlannedTitle})`:''}`
      : `Athlete-selected ${sequencing.nextPlannedLane} FZ planned intent`;
    context={
      ...context,
      sequencing:{...(context.sequencing||{}),...sequencing},
      evidence:[...(context.evidence||[]),{
        ref:`planned-intent:${plan.session_id}`,
        fact:`${planDescription} is active for ${sequencing.nextPlannedDate}${plannedStartAt?` at ${plannedStartAt}`:' with date-only timing'}.`,
        provenance:sequencing.source==='ATHLETE_PLANNED_INTENT'?'Canonical Athlete Voice + planned intent':'Canonical FZ athlete choice + planned intent',quality:'DIRECT'
      }]
    };
  }
  if(Array.isArray(athleteState?.activeContexts)&&athleteState.activeContexts.length){
    context={
      ...context,
      evidence:[
        ...(context.evidence||[]),
        ...athleteState.activeContexts.map(item=>({
          ref:`athlete-context:${item.contextKey}:${item.lastConfirmedAt||'current'}`,
          fact:item.summary||`${item.domain} context is currently active.`,
          provenance:'Canonical Current Athlete State',quality:'DIRECT'
        }))
      ]
    };
  }
  const readinessRow=await readCurrentReadiness({date:asOf}).catch(()=>null);
  context=mergeCanonicalReadinessIntoContext(context,readinessRow?.payload||null);
  return {
    ...context,
    provenance:{...(context.provenance||{}),athleteStateSource:athleteStateRow?.payload?'FZ_CANONICAL_CURRENT_ATHLETE_STATE':'UNAVAILABLE',temporalSource:'FZ_LOCAL_CLOCK'}
  };
}
