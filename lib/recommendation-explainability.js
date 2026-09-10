const LANES=new Set(['ABSORB','MAINTAIN','ADAPT']);
const COSTS=new Set(['LOW','LOW_TO_MODERATE','MODERATE','MODERATE_TO_HIGH','HIGH']);
const QUALITY=new Set(['DIRECT','DERIVED','INFERRED','PROVISIONAL']);
const CONFIDENCE=new Set(['LOW','MODERATE','HIGH']);

export function validateRecommendationExplanation(value={}){
  const errors=[];
  if(value.schemaVersion!=='1.0') errors.push('schemaVersion must be 1.0');
  if(!value.recommendationId) errors.push('recommendationId required');
  if(!LANES.has(value.lane)) errors.push('valid lane required');
  if(!Array.isArray(value.evidence)||!value.evidence.length) errors.push('evidence required');
  for(const e of value.evidence||[]){ if(!e.ref||!e.fact||!e.provenance||!QUALITY.has(e.quality)) errors.push(`invalid evidence ${e.ref||'unknown'}`); }
  if(!Array.isArray(value.interpretation)||!value.interpretation.length) errors.push('interpretation required');
  if(!Array.isArray(value.objectiveRelevance)||!value.objectiveRelevance.length) errors.push('objectiveRelevance required');
  if(!value.recommendation?.whyThisLane||!value.recommendation?.expectedBenefit||!COSTS.has(value.recommendation?.expectedCost)) errors.push('recommendation rationale/cost incomplete');
  if(!CONFIDENCE.has(value.uncertainty?.confidence)||!Array.isArray(value.uncertainty?.unknowns)) errors.push('uncertainty contract incomplete');
  for(const field of ['headline','whyNow','objectiveConnection']) if(!value.athleteFacing?.[field]) errors.push(`athleteFacing.${field} required`);
  if(value.safety?.override===true&&!value.safety?.reason) errors.push('safety override requires reason');
  return {ok:errors.length===0,errors};
}

export function buildRecommendationExplanation({recommendationId,lane,evidence,interpretation,objectiveRelevance,recommendation,counterfactuals={},uncertainty,safety={override:false,reason:null},athleteFacing}={}){
  const value={schemaVersion:'1.0',recommendationId,lane,evidence:evidence||[],interpretation:interpretation||[],objectiveRelevance:objectiveRelevance||[],recommendation:recommendation||{},counterfactuals:{ABSORB:counterfactuals.ABSORB??null,MAINTAIN:counterfactuals.MAINTAIN??null,ADAPT:counterfactuals.ADAPT??null},uncertainty:uncertainty||{confidence:'LOW',unknowns:['Decision context incomplete'],assumptions:[]},safety,athleteFacing:athleteFacing||{headline:'Recommendation context incomplete',whyNow:'More validated context is required.',objectiveConnection:'No objective connection has been resolved.',caveat:'Do not present as a confident recommendation.'}};
  const validation=validateRecommendationExplanation(value);
  if(!validation.ok) throw new Error(`invalid recommendation explanation: ${validation.errors.join('; ')}`);
  return value;
}

export function explanationDecisionTrace(explanation={}){
  const validation=validateRecommendationExplanation(explanation);
  if(!validation.ok) return {status:'INVALID',errors:validation.errors,steps:[]};
  return {status:'VALID',steps:[
    {stage:'EVIDENCE',count:explanation.evidence.length,refs:explanation.evidence.map(x=>x.ref)},
    {stage:'INTERPRETATION',count:explanation.interpretation.length},
    {stage:'OBJECTIVE_RELEVANCE',count:explanation.objectiveRelevance.length,objectives:explanation.objectiveRelevance.map(x=>x.objective)},
    {stage:'RECOMMENDATION',lane:explanation.lane,expectedCost:explanation.recommendation.expectedCost},
    {stage:'UNCERTAINTY',confidence:explanation.uncertainty.confidence,unknowns:explanation.uncertainty.unknowns}
  ]};
}
