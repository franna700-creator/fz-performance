import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildActiveRecommendationPayload, activeRecommendationSemanticHash } from '../lib/active-recommendation-store.js';

const schema = JSON.parse(fs.readFileSync('schemas/active-recommendation.schema.json', 'utf8'));
assert.equal(schema.properties.contextType.const, 'ACTIVE_RECOMMENDATION');
assert.deepEqual(schema.$defs.lane.enum, ['ABSORB', 'MAINTAIN', 'ADAPT']);

const readyShadow = {
  contextType: 'RECOMMENDATION_SHADOW',
  engineVersion: '4.2.0-shadow.1',
  mode: 'SHADOW',
  recommendationId: 'shadow:4.2.0-shadow.1:abc123',
  contextFingerprint: 'abc123',
  status: 'READY',
  lane: 'MAINTAIN',
  confidence: 'HIGH',
  explanation: { safety: { override: false }, athleteFacing: { headline: 'Maintain.' } },
  rules: { safetyOverridesLaneScoring: true },
  contextSummary: {
    asOf: '2026-09-11',
    objectiveSource: 'NEON_OBJECTIVE_GRAPH',
    primaryObjective: { id: 'hyrox-jhb', name: 'HYROX Johannesburg', role: 'PRIMARY' },
    measurementHierarchyId: 'hyrox-primary-v1',
    uncertainty: { assumptions: [] }
  },
  trigger: { type: 'TRAINING_SYNC', sourceVersionBefore: 10, sourceVersionAfter: 11 }
};

const ready = buildActiveRecommendationPayload(readyShadow);
assert.equal(ready.status, 'READY');
assert.equal(ready.fzRecommendedLane, 'MAINTAIN');
assert.equal(ready.athleteSelection, null, 'projection must not manufacture athlete choice');
assert.deepEqual(ready.lanes, { ABSORB: [], MAINTAIN: [], ADAPT: [] }, 'concrete session options remain 4.4');
assert.equal(ready.provenance.sourceRecommendationId, readyShadow.recommendationId);
assert.equal(ready.rules.shadowAuditImmutable, true);
assert.equal(ready.rules.athleteChoiceDoesNotRewriteRecommendation, true);
assert.equal(Object.hasOwn(ready, 'generatedAt'), false, 'volatile projection time must not break recommendation idempotency');

const sameDecisionDifferentTrigger = {
  ...readyShadow,
  trigger: { type: 'MANUAL_REFRESH', evidenceKey: null }
};
assert.equal(
  activeRecommendationSemanticHash(readyShadow),
  activeRecommendationSemanticHash(sameDecisionDifferentTrigger),
  'active recommendation identity must depend on shadow decision semantics, not invocation trigger metadata'
);

const withheldShadow = {
  ...readyShadow,
  recommendationId: 'shadow:4.2.0-shadow.1:def456',
  contextFingerprint: 'def456',
  status: 'WITHHELD',
  lane: null,
  confidence: 'LOW',
  reasonCode: 'PRIMARY_MEASUREMENT_HIERARCHY_UNAVAILABLE',
  reason: 'Required context unavailable.'
};
const withheld = buildActiveRecommendationPayload(withheldShadow);
assert.equal(withheld.status, 'WITHHELD');
assert.equal(withheld.fzRecommendedLane, null, 'withheld state must clear a previously visible lane');
assert.equal(withheld.reasonCode, 'PRIMARY_MEASUREMENT_HIERARCHY_UNAVAILABLE');

const safetyShadow = {
  ...readyShadow,
  recommendationId: 'shadow:4.2.0-shadow.1:safety',
  contextFingerprint: 'safety',
  lane: 'ABSORB',
  explanation: { safety: { override: true } }
};
const safety = buildActiveRecommendationPayload(safetyShadow);
assert.equal(safety.fzRecommendedLane, 'ABSORB');
assert.equal(safety.safetyOverride, true);
assert.equal(safety.rules.safetyOverrideCannotBeBypassed, true);

console.log('PASS Tranche 4.3 active recommendation projection');
