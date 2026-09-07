import { gunzipSync } from 'node:zlib';

const ORIGIN='https://fz-performance-state.vercel.app';
const CHUNKS=['/state-01.bin','/state-02.bin','/state-03.bin','/state-04.bin'];
function valid(s){return !!(s&&s.masterValidated===true&&s.pages&&['today','trends','train','system'].every(k=>typeof s.pages[k]==='string')&&s.datasets)}
export default async function handler(req,res){
  try{
    const parts=await Promise.all(CHUNKS.map(async path=>{const r=await fetch(ORIGIN+path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(path+' '+r.status);return Buffer.from(await r.arrayBuffer())}));
    const state=JSON.parse(gunzipSync(Buffer.concat(parts)).toString('utf8'));
    if(!valid(state))throw new Error('invalid state contract');
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('X-FZ-State-Id',state.stateId||'unknown');
    return res.status(200).json(state);
  }catch(err){
    res.setHeader('Cache-Control','no-store, max-age=0');
    return res.status(503).json({ok:false,error:'runtime_state_unavailable'});
  }
}
