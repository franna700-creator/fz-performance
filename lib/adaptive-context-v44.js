import { buildAdaptiveContext as buildBaseAdaptiveContext } from './adaptive-context.js';
import { getSql } from './db.js';

const TZ='Africa/Johannesburg';
function upper(value){return String(value??'').trim().toUpperCase();}
function localDate(value){const d=value instanceof Date?value:new Date(value);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function hoursBetween(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(y-x)/3600000):null;}
function dateDistanceDays(fromDate,toDate){const a=new Date(`${fromDate}T12:00:00Z`).getTime(),b=new Date(`${toDate}T12:00:00Z`).getTime();return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;}

export function buildFzPlanSequencing(plan,{now=new Date(),asOf=null}={}){
  if(!plan)return null;
  const lane=upper(plan.payload?.lane);
  if(!['ABSORB','MAINTAIN','ADAPT'].includes(lane))return null;
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
    timingPrecision:plannedStartAt?'EXACT_START':'DATE_ONLY',
    source:'FZ_ATHLETE_CHOICE'
  };
}

async function latestOpenFzPlan(asOf){
  const sql=await getSql();
  const rows=await sql`
    SELECT s.session_id,s.local_date::text AS local_date,s.planned_start_at,s.status,r.payload
    FROM fz_training_sessions s
    JOIN fz_training_session_sources l ON l.session_id=s.session_id AND l.relationship='PLAN'
    JOIN fz_training_source_records r ON r.id=l.source_record_pk
    WHERE s.local_date >= ${asOf}
      AND s.status IN ('ACCEPTED','MODIFIED','PLANNED','RECOMMENDED')
      AND r.source_key='fz-intelligence' AND r.record_type='planned_workout'
      AND r.payload->>'contextType'='FZ_PLANNED_INTENT'
    ORDER BY s.local_date, s.planned_start_at NULLS LAST, s.created_at
    LIMIT 1
  `;
  return rows?.[0]||null;
}
export async function buildAdaptiveContext(options={}){
  const now=options.now||new Date(),nowDate=now instanceof Date?now:new Date(now);
  const context=await buildBaseAdaptiveContext(options);
  const asOf=context.asOf||localDate(nowDate);
  const plan=await latestOpenFzPlan(asOf).catch(()=>null);
  const sequencing=buildFzPlanSequencing(plan,{now:nowDate,asOf});
  if(!sequencing)return context;
  const plannedStartAt=plan.planned_start_at?new Date(plan.planned_start_at).toISOString():null;
  return {
    ...context,
    sequencing:{...(context.sequencing||{}),...sequencing},
    evidence:[...(context.evidence||[]),{
      ref:`fz-plan:${plan.session_id}`,
      fact:`Athlete-selected ${sequencing.nextPlannedLane} planned intent is active for ${sequencing.nextPlannedDate}${plannedStartAt?` at ${plannedStartAt}`:' with date-only timing'}.`,
      provenance:'Canonical FZ athlete choice + planned intent',quality:'DIRECT'
    }]
  };
}
