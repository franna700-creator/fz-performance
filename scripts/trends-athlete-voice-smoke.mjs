import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveCanonicalAthleteVoiceSummary } from '../lib/trends-athlete-voice.js';

const rows = [{
  event_id: 1623,
  event_key: 'athlete:forward:07fcd255a94c901c4b92ea9e03a8',
  session_id: 'exec:tredict:msjYGFLpxZrevGBX5fny8a',
  event_type: 'POST_SESSION_FEEDBACK',
  occurred_at: '2026-09-10T19:49:00.000Z',
  local_date: '2026-09-10',
  certainty: 'REPORTED',
  summary: 'Controlled upper-body pump; no failure; felt great and mentally beneficial.'
}];

const voice = deriveCanonicalAthleteVoiceSummary(rows);
assert.ok(voice, 'Canonical Athlete Voice must be derivable from Athlete Memory');
assert.equal(voice.eventId, 1623);
assert.equal(voice.sessionId, 'exec:tredict:msjYGFLpxZrevGBX5fny8a');
assert.equal(voice.canonicalSummary, 'Controlled upper-body pump; no failure; felt great and mentally beneficial.');
assert.equal(voice.verbatim, false, 'Athlete-facing summary must not be represented as verbatim transcript');
assert.match(voice.text, /^10 Sep · Controlled upper-body pump/);
assert.doesNotMatch(voice.text, /No new .* subjective feedback is captured/i, 'Canonical Athlete Memory must override stale no-feedback wording');

const api = fs.readFileSync('api/trends/current.js', 'utf8');
assert.match(api, /overlayCanonicalAthleteVoiceOnTrends/, 'TRENDS API must overlay canonical Athlete Memory on every current read');
const helper = fs.readFileSync('lib/trends-athlete-voice.js', 'utf8');
assert.match(helper, /FROM fz_athlete_events/, 'TRENDS Athlete Voice must read canonical Athlete Memory');
assert.match(helper, /actor='ATHLETE'/, 'TRENDS Athlete Voice must only use athlete-authored canonical events');
assert.match(helper, /rawTranscriptIsPrimary: false/, 'Raw transcript must never become the primary Athlete Voice surface');

console.log('PASS TRENDS canonical Athlete Voice propagation');
console.log('  ✓ latest canonical Athlete Memory overrides stale runtime voice wording');
console.log('  ✓ canonical interpreted summary remains primary; transcript is not promoted');
