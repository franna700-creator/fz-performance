import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const files = [
  'schemas/runtime-state.schema.json',
  'schemas/state-generation-manifest.schema.json',
  'schemas/state-pointer.schema.json'
];

const schemas = {};
for (const file of files) schemas[file] = JSON.parse(await fs.readFile(file, 'utf8'));

const runtime = schemas['schemas/runtime-state.schema.json'];
assert.equal(runtime.$schema, 'https://json-schema.org/draft/2020-12/schema');
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

console.log('PASS formal runtime state, generation manifest and atomic pointer schemas');
