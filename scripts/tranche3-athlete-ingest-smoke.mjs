import assert from 'node:assert/strict';
import {
  classifyAthleteMemory,
  inferAthleteEventType,
  inferCertainty,
  athleteEventKey,
  johannesburgLocalDate,
  scoreSessionCandidate
} from '../lib/athlete-memory-ingest.js';

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

console.log('PASS Tranche 3 forward athlete-memory ingestion contract');
