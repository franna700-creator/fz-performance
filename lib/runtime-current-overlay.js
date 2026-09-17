function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function dateOnly(value){const match=/^\d{4}-\d{2}-\d{2}/.exec(String(value||''));return match?match[0]:null;}
function activeText(active){
  if(!active)return null;
  if(active.status==='WITHHELD')return active.reason||'FZ recommendation is withheld until the required decision context is available.';
  return active.explanation?.athleteFacing?.summary||active.explanation?.athleteFacing?.headline||active.reason||`FZ recommends ${String(active.fzRecommendedLane||'').toLowerCase()}.`;
}

export function overlayCanonicalCurrentState(runtimeState,intelligence){
  if(!runtimeState||typeof runtimeState!=='object')return runtimeState;
  const next=clone(runtimeState);
  const readiness=next?.renderContract?.readiness;
  if(!readiness)return next;
  const active=intelligence?.activeRecommendation||null;
  const canonicalReadiness=intelligence?.currentReadiness||null;
  const athleteState=intelligence?.currentAthleteState||null;
  const runtimeDate=dateOnly(next.stateId||next.candidateStateId||next.masterAsOf||readiness.asOfDate);
  const activeDate=dateOnly(active?.localDate);
  const readinessDate=dateOnly(canonicalReadiness?.localDate);
  const currentDate=readinessDate||activeDate||intelligence?.temporal?.localDate||runtimeDate;
  const canonicalReadinessCurrent=Boolean(canonicalReadiness&&readinessDate&&readinessDate===currentDate&&canonicalReadiness.engineVersion);

  if(active){
    readiness.primaryDecision=activeText(active)||readiness.primaryDecision;
    readiness.recommendationLane=active.fzRecommendedLane||null;
    readiness.recommendationVersion=active.recommendationVersion||null;
    readiness.recommendationStatus=active.status||null;
    readiness.successCriteria=active.explanation?.recommendation?.successConditions?.[0]||readiness.successCriteria;
  }
  readiness.asOfDate=currentDate||null;
  readiness.runtimeReadinessDate=runtimeDate;
  readiness.runtimeReadinessFresh=Boolean(runtimeDate&&currentDate&&runtimeDate===currentDate);

  if(canonicalReadinessCurrent){
    readiness.score=canonicalReadiness.status==='READY'?canonicalReadiness.score:null;
    readiness.readinessBand=canonicalReadiness.band||null;
    readiness.readinessEngineVersion=canonicalReadiness.engineVersion||null;
    readiness.readinessConfidence=canonicalReadiness.confidence||null;
    readiness.readinessInputFingerprint=canonicalReadiness.inputFingerprint||null;
    readiness.status=active?.status==='WITHHELD'?'CURRENT RECOMMENDATION WITHHELD':active?.fzRecommendedLane?`CURRENT · ${active.fzRecommendedLane}`:(canonicalReadiness.band||'CURRENT READINESS');
    readiness.systemicRecovery=canonicalReadiness.systemicState||readiness.systemicRecovery;
    readiness.localTissueState=canonicalReadiness.localTissueState||readiness.localTissueState;
    readiness.canonicalReadinessCurrent=true;
    readiness.historicalRuntimeReadinessSuppressed=runtimeDate!==currentDate;
  }else if(runtimeDate!==currentDate){
    readiness.score=null;
    readiness.status=active?.status==='WITHHELD'?'CURRENT RECOMMENDATION WITHHELD':`CURRENT · ${active?.fzRecommendedLane||'RECOMMENDATION'}`;
    readiness.systemicRecovery=activeText(active)||'Current decision state is available; historical runtime readiness is not presented as current.';
    readiness.localTissueState='Historical runtime readiness is suppressed because current canonical readiness is unavailable.';
    readiness.canonicalReadinessCurrent=false;
  }

  next.renderContract.intelligence={
    contract:'FZ_CURRENT_PRESENTATION_V5',
    canonicalRevisionId:intelligence?.markers?.canonicalRevision?.revisionId||null,
    convergenceStatus:intelligence?.convergence?.status||null,
    pendingPropagation:intelligence?.pendingPropagation===true,
    temporal:intelligence?.temporal||null,
    athleteState:athleteState?{
      engineVersion:athleteState.engineVersion||null,inputFingerprint:athleteState.inputFingerprint||null,
      activeConstraints:(athleteState.activeConstraints||[]).map(item=>({subject:item.subject,severity:item.severity,lastConfirmedAt:item.lastConfirmedAt}))
    }:null
  };
  return next;
}
