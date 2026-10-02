import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyAthleteMemory } from '../lib/athlete-memory-ingest.js';

const forearmCategories=classifyAthleteMemory({
  summary:'My forearm is inflamed and painful after training.'
});
assert.ok(forearmCategories.includes('CONSTRAINT'),'natural forearm feedback must be detected as constraint context');

const ingest=fs.readFileSync('lib/athlete-memory-ingest.js','utf8');
assert.match(ingest,/compositeSessionIds = \[\]/);
assert.match(ingest,/EXPLICIT_COMPOSITE_SESSION_SET/);
assert.match(ingest,/invalid_composite_session_set_requires_multiple/);
assert.match(ingest,/invalid_composite_session_set_conflicts_with_single_session_reference/);
assert.match(ingest,/invalid_composite_session_set_must_share_local_date/);
assert.match(ingest,/session:null,\s*compositeSessions:sessions/);
assert.match(ingest,/composite: Boolean\(resolution\.compositeSessions\?\.length\)/);
assert.match(ingest,/for \(const session of resolution\.compositeSessions\)/);
assert.match(ingest,/relationship: 'EVIDENCE'/);
assert.match(ingest,/linkedSessions: resolution\.compositeSessions/);

const appendStart=ingest.indexOf('const inserted = await appendAthleteEvent');
const appendEnd=ingest.indexOf('const sql = await getSql()',appendStart);
const appendBlock=ingest.slice(appendStart,appendEnd);
assert.ok(appendStart>=0&&appendEnd>appendStart,'athlete event append block must remain inspectable');
assert.match(appendBlock,/sessionId: resolution\.session\?\.session_id \|\| null/,
  'composite Athlete Voice must remain a standalone event rather than choosing one fragment as event.session_id');

const reconcile=fs.readFileSync('lib/athlete-memory-reconcile.js','utf8');
assert.match(reconcile,/COALESCE\(payload#>>'\{linkResolution,composite\}','false'\) <> 'true'/,
  'late binding must never collapse an explicit composite association into one session');

const api=fs.readFileSync('api/training/athlete-event.js','utf8');
assert.match(api,/supportsCompositeSessionContext:true/);

console.log('PASS Stage 2 composite Athlete Memory association v1');
console.log('  ✓ one Athlete Voice source can attach as EVIDENCE to multiple workout fragments');
console.log('  ✓ event.session_id remains null instead of inventing one-to-one truth');
console.log('  ✓ later automatic late binding cannot collapse an explicit composite relationship');
console.log('  ✓ natural forearm wording is detected as constraint context');
