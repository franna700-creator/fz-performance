import { getTrainingDay } from '../../lib/training-presentation.js';
import { syncTrainingRuntime } from '../../lib/training-sync-runtime.js';

function num(value, fallback, min, max) {
  const parsed=Number(value);
  if(!Number.isFinite(parsed)) return fallback;
  return Math.max(min,Math.min(max,Math.trunc(parsed)));
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'method_not_allowed'});
  }
  const requestedDate=req.query?.date ? String(req.query.date) : null;
  const refresh=['1','true','yes'].includes(String(req.query?.refresh||'').toLowerCase());
  try{
    let sync=null;
    if(refresh){
      sync=await syncTrainingRuntime({force:true,days:num(req.query?.days,5,2,14),reason:'api-training-today'});
    }
    const day=await getTrainingDay(requestedDate);
    if(!day) return res.status(404).json({ok:false,error:'training_day_not_found',date:requestedDate});
    return res.status(200).json({
      ok:true,
      generatedAt:new Date().toISOString(),
      source:'fz-training-canonical',
      sync,
      ...day
    });
  }catch(error){
    return res.status(503).json({
      ok:false,
      error:'training_today_unavailable',
      detail:String(error?.message||error),
      date:requestedDate,
      sessions:[],
      athleteMemory:[],
      feedback:[]
    });
  }
}
