import assert from 'node:assert/strict';
import fs from 'node:fs';

const athleteResponse = fs.readFileSync('lib/athlete-response-capture.js','utf8');
const athleteMemory = fs.readFileSync('lib/athlete-memory-ingest.js','utf8');
const athleteState = fs.readFileSync('lib/athlete-current-state.js','utf8');
const materiality = fs.readFileSync('lib/materiality-engine.js','utf8');
const runtimeSync = fs.readFileSync('lib/training-sync-runtime.js','utf8');
const choice = fs.readFileSync('lib/athlete-choice-store.js','utf8');
const outbox = fs.readFileSync('db/migrations/008_canonical_mutation_outbox.sql','utf8');
const graph = fs.readFileSync('lib/runtime-dependency-graph.js','utf8');
const eventSchema = JSON.parse(fs.readFileSync('schemas/event-intake.schema.json','utf8'));
const standardBinding = fs.readFileSync('docs/FZ_ATHLETE_INPUT_INTELLIGENCE_INGESTION_STANDARD.md','utf8');
const audit = fs.readFileSync('docs/STAGE_2_INGESTION_COVERAGE_AUDIT_2026-10-02.md','utf8');

// Always-on athlete input is a canonical write path, not a UI-only convention.
assert.match(standardBinding,/every athlete-originated message is an always-on potential ingestion trigger/i);
assert.match(standardBinding,/supported athlete-state evolution is persisted\/reconciled as runtime data/i);
assert.match(standardBinding,/data evolution, not releases/i);

// Natural athlete response must persist before downstream decision work.
const responseStart = athleteResponse.indexOf('export async function recordExerciseAthleteResponse');
const responseBody = athleteResponse.slice(responseStart);
const memoryAt = responseBody.indexOf('await recordAthleteMemory(normalized)');
const materialityAt = responseBody.indexOf('await persistMaterialityAssessment(');
const stateAt = responseBody.indexOf('await recomputeCurrentAthleteStateSafely(');
const propagationAt = responseBody.indexOf('await propagateCanonicalChangeSafely(');
assert.ok(responseStart >= 0 && memoryAt >= 0 && materialityAt > memoryAt && stateAt > materialityAt && propagationAt > stateAt,
  'athlete response must persist Athlete Memory before materiality, Current Athlete State and propagation');

// Athlete Memory retains broad semantic classes and the major changed-execution states.
for (const category of ['STATE','SESSION','COST','RECOVERY','FUELING','CONSTRAINT','HYPOTHESIS']) {
  assert.ok(athleteMemory.includes(`'${category}'`), `Athlete Memory missing ${category}`);
}
for (const eventType of ['ATHLETE_MODIFIED','STOPPED_EARLY','ABORTED','SKIPPED','POST_SESSION_FEEDBACK','NEXT_DAY_RESPONSE','CONTEXT']) {
  assert.ok(athleteMemory.includes(`'${eventType}'`), `Athlete Memory missing ${eventType}`);
}
assert.match(athleteMemory,/AMBIGUOUS_CONTEXT/,'ambiguous session association must remain unresolved rather than guessed');
assert.match(runtimeSync,/reconcileUnlinkedAthleteEvents/,'source sync must late-bind previously unresolved Athlete Memory');

// All materiality states are executable.
for (const level of ['RECORD_ONLY','UPDATE_STATE','RECOMPUTE_RECOMMENDATION','SAFETY_OVERRIDE']) {
  assert.ok(materiality.includes(`'${level}'`), `materiality engine missing ${level}`);
}
assert.match(materiality,/safety_override|SAFETY_OVERRIDE/i,'safety escalation must exist');
assert.match(materiality,/sequencingChanged/,'materiality must support sequencing change');

// Athlete overrides are durable evidence and safety remains above preference.
assert.match(choice,/doesNotRewriteRecommendation:true/,'athlete choice must preserve the source recommendation');
assert.match(choice,/safetyOverrideCannotBeBypassed:true/,'selected choice must preserve safety precedence');
assert.match(choice,/await propagateCanonicalChangeSafely/,'athlete choice must propagate');

// Event/objective data is runtime-variable and persistence-boundary mutations enter the outbox.
for (const table of ['fz_objectives','fz_objective_revisions','fz_event_source_evidence','fz_event_format_profiles','fz_objective_capabilities','fz_event_transfer_assessments']) {
  assert.ok(outbox.includes(table), `canonical mutation outbox missing ${table}`);
}
for (const node of ['source.athlete.event','source.athlete.objective','event.intake','objective.graph','event.intelligence','adaptive.context']) {
  assert.ok(graph.includes(`'${node}'`) || graph.includes(node), `dependency graph missing ${node}`);
}
assert.ok(eventSchema.properties?.participationStatus?.enum?.includes('CONSIDERING'),'event intake must represent considering');
assert.ok(eventSchema.properties?.participationStatus?.enum?.includes('CONFIRMED'),'event intake must represent confirmed participation');
assert.ok(eventSchema.properties?.dateWindow,'event intake must preserve approximate date windows');

// Current Athlete State is intentionally narrower than raw ingestion. The audit must
// keep this distinction explicit so a stored context item is never mistaken for a
// durable governing state.
assert.match(athleteState,/recent:\{state:recentState,recovery:recentRecovery,cost:recentCost\}/,
  'current athlete state must expose its bounded recent-state projection');
assert.match(audit,/generic durable current context is narrower than ingestion/i,
  'Stage 2 audit must record the current-context projection gap');
assert.match(audit,/FOREARM/i,'Stage 2 audit must retain the known FOREARM taxonomy gap');
assert.match(audit,/autonomous training-source continuity/i,'Stage 2 audit must retain source-continuity findings');

console.log('PASS Stage 2 ingestion coverage structural audit');
console.log('  ✓ athlete response: persistence → materiality → current state → propagation');
console.log('  ✓ late binding + changed-session semantics');
console.log('  ✓ all four materiality levels');
console.log('  ✓ adaptive choice + safety precedence');
console.log('  ✓ event/objective runtime graph + persistence-boundary outbox');
console.log('  ✓ known gaps remain explicit rather than being silently treated as closed');
