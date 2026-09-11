import { buildAdaptiveContext } from './adaptive-context-v44.js';
import { evaluateRecommendation, RECOMMENDATION_ENGINE_MODE, RECOMMENDATION_ENGINE_VERSION } from './recommendation-engine.js';
import { persistRecommendationShadow } from './recommendation-shadow-store.js';

export async function recomputeRecommendationShadow({trigger={},materiality=null,now=new Date(),persist=true}={}){
  const context=await buildAdaptiveContext({now,materialityOverride:materiality,trigger});
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
