import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync('src/intelligence-refresh.js','utf8');
const adaptiveChoice = fs.readFileSync('src/adaptive-choice.js','utf8');
const cleanShell = fs.readFileSync('dist/index.html','utf8');

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

assert.match(adaptiveChoice, /fz44Fingerprint/, '4.4 DOM projection must fingerprint its own writes and become idempotent');
assert.match(adaptiveChoice, /observer\.disconnect\(\)/, '4.4 renderer must disconnect its observer while mutating observed DOM');
assert.match(adaptiveChoice, /observer\.observe\(observerRoot,\{childList:true,subtree:true\}\)/, '4.4 observer must be reattached only after rendering completes');
assert.match(adaptiveChoice, /document\.querySelector\('\.main'\)/, '4.4 observer must be scoped to the application surface rather than the whole document');
assert.match(adaptiveChoice, /setTimeout\(\(\)=>\{FZ_CHOICE\.renderScheduled=false;render\(\);\},0\)/, '4.4 observer writes must yield to the browser event loop');
assert.doesNotMatch(adaptiveChoice, /function scheduleRender\(\)[\s\S]*?queueMicrotask/, '4.4 observer must not recursively schedule DOM rewrites in the microtask queue');
assert.match(adaptiveChoice, /successCondition/, '4.4 option UI must expose the success condition already present in canonical session composition');
assert.match(adaptiveChoice, /stopCondition/, '4.4 option UI must expose the modify\/stop condition already present in canonical session composition');
assert.match(adaptiveChoice, /option\.confidence/, '4.4 option UI must expose composition confidence rather than hiding material uncertainty');
assert.match(adaptiveChoice, /evidenceBasis/, '4.4 option UI may expose concise evidence basis without dumping raw telemetry');
assert.doesNotMatch(adaptiveChoice, /<code>\$\{esc\(option\.optionId\)\}<\/code>/, 'internal option identity must remain provenance rather than the primary athlete interaction');
assert.match(adaptiveChoice, /To select it, tell FZ/, 'option selection guidance must use natural athlete language');

const intelligenceScript = '/assets/intelligence-refresh.js';
const appScript = '/assets/app-clean.js';
assert(cleanShell.includes(intelligenceScript), 'clean shell must package the 4.3 intelligence controller');
assert(cleanShell.indexOf(intelligenceScript) < cleanShell.indexOf(appScript), '4.3 intelligence controller must load before app-clean reads canonical APIs');
assert.equal(fs.readFileSync('dist/assets/intelligence-refresh.js','utf8'), controller, 'intelligence controller must be copied unchanged from canonical source');

console.log('PASS Tranche 4.3/4.4 browser safety: revision, fail-stale, complete option guidance and observer idempotence');
