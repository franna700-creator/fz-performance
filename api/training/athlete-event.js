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
import { SESSION_PRESCRIPTION_COMPOSER_VERSION } from '../../lib/session-prescription-resolver.js';
import { MATERIALITY_ENGINE_VERSION, MATERIALITY_LEVELS } from '../../lib/materiality-engine.js';
import {
  ATHLETE_AUTH_VERSION,
  athleteAuthStatus,
  athleteSessionCookie,
  clearAthleteSessionCookie,
  establishAthletePin,
  loginAthlete,
  logoutAthlete,
  requireAthleteSession,
  assertSameOrigin,
  publicAuthFailure
} from '../../lib/athlete-auth.js';

const MAX_BODY_BYTES=64*1024;
function secureEqual(left,right){const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);}
function bearerToken(req){const header=String(req.headers?.authorization||'');return header.startsWith('Bearer ')?header.slice(7):'';}
function validRuntimeBearer(req){const expected=process.env.FZ_STATE_WRITE_TOKEN;return Boolean(expected&&secureEqual(bearerToken(req),expected));}
function parseBody(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string')return JSON.parse(req.body);return null;}
function contract(){return {
  version:'exercise-athlete-response-v3.2+materiality-v4.1+choice-v4.6+athlete-auth-v4.6',projectScope:EXERCISE_PROJECT_SCOPE,athleteId:FZ_ATHLETE_ID,
  speakerResolutions:SPEAKER_RESOLUTIONS,memoryCategories:MEMORY_CATEGORIES,eventTypes:ATHLETE_EVENT_TYPES,
  materialityEngineVersion:MATERIALITY_ENGINE_VERSION,materialityLevels:MATERIALITY_LEVELS,sessionOptionComposerVersion:SESSION_OPTION_COMPOSER_VERSION,
  sessionPrescriptionComposerVersion:SESSION_PRESCRIPTION_COMPOSER_VERSION,athleteAuthVersion:ATHLETE_AUTH_VERSION,
  acceptedKinds:['ATHLETE_RESPONSE','ADAPTIVE_CHOICE','ATHLETE_AUTH'],requiredCaptureFields:['projectScope','athleteId','speakerResolution'],
  behavior:{chatIsPrimaryInput:true,projectWideAcrossChats:true,interpretedSummaryPrimary:true,rawTextRetainedAsProvenanceWhenAvailable:true,preservesReportedAt:true,preservesOccurredAt:true,supportsOccurrencePrecision:true,supportsStandaloneContext:true,linksWhenConfident:true,ambiguousSpeakerRequiresConfirmation:true,idempotentEventKey:true,evaluatesMaterialitySameTurn:true,propagatesCanonicalDependenciesSameTurn:true,materialityCanRecomputeRecommendation:true,activeRecommendationCanProjectWithoutDeployment:true,adaptiveChoiceCanonical:true,plannedIntentCanonical:true,executionReconciliation:true,browserMutationEnabled:true,browserMutationScope:'AUTHENTICATED_ADAPTIVE_CHOICE_ONLY',authenticatedRuntimeMutation:true,athletePinNeverStoredInCanonicalRecords:true,routineAthleteStateRequiresDeployment:false}
};}
function setSecurityHeaders(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
}
function bodySizeGuard(req,body){
  const declaredLength=Number(req.headers?.['content-length']||0);if(Number.isFinite(declaredLength)&&declaredLength>MAX_BODY_BYTES)throw new Error('payload_too_large');
  if(Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_BODY_BYTES)throw new Error('payload_too_large');
}
async function handleAthleteAuth(req,res,body){
  assertSameOrigin(req);
  const action=String(body.action||'').toUpperCase();
  if(action==='SETUP'||action==='RESET'){
    const session=await establishAthletePin({pin:body.pin,bootstrapProof:body.bootstrapProof});
    res.setHeader('Set-Cookie',athleteSessionCookie(session.token));
    return res.status(200).json({ok:true,auth:{configured:true,authenticated:true,mode:'ATHLETE',csrfToken:session.csrfToken,expiresAt:session.expiresAt,authVersion:ATHLETE_AUTH_VERSION}});
  }
  if(action==='LOGIN'){
    const session=await loginAthlete({pin:body.pin});
    res.setHeader('Set-Cookie',athleteSessionCookie(session.token));
    return res.status(200).json({ok:true,auth:{configured:true,authenticated:true,mode:'ATHLETE',csrfToken:session.csrfToken,expiresAt:session.expiresAt,authVersion:ATHLETE_AUTH_VERSION}});
  }
  if(action==='LOGOUT'){
    await requireAthleteSession(req,{csrf:true,consumeNonce:false});
    await logoutAthlete(req);
    res.setHeader('Set-Cookie',clearAthleteSessionCookie());
    return res.status(200).json({ok:true,auth:{configured:true,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null,authVersion:ATHLETE_AUTH_VERSION}});
  }
  return res.status(400).json({ok:false,error:'unsupported_athlete_auth_action'});
}

export default async function handler(req,res){
  setSecurityHeaders(res);
  if(req.method==='GET'){
    const operation=String(req.query?.operation||'').toLowerCase();
    if(operation==='athlete-auth-status'){
      try{return res.status(200).json({ok:true,auth:await athleteAuthStatus(req,{rotateCsrf:true})});}
      catch(error){console.error('FZ athlete auth status failed',String(error?.message||error));return res.status(503).json({ok:false,error:'athlete_auth_unavailable'});}
    }
    return res.status(200).json({ok:true,writeConfigured:Boolean(process.env.DATABASE_URL||process.env.POSTGRES_URL)&&Boolean(process.env.FZ_STATE_WRITE_TOKEN),athleteAuthConfigured:Boolean(process.env.DATABASE_URL||process.env.POSTGRES_URL)&&Boolean(process.env.FZ_ATHLETE_BOOTSTRAP_TOKEN),contract:contract()});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'method_not_allowed'});}
  try{
    const body=parseBody(req);if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({ok:false,error:'invalid_body'});
    bodySizeGuard(req,body);
    const kind=String(body.kind||'ATHLETE_RESPONSE').toUpperCase();
    if(kind==='ATHLETE_AUTH')return handleAthleteAuth(req,res,body);
    const runtimeAuthorized=validRuntimeBearer(req);
    if(kind==='ADAPTIVE_CHOICE'){
      if(!runtimeAuthorized){assertSameOrigin(req);await requireAthleteSession(req,{csrf:true,consumeNonce:true});}
      const choice=await recordAthleteChoice(body.choice&&typeof body.choice==='object'?body.choice:body);
      return res.status(200).json({ok:true,contract:contract(),choice});
    }
    if(kind!=='ATHLETE_RESPONSE')return res.status(400).json({ok:false,error:'unsupported_athlete_event_kind'});
    if(!runtimeAuthorized)return res.status(401).json({ok:false,error:'unauthorized'});
    const memory=await recordExerciseAthleteResponse(body);return res.status(200).json({ok:true,contract:contract(),memory});
  }catch(error){
    if(String(error?.message||error)==='payload_too_large')return res.status(413).json({ok:false,error:'payload_too_large'});
    const authFailure=publicAuthFailure(error);
    if(authFailure){if(authFailure.retryAfter)res.setHeader('Retry-After',String(authFailure.retryAfter));return res.status(authFailure.status).json({ok:false,error:authFailure.error,detail:authFailure.detail});}
    const detail=error instanceof Error?error.message:String(error);
    const badInput=/^(summary_required|summary_too_long|raw_text_too_long|invalid_|unknown_session|unknown_source_record|memory_category|required|invalid_event_type|exercise_project_scope_required|francois_speaker_required|speaker_resolution_required|materiality_|active_recommendation_|stale_recommendation|choice_option|choice_prescription|safety_override|unsupported_athlete_auth_action)/.test(detail);
    console.error('FZ athlete event ingest failed',detail);
    return res.status(badInput?400:500).json({ok:false,error:badInput?'athlete_event_contract_failure':'athlete_event_ingest_failed',detail:badInput?detail:undefined});
  }
}
