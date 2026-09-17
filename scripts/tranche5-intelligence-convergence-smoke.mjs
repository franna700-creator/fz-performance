import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCurrentAthleteState } from '../lib/athlete-current-state.js';
import { affectedNodes, assertKnownChangedNodes, unknownDependencyNodes, validateDependencyGraph } from '../lib/runtime-dependency-graph.js';

function materiality(reasonCodes = []) {
  return { materiality: { reasonCodes, level: 'RECORD_ONLY', shouldRecomputeRecommendation: false } };
}
function event({ id, key, at, summary, categories = [], reasons = [] }) {
  return {
    event_id: id,
    event_key: key,
    event_type: 'CONTEXT',
    occurred_at: at,
    local_date: at.slice(0, 10),
    summary,
    payload: { rawText: summary, memoryCategories: categories },
    materiality_payload: materiality(reasons)
  };
}

const finger = event({
  id: 1,
  key: 'athlete:finger:1',
  at: '2026-09-15T10:00:00.000Z',
  summary: 'My middle finger is still sore and grip is uncomfortable.',
  categories: ['CONSTRAINT'],
  reasons: ['PAIN_MODERATE']
});
const unrelatedRecovery = event({
  id: 2,
  key: 'athlete:sleep:1',
  at: '2026-09-16T05:00:00.000Z',
  summary: 'Slept really well and feel fresh this morning.',
  categories: ['RECOVERY'],
  reasons: ['RECOVERY_POSITIVE']
});
const carried = buildCurrentAthleteState({
  events: [finger, unrelatedRecovery],
  asOf: new Date('2026-09-16T12:00:00.000Z')
});
assert.equal(carried.activeConstraints.length, 1, 'unrelated feedback must not erase an unresolved constraint');
assert.equal(carried.activeConstraints[0].subject, 'HAND_FINGER_GRIP');
assert.equal(carried.readinessContext.source, 'ACTIVE_CONSTRAINT', 'active constraint must govern subjective readiness context');
assert.equal(carried.recent.recovery.eventKey, 'athlete:sleep:1', 'positive recovery remains visible alongside the constraint');

const resolved = event({
  id: 3,
  key: 'athlete:finger:resolved',
  at: '2026-09-16T15:00:00.000Z',
  summary: 'Finger is much better now and the pain has resolved.',
  categories: ['CONSTRAINT'],
  reasons: ['CONSTRAINT_REPORTED_RESOLVED']
});
const afterResolution = buildCurrentAthleteState({
  events: [finger, unrelatedRecovery, resolved],
  asOf: new Date('2026-09-16T16:00:00.000Z')
});
assert.equal(afterResolution.activeConstraints.length, 0, 'explicit resolution must clear current constraint state');
assert.equal(afterResolution.resolutionLog.at(-1)?.subject, 'HAND_FINGER_GRIP');

const stale = buildCurrentAthleteState({
  events: [finger],
  asOf: new Date('2026-10-08T12:00:00.000Z')
});
assert.equal(stale.activeConstraints.length, 0, 'expired unconfirmed constraint must not remain active forever');
assert.equal(stale.staleConstraints[0]?.status, 'STALE_UNCONFIRMED');

assert.deepEqual(unknownDependencyNodes(['totally.unknown.node']), ['totally.unknown.node']);
assert.throws(() => assertKnownChangedNodes(['totally.unknown.node']), /unknown_dependency_node/, 'unknown mutation nodes must fail closed');
const graphValidation = validateDependencyGraph();
assert.deepEqual(graphValidation.errors, [], `dependency graph must remain registry-valid: ${graphValidation.errors.join(' | ')}`);
assert.equal(graphValidation.ok, true, 'dependency graph must remain registry-valid');

const athleteClosure = affectedNodes('source.athlete.feedback');
for (const required of ['athlete.memory','athlete.state.current','readiness.current','adaptive.context','recommendation.shadow','ui.today','ui.train','ui.trends','ui.system']) {
  assert.ok(athleteClosure.includes(required), `Athlete Voice must reach ${required}`);
}
const clockClosure = affectedNodes('clock.local_day');
for (const required of ['athlete.state.current','measurement.evidence','objective.graph','adaptive.context','recommendation.shadow','ui.goals']) {
  assert.ok(clockClosure.includes(required), `local-day transition must reach ${required}`);
}
const bootstrapClosure = affectedNodes('source.system.reconciliation');
for (const required of ['wellness.current','training.evidence','athlete.state.current','objective.graph','measurement.evidence','readiness.current','adaptive.context','recommendation.shadow']) {
  assert.ok(bootstrapClosure.includes(required), `system bootstrap must reach ${required}`);
}

const migration = fs.readFileSync('db/migrations/007_intelligence_convergence.sql', 'utf8');
assert.match(migration, /'choice_outcome'/, 'deployed schema migration must admit choice_outcome');
assert.match(migration, /CREATE TABLE IF NOT EXISTS fz_canonical_revisions/, 'canonical revision ledger must be migrated');
assert.match(migration, /CREATE TABLE IF NOT EXISTS fz_convergence_ledger/, 'convergence ledger must be migrated');
assert.match(migration, /PROVEN_UNAFFECTED/, 'convergence states must distinguish intentional retention');

const outboxMigration = fs.readFileSync('db/migrations/008_canonical_mutation_outbox.sql', 'utf8');
assert.match(outboxMigration, /CREATE TABLE IF NOT EXISTS fz_canonical_mutation_outbox/, 'canonical mutation outbox must be migrated');
assert.match(outboxMigration, /fz_wellness_snapshots/, 'outbox must watch persisted wellness snapshots');
assert.doesNotMatch(outboxMigration, /ON fz_wellness_current/, 'outbox must never install a row trigger on the wellness current view');
for (const table of ['fz_training_source_records','fz_training_sessions','fz_training_session_sources','fz_athlete_events','fz_objectives','fz_objective_revisions','fz_objective_capabilities','fz_event_format_profiles','fz_event_source_evidence','fz_event_transfer_assessments']) {
  assert.match(outboxMigration, new RegExp(`ON ${table}\\b`), `outbox trigger coverage missing ${table}`);
}
assert.match(outboxMigration, /source_key',''\) = 'fz-intelligence'/, 'derived FZ intelligence writes must be excluded from outbox recursion');

const propagation = fs.readFileSync('lib/canonical-propagation.js', 'utf8');
assert.match(propagation, /intelligence-current-v5\.js/, 'propagation must use graph-wide Tranche 5 currentness');
assert.match(propagation, /assertKnownChangedNodes/, 'propagation must fail closed on unknown nodes');
assert.match(propagation, /PROVEN_UNAFFECTED/, 'propagation must account for intentionally unchanged intelligence');
assert.match(propagation, /acknowledgeCoveredCanonicalMutations/, 'propagation must acknowledge covered persistence-boundary mutations');

const refresh = fs.readFileSync('lib/intelligence-refresh.js', 'utf8');
assert.match(refresh, /source\.system\.reconciliation/, 'first convergence revision must bootstrap deterministically');
assert.match(refresh, /clock\.local_day/, 'local-day temporal invalidation must be explicit');
assert.match(refresh, /clock\.decision_window/, 'decision-window temporal invalidation must be explicit');
assert.match(refresh, /addDays\(date, -45\)/, 'late evidence reconciliation must refresh the full 45-day history');
assert.match(refresh, /readPendingCanonicalMutations/, 'refresh must drain direct canonical DB mutations');

const readiness = fs.readFileSync('lib/readiness-store.js', 'utf8');
assert.doesNotMatch(readiness, /WELLNESS_HISTORY/, 'readiness must not use runtime wellness history');
assert.match(readiness, /athlete-current-state/, 'readiness must consume durable Current Athlete State');

const trends = fs.readFileSync('lib/trends-store.js', 'utf8');
assert.doesNotMatch(trends, /loadDatabaseRuntimeState/, 'TRENDS must not use runtime-state load fallback');
assert.doesNotMatch(trends, /EXPECTED_MATCHED_AET_DATES/, 'TRENDS quality must not hard-code athlete-specific historical dates');

const trendsApi = fs.readFileSync('api/trends/current.js', 'utf8');
assert.match(trendsApi, /adaptive-context-v44\.js/, 'TRENDS and recommendation must share the same adaptive context');

const runtimeApi = fs.readFileSync('api/runtime-state.js', 'utf8');
assert.match(runtimeApi, /overlayCanonicalCurrentState/, 'server must own current presentation overlay');
assert.match(runtimeApi, /intelligence-current-v5\.js/, 'runtime presentation must consume Tranche 5 currentness');
const browser = fs.readFileSync('src/intelligence-refresh.js', 'utf8');
assert.doesNotMatch(browser, /function overlayRuntime/, 'browser must not manufacture canonical readiness');

const system = fs.readFileSync('api/system/status.js', 'utf8');
assert.match(system, /runLiveSystemicReconciliationSweep/, 'SYSTEM must run the live integrity sweep');
assert.match(system, /systemIntegrity/, 'SYSTEM must expose live invariant status');

console.log('✓ Tranche 5 intelligence convergence smoke passed');
