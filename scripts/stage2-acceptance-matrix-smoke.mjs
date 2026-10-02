import assert from 'node:assert/strict';
import fs from 'node:fs';

const matrix=JSON.parse(fs.readFileSync('fixtures/stage2-acceptance-matrix.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const build=String(pkg.scripts?.build||'');

assert.equal(matrix.version,'1.0');
assert.equal(matrix.scenarios.length,14,'Stage 2 acceptance matrix must retain all 14 scenarios');

const ids=matrix.scenarios.map(item=>item.id);
assert.deepEqual(ids,Array.from({length:14},(_,index)=>`S2-${String(index+1).padStart(2,'0')}`),
  'Stage 2 scenario IDs must remain complete and ordered');

for(const scenario of matrix.scenarios){
  assert.ok(scenario.name&&scenario.name.trim(),`${scenario.id} must retain a human-readable scenario name`);
  assert.ok(Array.isArray(scenario.regressions)&&scenario.regressions.length>=1,`${scenario.id} must map to at least one deterministic regression`);
  for(const file of scenario.regressions){
    assert.ok(fs.existsSync(file),`${scenario.id} regression file missing: ${file}`);
    assert.ok(build.includes(`node ${file}`)||build.includes(`node --experimental-test-module-mocks ${file}`),
      `${scenario.id} regression is not part of the quality build: ${file}`);
  }
}

const requiredStage2=[
  'scripts/stage2-ingestion-coverage-smoke.mjs',
  'scripts/stage2-objective-mutation-smoke.mjs',
  'scripts/stage2-athlete-planned-intent-smoke.mjs',
  'scripts/stage2-current-athlete-context-smoke.mjs',
  'scripts/stage2-intervals-activity-backstop-smoke.mjs',
  'scripts/stage2-composite-athlete-memory-smoke.mjs'
];
for(const file of requiredStage2){
  assert.ok(fs.existsSync(file),`Stage 2 gap-closure regression missing: ${file}`);
  assert.ok(build.includes(`node ${file}`),`Stage 2 gap-closure regression must run in quality: ${file}`);
}

const semanticCoverage=new Map(matrix.scenarios.map(item=>[item.id,new Set(item.regressions)]));
assert.ok(semanticCoverage.get('S2-03').has('scripts/athlete-memory-reconcile-smoke.mjs'),'late binding must have direct deterministic coverage');
assert.ok(semanticCoverage.get('S2-10').has('scripts/training-evidence-smoke.mjs'),'monotonic evidence must have direct deterministic coverage');
assert.ok(semanticCoverage.get('S2-11').has('scripts/stage2-composite-athlete-memory-smoke.mjs'),'composite exposure must have dedicated forward-ingestion coverage');
assert.ok(semanticCoverage.get('S2-14').has('scripts/tranche4-materiality-smoke.mjs'),'safety override must retain materiality coverage');

console.log('PASS Stage 2 deterministic acceptance matrix: 14/14 scenarios mapped to quality-gated regressions');
console.log('  Production live acceptance remains a separate evidence lane and is not manufactured by this fixture.');
