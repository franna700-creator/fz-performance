import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getSql } from './db.js';
import { FZ_ATHLETE_ID } from './athlete-response-capture.js';

const scryptAsync=promisify(crypto.scrypt);
export const ATHLETE_SESSION_COOKIE='fz_athlete_session';
export const ATHLETE_AUTH_VERSION='4.6.0-auth.1';
export const ATHLETE_SESSION_MAX_AGE_SECONDS=12*60*60;
export const ATHLETE_PIN_PATTERN=/^\d{6,12}$/;
const SCRYPT_PARAMS=Object.freeze({N:32768,r:8,p:1,keylen:64,maxmem:64*1024*1024});
const LOGIN_LOCK_ATTEMPTS=5;
const LOCK_SECONDS=15*60;

function text(value){return String(value??'').trim();}
function sha256(value){return crypto.createHash('sha256').update(String(value??'')).digest('hex');}
function secureEqualBuffer(left,right){
  const a=Buffer.isBuffer(left)?left:Buffer.from(left||'');
  const b=Buffer.isBuffer(right)?right:Buffer.from(right||'');
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}
function nowDate(value=null){const d=value?new Date(value):new Date();if(Number.isNaN(d.getTime()))throw new Error('invalid_auth_time');return d;}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url');}
function cookieMap(req){
  const out={};
  for(const part of String(req?.headers?.cookie||'').split(';')){
    const idx=part.indexOf('=');if(idx<0)continue;
    const key=part.slice(0,idx).trim(),value=part.slice(idx+1).trim();if(key)out[key]=decodeURIComponent(value);
  }
  return out;
}
function retryAfterSeconds(row,now=new Date()){
  const until=row?.locked_until?new Date(row.locked_until):row?.next_attempt_after?new Date(row.next_attempt_after):null;
  return until&&until>now?Math.max(1,Math.ceil((until-now)/1000)):0;
}
function sameOrigin(req){
  const origin=text(req?.headers?.origin);
  if(!origin)return false;
  const host=text(req?.headers?.['x-forwarded-host']||req?.headers?.host);
  const proto=text(req?.headers?.['x-forwarded-proto']||'https').split(',')[0].trim()||'https';
  if(!host)return false;
  try{return new URL(origin).origin===`${proto}://${host}`;}catch{return false;}
}

export function assertSameOrigin(req){if(!sameOrigin(req))throw new Error('athlete_auth_origin_required');}
export function validateAthletePin(pin){if(!ATHLETE_PIN_PATTERN.test(text(pin)))throw new Error('athlete_pin_policy_failure');return text(pin);}
export function bootstrapDigest(proof){return sha256(proof);}
export function sessionTokenFromRequest(req){return cookieMap(req)[ATHLETE_SESSION_COOKIE]||'';}
export function csrfHeader(req){return text(req?.headers?.['x-fz-csrf']);}
export function nonceHeader(req){return text(req?.headers?.['x-fz-idempotency-key']);}

export function athleteSessionCookie(token,{maxAge=ATHLETE_SESSION_MAX_AGE_SECONDS}={}){
  return `${ATHLETE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
export function clearAthleteSessionCookie(){return `${ATHLETE_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;}

export async function hashPinForStorage(pin,{salt=null}={}){
  const value=validateAthletePin(pin);
  const saltBuffer=salt?Buffer.from(salt,'base64url'):crypto.randomBytes(16);
  const derived=await scryptAsync(value,saltBuffer,SCRYPT_PARAMS.keylen,{N:SCRYPT_PARAMS.N,r:SCRYPT_PARAMS.r,p:SCRYPT_PARAMS.p,maxmem:SCRYPT_PARAMS.maxmem});
  return {salt:saltBuffer.toString('base64url'),hash:Buffer.from(derived).toString('base64url'),params:{algorithm:'scrypt',N:SCRYPT_PARAMS.N,r:SCRYPT_PARAMS.r,p:SCRYPT_PARAMS.p,keylen:SCRYPT_PARAMS.keylen}};
}
export async function verifyPinAgainstRecord(pin,record){
  if(!record?.pin_salt||!record?.pin_hash)return false;
  let params={};try{params=typeof record.pin_params==='string'?JSON.parse(record.pin_params):record.pin_params||{};}catch{}
  const n=Number(params.N)||SCRYPT_PARAMS.N,r=Number(params.r)||SCRYPT_PARAMS.r,p=Number(params.p)||SCRYPT_PARAMS.p,keylen=Number(params.keylen)||SCRYPT_PARAMS.keylen;
  if(!ATHLETE_PIN_PATTERN.test(text(pin)))return false;
  const derived=await scryptAsync(text(pin),Buffer.from(record.pin_salt,'base64url'),keylen,{N:n,r,p,maxmem:SCRYPT_PARAMS.maxmem});
  return secureEqualBuffer(Buffer.from(derived),Buffer.from(record.pin_hash,'base64url'));
}

async function credentialRow(sql){
  const rows=await sql`SELECT * FROM fz_athlete_auth_credentials WHERE athlete_id=${FZ_ATHLETE_ID} LIMIT 1`;
  return rows?.[0]||null;
}
export async function athleteAuthConfigured(){const sql=await getSql();return Boolean(await credentialRow(sql));}

async function createSession(sql,credential,{now=new Date()}={}){
  const token=randomToken(32),csrfToken=randomToken(24),sessionHash=sha256(token),csrfHash=sha256(csrfToken);
  const expiresAt=new Date(now.getTime()+ATHLETE_SESSION_MAX_AGE_SECONDS*1000).toISOString();
  await sql`
    INSERT INTO fz_athlete_auth_sessions
      (session_hash,athlete_id,csrf_hash,credential_version,expires_at,last_seen_at)
    VALUES (${sessionHash},${FZ_ATHLETE_ID},${csrfHash},${credential.credential_version},${expiresAt},${now.toISOString()})
  `;
  return {token,csrfToken,expiresAt};
}

export async function establishAthletePin({pin,bootstrapProof,now=null}={}){
  const at=nowDate(now),proof=text(bootstrapProof),expected=text(process.env.FZ_ATHLETE_BOOTSTRAP_TOKEN);
  if(!expected||!proof||!secureEqualBuffer(Buffer.from(proof),Buffer.from(expected)))throw new Error('athlete_bootstrap_invalid');
  const digest=bootstrapDigest(proof),sql=await getSql(),existing=await credentialRow(sql);
  if(existing?.bootstrap_digest===digest)throw new Error('athlete_bootstrap_reused');
  const pinRecord=await hashPinForStorage(pin);
  if(existing){
    const nextVersion=Number(existing.credential_version||0)+1;
    await sql`
      UPDATE fz_athlete_auth_credentials SET
        pin_salt=${pinRecord.salt},pin_hash=${pinRecord.hash},pin_params=${JSON.stringify(pinRecord.params)}::jsonb,
        credential_version=${nextVersion},bootstrap_digest=${digest},failed_attempts=0,next_attempt_after=NULL,locked_until=NULL,updated_at=NOW()
      WHERE athlete_id=${FZ_ATHLETE_ID}
    `;
    await sql`UPDATE fz_athlete_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE athlete_id=${FZ_ATHLETE_ID} AND revoked_at IS NULL`;
  }else{
    await sql`
      INSERT INTO fz_athlete_auth_credentials
        (athlete_id,pin_salt,pin_hash,pin_params,credential_version,bootstrap_digest,failed_attempts)
      VALUES (${FZ_ATHLETE_ID},${pinRecord.salt},${pinRecord.hash},${JSON.stringify(pinRecord.params)}::jsonb,1,${digest},0)
    `;
  }
  const credential=await credentialRow(sql),session=await createSession(sql,credential,{now:at});
  return {configured:true,authenticated:true,credentialVersion:Number(credential.credential_version),...session};
}

export async function loginAthlete({pin,now=null}={}){
  const at=nowDate(now),sql=await getSql(),credential=await credentialRow(sql);
  if(!credential)throw new Error('athlete_login_failed');
  const wait=retryAfterSeconds(credential,at);
  if(wait>0){const error=new Error('athlete_login_failed');error.retryAfter=wait;throw error;}
  const ok=await verifyPinAgainstRecord(pin,credential);
  if(!ok){
    const attempts=Number(credential.failed_attempts||0)+1;
    const backoff=Math.min(60,2**Math.min(attempts,6));
    const lockedUntil=attempts>=LOGIN_LOCK_ATTEMPTS?new Date(at.getTime()+LOCK_SECONDS*1000).toISOString():null;
    const nextAttemptAfter=lockedUntil||new Date(at.getTime()+backoff*1000).toISOString();
    await sql`UPDATE fz_athlete_auth_credentials SET failed_attempts=${attempts},next_attempt_after=${nextAttemptAfter},locked_until=${lockedUntil},updated_at=NOW() WHERE athlete_id=${FZ_ATHLETE_ID}`;
    const error=new Error('athlete_login_failed');error.retryAfter=lockedUntil?LOCK_SECONDS:backoff;throw error;
  }
  await sql`UPDATE fz_athlete_auth_credentials SET failed_attempts=0,next_attempt_after=NULL,locked_until=NULL,updated_at=NOW() WHERE athlete_id=${FZ_ATHLETE_ID}`;
  const fresh=await credentialRow(sql),session=await createSession(sql,fresh,{now:at});
  return {configured:true,authenticated:true,credentialVersion:Number(fresh.credential_version),...session};
}

async function validSession(sql,token,{now=new Date()}={}){
  if(!token)return null;
  const rows=await sql`
    SELECT s.*,c.credential_version AS current_credential_version
    FROM fz_athlete_auth_sessions s
    JOIN fz_athlete_auth_credentials c ON c.athlete_id=s.athlete_id
    WHERE s.session_hash=${sha256(token)} AND s.athlete_id=${FZ_ATHLETE_ID}
      AND s.revoked_at IS NULL AND s.expires_at>${now.toISOString()}
    LIMIT 1
  `;
  const row=rows?.[0]||null;
  if(!row||Number(row.credential_version)!==Number(row.current_credential_version))return null;
  return row;
}

export async function athleteAuthStatus(req,{rotateCsrf=true,now=null}={}){
  const at=nowDate(now),sql=await getSql(),credential=await credentialRow(sql),token=sessionTokenFromRequest(req),session=await validSession(sql,token,{now:at});
  if(!session)return {configured:Boolean(credential),authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null,authVersion:ATHLETE_AUTH_VERSION};
  let csrfToken=null;
  if(rotateCsrf){csrfToken=randomToken(24);await sql`UPDATE fz_athlete_auth_sessions SET csrf_hash=${sha256(csrfToken)},last_seen_at=${at.toISOString()} WHERE session_hash=${session.session_hash}`;}
  return {configured:true,authenticated:true,mode:'ATHLETE',csrfToken,expiresAt:new Date(session.expires_at).toISOString(),authVersion:ATHLETE_AUTH_VERSION};
}

export async function requireAthleteSession(req,{csrf=true,consumeNonce=false,now=null}={}){
  const at=nowDate(now),sql=await getSql(),token=sessionTokenFromRequest(req),session=await validSession(sql,token,{now:at});
  if(!session)throw new Error('athlete_session_required');
  if(csrf){const supplied=csrfHeader(req);if(!supplied||!secureEqualBuffer(Buffer.from(sha256(supplied)),Buffer.from(session.csrf_hash)))throw new Error('athlete_csrf_invalid');}
  if(consumeNonce){
    const nonce=nonceHeader(req);if(!nonce||nonce.length<16||nonce.length>200)throw new Error('athlete_nonce_required');
    try{await sql`INSERT INTO fz_athlete_auth_nonces (nonce_hash,session_hash) VALUES (${sha256(nonce)},${session.session_hash})`;}
    catch(error){if(/unique|duplicate/i.test(String(error?.message||error)))throw new Error('athlete_replay_detected');throw error;}
  }
  await sql`UPDATE fz_athlete_auth_sessions SET last_seen_at=${at.toISOString()} WHERE session_hash=${session.session_hash}`;
  return session;
}

export async function logoutAthlete(req){
  const token=sessionTokenFromRequest(req);if(!token)return;
  const sql=await getSql();await sql`UPDATE fz_athlete_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE session_hash=${sha256(token)} AND athlete_id=${FZ_ATHLETE_ID}`;
}

export function publicAuthFailure(error){
  const detail=String(error?.message||error||'');
  if(detail==='athlete_pin_policy_failure')return {status:400,error:'pin_policy_failure',detail:'Choose a PIN containing 6–12 digits.'};
  if(detail==='athlete_bootstrap_invalid'||detail==='athlete_bootstrap_reused')return {status:401,error:'setup_proof_invalid',detail:'The one-time setup/recovery proof is invalid or has already been used.'};
  if(detail==='athlete_login_failed')return {status:error?.retryAfter?429:401,error:'login_failed',detail:'Unable to authenticate Athlete Mode.',retryAfter:error?.retryAfter||null};
  if(detail==='athlete_session_required')return {status:401,error:'athlete_session_required',detail:'Athlete Mode authentication is required.'};
  if(detail==='athlete_csrf_invalid'||detail==='athlete_nonce_required'||detail==='athlete_replay_detected'||detail==='athlete_auth_origin_required')return {status:403,error:'athlete_write_rejected',detail:'The authenticated write could not be verified.'};
  return null;
}
