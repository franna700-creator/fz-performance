import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('lib/objective-runtime-store.js', 'utf8');
assert.match(source, /import measurementRegistry from '\.\.\/config\/measurement-hierarchies\.json' with \{ type: 'json' \};/, 'measurement hierarchy must be a static import so Vercel traces it into function bundles');
assert.doesNotMatch(source, /fs\.readFile\(new URL\(relative,import\.meta\.url\)/, 'runtime config must not depend on an untraceable dynamic fs path');
const module = await import('../lib/objective-runtime-store.js');
const registry = await module.loadMeasurementRegistry();
assert.equal(registry.version, '1.0');
assert.ok(Array.isArray(registry.hierarchies) && registry.hierarchies.length > 0);
console.log('PASS runtime config bundle contract: measurement hierarchy is statically traceable and loadable');
