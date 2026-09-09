import assert from 'node:assert/strict';
import {
  classifyAthleteMemory,
  inferAthleteEventType,
  inferCertainty,
  athleteEventKey,
  johannesburgLocalDate,
  scoreSessionCandidate
} from '../lib/athlete-memory-ingest.js';
import {
  normalizeExerciseAthleteResponse,
  EXERCISE_PROJECT_SCOPE,
  FZ_ATHLETE_ID
} from '../lib/athlete-response-capture.js';

const categories = classifyAthleteMemory({
  summary: 'Run AET felt hard and I stopped early because of stomach cramps after a banana 40 minutes before.',
  rawText: ''
});
for (const expected of ['SESSION','COST','FUELING','CONSTRAINT']) assert(categories.includes(expected), `missing ${expected}`);

assert.equal(inferAthleteEventType({ summary: 'I stopped early because stomach cramps made it impractical to continue.' }), 'STOPPED_EARLY');
assert.equal(inferAthleteEventType({ summary: 'The following morning my legs felt surprisingly fresh.' }), 'NEXT_DAY_RESPONSE');
assert.equal(inferCertainty({ categories: ['HYPOTHESIS'], summary: 'Maybe the banana contributed.' }), 'HYPOTHESIS');
assert.equal(johannesburgLocalDate('2026-09-08T22:30:00Z'), '2026-09-09');

const key1 = athleteEventKey({ idempotencyKey: 'conversation-message-123', occurredAt: '2026-09-09T12:00:00Z', summary: 'same' });
const key2 = athleteEventKey({ idempotencyKey: 'conversation-message-123', occurredAt: '2026-09-09T13:00:00Z', summary: 'changed' });
assert.equal(key1, key2, 'explicit idempotency key must dominate content changes');
assert.match(key1, /^athlete:forward:[a-f0-9]{28}$/);

const normalized = normalizeExerciseAthleteResponse({
  projectScope: 'exercise-project',
  athleteId: 'francois',
  speakerResolution: 'INFERRED_HIGH_CONFIDENCE',
  reportedAt: '2026-09-10T06:00:00Z',
  occurredAt: '2026-09-09T20:00:00Z',
  occurrencePrecision: 'approximate',
  summary: 'Quads became sore around 22:00 last night.'
});
assert.equal(normalized.projectScope, EXERCISE_PROJECT_SCOPE);
assert.equal(normalized.athleteId, FZ_ATHLETE_ID);
assert.equal(normalized.reportedAt, '2026-09-10T06:00:00.000Z');
assert.equal(normalized.occurredAt, '2026-09-09T20:00:00.000Z');
assert.equal(normalized.payload.captureScope, 'exercise-project');
assert.throws(() => normalizeExerciseAthleteResponse({ projectScope: 'exercise-project', athleteId: 'francois', summary: 'ambiguous speaker' }), /speaker_resolution_required/);
assert.throws(() => normalizeExerciseAthleteResponse({ projectScope: 'other-project', athleteId: 'francois', speakerResolution: 'CONFIRMED', summary: 'wrong project' }), /exercise_project_scope_required/);

const candidate = {
  local_date: '2026-09-08',
  title: 'Roodepoort - AET Run Workout',
  sport_type: 'running',
  session_kind: 'AET',
  actual_start_at: '2026-09-08T16:20:20Z'
};
const scored = scoreSessionCandidate(candidate, {
  localDate: '2026-09-08',
  title: 'AET Run Workout',
  sportType: 'running',
  sessionKind: 'AET'
}, '2026-09-08T17:12:00Z', 2);
assert(scored.score >= 0.7, `expected strong contextual link, got ${scored.score}`);

console.log('PASS Tranche 3.1 Exercise-project athlete response capture contract');
