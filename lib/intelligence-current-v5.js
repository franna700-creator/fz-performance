import { readIntelligenceCurrent as readLegacyIntelligenceCurrent } from './intelligence-current.js';
import { readConvergenceStatus } from './convergence-store.js';
import { readRecentRecommendationShadows } from './recommendation-shadow-store.js';
import { readCurrentAthleteState } from './athlete-current-state.js';
import { buildTemporalContext } from './adaptive-context-v44.js';

function markerFromConvergence(convergence){
  const revision=convergence?.revision;
  if(!revision)return null;
  return {
    revisionId:revision.revision_id||null,
    revisionSha256:revision.revision_sha256||null,
    sourceType:revision.source_type||null,
    occurredAt:revision.occurred_at||null,
    status:convergence.status||null,
    counts:convergence.counts||null
  };
}

function athleteStateMarker(row){
  if(!row?.payload)return null;
  return {
    id:row.id==null?null:String(row.id),
    engineVersion:row.payload.engineVersion||null,
    inputFingerprint:row.payload.inputFingerprint||null,
    localDate:row.payload.localDate||null,
    activeConstraintCount:Array.isArray(row.payload.activeConstraints)?row.payload.activeConstraints.length:0,
    updatedAt:row.source_updated_at||row.ingested_at||null
  };
}

export async function readIntelligenceCurrent({now=new Date()}={}){
  const [base,convergence,shadows,athleteStateRow]=await Promise.all([
    readLegacyIntelligenceCurrent(),
    readConvergenceStatus().catch(()=>({status:'UNAVAILABLE',revision:null,rows:[],pending:true,failed:['CONVERGENCE_LEDGER_UNAVAILABLE'],invalidated:[]})),
    readRecentRecommendationShadows({limit:1}).catch(()=>[]),
    readCurrentAthleteState().catch(()=>null)
  ]);
  const temporal=buildTemporalContext(now);
  const shadow=shadows?.[0]?.payload||null;
  const shadowTemporal=shadow?.contextSummary?.temporal||null;
  const temporalPending=Boolean(shadow)&&shadowTemporal?.decisionWindowKey!==temporal.decisionWindowKey;
  const localDayPending=Boolean(shadow)&&shadowTemporal?.localDate!==temporal.localDate;
  const convergencePending=convergence?.pending!==false;
  const pending={
    ...(base.pending||{}),
    convergence:convergencePending,
    temporal:temporalPending
  };
  return {
    ...base,
    markers:{
      ...(base.markers||{}),
      athleteState:athleteStateMarker(athleteStateRow),
      canonicalRevision:markerFromConvergence(convergence),
      clock:{localDate:temporal.localDate,decisionWindowKey:temporal.decisionWindowKey,observedAt:temporal.observedAt}
    },
    dependencyState:{
      ...(base.dependencyState||{}),
      currentAthleteStateAvailable:Boolean(athleteStateRow?.payload),
      graphConverged:!convergencePending,
      temporalContextCurrent:!temporalPending,
      localDayCurrent:!localDayPending
    },
    pending,
    pendingPropagation:Object.values(pending).some(Boolean),
    convergence,
    temporal:{...temporal,shadowDecisionWindowKey:shadowTemporal?.decisionWindowKey||null,shadowLocalDate:shadowTemporal?.localDate||null,pending:temporalPending},
    currentAthleteState:athleteStateRow?.payload||null
  };
}
