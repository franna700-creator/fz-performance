import { timingSafeEqual } from 'node:crypto';
import { MEMORY_CATEGORIES, ATHLETE_EVENT_TYPES } from '../../lib/athlete-memory-ingest.js';
import {
  recordExerciseAthleteResponse,
  EXERCISE_PROJECT_SCOPE,
  FZ_ATHLETE_ID,
  SPEAKER_RESOLUTIONS
} from '../../lib/athlete-response-capture.js';
import { recordAthleteChoice } from '../../lib/athlete-choice-store.js';
import { SESSION_OPTION_COMPOSER_VERSION } from '../../lib/session-option-composer.js';
import { MATERIALITY_ENGINE_VERSION, MATERIALITY_LEVELS } from '../../lib/materiality-engine.js';

const MAX_BODY_BYTES=64*1024;
function secureEqual(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);}
function bearerToken(req){const header=String(req.headers?.authorization||'');return header.startsWith('Bearer ')?header.slice(7):'';}
function parseBody(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);return null;}
function contract(){return {
  version:'exercise-athlete-response-v3.2+materiality-v4.1+choice-v4.4',projectScope:EXERCISE_PROJECT_SCOPE,athleteId:FZ_ATHLETE_ID,
  speakerResolutions:SPEAKER_RESOLUTIONS,memoryCategories:MEMORY_CATEGORIES,eventTypes:ATHLETE_EVENT_TYPES,
  materialityEngineVersion:MATERIALITY_ENGINE_VERSION,materialityLevels:MATERIALITY_LEVELS,sessionOptionComposerVersion:SESSION_OPTION_COMPOSER_VERSION,
  acceptedKinds:['ATHLETE_RESPONSE','ADAPTIVE_CHOICE'],requiredCaptureFields:['projectScope','athleteId','speakerResolution'],
  behavior:{chatIsPrimaryInput:true,projectWideAcrossChats:true,interpretedSummaryPrimary:true,rawTextRetainedAsProvenanceWhenAvailable:true,preservesReportedAt:true,preservesOccurredAt:true,supportsOccurrencePrecision:true,supportsStandaloneContext:true,linksWhenConfident:true,ambiguousSpeakerRequiresConfirmation:true,idempotentEventKey:true,evaluatesMaterialitySameTurn:true,propagatesCanonicalDependenciesSameTurn:true,materialityCanRecomputeRecommendation:true,activeRecommendationCanProjectWithoutDeployment:true,adaptiveChoiceCanonical:true,plannedIntentCanonical:true,executionReconciliation:true,browserMutationEnabled:false,authenticatedRuntimeMutation:true,routineAthleteStateRequiresDeployment:false}
};}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET')return res.status(200).json({ok:true,writeConfigured:Boolean(process.env.DATABASE_URL||process.env.POSTGRES_URL)&&Boolean(process.env.FZ_STATE_WRITE_TOKEN),contract:contract()});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'method_not_allowed'});}
  const expectedToken=process.env.FZ_STATE_WRITE_TOKEN;if(!expectedToken||!secureEqual(bearerToken(req),expectedToken))return res.status(401).json({ok:false,error:'unauthorized'});
  const declaredLength=Number(req.headers?.['content-length']||0);if(Number.isFinite(declaredLength)&&declaredLength>MAX_BODY_BYTES)return res.status(413).json({ok:false,error:'payload_too_large'});
  try{
    const body=parseBody(req);if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({ok:false,error:'invalid_body'});
    if(Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_BODY_BYTES)return res.status(413).json({ok:false,error:'payload_too_large'});
    const kind=String(body.kind||'ATHLETE_RESPONSE').toUpperCase();
    if(kind==='ADAPTIVE_CHOICE'){
      const choice=await recordAthleteChoice(body.choice&&typeof body.choice==='object'?body.choice:body);
      return res.status(200).json({ok:true,contract:contract(),choice});
    }
    if(kind!=='ATHLETE_RESPONSE')return res.status(400).json({ok:false,error:'unsupported_athlete_event_kind'});
    const memory=await recordExerciseAthleteResponse(body);return res.status(200).json({ok:true,contract:contract(),memory});
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);
    const badInput=/^(summary_required|summary_too_long|raw_text_too_long|invalid_|unknown_session|unknown_source_record|memory_category|required|invalid_event_type|exercise_project_scope_required|francois_speaker_required|speaker_resolution_required|materiality_|active_recommendation_|stale_recommendation|choice_option|safety_override)/.test(detail);
    console.error('FZ athlete event ingest failed',detail);
    return res.status(badInput?400:500).json({ok:false,error:badInput?'athlete_event_contract_failure':'athlete_event_ingest_failed',detail});
  }
}
