import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeAthletePlannedIntent, ATHLETE_PLANNED_INTENT_CONTEXT } from '../lib/athlete-planned-intent.js';
import { evaluateMateriality } from '../lib/materiality-engine.js';

const base={
  projectScope:'exercise-project',
  athleteId:'francois',
  speakerResolution:'CONFIRMED',
  reportedAt:'2026-10-02T08:00:00+02:00',
  occurredAt:'2026-10-02T08:00:00+02:00',
  plannedForDate:'2026-10-03',
  title:'Easy aerobic run',
  modality:'Running',
  sessionKind:'Zone 2',
  rawText:"I'm doing an easy run tomorrow morning."
};

const normalized=normalizeAthletePlannedIntent(base);
assert.equal(ATHLETE_PLANNED_INTENT_CONTEXT,'ATHLETE_PLANNED_INTENT');
assert.equal(normalized.athleteId,'francois');
assert.equal(normalized.plannedForDate,'2026-10-03');
assert.equal(normalized.title,'Easy aerobic run');
assert.equal(normalized.modality,'Running');
assert.equal(normalized.status,'PLANNED');
assert.match(normalized.intentId,/^athlete-plan:/);
assert.match(normalized.sessionId,/^plan:athlete:/);
assert.ok(normalized.matchHints.titleTerms.includes('easy'));
assert.ok(normalized.matchHints.titleTerms.includes('aerobic'));

const exactStart=normalizeAthletePlannedIntent({...base,plannedStartAt:'2026-10-03T05:00:00+02:00'});
assert.equal(exactStart.plannedStartAt,'2026-10-03T03:00:00.000Z');
assert.throws(()=>normalizeAthletePlannedIntent({...base,plannedStartAt:'2026-10-04T05:00:00+02:00'}),/planned_start_date_mismatch/);
assert.throws(()=>normalizeAthletePlannedIntent({...base,plannedForDate:'2026-10-XX'}),/invalid_planned_for_date/);
assert.throws(()=>normalizeAthletePlannedIntent({...base,title:''}),/planned_intent_title_required/);
assert.throws(()=>normalizeAthletePlannedIntent({...base,modality:''}),/planned_intent_modality_required/);
assert.throws(()=>normalizeAthletePlannedIntent({...base,athleteId:'someone-else'}),/francois_speaker_required/);

const replayA=normalizeAthletePlannedIntent({...base,idempotencyKey:'conversation:abc'});
const replayB=normalizeAthletePlannedIntent({...base,idempotencyKey:'conversation:abc'});
assert.equal(replayA.intentId,replayB.intentId);
assert.equal(replayA.sessionId,replayB.sessionId);

const materiality=evaluateMateriality({
  sourceType:'ATHLETE_FEEDBACK',
  eventType:'CONTEXT',
  certainty:'REPORTED',
  categories:['SESSION'],
  summary:'Athlete plans a different session tomorrow.',
  signals:{sequencingChanged:true}
});
assert.equal(materiality.level,'RECOMPUTE_RECOMMENDATION');
assert.ok(materiality.reasonCodes.includes('SEQUENCING_CHANGED'));

const store=fs.readFileSync('lib/athlete-planned-intent.js','utf8');
assert.match(store,/recordType:'planned_workout'/);
assert.match(store,/contextType:ATHLETE_PLANNED_INTENT_CONTEXT/);
assert.match(store,/relationship:'PLAN'/);
assert.match(store,/eventType:'PLANNED'/);
assert.match(store,/actor:'ATHLETE'/);
assert.match(store,/memoryCategories:\['SESSION'\]/);
assert.match(store,/sequencingChanged:true/);
assert.match(store,/propagateCanonicalChangeSafely/);
assert.match(store,/training\.intent/);
assert.match(store,/athleteIntentDoesNotImplyFzRecommendation:true/);

const reconcile=fs.readFileSync('lib/planned-intent-reconcile.js','utf8');
assert.match(reconcile,/ATHLETE_PLANNED_INTENT/);
assert.match(reconcile,/FZ_PLANNED_INTENT/);
assert.match(reconcile,/ATHLETE_PLANNED_INTENT_MATCH/);
assert.match(reconcile,/if\(planContext==='FZ_PLANNED_INTENT'\)/,
  'generic athlete plans must not fabricate adaptive-choice outcome records');

const api=fs.readFileSync('api/training/athlete-event.js','utf8');
assert.match(api,/ATHLETE_PLANNED_INTENT/);
assert.match(api,/recordAthletePlannedIntent/);
assert.match(api,/plannedIntent/);

console.log('PASS Stage 2 athlete-described planned intent v1');
console.log('  ✓ natural future training intent has a typed canonical write');
console.log('  ✓ Athlete Voice provenance remains attached to the planned session');
console.log('  ✓ sequencing change triggers recommendation recomputation');
console.log('  ✓ later execution can late-bind without fabricating an FZ choice outcome');
