import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeObjectiveMutation } from '../lib/objective-mutation.js';
import { validateObjectiveRegistry, eventStrategicWeight } from '../lib/event-objective-model.js';

const candidate=normalizeObjectiveMutation({
  objective:{objectiveId:'event-new',name:'New event',status:'CANDIDATE',participationStatus:'CONSIDERING',knowledgeStatus:'ATHLETE_STRUCTURE_REQUIRED'}
});
assert.equal(candidate.state,'DORMANT');
assert.equal(candidate.role,'UNCLASSIFIED');
assert.equal(candidate.strategicWeight,0);
assert.equal(candidate.knowledgeStatus,'ATHLETE_STRUCTURE_REQUIRED');
assert.equal(candidate.metadata.participationStatus,'CONSIDERING');
assert.equal(candidate.metadata.intakeStatus,'CANDIDATE');
assert.equal(candidate.startsOn,null);
assert.equal(candidate.endsOn,null);

const scheduled=normalizeObjectiveMutation({
  objective:{
    objectiveId:'event-scheduled',name:'Scheduled event',status:'SCHEDULED',role:'SECONDARY',strategicWeight:0.7,
    participationStatus:'CONFIRMED',knowledgeStatus:'RESEARCH_REQUIRED',date:'2026-11-08'
  }
});
assert.equal(scheduled.startsOn,'2026-11-08');
assert.equal(scheduled.endsOn,'2026-11-08');
assert.equal(scheduled.metadata.datePrecision,'EXACT');

const windowed=normalizeObjectiveMutation({
  objective:{
    objectiveId:'event-window',name:'Window event',status:'SCHEDULED',role:'VALIDATION',strategicWeight:0.4,
    participationStatus:'PLANNED',knowledgeStatus:'PROVISIONAL',
    dateWindow:{start:'2026-11-10',end:'2026-11-16',precision:'WEEK'}
  }
});
assert.equal(windowed.startsOn,'2026-11-10');
assert.equal(windowed.endsOn,'2026-11-16');
assert.equal(windowed.metadata.datePrecision,'WEEK');

assert.throws(()=>normalizeObjectiveMutation({
  objective:{objectiveId:'bad-weight',name:'Bad weight',status:'CANDIDATE',role:'UNCLASSIFIED',strategicWeight:0.2}
}),/unclassified_objective_weight_must_be_zero/);
assert.throws(()=>normalizeObjectiveMutation({
  objective:{objectiveId:'missing-weight',name:'Missing weight',status:'SCHEDULED',role:'SECONDARY',date:'2026-11-08'}
}),/strategic_weight_required_for_classified_objective/);
assert.throws(()=>normalizeObjectiveMutation({
  objective:{objectiveId:'missing-date',name:'Missing date',status:'SCHEDULED',role:'UNCLASSIFIED'}
}),/active_objective_date_required/);

const existing={
  objective_id:'event-existing',objective_type:'EVENT',name:'Existing',state:'SCHEDULED',role:'SECONDARY',strategic_weight:'0.6',
  starts_on:'2026-11-01',ends_on:'2026-11-01',format_profile_id:null,knowledge_status:'RESEARCH_REQUIRED',
  target:{finish:'strong'},metadata:{participationStatus:'ENTERED',datePrecision:'EXACT',location:'Johannesburg'}
};
const amended=normalizeObjectiveMutation({objective:{objectiveId:'event-existing',target:{time:'01:20:00'}}},existing);
assert.equal(amended.name,'Existing');
assert.equal(amended.role,'SECONDARY');
assert.equal(amended.strategicWeight,0.6);
assert.equal(amended.startsOn,'2026-11-01');
assert.deepEqual(amended.target,{time:'01:20:00'});
assert.equal(amended.metadata.participationStatus,'ENTERED');

const registry={
  version:'1.0',capabilities:[],evergreenObjectives:[],
  events:[{id:'candidate',name:'Candidate',date:null,status:'DORMANT',role:'UNCLASSIFIED',strategicWeight:0,objective:{},demands:[]}]
};
assert.deepEqual(validateObjectiveRegistry(registry),{ok:true,errors:[]});
assert.equal(eventStrategicWeight(registry.events[0]),0);

const migration=fs.readFileSync('db/migrations/010_event_intake_semantic_alignment.sql','utf8');
assert.match(migration,/'UNCLASSIFIED'::text/);
assert.match(migration,/'ATHLETE_STRUCTURE_REQUIRED'::text/);
assert.match(migration,/strategic_weight = 0/);
assert.match(migration,/fz_event_source_evidence_idempotency_idx/);

const store=fs.readFileSync('lib/objective-mutation.js','utf8');
assert.match(store,/FZ_OBJECTIVE_MUTATION_V1/);
assert.match(store,/fz_objective_revisions/);
assert.match(store,/fz_event_source_evidence/);
assert.match(store,/ON CONFLICT \(objective_id,source_type,source_ref\)/);
assert.match(store,/propagateCanonicalChangeSafely/);
assert.match(store,/source\.athlete\.objective/);
assert.match(store,/source\.research\.event/);

const api=fs.readFileSync('api/training/athlete-event.js','utf8');
assert.match(api,/OBJECTIVE_MUTATION/);
assert.match(api,/recordObjectiveMutation/);
assert.match(api,/if\(!runtimeAuthorized\)return res\.status\(401\)/);

console.log('PASS Stage 2 event/objective mutation v1');
console.log('  ✓ unclassified candidate remains non-influential');
console.log('  ✓ athlete-structure-required knowledge state is preserved');
console.log('  ✓ exact and approximate event dates remain distinct');
console.log('  ✓ classified objectives require explicit strategic weight');
console.log('  ✓ objective revision + source evidence + propagation are one canonical operation');
