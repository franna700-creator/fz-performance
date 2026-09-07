import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const files = [
  'schemas/runtime-state.schema.json',
  'schemas/state-generation-manifest.schema.json',
  'schemas/state-pointer.schema.json',
  'schemas/longitudinal-daily-state.schema.json',
  'schemas/training-exposure.schema.json',
  'schemas/decision-outcome.schema.json',
  'schemas/event-context.schema.json',
  'schemas/logic-version.schema.json',
  'schemas/athlete-feedback.schema.json',
  'schemas/wellness-baseline.schema.json',
  'schemas/trend-interpretation.schema.json'
];

const schemas = {};
for (const file of files) {
  schemas[file] = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(schemas[file].$schema, 'https://json-schema.org/draft/2020-12/schema', `${file} must use draft 2020-12`);
}

const runtime = schemas['schemas/runtime-state.schema.json'];
for (const field of ['schemaVersion', 'stateId', 'masterValidated', 'nextRefreshAt', 'pages', 'datasets']) {
  assert.ok(runtime.required.includes(field), `runtime schema must require ${field}`);
}
for (const page of ['today', 'trends', 'train', 'system']) {
  assert.ok(runtime.properties.pages.required.includes(page), `runtime schema must require page ${page}`);
}
for (const dataset of ['AET', 'WELL', 'LOAD', 'RUNS', 'CAP']) {
  assert.ok(runtime.properties.datasets.required.includes(dataset), `runtime schema must require dataset ${dataset}`);
}

const generation = schemas['schemas/state-generation-manifest.schema.json'];
assert.equal(generation.properties.schemaVersion.const, '1.1');
assert.ok(generation.required.includes('generationId'));
assert.ok(generation.required.includes('compressedSha256'));
assert.ok(generation.required.includes('chunks'));
assert.match(generation.properties.chunks.items.properties.path.pattern, /generations/);

const pointer = schemas['schemas/state-pointer.schema.json'];
assert.equal(pointer.properties.schemaVersion.const, '1.1');
assert.ok(pointer.required.includes('pointerVersion'));
assert.ok(pointer.required.includes('current'));
assert.ok(pointer.properties.previous, 'pointer schema must support previous generation fallback');
assert.match(pointer.$defs.ref.properties.manifestPath.pattern, /manifest/);

const daily = schemas['schemas/longitudinal-daily-state.schema.json'];
for (const field of ['snapshotId','date','snapshotClass','recordStatus','sourceCoverage']) assert.ok(daily.required.includes(field));
assert.ok(daily.properties.decision.properties.readiness, 'daily state must model readiness');
assert.ok(daily.properties.logicVersion, 'daily state must model logic version');

const feedback = schemas['schemas/athlete-feedback.schema.json'];
for (const field of ['feedbackId','date','feedbackType','captureSource','extractionClass','confidence']) assert.ok(feedback.required.includes(field));
assert.ok(feedback.properties.rawRetainedNote, 'feedback schema preserves raw/retained note');
assert.ok(feedback.properties.exposureId, 'feedback schema links to exposure');

const baseline = schemas['schemas/wellness-baseline.schema.json'];
for (const field of ['baselineId','metric','grain','source','windowStart','windowEnd','validN','maturity','logicVersion']) assert.ok(baseline.required.includes(field));
assert.ok(baseline.properties.zScore, 'baseline supports deviation context');

const insight = schemas['schemas/trend-interpretation.schema.json'];
for (const field of ['insightId','asOf','domain','horizon','observation','interpretation','confidence','logicVersion','recordStatus','provenance']) assert.ok(insight.required.includes(field));
for (const field of ['relationship','athleteFeedback','performanceConnection','whatToWatch']) assert.ok(insight.properties[field], `trend interpretation must include ${field}`);

console.log('PASS runtime reliability + longitudinal memory + athlete feedback + wellness baseline + trend interpretation schemas');
