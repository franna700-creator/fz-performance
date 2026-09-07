import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const ORIGIN='https://fz-performance-state.vercel.app';
const MANIFEST='/current.json';
const sha256=b=>createHash('sha256').update(b).digest('hex');
function validState(s){return !!(s&&s.masterValidated===true&&s.stateId&&s.pages&&['today','trends','train','system'].every(k=>typeof s.pages[k]==='string')&&s.datasets)}
function validManifest(m){return !!(m&&m.masterValidated===true&&m.stateId&&m.compressedSha256&&Array.isArray(m.chunks)&&m.chunks.length>0&&m.chunks.every(c=>c.path&&Number.isFinite(c.size)&&c.sha256))}
async function fetchNoStore(path){const r=await fetch(ORIGIN+path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('state transport unavailable');return r}

export default async function handler(req,res){
  try{
    const manifest=await (await fetchNoStore(MANIFEST)).json();
    if(!validManifest(manifest))throw new Error('invalid state manifest');
    const parts=await Promise.all(manifest.chunks.map(async c=>{
      const b=Buffer.from(await (await fetchNoStore(c.path)).arrayBuffer());
      if(b.length!==c.size||sha256(b)!==c.sha256)throw new Error('state chunk integrity failure');
      return b;
    }));
    const compressed=Buffer.concat(parts);
    if(sha256(compressed)!==manifest.compressedSha256)throw new Error('state payload checksum failure');
    const state=JSON.parse(gunzipSync(compressed).toString('utf8'));
    if(!validState(state)||state.stateId!==manifest.stateId)throw new Error('state contract mismatch');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('X-FZ-State-Id',state.stateId);
    res.setHeader('X-FZ-State-SHA256',manifest.compressedSha256);
    return res.status(200).json(state);
  }catch(err){
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(503).json({ok:false,error:'runtime_state_unavailable'});
  }
}
