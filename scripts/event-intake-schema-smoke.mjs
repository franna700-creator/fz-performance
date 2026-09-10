import assert from 'node:assert/strict';
import fs from 'node:fs';
const schema = JSON.parse(fs.readFileSync('schemas/event-intake.schema.json','utf8'));
assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');
assert.ok(schema.required.includes('knowledgeStatus'));
assert.ok(schema.properties.knowledgeStatus.enum.includes('RESEARCH_REQUIRED'));
assert.ok(schema.properties.knowledgeStatus.enum.includes('QUALIFIED'));
console.log('PASS event intake schema knowledge gate');
