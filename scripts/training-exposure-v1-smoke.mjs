import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract=JSON.parse(fs.readFileSync('dist/release-ui-contract.json','utf8'));
const html=fs.readFileSync('dist/index.html','utf8');
const js=fs.readFileSync('src/training-exposure-v1.js','utf8');
const css=fs.readFileSync('src/training-exposure-v1.css','utf8');
const trends=fs.readFileSync('lib/trends-dynamic.js','utf8');
const spec=fs.readFileSync('docs/PHASE5_TRAINING_EXPOSURE_CONTRACT.md','utf8');

assert.equal(contract.trainingExposureV1,true,'release UI contract missing Training Exposure v1 marker');
assert.equal(contract.trainingExposureCanonicalProjection,true,'release UI contract missing canonical projection marker');
assert.ok(contract.requiredAssets.includes('training-exposure-v1.js'),'release contract missing Training Exposure JS');
assert.ok(contract.requiredAssets.includes('training-exposure-v1.css'),'release contract missing Training Exposure CSS');
assert.ok(html.includes('/assets/training-exposure-v1.js')&&html.includes('/assets/training-exposure-v1.css'),'Training Exposure assets not wired into dist shell');

for(const marker of ['trainingExposure:{schemaVersion','missingIsNotZero:true','noCrossModalitySyntheticVolume:true','nclRequiresHrZoneEvidence:true','durationMin:row.durationMin','hrDistributionSeconds:row.hrDistributionSeconds','strengthSetCount:row.strengthSetCount']){
  assert.ok(trends.includes(marker),`canonical Training Exposure projection missing: ${marker}`);
}
for(const marker of ['7 DAYS','28 DAYS','CUSTOM','TIME','LOAD','VOLUME','Choose one modality for volume','Missing evidence is never plotted as zero']){
  assert.ok(js.includes(marker),`Training Exposure UI contract missing: ${marker}`);
}
assert.ok(js.includes("fetch('/api/trends/current?days=90'"),'Training Exposure must read canonical Trends runtime rather than static athlete truth');
assert.ok(!js.includes('localStorage')&&!js.includes('sessionStorage'),'Training Exposure must not create a browser-owned truth store');
assert.ok(css.includes('.fz-training-exposure-v1')&&css.includes('@media(max-width:760px)'),'Training Exposure responsive CSS missing');
assert.ok(spec.includes('No new athlete-state store')&&spec.includes('Never sum kilometres'),'Training Exposure canonical/volume safeguards missing from contract');

console.log('PASS Training Exposure v1 canonical projection + UI safeguards');
