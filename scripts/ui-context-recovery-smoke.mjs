import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/ui-context-recovery.js','utf8');
const choice=fs.readFileSync('src/adaptive-choice.js','utf8');
const css=fs.readFileSync('src/ui-context-recovery.css','utf8');
const shell=fs.readFileSync('scripts/clean-shell.mjs','utf8');
const html=fs.readFileSync('dist/index.html','utf8');

assert.match(js,/cross-surface rationalisation v2/,'rationalisation controller must be versioned');
assert.doesNotMatch(js,/Decision Context|Current Training Direction|Latest Executions & Response|Primary Objective Lens/,'legacy duplicate current-decision sections must not be created');
assert.match(js,/Primary Objective Capability Priorities/,'TRENDS keeps longitudinal capability hierarchy');
assert.match(js,/removeLegacyContextSections/,'legacy context sections must be removed if an older renderer inserts them');
assert.match(choice,/Current Training Choice/,'TRAIN owns concrete recommendation options and athlete decision');
assert.match(choice,/CURRENT FZ RECOMMENDATION · 4\.4/,'TODAY owns exactly one current FZ decision surface');
assert.match(choice,/removeDuplicateSections/,'4.4 renderer defensively removes duplicate decision context');
assert.match(choice,/rationaliseSystem/,'SYSTEM must be reduced to technical recommendation/choice provenance');
assert.doesNotMatch(choice,/HYROX Johannesburg Solo Male/,'athlete objective truth must not be hard-coded into UI');
assert.match(css,/max-height:164px/,'desktop trend charts must remain bounded');
assert.match(css,/max-height:142px/,'mobile trend charts must remain bounded');
assert.match(shell,/adaptive-choice\.js/);assert.match(shell,/adaptive-choice\.css/);assert.match(shell,/ui-context-recovery\.js/);
assert.ok(fs.existsSync('dist/assets/adaptive-choice.js'));assert.ok(fs.existsSync('dist/assets/adaptive-choice.css'));assert.ok(fs.existsSync('dist/assets/ui-context-recovery.js'));
assert.match(html,/4\.4-choice-rationalised/);assert.match(html,/\/assets\/adaptive-choice\.js/);assert.match(html,/\/assets\/adaptive-choice\.css/);
assert.doesNotMatch(html,/\/assets\/app\.js/);assert.doesNotMatch(html,/v0\.5 reliability shell|FZ Performance · HYROX System|06:00 \/ 13:00 \/ 20:00/);
const releaseIdentity=JSON.parse(fs.readFileSync('dist/release-ui-contract.json','utf8'));
assert.equal(releaseIdentity.shell,'4.4-choice-rationalised');assert.equal(releaseIdentity.crossSurfaceRationalised,true);assert.equal(releaseIdentity.sessionOptionComposer,true);assert.equal(releaseIdentity.athleteChoiceCanonical,true);assert.equal(releaseIdentity.plannedIntentReconciliation,true);assert.equal(releaseIdentity.legacyAppJs,false);
console.log('PASS cross-surface rationalisation: TODAY decision, TRAIN choice/memory, TRENDS longitudinal evidence, SYSTEM provenance');
