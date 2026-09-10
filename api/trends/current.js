import { getCurrentTrends } from '../../lib/trends-dynamic.js';

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'method_not_allowed'});
  }
  try{
    const trends=await getCurrentTrends();
    if(!trends){
      return res.status(503).json({ok:false,error:'trends_unavailable'});
    }
    return res.status(200).json({
      ok:true,
      generatedAt:new Date().toISOString(),
      source:'fz-trends-dynamic-canonical',
      ...trends
    });
  }catch(error){
    return res.status(503).json({
      ok:false,
      error:'trends_unavailable',
      detail:String(error?.message||error)
    });
  }
}
