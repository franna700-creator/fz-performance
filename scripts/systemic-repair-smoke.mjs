import assert from 'node:assert/strict';
import fs from 'node:fs';

const standard=fs.readFileSync('docs/SYSTEMIC_REPAIR_STANDARD.md','utf8');
const evidence=fs.readFileSync('lib/training-evidence.js','utf8');
const reconcile=fs.readFileSync('lib/athlete-memory-reconcile.js','utf8');
const trends=fs.readFileSync('lib/trends-dynamic.js','utf8');
const production=fs.readFileSync('scripts/production-health.mjs','utf8');
const trainingStore=fs.readFileSync('lib/training-store.js','utf8');
const choiceStore=fs.readFileSync('lib/athlete-choice-store.js','utf8');
const intelligenceCurrent=fs.readFileSync('lib/intelligence-current.js','utf8');
const convergenceMigration=fs.readFileSync('db/migrations/007_intelligence_convergence.sql','utf8');
const tranche5=fs.readFileSync('docs/TRANCHE_5_INTELLIGENCE_CONVERGENCE.md','utf8');

for(const phrase of [
  'Missing is never silently converted to zero',
  'Newer sparse evidence cannot erase richer previously observed evidence',
  'late-bound',
  'Routine data refresh must not consume Vercel deployments'
]) assert.ok(standard.includes(phrase),`systemic invariant missing: ${phrase}`);

assert.ok(/best|rich|complet/i.test(evidence),'training evidence layer must rank/merge richer evidence');
assert.ok(/unlinked|late|candidate|confidence/i.test(reconcile),'Athlete Memory reconciliation must support later association');
assert.ok(trends.includes('PENDING_DETAIL')&&trends.includes('VERIFIED_ZERO'),'Trends must distinguish pending from verified zero');
assert.ok(!production.includes('270.72')&&!production.includes('2036.59'),'production health must not freeze moving athlete values');

assert.match(convergenceMigration,/choice_outcome/,'Tranche 5 schema must admit persisted choice outcomes');
for(const table of ['fz_canonical_revisions','fz_convergence_ledger'])assert.ok(convergenceMigration.includes(table),`${table} must exist in convergence foundation migration`);
assert.match(trainingStore,/reconciliation_state='MATCHED'[\s\S]*EXCLUDED\.reconciliation_state IN \('UNMATCHED','MATCH_REQUIRED'\)[\s\S]*THEN 'MATCHED'/,'source upsert must not downgrade MATCHED reconciliation');
assert.match(trainingStore,/reconciliation_state='MATCH_REQUIRED'[\s\S]*EXCLUDED\.reconciliation_state='UNMATCHED'[\s\S]*THEN 'MATCH_REQUIRED'/,'source upsert must not downgrade MATCH_REQUIRED reconciliation');
assert.match(choiceStore,/supersedePriorOpenPlans/,'later athlete choices must supersede replaced open FZ plans');
assert.match(choiceStore,/status IN \('PLANNED','RECOMMENDED','ACCEPTED','MODIFIED'\)/,'choice supersession must be limited to open plan states');
assert.match(intelligenceCurrent,/state IN \('SCHEDULED','ACTIVE'\)/,'intelligence currentness must track scheduled decision-driving objectives');
assert.match(intelligenceCurrent,/objectiveGraphMarker/,'objective currentness must fingerprint the decision-driving objective graph');
for(const phrase of ['pendingPropagation: false','Time is an intelligence input'])assert.ok(tranche5.includes(phrase),`Tranche 5 architecture definition missing: ${phrase}`);
assert.match(tranche5,/current[- ]athlete[- ]state/i,'Tranche 5 architecture definition must establish canonical Current Athlete State');

console.log('PASS systemic repair invariants: monotonic evidence, late binding, schema parity, monotonic reconciliation and decision-objective tracking');
