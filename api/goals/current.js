import { buildAdaptiveContext } from '../../lib/adaptive-context-v44.js';

function sortRunway(a,b){
  const ar=Number.isFinite(Number(a?.runwayDays))?Number(a.runwayDays):Number.POSITIVE_INFINITY;
  const br=Number.isFinite(Number(b?.runwayDays))?Number(b.runwayDays):Number.POSITIVE_INFINITY;
  return ar-br||String(a?.name||'').localeCompare(String(b?.name||''));
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  try{
    const context=await buildAdaptiveContext({now:new Date()});
    const measurement=context?.measurement||{};
    return res.status(200).json({
      ok:true,
      generatedAt:new Date().toISOString(),
      contract:'CANONICAL_GOALS_PROGRESS_V1',
      objective:{
        primary:context?.primaryObjective||null,
        relatedEvents:[...(context?.eventPressure||[])].sort(sortRunway)
      },
      progress:{
        measurement:{
          status:measurement.status||'UNAVAILABLE',
          hierarchyId:measurement.hierarchyId||null,
          measured:measurement.measured||[],
          topGaps:measurement.topGaps||[]
        },
        evidence:context?.evidence||[],
        uncertainty:context?.uncertainty||{missing:[],assumptions:[],confidence:'LOW'}
      },
      provenance:context?.provenance||{},
      rules:{
        ...(context?.rules||{}),
        noFabricatedProgressPercentages:true,
        unknownMeasurementIsNotWeakness:true,
        directionalOverlapIsNotTrainingValue:true,
        primaryObjectiveCannotBeDisplacedByProximity:true
      }
    });
  }catch(error){
    console.error('FZ goals current failed',error instanceof Error?error.message:String(error));
    return res.status(503).json({
      ok:false,
      error:'goals_current_unavailable',
      detail:error instanceof Error?error.message:String(error)
    });
  }
}
