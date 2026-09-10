import assert from 'node:assert/strict';
import { buildIntelligenceCurrent, intelligenceRevision } from '../lib/intelligence-current.js';

const baseRows = {
  runtime: { current_state_id: 'state-1', pointer_version: 7, updated_at: '2026-09-10T20:00:00Z' },
  athleteEvent: { event_id: 10, event_key: 'athlete:event:10', occurred_at: '2026-09-10T19:55:00Z', created_at: '2026-09-10T20:01:00Z' },
  trainingEvidence: { id: 200, source_updated_at: '2026-09-10T19:50:00Z', ingested_at: '2026-09-10T20:00:30Z' },
  wellnessEvidence: { id: 300, source_as_of: '2026-09-10T19:58:00Z', ingested_at: '2026-09-10T20:00:45Z' },
  objective: { objective_id: 'hyrox-jhb', role: 'PRIMARY', updated_at: '2026-09-10T19:00:00Z', created_at: '2026-09-01T00:00:00Z' }
};

const first = buildIntelligenceCurrent(baseRows);
assert.equal(first.pending.materiality, true, 'new athlete event must require event-addressed materiality');
assert.equal(first.pending.shadowRecommendation, true, 'training/wellness evidence newer than no shadow must require shadow recomputation');
assert.equal(first.pending.activeRecommendation, false, 'active recommendation cannot be pending until a shadow exists');
assert.equal(first.pendingPropagation, true);

const mismatchedMateriality = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    id: 999,
    source_updated_at: '2026-09-10T20:09:00Z',
    ingested_at: '2026-09-10T20:09:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'some-other-event', athleteEventId: 9, materiality: { shouldRecomputeRecommendation: true } }
  }
});
assert.equal(mismatchedMateriality.pending.materiality, true, 'newer unrelated materiality must not mask an unassessed latest athlete event');

const withMateriality = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    id: 400,
    source_updated_at: '2026-09-10T20:02:00Z',
    ingested_at: '2026-09-10T20:02:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
  }
});
assert.equal(withMateriality.pending.materiality, false);
assert.equal(withMateriality.dependencyState.latestAthleteEventAssessed, true);
assert.equal(withMateriality.dependencyState.latestMaterialityDrivesRecommendation, false);
assert.equal(withMateriality.pending.shadowRecommendation, true, 'independent training/wellness evidence still requires a shadow');

const withShadow = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    id: 400,
    source_updated_at: '2026-09-10T20:02:00Z',
    ingested_at: '2026-09-10T20:02:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
  },
  shadowRecommendation: { id: 500, source_updated_at: '2026-09-10T20:03:00Z', ingested_at: '2026-09-10T20:03:01Z', payload: { lane: 'MAINTAIN' } }
});
assert.equal(withShadow.pending.shadowRecommendation, false);
assert.equal(withShadow.pending.activeRecommendation, true, 'fresh shadow must require an active recommendation');

const materialAthleteChange = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    id: 401,
    source_updated_at: '2026-09-10T20:05:00Z',
    ingested_at: '2026-09-10T20:05:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: true } }
  },
  shadowRecommendation: { id: 500, source_updated_at: '2026-09-10T20:03:00Z', ingested_at: '2026-09-10T20:03:01Z', payload: { lane: 'MAINTAIN' } }
});
assert.equal(materialAthleteChange.pending.shadowRecommendation, true, 'decision-driving Athlete Voice materiality must invalidate the shadow');

const complete = buildIntelligenceCurrent({
  ...baseRows,
  materiality: {
    id: 400,
    source_updated_at: '2026-09-10T20:02:00Z',
    ingested_at: '2026-09-10T20:02:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
  },
  shadowRecommendation: { id: 500, source_updated_at: '2026-09-10T20:03:00Z', ingested_at: '2026-09-10T20:03:01Z' },
  activeRecommendation: { id: 600, source_updated_at: '2026-09-10T20:04:00Z', ingested_at: '2026-09-10T20:04:01Z', payload: { lane: 'MAINTAIN', contextFingerprint: 'ctx-1' } }
});
assert.equal(complete.pendingPropagation, false);
assert.equal(complete.activeRecommendation.lane, 'MAINTAIN');
assert.deepEqual(complete.affectedSurfaces, ['TODAY', 'TRAIN', 'TRENDS', 'SYSTEM']);

const completeAgain = buildIntelligenceCurrent(JSON.parse(JSON.stringify({
  ...baseRows,
  materiality: {
    id: 400,
    source_updated_at: '2026-09-10T20:02:00Z',
    ingested_at: '2026-09-10T20:02:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
  },
  shadowRecommendation: { id: 500, source_updated_at: '2026-09-10T20:03:00Z', ingested_at: '2026-09-10T20:03:01Z' },
  activeRecommendation: { id: 600, source_updated_at: '2026-09-10T20:04:00Z', ingested_at: '2026-09-10T20:04:01Z', payload: { lane: 'MAINTAIN', contextFingerprint: 'ctx-1' } }
})));
assert.equal(complete.revision, completeAgain.revision, 'identical canonical markers must produce an identical revision');

const changedEvidence = buildIntelligenceCurrent({
  ...baseRows,
  trainingEvidence: { id: 201, source_updated_at: '2026-09-10T20:05:00Z', ingested_at: '2026-09-10T20:05:01Z' },
  materiality: {
    id: 400,
    source_updated_at: '2026-09-10T20:02:00Z',
    ingested_at: '2026-09-10T20:02:01Z',
    payload: { contextType: 'MATERIALITY_ASSESSMENT', evidenceKey: 'athlete:event:10', athleteEventId: 10, materiality: { shouldRecomputeRecommendation: false } }
  },
  shadowRecommendation: { id: 500, source_updated_at: '2026-09-10T20:03:00Z', ingested_at: '2026-09-10T20:03:01Z' },
  activeRecommendation: { id: 600, source_updated_at: '2026-09-10T20:04:00Z', ingested_at: '2026-09-10T20:04:01Z' }
});
assert.notEqual(changedEvidence.revision, complete.revision, 'new canonical evidence must change the revision');
assert.equal(changedEvidence.pending.shadowRecommendation, true, 'new training evidence must invalidate shadow freshness');

assert.equal(intelligenceRevision({ b: 2, a: 1 }), intelligenceRevision({ a: 1, b: 2 }), 'revision hashing must be key-order stable');

console.log('tranche4 systemic propagation smoke: ok');
