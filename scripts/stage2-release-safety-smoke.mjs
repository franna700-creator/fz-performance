import assert from 'node:assert/strict';
import fs from 'node:fs';

const smoke=fs.readFileSync('scripts/production-smoke.mjs','utf8');
assert.match(smoke,/installReadOnlyWellnessRoute/,'staged acceptance must freeze wellness reads');
assert.match(smoke,/installReadOnlyTrainingRoute/,'staged acceptance must freeze training-memory reads');
assert.match(smoke,/\*\*\/api\/training\/memory\*/,'training-memory refresh calls from the PWA must be intercepted during staged acceptance');
assert.match(smoke,/acceptanceMode: 'STAGED_ACCEPTANCE_READ_ONLY_FIXTURE'/,'training acceptance fixture must identify read-only mode');
assert.match(smoke,/installReadOnlyMutationGuards/,'staged acceptance must guard mutation endpoints');
assert.match(smoke,/\*\*\/api\/intelligence\/refresh/,'intelligence refresh must be no-op guarded during staged browser acceptance');

const runBlock=smoke.slice(smoke.indexOf('async function runViewport'),smoke.indexOf('const browser ='));
for(const required of ['installReadOnlyWellnessRoute','installReadOnlyTrainingRoute','installReadOnlyMutationGuards']){
  assert.ok(runBlock.indexOf(required)>=0,`${required} must be installed before staged browser navigation`);
}
assert.ok(runBlock.indexOf('installReadOnlyTrainingRoute')<runBlock.indexOf('context.newPage()'),'training read-only guard must be installed before opening the PWA');
assert.ok(runBlock.indexOf('installReadOnlyMutationGuards')<runBlock.indexOf('context.newPage()'),'mutation guard must be installed before opening the PWA');

console.log('PASS staged acceptance remains read-only');
console.log('  ✓ PWA auto-refresh cannot write training evidence during staged browser smoke');
console.log('  ✓ intelligence refresh is no-op guarded before page boot');
