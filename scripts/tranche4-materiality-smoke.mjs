import assert from 'node:assert/strict';
import { evaluateMateriality, MATERIALITY_ENGINE_VERSION } from '../lib/materiality-engine.js';

function level(input) { return evaluateMateriality(input).level; }

assert.equal(MATERIALITY_ENGINE_VERSION, '4.1.0');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'POST_SESSION_FEEDBACK',
  certainty: 'REPORTED',
  categories: ['SESSION'],
  summary: 'Session felt fine and went as expected.'
}), 'RECORD_ONLY');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'CONTEXT',
  certainty: 'REPORTED',
  categories: ['STATE','RECOVERY'],
  summary: 'Legs feel a bit heavy today but otherwise okay.'
}), 'UPDATE_STATE');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'STOPPED_EARLY',
  certainty: 'REPORTED',
  categories: ['SESSION','COST','CONSTRAINT'],
  summary: 'I stopped early because severe stomach cramps made continuation impractical.'
}), 'RECOMPUTE_RECOMMENDATION');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'CONTEXT',
  certainty: 'REPORTED',
  categories: ['CONSTRAINT'],
  summary: 'Sudden sharp knee pain, 8/10, and I cannot bear weight comfortably.'
}), 'SAFETY_OVERRIDE');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'CONTEXT',
  certainty: 'HYPOTHESIS',
  categories: ['HYPOTHESIS','FUELING'],
  summary: 'Maybe the banana caused the stomach issue.'
}), 'RECORD_ONLY');

assert.equal(level({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'NEXT_DAY_RESPONSE',
  certainty: 'REPORTED',
  categories: ['STATE','RECOVERY'],
  summary: 'I am surprisingly fresh and much better than expected this morning.'
}), 'RECOMPUTE_RECOMMENDATION');

assert.equal(level({
  sourceType: 'WELLNESS_OBSERVATION',
  eventType: 'CONTEXT',
  signals: { hrvDeltaPct: -2, rhrDeltaBpm: 1, sleepScoreDelta: -3 }
}), 'RECORD_ONLY');

assert.equal(level({
  sourceType: 'WELLNESS_OBSERVATION',
  eventType: 'CONTEXT',
  signals: { hrvDeltaPct: -18, rhrDeltaBpm: 8, sleepScoreDelta: -18 }
}), 'RECOMPUTE_RECOMMENDATION');

assert.equal(level({
  sourceType: 'TRAINING_EXECUTION',
  eventType: 'EXECUTED',
  certainty: 'OBSERVED',
  summary: 'Completed as planned.'
}), 'UPDATE_STATE');

assert.equal(level({
  sourceType: 'TRAINING_EXECUTION',
  eventType: 'ABORTED',
  certainty: 'OBSERVED',
  summary: 'Execution aborted.'
}), 'RECOMPUTE_RECOMMENDATION');

const positiveCurrent = evaluateMateriality({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'CONTEXT',
  certainty: 'REPORTED',
  categories: ['STATE','SESSION','RECOVERY','CONSTRAINT'],
  summary: 'Feeling really good, no GI issues, and much better than expected while training.'
});
assert.equal(positiveCurrent.level, 'UPDATE_STATE');
assert(positiveCurrent.reasonCodes.includes('CONSTRAINT_REPORTED_RESOLVED'));
assert.equal(positiveCurrent.shouldRecomputeRecommendation, false);

const safety = evaluateMateriality({
  sourceType: 'ATHLETE_FEEDBACK',
  eventType: 'CONTEXT',
  categories: ['CONSTRAINT'],
  signals: { safetyFlag: true }
});
assert.equal(safety.blocksExistingRecommendation, true);
assert.equal(safety.shouldRecomputeRecommendation, true);

console.log('PASS Tranche 4.1 deterministic materiality engine');
