import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync('src/intelligence-refresh.js','utf8');
const cleanShell = fs.readFileSync('scripts/clean-shell.mjs','utf8');

assert.match(controller, /\/api\/intelligence\/current/, 'visible PWA must poll the cheap read-only intelligence revision contract');
assert.match(controller, /method:\s*'POST'/, 'PWA convergence must use the POST mutation boundary');
assert.match(controller, /payload:\s*\{\s*sources\s*\}/, 'source refresh must be an explicit user/system choice');
assert.doesNotMatch(controller, /forceWellness/, 'browser must not bypass Garmin wellness throttling');
assert.match(controller, /responseCache/, 'PWA must retain last successful canonical reads for fail-stale behavior');
assert.match(controller, /X-FZ-Fail-Stale/, 'fail-stale responses must be observable rather than silently masquerading as live');
assert.match(controller, /if \(element && element\.textContent !== value\)/, 'recommendation DOM updates must be no-op when content is unchanged to avoid observer churn');
assert.match(controller, /RECOMMENDATION WITHHELD/, 'WITHHELD recommendation state must be visible and understandable');
assert.match(controller, /no stale lane substituted/, 'WITHHELD state must not fall back to a stale recommendation lane');
assert.match(controller, /data-refresh-fz/, 'manual Refresh FZ affordance must exist');
assert.doesNotMatch(controller, /data-athlete-choice|FZ_STATE_WRITE_TOKEN|recordAthleteMemory/, 'PWA controller must not expose insecure athlete-choice mutation or write credentials');

const intelligenceScript = '/assets/intelligence-refresh.js';
const appScript = '/assets/app-clean.js';
assert(cleanShell.includes(intelligenceScript), 'clean shell must package the 4.3 intelligence controller');
assert(cleanShell.indexOf(intelligenceScript) < cleanShell.indexOf(appScript), '4.3 intelligence controller must load before app-clean reads canonical APIs');
assert.match(cleanShell, /fs\.copyFileSync\(intelligenceRefreshJs/, '4.3 controller must be copied into the build artifact');

console.log('PASS Tranche 4.3 PWA revision, fail-stale and recommendation-surface wiring');
