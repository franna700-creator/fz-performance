import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const ROOT=process.cwd();
const PAYLOAD=path.join(ROOT,'release-payload');
const DIST=path.join(ROOT,'dist');
const PREFIX='fz-performance-v05/';

function extractZip(buf){
  const out=new Map();
  let o=0;
  while(o+4<=buf.length && buf.readUInt32LE(o)===0x04034b50){
    const flags=buf.readUInt16LE(o+6),method=buf.readUInt16LE(o+8),csize=buf.readUInt32LE(o+18),usize=buf.readUInt32LE(o+22),nlen=buf.readUInt16LE(o+26),elen=buf.readUInt16LE(o+28);
    if(flags & 0x08) throw new Error('ZIP data descriptors are unsupported');
    const name=buf.subarray(o+30,o+30+nlen).toString('utf8');
    const start=o+30+nlen+elen,end=start+csize;
    const compressed=buf.subarray(start,end);
    let data;
    if(method===0) data=Buffer.from(compressed);
    else if(method===8) data=inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP method ${method} for ${name}`);
    if(data.length!==usize) throw new Error(`ZIP size mismatch for ${name}`);
    if(!name.endsWith('/')) out.set(name,data);
    o=end;
  }
  return out;
}
function sha(b){return createHash('sha256').update(b).digest('hex')}
function write(rel,data){const p=path.join(DIST,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data)}

const parts=fs.readdirSync(PAYLOAD).filter(f=>/^[0-9]+\.b64$/.test(f)).sort();
if(parts.length!==6) throw new Error(`Expected 6 release payload parts; found ${parts.length}`);
const zipped=Buffer.from(parts.map(f=>fs.readFileSync(path.join(PAYLOAD,f),'utf8').trim()).join(''),'base64');
const files=extractZip(zipped);
fs.rmSync(DIST,{recursive:true,force:true});fs.mkdirSync(DIST,{recursive:true});
for(const rel of ['index.html','assets/app.css','assets/app.js','manifest.webmanifest','icon.svg']){
  const data=files.get(PREFIX+rel);if(!data)throw new Error(`Payload missing ${rel}`);write(rel,data);
}
let html=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
html=html.replace('<!doctype html>\n<!DOCTYPE html>\n','<!doctype html>\n')
  .replace('<link href="/assets/app.css" rel="stylesheet"/><link href="/manifest.webmanifest" rel="manifest"/>','<link href="/assets/app.css" rel="stylesheet"/>')
  .replace('06:00 master-first rebuild · 06:00 / 13:00 / 20:00 hourly reconciled refreshes.','06:00 master-first rebuild · state refreshes 06:00 / 13:00 / 20:00 SAST.')
  .replace('Locked v0.3 interaction model · v0.4 content-parity state','v0.5 reliability architecture · state-only publication')
  .replace('Hourly delta reconcile → reinterpret → PWA refresh','State-only delta reconcile → reinterpret → publish')
  .replace('Locked v0.3 + v0.4 content parity','v0.5 reliability shell')
  .replace('<h3>FULL PRODUCTION REBUILD · 07 SEP 07:11 SAST</h3><p>Built from the latest complete v0.4 archive shell and the current 7 Sep reconciled PWA State. TRAIN and SYSTEM are direct top-level pages, not nested inside TRENDS. TODAY/TRENDS responsive layout rules are normalized and the refresh countdown uses a stable <strong>hh:mm:ss</strong> display.</p>',
    '<h3>v0.5 RELIABILITY ARCHITECTURE</h3><p>Direct static shell, same-origin runtime-state gateway, fail-stale recovery and graph scrubbing. Routine 06:00 / 13:00 / 20:00 refreshes publish validated state only; product or platform changes use a gated release.</p>')
  .replace('FZ Performance PWA · full content-parity production build · canonical master → validated PWA State → complete four-page PWA · TODAY / TRENDS / TRAIN / SYSTEM · motion for comprehension only · reduced-motion aware.',
    'FZ Performance PWA · v0.5 reliability shell · canonical master → validated runtime state → TODAY / TRENDS / TRAIN / SYSTEM · graph scrubbing · fail-stale recovery · reduced-motion aware.');
if(/hourly reconciled refresh|07:00–22:00|FULL PRODUCTION REBUILD · 07 SEP 07:11/.test(html)) throw new Error('Legacy refresh/product copy remains');
fs.writeFileSync(path.join(DIST,'index.html'),html);

const expected={
  'index.html':'cd5e9667b4e4c3007b335dea0911864830c845ddb2a9f5430b4103dc50a69f73',
  'assets/app.css':'4c220f646f1e120745189488e322e54e8d92e884ef27506ab028851cadb9105e',
  'assets/app.js':'cde72b4337c89eb3089c7ad8f80febba8809d4e42463b3b85acb88c3057b4e21'
};
for(const [rel,want] of Object.entries(expected)){const got=sha(fs.readFileSync(path.join(DIST,rel)));if(got!==want)throw new Error(`Release hash mismatch for ${rel}: ${got}`)}
console.log(JSON.stringify({ok:true,payloadParts:parts.length,files:[...files.keys()].length,hashes:expected},null,2));
