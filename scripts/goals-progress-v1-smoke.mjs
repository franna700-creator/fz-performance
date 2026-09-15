import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const js=fs.readFileSync('dist/assets/goals-progress-v1.js','utf8');
const css=fs.readFileSync('dist/assets/goals-progress-v1.css','utf8');
const api=fs.readFileSync('api/system/status.js','utf8');
const adaptiveV44=fs.readFileSync('lib/adaptive-context-v44.js','utf8');
const shadowOrchestrator=fs.readFileSync('lib/recommendation-shadow-orchestrator.js','utf8');
const vercel=fs.readFileSync('vercel.json','utf8');
const contract=JSON.parse(fs.readFileSync('dist/release-ui-contract.json','utf8'));

assert.ok(html.includes('id="goals"'),'Goals page is not wired');
assert.ok(html.includes('data-page="goals"'),'Goals navigation is not wired');
assert.ok(html.includes('/assets/goals-progress-v1.css'),'Goals CSS is not wired');
assert.ok(html.includes('/assets/goals-progress-v1.js'),'Goals JS is not wired');
assert.ok(html.indexOf('/assets/goals-progress-v1.js')>html.indexOf('/assets/app-clean.js'),'Goals must run after canonical renderer');
assert.equal(contract.goalsProgressExperienceV1,true,'release UI contract missing Goals marker');
assert.equal(contract.canonicalGoalsProgress,true,'release UI contract missing canonical Goals marker');
assert.ok(contract.requiredAssets.includes('goals-progress-v1.js')&&contract.requiredAssets.includes('goals-progress-v1.css'),'release UI contract missing Goals assets');

for(const marker of ['PRIMARY OBJECTIVE','WHAT MATTERS NOW','EVENT RUNWAY','CAPABILITY PROGRESS','MEASUREMENT MAP','CONFIDENCE & UNCERTAINTY','Evidence before percentage.']){
  assert.ok(js.includes(marker),`Goals presentation marker missing: ${marker}`);
}
assert.ok(js.includes('/api/goals/current'),'Goals must consume canonical Goals runtime projection');
assert.ok(js.includes('/api/trends/current?days=45'),'Goals capability trajectory must consume canonical Trends data');
assert.ok(!js.includes('HYROX Johannesburg')&&!js.includes('Deadly Dozen')&&!js.includes('HOKA Half'),'Goals static presentation contains athlete/event truth');
assert.ok(!/progressPercent|completionPercent|% complete/i.test(js),'Goals must not fabricate progress percentages');
assert.ok(api.includes('buildAdaptiveContext')&&api.includes('CANONICAL_GOALS_PROGRESS_V1')&&api.includes('async function goalsCurrent'),'Goals projection is not based on canonical adaptive context');
assert.ok(adaptiveV44.includes("readCurrentReadiness")&&adaptiveV44.includes('mergeCanonicalReadinessIntoContext'),'Shared adaptive context must merge canonical current readiness before Goals/recommendation consumption');
assert.ok(!shadowOrchestrator.includes('readCurrentReadiness')&&!shadowOrchestrator.includes('mergeCanonicalReadinessIntoContext'),'Recommendation orchestration must not apply a second canonical readiness merge');
assert.ok(/noFabricatedProgressPercentages:\s*true/.test(api),'Goals API must declare no-fabricated-progress rule');
assert.ok(/directionalOverlapIsNotTrainingValue:\s*true/.test(api),'Goals API must preserve overlap/training-value distinction');
assert.ok(api.includes("operation === 'goals-current'")&&vercel.includes('"/api/goals/current"')&&vercel.includes('operation=goals-current'),'Goals public route must reuse the existing system serverless function');
assert.ok(!fs.existsSync('api/goals/current.js'),'Goals must not consume a thirteenth serverless function');
assert.ok(css.includes('#goals.fz-goals-v1')&&css.includes('@media(max-width:760px)'),'Goals responsive styles missing');
assert.ok(css.includes('prefers-reduced-motion'),'Goals reduced-motion contract missing');

console.log('PASS Goals & Progress v1: canonical objective truth, canonical readiness consistency, evidence-led progress, shared serverless contract, responsive surface');
