import fs from 'node:fs';

const required = [
  'longitudinal-daily-state.schema.json',
  'training-exposure.schema.json',
  'decision-outcome.schema.json',
  'event-context.schema.json',
  'logic-version.schema.json'
];

for (const name of required) {
  const path = `schemas/${name}`;
  if (!fs.existsSync(path)) throw new Error(`Missing longitudinal schema: ${name}`);
  const schema = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (schema.type !== 'object') throw new Error(`${name}: root type must be object`);
  if (!Array.isArray(schema.required) || !schema.required.length) throw new Error(`${name}: required[] missing`);
  if (schema.additionalProperties !== false) throw new Error(`${name}: additionalProperties must be false`);
  console.log(`PASS ${name}`);
}

const doc = fs.readFileSync('docs/LONGITUDINAL_LAYER_V1.md','utf8');
for (const phrase of ['STATE -> RECOMMENDATION -> ATHLETE CHOICE -> EXECUTION -> RESPONSE','HISTORICAL_BACKFILL','Phase-1 exit gate']) {
  if (!doc.includes(phrase)) throw new Error(`Longitudinal operating standard missing: ${phrase}`);
}
console.log('PASS longitudinal v1 operating contract');
