import assert from 'node:assert/strict';
import fs from 'node:fs';

const store=fs.readFileSync('lib/trends-store.js','utf8');
const dynamic=fs.readFileSync('lib/trends-dynamic.js','utf8');
const api=fs.readFileSync('api/trends/current.js','utf8');
const classifier=fs.readFileSync('lib/training-classifier.js','utf8');
const app=fs.readFileSync('src/app-clean.js','utf8');
const registry=fs.readFileSync('lib/data-contract-registry.js','utf8');
const graph=fs.readFileSync('lib/runtime-dependency-graph.js','utf8');

assert.match(store,/FROM fz_wellness_current/,'TRENDS wellness history must come from Neon');
assert.doesNotMatch(store,/runtimeState\?\.datasets\?\.WELLNESS_HISTORY/,'runtime WELLNESS_HISTORY may not seed current TRENDS history');
assert.doesNotMatch(store,/runtimeState\?\.datasets\?\.CAP/,'runtime CAP snapshot may not feed current TRENDS capabilities');
assert.doesNotMatch(store,/runtimeState\?\.renderContract\?\.trends/,'runtime trend narratives may not feed current TRENDS summaries');
assert.match(store,/status NOT IN \('PLANNED','ACCEPTED','SUPERSEDED','SKIPPED'\)/,'base TRENDS history must exclude non-executed intent');
assert.match(dynamic,/plannedAndAcceptedSessionsExcluded:true/,'dynamic exposure contract must explicitly exclude planned/accepted sessions');
assert.match(dynamic,/summaryPolicy:'Derived on read from current canonical evidence/,'longitudinal summaries must declare on-read derivation');
assert.match(dynamic,/status NOT IN \('PLANNED','ACCEPTED','SUPERSEDED','SKIPPED'\)/,'dynamic exposure must exclude non-executed intent');
assert.match(api,/buildAdaptiveContext/,'TRENDS capability cards must consume current adaptive/measurement evidence');
assert.match(api,/capabilityProjection/,'TRENDS capability provenance must be explicit');
assert.match(classifier,/canonical HYROX session kind/,'HYROX protocol identity must outrank incidental single-modality wording');
assert.match(app,/const s=t\.summaries\|\|\{\}/,'Longitudinal Signals must render the canonical TRENDS summary contract');
assert.match(registry,/id:'wellness\.history'/,'wellness history must be a first-class contract');
assert.match(registry,/id:'trends\.summary'/,'longitudinal summary must be a first-class contract');
assert.match(graph,/'wellness\.history':\['trends\.summary','ui\.trends'\]/,'wellness history must invalidate longitudinal summaries and TRENDS');
assert.match(graph,/'trends\.summary':\['ui\.trends'\]/,'longitudinal summaries must invalidate the TRENDS surface');

console.log('PASS systemic TRENDS derivation closure: live wellness history + execution-only exposure + current summaries/capabilities + dependency visibility');
