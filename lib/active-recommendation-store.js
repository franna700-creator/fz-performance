import { ingestTrainingSourceRecord, sourceHash } from './training-store.js';
import { readRecentRecommendationShadows } from './recommendation-shadow-store.js';
import { composeSessionOptions, SESSION_OPTION_COMPOSER_VERSION } from './session-option-composer.js';

const SOURCE_KEY = 'fz-intelligence';
const CONTEXT_TYPE = 'ACTIVE_RECOMMENDATION';
const TZ = 'Africa/Johannesburg';

function localDate(value) {
  const date = value ? new Date(`${String(value).slice(0, 10)}T12:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('invalid_active_recommendation_date');
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function buildActiveRecommendationPayload(shadowPayload = {}) {
  if (shadowPayload.contextType !== 'RECOMMENDATION_SHADOW') throw new Error('recommendation_shadow_required');
  if (!shadowPayload.recommendationId) throw new Error('shadow_recommendation_id_required');
  if (!shadowPayload.contextFingerprint) throw new Error('shadow_context_fingerprint_required');
  const status = shadowPayload.status === 'READY' ? 'READY' : 'WITHHELD';
  const lane = status === 'READY' ? shadowPayload.lane || null : null;
  if (status === 'READY' && !['ABSORB', 'MAINTAIN', 'ADAPT'].includes(lane)) throw new Error('active_recommendation_lane_required');
  const lanes = status === 'READY' ? composeSessionOptions(shadowPayload) : { ABSORB: [], MAINTAIN: [], ADAPT: [] };

  return {
    schemaVersion: '1.0',
    contextType: CONTEXT_TYPE,
    status,
    engineVersion: shadowPayload.engineVersion || null,
    recommendationVersion: shadowPayload.recommendationId,
    shadowRecommendationId: shadowPayload.recommendationId,
    contextFingerprint: shadowPayload.contextFingerprint,
    localDate: shadowPayload.contextSummary?.asOf || null,
    fzRecommendedLane: lane,
    safetyOverride: shadowPayload.rules?.safetyOverridesLaneScoring === true && shadowPayload.explanation?.safety?.override === true,
    confidence: shadowPayload.confidence || 'LOW',
    reasonCode: shadowPayload.reasonCode || null,
    reason: shadowPayload.reason || null,
    explanation: shadowPayload.explanation || null,
    lanes,
    athleteSelection: null,
    sessionOptionComposerVersion: SESSION_OPTION_COMPOSER_VERSION,
    context: {
      runtimeStateId: null,
      materialityAssessmentId: null,
      primaryObjective: shadowPayload.contextSummary?.primaryObjective?.id || null,
      objectiveSource: shadowPayload.contextSummary?.objectiveSource || null,
      measurementHierarchyId: shadowPayload.contextSummary?.measurementHierarchyId || null,
      assumptions: shadowPayload.contextSummary?.uncertainty?.assumptions || []
    },
    provenance: {
      sourceContract: 'RECOMMENDATION_SHADOW',
      sourceRecommendationId: shadowPayload.recommendationId,
      sourceContextFingerprint: shadowPayload.contextFingerprint
    },
    rules: {
      projectionOnly: true,
      shadowAuditImmutable: true,
      athleteChoiceDoesNotRewriteRecommendation: true,
      safetyOverrideCannotBeBypassed: true,
      sessionOptionsDeferredToTranche44: false,
      sessionOptionComposerVersion: SESSION_OPTION_COMPOSER_VERSION
    }
  };
}

export function activeRecommendationSemanticHash(shadowPayload = {}) {
  return sourceHash(buildActiveRecommendationPayload(shadowPayload));
}

export async function persistActiveRecommendationFromShadow(shadowRow = null) {
  let row = shadowRow;
  if (!row) row = (await readRecentRecommendationShadows({ limit: 1 }))[0] || null;
  if (!row?.payload) return { status: 'NO_SHADOW', row: null, payload: null };

  const payload = buildActiveRecommendationPayload(row.payload);
  const sourceUpdatedAt = row.source_updated_at || row.ingested_at || null;
  const persisted = await ingestTrainingSourceRecord({
    sourceKey: SOURCE_KEY,
    recordType: 'recommendation',
    sourceRecordId: `active-recommendation:${payload.engineVersion || 'unknown'}:${payload.shadowRecommendationId}`,
    sourceUpdatedAt,
    localDate: localDate(payload.localDate || row.local_date),
    payload
  });
  return { status: 'READY', row: persisted, payload };
}
