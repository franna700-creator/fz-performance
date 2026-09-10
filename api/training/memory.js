import { listTrainingMemory, trainingMemorySummary } from '../../lib/training-presentation.js';
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
  try{
    const limit=num(req.query?.limit,20,1,100);
    const feedbackLimit=num(req.query?.feedbackLimit,60,1,200);
    const feedbackDays=num(req.query?.feedbackDays,90,1,365);
    const refresh=['1','true','yes'].includes(String(req.query?.refresh||'').toLowerCase());
    let sync=null;
    if(refresh){
      sync=await syncTrainingRuntime({force:true,days:num(req.query?.days,7,2,30),reason:'api-training-memory'});
    }
    const memory=await listTrainingMemory({limit,feedbackLimit,feedbackDays,includeSuperseded:false});
    return res.status(200).json({
      ok:true,
      generatedAt:new Date().toISOString(),
      source:'fz-training-canonical',
      sync,
      summary:trainingMemorySummary(memory),
      sessions:memory.sessions,
      athleteMemory:memory.athleteMemory,
      feedback:memory.athleteMemory,
      note:'Canonical training execution with derived human identity and canonical Athlete Memory. Raw source identity remains available in provenance; associations may be unlinked or late-linked when evidence arrives after the athlete observation.'
    });
  }catch(error){
    return res.status(503).json({
      ok:false,
      error:'training_memory_unavailable',
      detail:String(error?.message||error),
      sessions:[],
      athleteMemory:[],
      feedback:[]
    });
  }
}
