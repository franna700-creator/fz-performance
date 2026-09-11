import assert from 'node:assert/strict';
import { evaluateMateriality } from '../lib/materiality-engine.js';
import { wellnessDecisionSignature, wellnessSignalsAgainstBaseline } from '../lib/source-materiality.js';
import { sourceHash } from '../lib/training-store.js';

const sequence = evaluateMateriality({
  sourceType: 'SYSTEM_RECONCILIATION',
  eventType: 'CONTEXT',
  signals: { sequencingChanged: true }
});
assert.equal(sequence.level, 'RECOMPUTE_RECOMMENDATION');
assert(sequence.reasonCodes.includes('SEQUENCING_CHANGED'));

const enriched = evaluateMateriality({
  sourceType: 'TRAINING_EXECUTION',
  eventType: 'EXECUTED',
  signals: { evidenceGapResolved: true }
});
assert.equal(enriched.level, 'RECOMPUTE_RECOMMENDATION');
assert(enriched.reasonCodes.includes('DECISION_EVIDENCE_GAP_RESOLVED'));

const ordinaryExecution = evaluateMateriality({
  sourceType: 'TRAINING_EXECUTION',
  eventType: 'EXECUTED',
  signals: { sequencingChanged: false, evidenceGapResolved: false }
});
assert.equal(ordinaryExecution.level, 'UPDATE_STATE', 'routine execution remains state evolution unless decision evidence materially changes');

const current = { local_date: '2026-09-11', hrv_last_night: 60, resting_heart_rate: 58, sleep_score: 65, body_battery_high: 72, steps: 12345, stress_current: 80 };
const currentSameDecisionSignals = { ...current, steps: 25000, stress_current: 12 };
assert.equal(
  sourceHash(wellnessDecisionSignature(current)),
  sourceHash(wellnessDecisionSignature(currentSameDecisionSignals)),
  'steps and intraday stress must not churn the wellness decision identity'
);

const history = [
  { hrv_last_night: 72, resting_heart_rate: 51, sleep_score: 82, body_battery_high: 90 },
  { hrv_last_night: 70, resting_heart_rate: 50, sleep_score: 80, body_battery_high: 88 },
  { hrv_last_night: 74, resting_heart_rate: 52, sleep_score: 84, body_battery_high: 92 },
  { hrv_last_night: 71, resting_heart_rate: 51, sleep_score: 81, body_battery_high: 89 }
];
const signals = wellnessSignalsAgainstBaseline(current, history);
assert(signals.hrvDeltaPct <= -15);
assert(signals.rhrDeltaBpm >= 7);
assert(signals.sleepScoreDelta <= -15);
const wellness = evaluateMateriality({ sourceType: 'WELLNESS_OBSERVATION', eventType: 'CONTEXT', signals });
assert.equal(wellness.level, 'RECOMPUTE_RECOMMENDATION');
assert(wellness.reasonCodes.includes('WELLNESS_MULTI_SIGNAL_DETERIORATION'));

const insufficientBaseline = wellnessSignalsAgainstBaseline(current, history.slice(0, 2));
assert.equal(insufficientBaseline.hrvDeltaPct, null, 'insufficient baseline must stay missing rather than manufacturing a delta');
assert.equal(insufficientBaseline.rhrDeltaBpm, null);

console.log('PASS Tranche 4.3 source materiality routing');
