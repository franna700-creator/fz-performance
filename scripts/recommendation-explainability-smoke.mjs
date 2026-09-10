import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildRecommendationExplanation, explanationDecisionTrace, validateRecommendationExplanation } from '../lib/recommendation-explainability.js';
const schema=JSON.parse(await fs.readFile('schemas/recommendation-explanation.schema.json','utf8'));
assert.equal(schema.properties.lane.enum.length,3);
const explanation=buildRecommendationExplanation({
  recommendationId:'synthetic-rec-1',lane:'MAINTAIN',
  evidence:[{ref:'training:last72h',fact:'Recent load is materially elevated relative to the immediate recovery window.',provenance:'canonical synthetic fixture',quality:'DERIVED'},{ref:'measurement:running.controlled_efficiency',fact:'Controlled running efficiency has usable evidence while compromised-running evidence remains incomplete.',provenance:'synthetic measurement hierarchy',quality:'DERIVED'}],
  interpretation:['There is useful capacity available, but another high-cost exposure is not automatically the highest-value choice today.'],
  objectiveRelevance:[{objective:'HYROX primary',connection:'Preserve running quality while leaving room for the next compromised-running exposure.',measurementIds:['running.controlled_efficiency','running.compromised_repeatability']}],
  recommendation:{whyThisLane:'MAINTAIN preserves useful capability without adding unnecessary recovery cost.',expectedBenefit:'Retain aerobic and movement quality while protecting the next higher-value adaptation opportunity.',expectedCost:'LOW_TO_MODERATE',stopOrModifyConditions:['New pain or material symptom escalation']},
  counterfactuals:{ABSORB:'Prefer ABSORB if recovery evidence deteriorates or local symptoms emerge.',ADAPT:'Prefer ADAPT when recovery cost is acceptable and the priority gap can be trained with sufficient quality.'},
  uncertainty:{confidence:'MODERATE',unknowns:['Compromised-running repeatability is under-measured'],assumptions:['No safety override is active']},
  safety:{override:false,reason:null},
  athleteFacing:{headline:'Keep useful work in the day without spending tomorrow’s quality.',whyNow:'You have enough capacity to train, but the recent load makes another costly session a poor trade today.',objectiveConnection:'This keeps your HYROX running base moving while preserving the next session that can actually test compromised running.',caveat:'The compromised-running picture is still incomplete, so this is a moderate-confidence call.'}
});
assert.equal(validateRecommendationExplanation(explanation).ok,true);
assert.equal(explanationDecisionTrace(explanation).steps.map(x=>x.stage).join('>'),'EVIDENCE>INTERPRETATION>OBJECTIVE_RELEVANCE>RECOMMENDATION>UNCERTAINTY');
assert.ok(explanation.counterfactuals.ABSORB&&explanation.counterfactuals.ADAPT);
assert.ok(!/HRV \d+|RHR \d+|NCL \d+/.test(explanation.athleteFacing.whyNow),'athlete-facing rationale must not default to telemetry dumping');
console.log('PASS recommendation explainability: evidence → interpretation → objective relevance → recommendation → uncertainty');
