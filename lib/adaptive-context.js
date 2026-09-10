import { loadDatabaseRuntimeState } from './runtime-store.js';
import { getWellnessToday } from './wellness-store.js';
import { buildDynamicCurrentTrends } from './trends-dynamic.js';
import { readTrainingRange } from './training-store.js';
import { classifyTrainingSession } from './training-classifier.js';
import { buildEventIntelligenceContext } from './event-intelligence.js';
import { resolvePrimaryObjectiveMeasurementHierarchy } from './measurement-hierarchy.js';
import { loadMeasurementRegistry, loadObjectiveRuntimeGraph } from './objective-runtime-store.js';
import { readRecentMaterialityAssessments } from './materiality-store.js';

const TZ='Africa/Johannesburg';
function n(value){if(value===null||value===undefined||value==='')return null;const x=Number(value);return Number.isFinite(x)?x:null;}
function addDays(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function iso(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
function hoursBetween(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(y-x)/3600000):null;}
function evidence(ref,fact,provenance,quality='DERIVED'){return {ref,fact,provenance,quality};}
function sessionMaps(range){
  const events=new Map(),sources=new Map();
  for(const event of range.events||[]){if(!event.session_id)continue;if(!events.has(event.session_id))events.set(event.session_id,[]);events.get(event.session_id).push(event);}
  for(const source of range.sources||[]){if(!sources.has(source.session_id))sources.set(source.session_id,[]);sources.get(source.session_id).push(source);}
  return {events,sources};
}
function measurementEvidence({trends,range}){
  const e={};
  if((trends?.performance?.matchedAet||[]).length)e.MATCHED_RUN_AET={count:trends.performance.matchedAet.length};
  if((range?.events||[]).some(x=>x.actor==='ATHLETE'))e.ATHLETE_MEMORY={count:(range.events||[]).filter(x=>x.actor==='ATHLETE').length};
  if((range?.events||[]).some(x=>x.event_type==='NEXT_DAY_RESPONSE'))e.NEXT_DAY_RESPONSE=true;
  if((range?.events||[]).some(x=>x.event_type==='POST_SESSION_FEEDBACK'))e.POST_STATION_RUN_RESPONSE=true;
  if((trends?.trainingIntent?.sessions||[]).some(x=>/HYROX|MIXED/i.test(`${x.title||''} ${x.modality||''}`)))e.HYBRID_SESSION_TRANSITIONS=true;
  if((trends?.recovery?.wellnessHistory||[]).length>=2)e.HRV_RHR_SLEEP_RESPONSE=true;
  return e;
}
function latestMateriality(rows=[]){const row=rows[0];return row?.payload?.materiality||null;}
export function deriveConstraintSeverity(materiality,recoveryText=''){
  if(materiality?.blocksExistingRecommendation||materiality?.level==='SAFETY_OVERRIDE')return 'SEVERE';
  const codes=materiality?.reasonCodes||[];
  if(codes.some(code=>/PAIN_HIGH|DOMS_HIGH|GI_LIMITER_HIGH|CURRENT_CONSTRAINT_HIGH|ATHLETE_RESPONSE_MATERIAL_NEGATIVE/.test(code)))return 'HIGH';
  const normalized=String(recoveryText||'').toLowerCase()
    .replace(/\bno\s+(?:(?:material|meaningful|current|significant)\s+)?(?:(?:local|tissue|systemic)\s+)?(?:pain|illness|limiter|constraint|fatigue|soreness?)\b/g,'')
    .replace(/\bwithout\s+(?:(?:any|a|an)\s+)?(?:(?:material|meaningful|current|significant)\s+)?(?:(?:local|tissue|systemic)\s+)?(?:pain|illness|limiter|constraint|fatigue|soreness?)\b/g,'');
  if(/not fully recovered|heavy legs|\bsevere\b|\bpain\b|\billness\b|\blimiter\b|\bconstraint\b|\bfatigue\b|\bsore(?:ness)?\b/.test(normalized))return 'MODERATE';
  return 'NONE';
}

export async function buildAdaptiveContext({now=new Date(),materialityOverride=null,trigger={}}={}){
  const nowIso=now instanceof Date?now.toISOString():iso(now)||new Date().toISOString();
  const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(nowIso));
  const objectiveRuntime=await loadObjectiveRuntimeGraph();
  const measurementRegistry=await loadMeasurementRegistry();
  const eventIntelligence=buildEventIntelligenceContext({objectiveRegistry:objectiveRuntime.objectiveRegistry,formatRegistry:objectiveRuntime.formatRegistry,nowDate:asOf});
  const [runtime,wellness,trends,range,materialityRows]=await Promise.all([
    loadDatabaseRuntimeState().catch(()=>null),
    getWellnessToday(asOf).catch(()=>null),
    buildDynamicCurrentTrends({days:45}).catch(()=>null),
    readTrainingRange(addDays(asOf,-3),addDays(asOf,2)).catch(()=>({sessions:[],events:[],sources:[]})),
    readRecentMaterialityAssessments({limit:10}).catch(()=>[])
  ]);
  const materiality=materialityOverride||latestMateriality(materialityRows)||null;
  const runtimeState=runtime?.state||null;
  const readiness=runtimeState?.renderContract?.readiness||{};
  const recoveryText=`${readiness.status||''} ${readiness.systemicRecovery||''} ${readiness.localTissueState||''}`.trim();
  const mEvidence=measurementEvidence({trends,range});
  const measurement=resolvePrimaryObjectiveMeasurementHierarchy({objectiveContext:eventIntelligence,formatRegistry:objectiveRuntime.formatRegistry,measurementRegistry,evidence:mEvidence});
  const topGaps=(measurement.gaps||[]).slice().sort((a,b)=>b.priority-a.priority||a.measurementId.localeCompare(b.measurementId)).slice(0,5);
  const intentSessions=trends?.trainingIntent?.sessions||[];
  const recentCutoff=addDays(asOf,-2);
  const recentAdaptCount=intentSessions.filter(x=>x.date>=recentCutoff&&x.date<=asOf&&x.lane==='ADAPT').length;
  const rolling7=n(trends?.load?.rolling7d?.value),rolling28=n(trends?.load?.rolling28d?.value);
  const ratio=rolling7!==null&&rolling28!==null&&rolling28>0?rolling7/(rolling28/4):null;

  const maps=sessionMaps(range);
  const planned=(range.sessions||[]).filter(session=>session.status==='PLANNED'&&iso(session.planned_start_at)&&new Date(session.planned_start_at).getTime()>=new Date(nowIso).getTime()).map(session=>{
    const classified=classifyTrainingSession({session,events:maps.events.get(session.session_id)||[],sources:maps.sources.get(session.session_id)||[]});
    return {session,lane:classified.adaptiveIntent,confidence:classified.confidence};
  }).sort((a,b)=>new Date(a.session.planned_start_at)-new Date(b.session.planned_start_at));
  const next=planned[0]||null;
  const nextHours=next?hoursBetween(nowIso,next.session.planned_start_at):null;

  const primaryEvent=eventIntelligence.primaryEvent||null;
  const primaryKnowledge=eventIntelligence.eventKnowledge.find(x=>x.eventId===primaryEvent?.id)||null;
  const primaryObjective=primaryEvent?{
    id:primaryEvent.id,name:primaryEvent.name,role:primaryEvent.role,runwayDays:primaryEvent.runwayDays,runwayWindow:primaryEvent.runwayWindow||null,
    startsOn:primaryEvent.startsOn||null,endsOn:primaryEvent.endsOn||null,datePrecision:primaryEvent.datePrecision||null,participationStatus:primaryEvent.participationStatus||null,
    knowledgeStatus:primaryKnowledge?.knowledgeStatus||'PENDING_RESEARCH',formatProfileId:primaryEvent.formatProfileId||null,
    versionToken:primaryEvent.versionToken||null,profileVersionToken:primaryEvent.profileVersionToken||null
  }:null;
  const eventPressure=(eventIntelligence.eventKnowledge||[]).filter(x=>x.eventId!==primaryObjective?.id).map(x=>{
    const source=eventIntelligence.upcomingEvents.find(event=>event.id===x.eventId)||{};
    return {
      id:x.eventId,name:x.eventName,role:x.role,runwayDays:x.runwayDays,runwayWindow:source.runwayWindow||null,
      startsOn:source.startsOn||null,endsOn:source.endsOn||null,datePrecision:source.datePrecision||null,participationStatus:source.participationStatus||null,
      knowledgeStatus:x.knowledgeStatus,overlapToPrimary:x.overlapToPrimary?.score??null,formatProfileId:source.formatProfileId||null,
      versionToken:source.versionToken||null,profileVersionToken:source.profileVersionToken||null
    };
  });

  const missing=[];const assumptions=[];
  const readinessScore=n(readiness.score);
  if(readinessScore===null)missing.push('current readiness score');
  if(!wellness)missing.push('current persisted wellness');
  if(rolling7===null||rolling28===null)missing.push('complete rolling load context');
  if(measurement.status!=='READY')missing.push('primary measurement hierarchy');
  if(objectiveRuntime.source!=='NEON_OBJECTIVE_GRAPH')missing.push('runtime objective graph');
  if(!materiality)missing.push('recent materiality assessment');
  const evidenceRows=[];
  if(primaryObjective)evidenceRows.push(evidence(`objective:${primaryObjective.id}:${primaryObjective.versionToken||'unversioned'}`,`${primaryObjective.name} is the resolved ${primaryObjective.role} objective${primaryObjective.runwayDays===null?' with an unresolved exact runway':` with ${primaryObjective.runwayDays} day(s) to the earliest active date`}.`,objectiveRuntime.source,'DIRECT'));
  for(const event of eventPressure){
    evidenceRows.push(evidence(`event:${event.id}:${event.versionToken||'unversioned'}:profile:${event.profileVersionToken||'none'}:overlap:${event.overlapToPrimary??'unknown'}`,`${event.name} is ${event.role} context${event.runwayDays===null?' with unresolved exact runway':` with ${event.runwayDays} day(s) to the earliest active date`}; directional overlap to the primary objective is ${event.overlapToPrimary??'unknown'}.`,objectiveRuntime.source,event.knowledgeStatus==='QUALIFIED'?'DERIVED':'DIRECT'));
  }
  if(readinessScore!==null)evidenceRows.push(evidence(`runtime:${runtime?.stateId||'current'}:readiness`,`Current canonical readiness score is ${readinessScore}; interpretation remains contextual rather than score-only.`,'Neon versioned runtime state','DIRECT'));
  if(rolling7!==null)evidenceRows.push(evidence(`trends:load:${asOf}`,`Rolling 7-day NCL is ${rolling7}${rolling28!==null?` and rolling 28-day NCL is ${rolling28}`:''}.`,'Neon canonical training evidence','DERIVED'));
  if(materiality)evidenceRows.push(evidence(`materiality:${trigger.evidenceKey||materialityRows[0]?.payload?.evidenceKey||'latest'}`,`Latest materiality is ${materiality.level} (${(materiality.reasonCodes||[]).join(', ')||'no reason code'}).`,'FZ 4.1 materiality ledger','DIRECT'));
  if(measurement.status==='READY')evidenceRows.push(evidence(`measurement:${measurement.hierarchyId}`,`${measurement.hierarchyId} is active; ${topGaps.length} high-priority observations remain unmeasured in the current evidence map.`,'FZ primary-objective measurement hierarchy','DERIVED'));
  if(next)evidenceRows.push(evidence(`plan:${next.session.session_id}`,`Next planned session is classified ${next.lane} and starts in approximately ${Math.round(nextHours)} hour(s).`,'Canonical Tredict plan + FZ training classifier','DERIVED'));

  return {
    schemaVersion:'1.0',asOf,generatedFrom:nowIso,
    primaryObjective,eventPressure,
    recovery:{readinessScore,status:readiness.status||null,systemicState:readiness.systemicRecovery||null,localConstraint:readiness.localTissueState||null,constraintSeverity:deriveConstraintSeverity(materiality,recoveryText),safetyBlock:materiality?.blocksExistingRecommendation===true,wellnessFreshness:wellness?.freshness||null},
    load:{rolling7d:rolling7,rolling28d:rolling28,ratio7dTo28dQuarter:ratio===null?null:Math.round(ratio*1000)/1000,recentAdaptCount},
    sequencing:{nextPlannedLane:next?.lane||null,nextPlannedWithinHours:nextHours===null?null:Math.round(nextHours*10)/10,nextPlannedSessionId:next?.session?.session_id||null},
    measurement:{status:measurement.status,hierarchyId:measurement.hierarchyId||null,topGaps,measured:(measurement.measurements||[]).filter(x=>x.evidence?.status==='MEASURED').map(x=>({measurementId:x.id,priority:x.priority,evidence:x.evidence}))},
    materiality,
    evidence:evidenceRows,
    uncertainty:{missing,assumptions,confidence:missing.length>=3?'LOW':missing.length?'MODERATE':'HIGH'},
    provenance:{objectiveSource:objectiveRuntime.source,runtimeStateId:runtime?.stateId||null,wellnessSource:wellness?'NEON_WELLNESS_CURRENT':null,trendsSource:trends?'DYNAMIC_CANONICAL_TRENDS':null},
    rules:{primaryObjectiveCannotBeDisplacedByProximity:true,unknownMeasurementIsNotWeakness:true,qualifiedEventStructureRequired:true,eventDataIsRuntimeVariable:true,staticEventSeedCannotOverrideRuntime:true,shadowRecommendationMayNotAlterToday:true}
  };
}
