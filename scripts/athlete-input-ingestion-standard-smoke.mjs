import assert from 'node:assert/strict';
import fs from 'node:fs';

const bindingPath = 'docs/FZ_ATHLETE_INPUT_INTELLIGENCE_INGESTION_STANDARD.md';
assert.ok(fs.existsSync(bindingPath), 'athlete-input ingestion repository binding must exist');
const text = fs.readFileSync(bindingPath, 'utf8');
const release = JSON.parse(fs.readFileSync('release-manifest.json', 'utf8'));

assert.match(text, /always-on potential ingestion trigger/i, 'natural athlete communication must remain an always-on ingestion trigger');
assert.match(text, /Athlete Voice and provenance/i, 'Athlete Voice and provenance must be preserved');
assert.match(text, /runtime data/i, 'supported athlete-state evolution must remain a runtime data operation');
assert.match(text, /Vercel deployment is required only when existing schema\/registries\/relationships\/deployed logic cannot correctly represent/i, 'deployment must remain architecture-gap only');
assert.match(text, /persistence must never be claimed unless the relevant runtime operation actually occurred/i, 'persistence claims must require an executed operation');
assert.match(text, /infer, recover and research before asking/i, 'infer/recover/research-before-ask contract must remain bound');

assert.equal(release.athleteInputIngestion?.repositoryBinding, bindingPath, 'release manifest must point to the repository binding');
assert.equal(release.athleteInputIngestion?.alwaysOnTrigger, true, 'release manifest must keep the always-on trigger');
assert.equal(release.athleteInputIngestion?.runtimeDataNotRelease, true, 'release manifest must keep athlete-state evolution out of release mechanics');
assert.equal(release.athleteInputIngestion?.persistenceClaimRequiresOperation, true, 'release manifest must require executed persistence before claiming it');

console.log('PASS athlete input intelligence ingestion repository contract');
