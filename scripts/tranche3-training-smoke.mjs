import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseTredictCsvResult } from '../lib/tredict-client.js';

const fake = {
  content: [{
    type: 'text',
    text: 'Preamble\n----\nid,date,sportType,title,notes\nabc,2026-09-09T16:00:00.000Z,running,"Run AET","4 x 4, controlled"\n'
  }]
};
const rows = parseTredictCsvResult(fake);
assert.equal(rows.length, 1);
assert.equal(rows[0].id, 'abc');
assert.equal(rows[0].title, 'Run AET');
assert.equal(rows[0].notes, '4 x 4, controlled');
assert.deepEqual(parseTredictCsvResult({ content: [{ type: 'text', text: 'Nothing\n----' }] }), []);

const migration = await fs.readFile('db/migrations/003_training_event_ledger.sql', 'utf8');
for (const object of ['fz_training_source_records', 'fz_training_sessions', 'fz_training_session_sources', 'fz_athlete_events', 'fz_training_timeline']) {
  assert.ok(migration.includes(object), `Tranche 3 migration must include ${object}`);
}
for (const certainty of ['OBSERVED', 'REPORTED', 'INFERRED', 'HYPOTHESIS']) {
  assert.ok(migration.includes(`'${certainty}'`), `ledger must preserve certainty ${certainty}`);
}

console.log('PASS Tranche 3 canonical training-event ledger and Tredict CSV parser');
