import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const js=fs.readFileSync('dist/assets/trends-train-redesign-v1.js','utf8');
const css=fs.readFileSync('dist/assets/trends-train-redesign-v1.css','utf8');
const contract=JSON.parse(fs.readFileSync('dist/release-ui-contract.json','utf8'));

assert.ok(html.includes('/assets/trends-train-redesign-v1.css'),'Phase 2 CSS is not wired');
assert.ok(html.includes('/assets/trends-train-redesign-v1.js'),'Phase 2 JS is not wired');
assert.ok(html.indexOf('/assets/trends-train-redesign-v1.js')>html.indexOf('/assets/app-clean.js'),'Phase 2 must run after canonical renderer');
assert.ok(html.includes('/assets/today-redesign-v2.js'),'TODAY reference experience must remain wired');
assert.equal(contract.trendsTrainExperienceV1,true,'release UI contract missing tranche 2 marker');
assert.ok(contract.requiredAssets.includes('trends-train-redesign-v1.js')&&contract.requiredAssets.includes('trends-train-redesign-v1.css'),'release UI contract missing tranche 2 assets');

for(const marker of ['Longitudinal Signals','Trajectory & Measurement Gaps','Recovery Response','Exposure Cost','Performance Trajectory','Athlete Voice','Training Memory','Athlete Memory']){
  assert.ok(js.includes(marker),`Phase 2 presentation marker missing: ${marker}`);
}
assert.ok(js.includes('fz44-choice-section'),'TRAIN does not preserve current choice as the first execution surface');
assert.ok(js.indexOf("phase2Section(root,'Training Memory')")<js.indexOf("phase2Section(root,'Athlete Memory')"),'TRAIN ordering code does not prioritise execution memory before Athlete Memory');
assert.ok(!js.includes('fetch('),'Phase 2 presentation layer must not create a parallel runtime data fetch path');
assert.ok(!js.includes('HYROX Johannesburg')&&!js.includes('Deadly Dozen')&&!js.includes('HOKA Half'),'Phase 2 static presentation contains athlete/event truth');
assert.ok(css.includes('#trends.fz-phase2-trends')&&css.includes('#train.fz-phase2-train'),'Phase 2 page styles missing');
assert.ok(css.includes('@media(max-width:760px)'),'Phase 2 mobile contract missing');
assert.ok(css.includes('prefers-reduced-motion'),'Phase 2 reduced-motion contract missing');

console.log('PASS TRENDS + TRAIN redesign v1: presentation-only hierarchy, responsive contract, canonical truth preserved');
