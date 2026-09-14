import { buildAdaptiveContext } from './adaptive-context-v44.js';
import { evaluateRecommendation, RECOMMENDATION_ENGINE_MODE, RECOMMENDATION_ENGINE_VERSION } from './recommendation-engine.js';
import { persistRecommendationShadow } from './recommendation-shadow-store.js';
import { readCurrentReadiness } from './readiness-store.js';
import { mergeCanonicalReadinessIntoContext } from './readiness-engine.js';

export async function recomputeRecommendationShadow({trigger={},materiality=null,now=new Date(),persist=true}={}){
  const baseContext=await buildAdaptiveContext({now,materialityOverride:materiality,trigger});
  const readinessRow=await readCurrentReadiness({date:baseContext.asOf}).catch(()=>null);
  const context=mergeCanonicalReadinessIntoContext(baseContext,readinessRow?.payload||null);
  const evaluation=evaluateRecommendation(context);
  let persistence=null;
  if(persist){
    const row=await persistRecommendationShadow({evaluation,context,trigger});
    persistence={recordPk:row?.id||null,sourceHash:row?.source_hash||null};
  }
  return {engineVersion:RECOMMENDATION_ENGINE_VERSION,mode:RECOMMENDATION_ENGINE_MODE,context,evaluation,persistence};
}
export async function recomputeRecommendationShadowSafely(options={}){
  try{return await recomputeRecommendationShadow(options);}catch(error){return {engineVersion:RECOMMENDATION_ENGINE_VERSION,mode:RECOMMENDATION_ENGINE_MODE,status:'ERROR',error:error instanceof Error?error.message:String(error)};}
}
