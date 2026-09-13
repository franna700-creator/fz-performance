import assert from 'node:assert/strict';
import { scoreFzPlannedIntentCandidate, selectFzPlannedIntentMatch } from '../lib/planned-intent-reconcile.js';
import { buildFzPlanSequencing } from '../lib/adaptive-context-v44.js';

const plan={
  session_id:'plan:fz:decision-1',
  local_date:'2026-09-11',
  payload:{
    decisionId:'decision-1',plannedForDate:'2026-09-11',lane:'ADAPT',modality:'RUNNING',sessionKind:'AET',
    matchHints:{modality:'RUNNING',titleTerms:['aet','run']}
  }
};
const execution={
  session_id:'exec:tredict:run-aet-1',local_date:'2026-09-11',actual_start_at:'2026-09-11T17:15:00+02:00',
  title:'Run AET',source_title:'Run AET',sport_type:'running',session_kind:'AET',classification:{modality:'RUNNING'}
};
const score=scoreFzPlannedIntentCandidate(plan,execution);
assert.ok(score&&score.score>=0.68,'same-day canonical modality/session evidence must be strong enough for deterministic planned-intent reconciliation');
assert.ok(score.reasons.includes('same local date'));
assert.ok(score.reasons.includes('canonical modality'));

const selected=selectFzPlannedIntentMatch(plan,[execution]);
assert.equal(selected.state,'MATCHED');
assert.equal(selected.best.session.session_id,execution.session_id);

const ambiguous=selectFzPlannedIntentMatch(plan,[
  execution,
  {...execution,session_id:'exec:garmin:duplicate-window'}
]);
assert.equal(ambiguous.state,'AMBIGUOUS','equally credible same-day executions must fail closed rather than guess');

const otherDay=selectFzPlannedIntentMatch(plan,[{...execution,local_date:'2026-09-12',actual_start_at:'2026-09-12T17:15:00+02:00'}]);
assert.equal(otherDay.state,'NO_CANDIDATE','execution on another local date must never satisfy the selected plan');

const dateOnly=buildFzPlanSequencing(plan,{now:new Date('2026-09-11T16:00:00+02:00'),asOf:'2026-09-11'});
assert.equal(dateOnly.nextPlannedLane,'ADAPT');
assert.equal(dateOnly.nextPlannedDate,'2026-09-11');
assert.equal(dateOnly.nextPlannedWithinDays,0);
assert.equal(dateOnly.timingPrecision,'DATE_ONLY');
assert.equal(dateOnly.nextPlannedWithinHours,null,'date-only athlete choice must not manufacture an exact start-time distance');

const exact=buildFzPlanSequencing({...plan,planned_start_at:'2026-09-11T18:00:00+02:00'},{now:new Date('2026-09-11T16:00:00+02:00'),asOf:'2026-09-11'});
assert.equal(exact.timingPrecision,'EXACT_START');
assert.equal(exact.nextPlannedWithinHours,2);
assert.equal(exact.nextPlannedWithinDays,0);

const nextDay=buildFzPlanSequencing({...plan,local_date:'2026-09-12',payload:{...plan.payload,plannedForDate:'2026-09-12'}},{now:new Date('2026-09-11T16:00:00+02:00'),asOf:'2026-09-11'});
assert.equal(nextDay.nextPlannedWithinDays,1);
assert.equal(nextDay.nextPlannedWithinHours,null);

console.log('PASS Tranche 4.4 planned intent: deterministic execution reconciliation, ambiguity fail-closed, date-only timing stays date-only');
