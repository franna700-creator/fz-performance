import { affectedNodes, affectedSurfaces, assertKnownChangedNodes } from './runtime-dependency-graph.js';
import { readIntelligenceCurrent } from './intelligence-current-v5.js';
import { recomputeCurrentAthleteStateSafely } from './athlete-current-state.js';
import { recomputeCurrentReadinessSafely } from './readiness-store.js';
import { buildAdaptiveContext } from './adaptive-context-v44.js';
import { recommendationContextFingerprint } from './recommendation-engine.js';
import { readRecentRecommendationShadows } from './recommendation-shadow-store.js';
import { recomputeRecommendationShadowSafely } from './recommendation-shadow-orchestrator.js';
import { persistActiveRecommendationFromShadow } from './active-recommendation-store.js';
import { createCanonicalRevision, markConvergenceNode, markConvergenceNodes, readConvergenceStatus } from './convergence-store.js';

function unique(values = []) { return [...new Set(values.filter(Boolean))]; }
function errorText(error) { return error instanceof Error ? error.message : String(error); }

const ADAPTIVE_CONTEXT_DERIVATIONS = new Set([
  'recovery.current','objective.graph','training.identity','training.intent','trends.ncl','load.rolling','performance.aet',
  'event.intelligence','capability.evidence','capability.priority','measurement.evidence','measurement.hierarchy','adaptive.context'
]);
const READ_ON_REQUEST_NODES = new Set(['trends.summary']);
const SOURCE_PERSISTED_NODES = new Set([
  'wellness.current','wellness.history','training.session','training.evidence','athlete.memory','event.intake','event.format','materiality.current'
]);

async function mark(revisionId,node,state,detail={},warnings=[]){
  try{return await markConvergenceNode(revisionId,node,state,detail);}
  catch(error){warnings.push(`Convergence ledger ${node}: ${errorText(error)}`);return null;}
}

export async function propagateCanonicalChange({
  changedNodes = [], materiality = null, trigger = {}, now = new Date(), forceRecommendationRecompute = false
} = {}) {
  const nodes = unique(Array.isArray(changedNodes) ? changedNodes : [changedNodes]);
  assertKnownChangedNodes(nodes);
  const closure = affectedNodes(nodes);
  const surfaces = affectedSurfaces(nodes);
  const before = await readIntelligenceCurrent({ now });
  const warnings = [];
  const revision = await createCanonicalRevision({changedNodes:nodes,dependencyClosure:closure,affectedSurfaces:surfaces,trigger,materiality,now});
  await markConvergenceNodes(revision.revisionId,nodes,'RECONCILED',{reason:'CANONICAL_CHANGE_PERSISTED_BEFORE_PROPAGATION'});

  let athleteState = null;
  let readiness = null;
  let adaptiveContext = null;
  let shadow = null;
  let activeRecommendation = null;

  if (closure.includes('athlete.state.current')) {
    athleteState = await recomputeCurrentAthleteStateSafely({ now, persist: true });
    if (athleteState?.status === 'ERROR') {
      warnings.push(`Current Athlete State recomputation: ${athleteState.error}`);
      await mark(revision.revisionId,'athlete.state.current','FAILED',{error:athleteState.error},warnings);
    } else {
      await mark(revision.revisionId,'athlete.state.current',athleteState?.changed===true?'RECOMPUTED':'PROVEN_UNAFFECTED',{
        engineVersion:athleteState?.payload?.engineVersion||null,inputFingerprint:athleteState?.payload?.inputFingerprint||null
      },warnings);
    }
  }

  if (closure.includes('readiness.current')) {
    readiness = await recomputeCurrentReadinessSafely({ now, persist: true });
    if (readiness?.status === 'ERROR') {
      warnings.push(`Readiness recomputation: ${readiness.error}`);
      await mark(revision.revisionId,'readiness.current','FAILED',{error:readiness.error},warnings);
    } else {
      await mark(revision.revisionId,'readiness.current',readiness?.changed===true?'RECOMPUTED':'PROVEN_UNAFFECTED',{
        engineVersion:readiness?.payload?.engineVersion||null,inputFingerprint:readiness?.payload?.inputFingerprint||null,status:readiness?.status||null
      },warnings);
    }
  }

  let latestShadow = null;
  let contextFingerprint = null;
  if (closure.includes('adaptive.context')) {
    try {
      adaptiveContext = await buildAdaptiveContext({ now });
      contextFingerprint = recommendationContextFingerprint(adaptiveContext);
      const shadows = await readRecentRecommendationShadows({limit:1});
      latestShadow = shadows?.[0] || null;
      for(const node of closure){
        if(ADAPTIVE_CONTEXT_DERIVATIONS.has(node)){
          await mark(revision.revisionId,node,'RECOMPUTED',{via:'ADAPTIVE_CONTEXT_BUILD',contextFingerprint},warnings);
        }
      }
    } catch (error) {
      const message=errorText(error);
      warnings.push(`Adaptive context recomputation: ${message}`);
      await mark(revision.revisionId,'adaptive.context','FAILED',{error:message},warnings);
    }
  }

  let current = await readIntelligenceCurrent({ now });
  const recommendationAffected = closure.includes('recommendation.shadow');
  const readinessChanged = readiness?.changed === true;
  const fingerprintChanged = recommendationAffected && contextFingerprint && latestShadow?.payload?.contextFingerprint !== contextFingerprint;
  const shouldRecompute = recommendationAffected && (
    forceRecommendationRecompute || readinessChanged || materiality?.shouldRecomputeRecommendation === true ||
    current.pending?.shadowRecommendation === true || fingerprintChanged
  );

  if (recommendationAffected) {
    if (shouldRecompute) {
      shadow = await recomputeRecommendationShadowSafely({ materiality, trigger: { ...trigger, readinessChanged, contextFingerprintChanged:fingerprintChanged===true }, now, persist: true });
      if (shadow?.status === 'ERROR') {
        warnings.push(`Shadow recomputation: ${shadow.error}`);
        await mark(revision.revisionId,'recommendation.shadow','FAILED',{error:shadow.error},warnings);
      } else {
        await mark(revision.revisionId,'recommendation.shadow','RECOMPUTED',{
          recommendationId:shadow?.evaluation?.recommendationId||shadow?.payload?.recommendationId||null,
          contextFingerprint:shadow?.evaluation?.contextFingerprint||shadow?.payload?.contextFingerprint||contextFingerprint||null,
          trigger:{forceRecommendationRecompute,readinessChanged,materialityRecompute:materiality?.shouldRecomputeRecommendation===true,fingerprintChanged:!!fingerprintChanged}
        },warnings);
      }
      current = await readIntelligenceCurrent({ now });
    } else {
      await mark(revision.revisionId,'recommendation.shadow','PROVEN_UNAFFECTED',{
        reason:'CURRENT_DECISION_FINGERPRINT_UNCHANGED_AND_MATERIALITY_DID_NOT_REQUIRE_RECOMPUTE',
        contextFingerprint,shadowContextFingerprint:latestShadow?.payload?.contextFingerprint||null
      },warnings);
    }
  }

  const activeIsAffected = closure.includes('recommendation.current');
  if (activeIsAffected) {
    if (current.pending?.activeRecommendation) {
      try {
        activeRecommendation = await persistActiveRecommendationFromShadow();
        await mark(revision.revisionId,'recommendation.current','RECOMPUTED',{
          shadowRecommendationId:activeRecommendation?.payload?.shadowRecommendationId||activeRecommendation?.shadowRecommendationId||null
        },warnings);
      } catch (error) {
        const message=errorText(error);
        warnings.push(`Active recommendation projection: ${message}`);
        await mark(revision.revisionId,'recommendation.current','FAILED',{error:message},warnings);
      }
      current = await readIntelligenceCurrent({ now });
    } else {
      await mark(revision.revisionId,'recommendation.current','PROVEN_UNAFFECTED',{reason:'ACTIVE_ALREADY_MATCHES_CURRENT_SHADOW'},warnings);
    }
  }

  if(closure.includes('recommendation.explanation')){
    await mark(revision.revisionId,'recommendation.explanation',activeIsAffected?'RECOMPUTED':'PROVEN_UNAFFECTED',{source:'recommendation.current'},warnings);
  }
  if(closure.includes('adaptive.choice')){
    await mark(revision.revisionId,'adaptive.choice','WITHHELD',{reason:'ATHLETE_SELECTION_IS_NOT_MANUFACTURED_BY_PROPAGATION'},warnings);
  }
  if(closure.includes('choice.outcome')&&!nodes.includes('choice.outcome')){
    await mark(revision.revisionId,'choice.outcome','WITHHELD',{reason:'NO_QUALIFIED_CHOICE_OUTCOME_OBSERVATION_IN_THIS_CANONICAL_CHANGE'},warnings);
  }

  for(const node of closure){
    if(node.startsWith('source.')||node.startsWith('process.')||node.startsWith('clock.')){
      await mark(revision.revisionId,node,'RECONCILED',{reason:'SOURCE_RECONCILIATION_OR_TEMPORAL_INPUT_APPLIED'},warnings);
    } else if(node.startsWith('ui.')){
      await mark(revision.revisionId,node,'RECONCILED',{mode:'SERVER_CANONICAL_READ_ON_REQUEST'},warnings);
    } else if(READ_ON_REQUEST_NODES.has(node)){
      await mark(revision.revisionId,node,'RECONCILED',{mode:'DERIVED_ON_READ_NO_STALE_PERSISTED_SNAPSHOT'},warnings);
    } else if(SOURCE_PERSISTED_NODES.has(node)){
      await mark(revision.revisionId,node,'RECONCILED',{reason:'CANONICAL_SOURCE_OR_MONOTONIC_READ_MODEL_ALREADY_UPDATED'},warnings);
    } else if(nodes.includes(node)){
      await mark(revision.revisionId,node,'RECONCILED',{reason:'CHANGED_CANONICAL_NODE_ALREADY_PERSISTED'},warnings);
    }
  }

  const convergence = await readConvergenceStatus(revision.revisionId);
  current = await readIntelligenceCurrent({ now });
  return {
    ok: convergence.failed.length===0,
    canonicalRevisionId: revision.revisionId,
    canonicalRevisionSha256: revision.revisionSha256,
    changedNodes: nodes,
    dependencyClosure: closure,
    affectedSurfaces: surfaces,
    beforeRevision: before.revision,
    afterRevision: current.revision,
    revisionChanged: before.revision !== current.revision,
    pendingPropagation: convergence.pending || current.pendingPropagation,
    pending: current.pending,
    convergence,
    athleteState,
    readiness,
    adaptiveContextFingerprint:contextFingerprint,
    shadow,
    activeRecommendation,
    warnings
  };
}

export async function propagateCanonicalChangeSafely(options = {}) {
  try { return await propagateCanonicalChange(options); }
  catch (error) {
    const nodes = unique(Array.isArray(options.changedNodes) ? options.changedNodes : [options.changedNodes]);
    let closure=[];
    let surfaces=[];
    try { assertKnownChangedNodes(nodes); closure=affectedNodes(nodes); surfaces=affectedSurfaces(nodes); } catch {}
    return {
      ok: false,
      changedNodes: nodes,
      dependencyClosure: closure,
      affectedSurfaces: surfaces,
      pendingPropagation: true,
      error: errorText(error),
      warnings: [errorText(error)]
    };
  }
}
