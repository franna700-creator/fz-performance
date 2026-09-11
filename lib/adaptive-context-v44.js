import { buildAdaptiveContext as buildBaseAdaptiveContext } from './adaptive-context.js';
import { getSql } from './db.js';

const TZ='Africa/Johannesburg';
function upper(value){return String(value??'').trim().toUpperCase();}
function localDate(value){const d=value instanceof Date?value:new Date(value);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function hoursBetween(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(y-x)/3600000):null;}
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
  const now=options.now||new Date(),nowIso=now instanceof Date?now.toISOString():new Date(now).toISOString();
  const context=await buildBaseAdaptiveContext(options);
  const asOf=context.asOf||localDate(now);
  const plan=await latestOpenFzPlan(asOf).catch(()=>null);
  if(!plan)return context;
  const lane=upper(plan.payload?.lane);
  if(!['ABSORB','MAINTAIN','ADAPT'].includes(lane))return context;
  const plannedStartAt=plan.planned_start_at?new Date(plan.planned_start_at).toISOString():null;
  const plannedWithinHours=plannedStartAt?hoursBetween(nowIso,plannedStartAt):null;
  return {
    ...context,
    sequencing:{
      ...(context.sequencing||{}),
      nextPlannedLane:lane,
      nextPlannedWithinHours:plannedWithinHours===null?null:Math.round(plannedWithinHours*10)/10,
      nextPlannedSessionId:plan.session_id,
      nextPlannedDate:String(plan.local_date).slice(0,10),
      timingPrecision:plannedStartAt?'EXACT_START':'DATE_ONLY',
      source:'FZ_ATHLETE_CHOICE'
    },
    evidence:[...(context.evidence||[]),{
      ref:`fz-plan:${plan.session_id}`,
      fact:`Athlete-selected ${lane} planned intent is active for ${String(plan.local_date).slice(0,10)}${plannedStartAt?` at ${plannedStartAt}`:' with date-only timing'}.`,
      provenance:'Canonical FZ athlete choice + planned intent',quality:'DIRECT'
    }]
  };
}
