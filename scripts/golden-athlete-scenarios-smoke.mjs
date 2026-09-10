import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mergeEvidenceRows } from '../lib/training-evidence.js';
import { resolveLateAssociation } from '../lib/athlete-memory-association.js';
const fixtures=JSON.parse(await fs.readFile('fixtures/golden-athlete-scenarios.json','utf8'));
assert.equal(fixtures.version,'1.0');
assert.equal(fixtures.scenarios.length,10);
const ids=new Set(fixtures.scenarios.map(x=>x.id));
for(const id of ['high-readiness-after-heavy-load','poor-sleep-fresh-legs-discordance','newer-sparse-training-evidence','feedback-before-workout-source','aborted-aet-gi','two-sessions-same-day','ambiguous-session-feedback','rest-zero-vs-pending-detail','athlete-overrides-recommended-lane','stale-source-not-live']) assert.ok(ids.has(id),`missing golden ${id}`);
for(const scenario of fixtures.scenarios) assert.ok(scenario.expectedInvariants.length>=3,`${scenario.id} needs at least three invariants`);
const merged=mergeEvidenceRows([
  {ingested_at:'2026-09-10T10:00:00Z',payload:{summary:{heartrate:148},detailLevel:'activity-list'}},
  {ingested_at:'2026-09-10T09:00:00Z',payload:{summary:{heartrate:146,power:310,intensityDistribution:{heartrate:{0:1800,1:600,2:60}}},detailLevel:'activity-detail'}}
]);
assert.equal(merged.payload.summary.heartrate,148);
assert.equal(merged.payload.summary.power,310);
assert.equal(merged.enrichedFromHistory,true);
const event={event_type:'POST_SESSION_FEEDBACK',occurred_at:'2026-09-10T17:20:00Z',local_date:'2026-09-10',summary:'Run AET felt controlled and good',payload:{memoryCategories:['SESSION']}};
const unambiguous=resolveLateAssociation(event,[{session_id:'s1',actual_start_at:'2026-09-10T16:30:00Z',local_date:'2026-09-10',title:'Run AET',sport_type:'RUNNING',session_kind:'AET',status:'COMPLETED'}]);
assert.equal(unambiguous.session?.session_id,'s1');
const ambiguous=resolveLateAssociation(event,[
  {session_id:'s1',actual_start_at:'2026-09-10T16:30:00Z',local_date:'2026-09-10',title:'Run AET',sport_type:'RUNNING',session_kind:'AET',status:'COMPLETED'},
  {session_id:'s2',actual_start_at:'2026-09-10T16:35:00Z',local_date:'2026-09-10',title:'Run AET',sport_type:'RUNNING',session_kind:'AET',status:'COMPLETED'}
]);
assert.equal(ambiguous.session,null);
console.log('PASS golden athlete scenarios v1: 10 synthetic invariants guard future adaptive intelligence without hard-coding athlete outcomes');
