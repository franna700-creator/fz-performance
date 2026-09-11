import { affectedNodes, affectedSurfaces } from './runtime-dependency-graph.js';
import { readIntelligenceCurrent } from './intelligence-current.js';
import { recomputeRecommendationShadowSafely } from './recommendation-shadow-orchestrator.js';
import { persistActiveRecommendationFromShadow } from './active-recommendation-store.js';

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function propagateCanonicalChange({
  changedNodes = [],
  materiality = null,
  trigger = {},
  now = new Date(),
  forceRecommendationRecompute = false
} = {}) {
  const nodes = unique(Array.isArray(changedNodes) ? changedNodes : [changedNodes]);
  const closure = affectedNodes(nodes);
  const surfaces = affectedSurfaces(nodes);
  const before = await readIntelligenceCurrent();
  const warnings = [];
  let shadow = null;
  let activeRecommendation = null;

  const recommendationAffected = closure.includes('recommendation.shadow');
  const shouldRecompute = recommendationAffected && (forceRecommendationRecompute || materiality?.shouldRecomputeRecommendation === true);
  if (shouldRecompute) {
    shadow = await recomputeRecommendationShadowSafely({ materiality, trigger, now, persist: true });
    if (shadow?.status === 'ERROR') warnings.push(`Shadow recomputation: ${shadow.error}`);
  }

  let current = await readIntelligenceCurrent();
  const activeIsAffected = closure.includes('recommendation.current');
  if (activeIsAffected && current.pending?.activeRecommendation) {
    try {
      activeRecommendation = await persistActiveRecommendationFromShadow();
    } catch (error) {
      warnings.push(`Active recommendation projection: ${errorText(error)}`);
    }
    current = await readIntelligenceCurrent();
  }

  return {
    ok: true,
    changedNodes: nodes,
    dependencyClosure: closure,
    affectedSurfaces: surfaces,
    beforeRevision: before.revision,
    afterRevision: current.revision,
    revisionChanged: before.revision !== current.revision,
    pendingPropagation: current.pendingPropagation,
    pending: current.pending,
    shadow,
    activeRecommendation,
    warnings
  };
}

export async function propagateCanonicalChangeSafely(options = {}) {
  try {
    return await propagateCanonicalChange(options);
  } catch (error) {
    const nodes = unique(Array.isArray(options.changedNodes) ? options.changedNodes : [options.changedNodes]);
    return {
      ok: false,
      changedNodes: nodes,
      dependencyClosure: affectedNodes(nodes),
      affectedSurfaces: affectedSurfaces(nodes),
      pendingPropagation: true,
      error: errorText(error),
      warnings: [errorText(error)]
    };
  }
}
