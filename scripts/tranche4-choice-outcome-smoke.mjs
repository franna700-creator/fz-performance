import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildChoiceOutcomeObservation, classifyChoiceResponse, CHOICE_OUTCOME_ENGINE_VERSION } from '../lib/choice-outcome.js';

const schema=JSON.parse(fs.readFileSync('schemas/choice-outcome.schema.json','utf8'));
const store=fs.readFileSync('lib/choice-outcome-store.js','utf8');
const reconcile=fs.readFileSync('lib/planned-intent-reconcile.js','utf8');
const athleteResponse=fs.readFileSync('lib/athlete-response-capture.js','utf8');
assert.equal(schema.properties.contextType.const,'CHOICE_OUTCOME');
assert.equal(schema.properties.rules.properties.observationOnly.const,true);
assert.equal(schema.properties.rules.properties.doesNotModifyRecommendation.const,true);
assert.equal(schema.properties.rules.properties.noCausalClaimFromSingleOutcome.const,true);

const plan={session_id:'plan:fz:decision-1',payload:{decisionId:'decision-1',recommendationVersion:'rec-1',recommendedLane:'MAINTAIN',lane:'MAINTAIN',optionId:'option-1',plannedSessionId:'plan:fz:decision-1',plannedForDate:'2026-09-14',expectedCost:'LOW_TO_MODERATE'}};
const execution={session_id:'exec:tredict:1',local_date:'2026-09-14',actual_start_at:'2026-09-14T17:00:00+02:00',title:'Controlled steady aerobic',sport_type:'Running',status:'COMPLETED',classification:{modality:'RUNNING'},metrics:{durationSeconds:2700,distanceMeters:7000,avgHeartRate:138,maxHeartRate:154}};
const matched=buildChoiceOutcomeObservation({plan,execution,matchConfidence:.91,matchReasons:['same local date','canonical modality']});
assert.equal(matched.engineVersion,CHOICE_OUTCOME_ENGINE_VERSION);
assert.equal(matched.observationState,'EXECUTION_MATCHED');
assert.equal(matched.rules.observationOnly,true);
assert.equal(matched.rules.doesNotModifyRecommendation,true);
assert.equal(matched.execution.matchConfidence,.91);
assert.equal(matched.execution.durationSeconds,2700);
assert.equal(matched.response,null);

const materiality={level:'RECOMPUTE_RECOMMENDATION',reasonCodes:['ATHLETE_RESPONSE_MATERIAL_NEGATIVE']};
assert.equal(classifyChoiceResponse(materiality),'NEGATIVE');
const responded=buildChoiceOutcomeObservation({plan,execution:{...execution,metrics:{}},previous:matched,athleteEvent:{event_key:'athlete:response:1',event_id:101,summary:'This felt much harder than expected.',certainty:'REPORTED',occurred_at:'2026-09-14T18:00:00+02:00'},materiality});
assert.equal(responded.observationState,'RESPONSE_OBSERVED');
assert.equal(responded.response.direction,'NEGATIVE');
assert.equal(responded.calibration.signal,'POSSIBLE_COST_UNDERPREDICTION');
assert.equal(responded.execution.durationSeconds,2700,'later sparse response linkage must preserve richer execution evidence');
assert.equal(responded.rules.noCausalClaimFromSingleOutcome,true,'one response may be learning evidence but must not become a coaching rule');

const positive={level:'UPDATE_STATE',reasonCodes:['ATHLETE_RESPONSE_MATERIAL_POSITIVE']};
assert.equal(classifyChoiceResponse(positive),'POSITIVE');
const mixed={level:'UPDATE_STATE',reasonCodes:['ATHLETE_RESPONSE_MATERIAL_POSITIVE','DOMS_MODERATE']};
assert.equal(classifyChoiceResponse(mixed),'MIXED');

assert.match(store,/recordType:RECORD_TYPE/,'choice outcome observations must use the existing append-only intelligence ledger rather than new schema');
assert.match(store,/recordType='planned_workout'/,'response linkage must recover the canonical FZ plan attached to the execution');
assert.doesNotMatch(store,/recommendation-shadow|active-recommendation|recomputeRecommendation/i,'observation persistence must not directly influence recommendation logic');
assert.match(reconcile,/persistChoiceOutcome\(/,'planned-intent execution reconciliation must create the first outcome observation');
assert.match(athleteResponse,/persistChoiceOutcomeResponse\(/,'direct Athlete Voice linked to an execution must enrich the existing outcome observation');
assert.match(athleteResponse,/choiceOutcome\?\.observation\?\['choice\.outcome'\]/,'outcome evidence may propagate as evidence but remains separate from the materiality-driven recommendation trigger');

console.log('PASS Tranche 4.5 outcome layer: choice → execution → response persists as observation-only learning evidence without recommendation influence');
