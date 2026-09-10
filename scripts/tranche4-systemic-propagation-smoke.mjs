import assert from 'node:assert/strict';
import { buildIntelligenceCurrent, intelligenceRevision } from '../lib/intelligence-current.js';

const baseRows = {
  runtime: { current_state_id: 'state-1', pointer_version: 7, updated_at: '2026-09-10T20:00:00Z' },
  athleteEvent: { event_id: 10, event_key: 'athlete:event:10', occurred_at: '2026-09-10T19:55:00Z', created_at: '2026-09-10T20:01:00Z' },
  trainingEvidence: { id: 200, source_updated_at: '2026-09-10T19:50:00Z', ingested_at: '2026-09-10T20:00:30Z' },
  wellnessEvidence: { id: 300, source_as_of: '2026-09-10T19:58:00Z', ingested_at: '2026-09-10T20:00:45Z' },
  objective: { objective_id: 'hyrox-jhb', role: 'PRIMARY', updated_at: '2026-09-10T19:00:00Z', created_at: '2026-09-01T00:00:00Z' }
};
const recordOnlyMateriality = {
  id: 400,
  source_updated_at: '2026-09-10T20:02:00Z',
  ingested_at: '2026-09-10T20:02:01Z',
  payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
};
const shadow = {
  id: 500,
  source_updated_at: '2026-09-10T20:03:00Z',
  ingested_at: '2026-09-10T20:03:01Z',
  payload: { contextType: 'RECOMMENDATION_SHADOW', recommendationId: 'shadow-1', contextFingerprint: 'ctx-1', status: 'READY', lane: 'MAINTAIN' }
};
const active = {
  id: 600,
  source_updated_at: '2026-09-10T20:04:00Z',
  ingested_at: '2026-09-10T20:04:01Z',
  payload: { contextType: 'ACTIVE_RECOMMENDATION', shadowRecommendationId: 'shadow-1', contextFingerprint: 'ctx-1', status: 'READY', fzRecommendedLane: 'MAINTAIN' }
};

const first = buildIntelligenceCurrent(baseRows);
assert.equal(first.pending.materiality, true, 'new Athlete Voice must require event-addressed materiality');
assert.equal(first.pending.shadowRecommendation, true, 'runtime/objective decision state newer than no shadow must require a shadow');
assert.equal(first.pending.activeRecommendation, false, 'active recommendation cannot be pending until a shadow exists');

const mismatchedMateriality = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    ...recordOnlyMateriality,
    id: 999,
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'some-other-event', athleteEventId: 9, materiality: { shouldRecomputeRecommendation: true } }
  }
});
assert.equal(mismatchedMateriality.pending.materiality, true, 'unrelated materiality must not mask an unassessed latest Athlete Voice event');

const withMateriality = buildIntelligenceCurrent({ ...baseRows, materiality: recordOnlyMateriality });
assert.equal(withMateriality.pending.materiality, false);
assert.equal(withMateriality.dependencyState.latestAthleteEventAssessed, true);
assert.equal(withMateriality.dependencyState.latestMaterialityDrivesRecommendation, false);
assert.equal(withMateriality.dependencyState.recommendationInvalidationOwnedByMateriality, true);

const withShadow = buildIntelligenceCurrent({ ...baseRows, materiality: recordOnlyMateriality, shadowRecommendation: shadow });
assert.equal(withShadow.pending.shadowRecommendation, false);
assert.equal(withShadow.pending.activeRecommendation, true, 'a shadow without its semantic 4.3 projection must require activation');

const decisionMateriality = {
  id: 401,
  source_updated_at: '2026-09-10T20:05:00Z',
  ingested_at: '2026-09-10T20:05:01Z',
  payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'training:tredict:executed_activity:x:hash', materiality: { shouldRecomputeRecommendation: true } }
};
const materialChange = buildIntelligenceCurrent({
  ...baseRows,
  materiality: recordOnlyMateriality,
  decisionMateriality,
  shadowRecommendation: shadow,
  activeRecommendation: active
});
assert.equal(materialChange.pending.shadowRecommendation, true, 'decision-driving materiality must invalidate the shadow');

const complete = buildIntelligenceCurrent({
  ...baseRows,
  materiality: recordOnlyMateriality,
  shadowRecommendation: shadow,
  activeRecommendation: active
});
assert.equal(complete.pendingPropagation, false);
assert.equal(complete.activeRecommendation.fzRecommendedLane, 'MAINTAIN');
assert.equal(complete.dependencyState.activeMatchesShadow, true);
assert.deepEqual(complete.affectedSurfaces, ['TODAY', 'TRAIN', 'TRENDS', 'SYSTEM']);

const completeAgain = buildIntelligenceCurrent(JSON.parse(JSON.stringify({
  ...baseRows,
  materiality: recordOnlyMateriality,
  shadowRecommendation: shadow,
  activeRecommendation: active
})));
assert.equal(complete.revision, completeAgain.revision, 'identical canonical markers must produce an identical revision');

const changedNonMaterialEvidence = buildIntelligenceCurrent({
  ...baseRows,
  trainingEvidence: { id: 201, source_updated_at: '2026-09-10T20:05:00Z', ingested_at: '2026-09-10T20:05:01Z' },
  materiality: recordOnlyMateriality,
  shadowRecommendation: shadow,
  activeRecommendation: active
});
assert.notEqual(changedNonMaterialEvidence.revision, complete.revision, 'new canonical evidence must change the intelligence revision for UI freshness');
assert.equal(changedNonMaterialEvidence.pending.shadowRecommendation, false, 'non-material source evolution must not bypass 4.1 and churn the recommendation');

const staleActive = buildIntelligenceCurrent({
  ...baseRows,
  materiality: recordOnlyMateriality,
  shadowRecommendation: shadow,
  activeRecommendation: { ...active, payload: { ...active.payload, contextFingerprint: 'old-context' } }
});
assert.equal(staleActive.pending.activeRecommendation, true, 'active freshness must be semantic rather than timestamp-only');

assert.equal(intelligenceRevision({ b: 2, a: 1 }), intelligenceRevision({ a: 1, b: 2 }), 'revision hashing must be key-order stable');

console.log('tranche4 systemic propagation smoke: ok');
