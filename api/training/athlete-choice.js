import { timingSafeEqual } from 'node:crypto';
import { recordAthleteChoice } from '../../lib/athlete-choice-store.js';
import { SESSION_OPTION_COMPOSER_VERSION } from '../../lib/session-option-composer.js';

const MAX_BODY_BYTES=32*1024;
function secureEqual(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);}
function bearer(req){const header=String(req.headers?.authorization||'');return header.startsWith('Bearer ')?header.slice(7):'';}
function body(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'&&req.body.trim())return JSON.parse(req.body);return null;}
function contract(){return {
  version:'adaptive-choice-v4.4',composerVersion:SESSION_OPTION_COMPOSER_VERSION,
  browserMutationEnabled:false,authenticatedRuntimeMutation:true,
  behavior:{recommendationImmutable:true,athleteChoiceCanonical:true,plannedIntentCanonical:true,executionReconciliation:true,safetyOverrideCannotBeBypassed:true,routineChoiceRequiresDeployment:false}
};}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET')return res.status(200).json({ok:true,writeConfigured:Boolean(process.env.DATABASE_URL||process.env.POSTGRES_URL)&&Boolean(process.env.FZ_STATE_WRITE_TOKEN),contract:contract()});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'method_not_allowed'});}
  const token=process.env.FZ_STATE_WRITE_TOKEN;
  if(!token||!secureEqual(bearer(req),token))return res.status(401).json({ok:false,error:'unauthorized'});
  const declared=Number(req.headers?.['content-length']||0);if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)return res.status(413).json({ok:false,error:'payload_too_large'});
  try{
    const input=body(req);if(!input||typeof input!=='object'||Array.isArray(input))return res.status(400).json({ok:false,error:'invalid_body'});
    if(Buffer.byteLength(JSON.stringify(input),'utf8')>MAX_BODY_BYTES)return res.status(413).json({ok:false,error:'payload_too_large'});
    const result=await recordAthleteChoice(input);return res.status(200).json({ok:true,contract:contract(),choice:result});
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);
    const bad=/^(active_recommendation_|stale_recommendation|invalid_choice|choice_option|safety_override|invalid_selected|invalid_planned)/.test(detail);
    console.error('FZ athlete choice failed',detail);
    return res.status(bad?400:500).json({ok:false,error:bad?'athlete_choice_contract_failure':'athlete_choice_failed',detail});
  }
}
