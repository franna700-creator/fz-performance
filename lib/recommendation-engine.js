import crypto from 'node:crypto';
import { ADAPTIVE_LANE_DEFINITIONS, ADAPTIVE_LANES } from './adaptive-lanes.js';
import { buildRecommendationExplanation } from './recommendation-explainability.js';

export const RECOMMENDATION_ENGINE_VERSION = '4.2.0-shadow.1';
export const RECOMMENDATION_ENGINE_MODE = 'SHADOW';

const COST_BY_LANE = Object.freeze({ ABSORB:'LOW', MAINTAIN:'LOW_TO_MODERATE', ADAPT:'MODERATE_TO_HIGH' });
const CONFIDENCE = new Set(['LOW','MODERATE','HIGH']);

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function text(value){return String(value ?? '').trim();}
function upper(value){return text(value).toUpperCase();}
function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(!value || typeof value!=='object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function unique(values){return [...new Set(values.filter(Boolean))];}
function push(scores,lane,delta,reason,reasons){scores[lane]=clamp(scores[lane]+delta,-1,2);if(reason)reasons[lane].push(reason);}
function bestLane(scores){return ADAPTIVE_LANES.slice().sort((a,b)=>scores[b]-scores[a]||ADAPTIVE_LANES.indexOf(a)-ADAPTIVE_LANES.indexOf(b))[0];}
function humanMeasurement(measurement){return measurement?.question || text(measurement?.measurementId).replaceAll('_',' ').replaceAll('.',' ');}

export function recommendationContextFingerprint(context={}){
  const decisionInput={
    primaryObjective: context.primaryObjective ? {
      id:context.primaryObjective.id,
      role:context.primaryObjective.role,
      runwayDays:context.primaryObjective.runwayDays,
      knowledgeStatus:context.primaryObjective.knowledgeStatus
    }:null,
    recovery: context.recovery ? {
      readinessScore:n(context.recovery.readinessScore),
      status:context.recovery.status||null,
      systemicState:context.recovery.systemicState||null,
      localConstraint:context.recovery.localConstraint||null,
      constraintSeverity:context.recovery.constraintSeverity||null
    }:null,
    load: context.load ? {
      rolling7d:n(context.load.rolling7d),
      rolling28d:n(context.load.rolling28d),
      ratio7dTo28dQuarter:n(context.load.ratio7dTo28dQuarter),
      recentAdaptCount:n(context.load.recentAdaptCount)
    }:null,
    sequencing: context.sequencing ? {
      nextPlannedLane:context.sequencing.nextPlannedLane||null,
      nextPlannedWithinHours:n(context.sequencing.nextPlannedWithinHours),
      nextPlannedSessionId:context.sequencing.nextPlannedSessionId||null
    }:null,
    eventPressure:(context.eventPressure||[]).map(x=>({id:x.id,role:x.role,runwayDays:x.runwayDays,knowledgeStatus:x.knowledgeStatus})),
    measurement: context.measurement ? {
      hierarchyId:context.measurement.hierarchyId||null,
      status:context.measurement.status||null,
      topGaps:(context.measurement.topGaps||[]).map(x=>({measurementId:x.measurementId,priority:x.priority,tier:x.tier}))
    }:null,
    materiality: context.materiality ? {
      level:context.materiality.level||null,
      reasonCodes:context.materiality.reasonCodes||[],
      blocksExistingRecommendation:context.materiality.blocksExistingRecommendation===true
    }:null,
    uncertainty: context.uncertainty ? { missing:context.uncertainty.missing||[], assumptions:context.uncertainty.assumptions||[] }:null,
    evidenceRefs:(context.evidence||[]).map(x=>x.ref)
  };
  return hash(decisionInput);
}

function withheld(context,code,reason){
  const fingerprint=recommendationContextFingerprint(context);
  return {
    schemaVersion:'1.0',engineVersion:RECOMMENDATION_ENGINE_VERSION,mode:RECOMMENDATION_ENGINE_MODE,
    status:'WITHHELD',reasonCode:code,reason,
    recommendationId:`shadow:${RECOMMENDATION_ENGINE_VERSION}:${fingerprint.slice(0,20)}`,
    contextFingerprint:fingerprint,lane:null,confidence:'LOW',scores:null,explanation:null,
    rules:{shadowOnly:true,mayNotWriteRecommendationCurrent:true,mayNotAlterToday:true,missingEvidenceNeverMeansWeakness:true}
  };
}

export function evaluateRecommendation(context={}){
  if(!context?.primaryObjective) return withheld(context,'NO_PRIMARY_OBJECTIVE','No active primary objective is resolved. FZ will not silently activate an evergreen objective.');
  if(context.primaryObjective.knowledgeStatus && context.primaryObjective.knowledgeStatus!=='QUALIFIED') return withheld(context,'PRIMARY_OBJECTIVE_STRUCTURE_PENDING','The active primary objective does not yet have qualified demand structure.');
  if(context.measurement?.status && context.measurement.status!=='READY') return withheld(context,'PRIMARY_MEASUREMENT_HIERARCHY_UNAVAILABLE','The primary objective has no ready measurement hierarchy.');

  const scores={ABSORB:0.2,MAINTAIN:0.45,ADAPT:0.35};
  const reasons={ABSORB:[],MAINTAIN:[],ADAPT:[]};
  const materiality=context.materiality||{};
  const recovery=context.recovery||{};
  const load=context.load||{};
  const sequencing=context.sequencing||{};
  const uncertainty=context.uncertainty||{};
  const readiness=n(recovery.readinessScore);
  const loadRatio=n(load.ratio7dTo28dQuarter);
  const recentAdapt=n(load.recentAdaptCount) ?? 0;
  const nextHours=n(sequencing.nextPlannedWithinHours);
  const constraintSeverity=upper(recovery.constraintSeverity);

  const safety=materiality.blocksExistingRecommendation===true || upper(materiality.level)==='SAFETY_OVERRIDE' || recovery.safetyBlock===true;
  if(safety){
    scores.ABSORB=2;scores.MAINTAIN=0;scores.ADAPT=-1;
    reasons.ABSORB.push('Safety override blocks normal progression until the limiting evidence is reconsidered.');
  } else {
    if(['HIGH','SEVERE'].includes(constraintSeverity)){
      push(scores,'ABSORB',0.85,'A current high-severity constraint materially limits training tolerance.',reasons);
      push(scores,'ADAPT',-0.5,null,reasons);
    }
    if(readiness!==null){
      if(readiness<50){push(scores,'ABSORB',0.75,'Current readiness is materially constrained.',reasons);push(scores,'ADAPT',-0.45,null,reasons);}
      else if(readiness<65){push(scores,'MAINTAIN',0.25,'Current recovery supports continuity better than a new high-cost stimulus.',reasons);push(scores,'ADAPT',-0.15,null,reasons);}
      else if(readiness>=75){push(scores,'ADAPT',0.22,'Current recovery is compatible with a deliberate adaptation stimulus.',reasons);}
    }
    const stateText=`${recovery.status||''} ${recovery.systemicState||''} ${recovery.localConstraint||''}`.toLowerCase();
    const localConstraintText=text(recovery.localConstraint).toLowerCase();
    const recoveryStateText=`${recovery.status||''} ${recovery.systemicState||''}`.toLowerCase().replace(/\bno\s+(?:pain|illness|fatigue|soreness?)\b/g,'');
    const explicitAbsorbState=/post[-\s]?session absorption|no further quality|recovery[-\s]?only|modify\s*\/\s*recover/.test(stateText);
    const symptomLimiter=/not fully recovered|poor recovery|\bheavy\b|\bsore\b|\bill(?:ness)?\b|\bfatigue\b/.test(recoveryStateText);
    const structuredLocalLimiter=!['NONE','NO','CLEAR'].includes(constraintSeverity) && /\bconstraint\b|\blimiter\b|\bpain\b|\bsore(?:ness)?\b/.test(localConstraintText);
    if(explicitAbsorbState){
      push(scores,'ABSORB',0.75,'Canonical state explicitly indicates post-session absorption or recovery-only intent.',reasons);
      push(scores,'MAINTAIN',-0.1,null,reasons);push(scores,'ADAPT',-0.45,null,reasons);
    } else if(symptomLimiter || structuredLocalLimiter){
      push(scores,'ABSORB',0.35,'Current state contains a meaningful recovery or local-tissue limiter.',reasons);
      push(scores,'MAINTAIN',0.1,null,reasons);push(scores,'ADAPT',-0.25,null,reasons);
    }
    if(upper(materiality.level)==='RECOMPUTE_RECOMMENDATION'){
      const negative=(materiality.reasonCodes||[]).some(code=>/NEGATIVE|ABORT|STOPPED|PAIN|DOMS|GI|ILLNESS|DETERIORATION|LOAD_MATERIAL/.test(code));
      const positive=(materiality.reasonCodes||[]).some(code=>/POSITIVE|IMPROVEMENT/.test(code));
      if(negative){push(scores,'ABSORB',0.35,'Recent material evidence increased expected recovery cost or constraint risk.',reasons);push(scores,'MAINTAIN',0.2,null,reasons);push(scores,'ADAPT',-0.3,null,reasons);}
      if(positive){push(scores,'ADAPT',0.14,'Recent material evidence improved the amount of useful work likely to be absorbed.',reasons);}
    }
    if(loadRatio!==null){
      if(loadRatio>=1.35){push(scores,'MAINTAIN',0.35,'Recent seven-day load is high relative to the surrounding 28-day context.',reasons);push(scores,'ABSORB',0.18,null,reasons);push(scores,'ADAPT',-0.28,null,reasons);}
      else if(loadRatio<=0.75 && readiness!==null && readiness>=70){push(scores,'ADAPT',0.12,'Recent load leaves room for a useful stimulus if other constraints remain controlled.',reasons);}
    }
    if(recentAdapt>=2){push(scores,'MAINTAIN',0.38,'Recent training already contains multiple adaptation-oriented exposures.',reasons);push(scores,'ADAPT',-0.28,null,reasons);}
    else if(recentAdapt===0 && readiness!==null && readiness>=70){push(scores,'ADAPT',0.1,'No recent adaptation-oriented exposure is competing for recovery capacity.',reasons);}

    if(sequencing.nextPlannedLane==='ADAPT' && nextHours!==null && nextHours<=30){
      push(scores,'MAINTAIN',0.45,'A higher-value adaptation session is already planned inside the next 30 hours.',reasons);
      push(scores,'ABSORB',0.12,null,reasons);push(scores,'ADAPT',-0.32,null,reasons);
    }

    const nearEvent=(context.eventPressure||[]).filter(event=>event.knowledgeStatus==='QUALIFIED'&&n(event.runwayDays)!==null&&event.runwayDays>=0).sort((a,b)=>a.runwayDays-b.runwayDays)[0]||null;
    if(nearEvent && nearEvent.runwayDays<=3){
      push(scores,'MAINTAIN',0.5,`${nearEvent.role==='PRIMARY'?'The primary event':'A qualified near-term event'} is within three days, so preserving event readiness has high opportunity value.`,reasons);
      push(scores,'ABSORB',0.2,null,reasons);push(scores,'ADAPT',-0.4,null,reasons);
    } else if(nearEvent && nearEvent.runwayDays<=10 && ['VALIDATION','SECONDARY'].includes(nearEvent.role)){
      push(scores,'MAINTAIN',0.16,'A qualified validation/secondary event is close enough to influence sequencing without replacing the primary objective.',reasons);
    }

    const topGap=(context.measurement?.topGaps||[])[0];
    if(topGap && n(topGap.priority)>=0.9 && readiness!==null && readiness>=70 && recentAdapt<2 && !(sequencing.nextPlannedLane==='ADAPT'&&nextHours!==null&&nextHours<=30)){
      push(scores,'ADAPT',0.16,`A high-priority primary-objective measurement remains unmeasured: ${humanMeasurement(topGap)}. This is an evidence opportunity, not proof of weakness.`,reasons);
    }

    const missingCount=(uncertainty.missing||[]).length;
    if(missingCount>=3){push(scores,'MAINTAIN',0.25,'Decision context is incomplete, so a conservative maintenance bias protects against false precision.',reasons);push(scores,'ADAPT',-0.18,null,reasons);}
  }

  const lane=safety?'ABSORB':bestLane(scores);
  const fingerprint=recommendationContextFingerprint(context);
  const recommendationId=`shadow:${RECOMMENDATION_ENGINE_VERSION}:${fingerprint.slice(0,20)}`;
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const margin=sorted[0][1]-sorted[1][1];
  const missingCount=(uncertainty.missing||[]).length;
  let confidence=missingCount>=3?'LOW':margin>=0.35&&missingCount===0?'HIGH':'MODERATE';
  if(!CONFIDENCE.has(confidence)) confidence='LOW';

  const topGap=(context.measurement?.topGaps||[])[0]||null;
  const evidence=(context.evidence||[]).length?context.evidence:[{ref:'adaptive-context',fact:'Canonical adaptive context was composed for shadow evaluation.',provenance:'FZ adaptive context',quality:'DERIVED'}];
  const laneReason=reasons[lane][0] || ADAPTIVE_LANE_DEFINITIONS[lane].principle;
  const objectiveName=context.primaryObjective.name || context.primaryObjective.id;
  const objectiveRelevance=[{
    objective:objectiveName,
    role:context.primaryObjective.role||'PRIMARY',
    relevance:`${lane} is evaluated against the active primary objective while preserving qualified near-term event sequencing and recovery cost.`,
    measurementIds:(context.measurement?.topGaps||[]).slice(0,3).map(x=>x.measurementId)
  }];
  const explanation=buildRecommendationExplanation({
    recommendationId,lane,evidence,
    interpretation:unique([
      laneReason,
      safety?'Safety status dominates ordinary training-value scoring.':null,
      topGap?`The top unresolved measurement is ${topGap.measurementId}; it remains unknown rather than being labelled weak.`:null
    ]),
    objectiveRelevance,
    recommendation:{
      whyThisLane:laneReason,
      expectedBenefit:ADAPTIVE_LANE_DEFINITIONS[lane].objective,
      expectedCost:COST_BY_LANE[lane],
      successConditions:['The intended training effect is achieved without materially worsening the next valuable training opportunity.'],
      stopModifyConditions:safety?['Do not progress while the safety override remains unresolved.']:['Modify if a new pain, illness, GI, local-tissue or recovery limiter materially changes tolerance.']
    },
    counterfactuals:{
      ABSORB:lane==='ABSORB'?null:'ABSORB was not preferred because current evidence does not require the lowest-cost lane.',
      MAINTAIN:lane==='MAINTAIN'?null:'MAINTAIN was not the highest-value balance after current recovery, load and sequencing were considered.',
      ADAPT:lane==='ADAPT'?null:'ADAPT was not preferred because current recovery/load/sequencing does not justify adding the highest deliberate stimulus.'
    },
    uncertainty:{confidence,unknowns:uncertainty.missing||[],assumptions:uncertainty.assumptions||[]},
    safety:{override:safety,reason:safety?'A SAFETY_OVERRIDE or explicit safety block is present.':null},
    athleteFacing:{
      headline:lane==='ABSORB'?'Protect the next useful training opportunity.':lane==='MAINTAIN'?'Keep the work useful without adding unnecessary cost.':'There is room for a deliberate adaptation stimulus.',
      whyNow:laneReason,
      objectiveConnection:`This decision stays anchored to ${objectiveName}${topGap?` and the current ${topGap.measurementId} evidence gap`:''}.`,
      caveat:(uncertainty.missing||[]).length?`Confidence is ${confidence.toLowerCase()} because some decision inputs remain incomplete.`:'The decision will be reconsidered when material new evidence arrives.'
    }
  });

  return {
    schemaVersion:'1.0',engineVersion:RECOMMENDATION_ENGINE_VERSION,mode:RECOMMENDATION_ENGINE_MODE,
    status:'READY',recommendationId,contextFingerprint:fingerprint,lane,confidence,
    scores:Object.fromEntries(Object.entries(scores).map(([key,value])=>[key,Math.round(value*1000)/1000])),
    reasons,explanation,
    rules:{shadowOnly:true,mayNotWriteRecommendationCurrent:true,mayNotAlterToday:true,missingEvidenceNeverMeansWeakness:true,safetyOverridesLaneScoring:true,nearTermEventsDoNotDisplacePrimaryObjective:true}
  };
}
