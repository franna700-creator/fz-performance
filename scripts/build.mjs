import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT=process.cwd(), PAYLOAD=path.join(ROOT,'release-payload'), DIST=path.join(ROOT,'dist'), TMP=path.join(ROOT,'.release-unpack'), PREFIX=path.join(TMP,'fz-performance-v05');
const parts=fs.readdirSync(PAYLOAD).filter(f=>/^[0-9]+\.b64$/.test(f)).sort();
if(parts.length!==6) throw new Error(`Expected 6 release payload parts; found ${parts.length}`);
const zip=Buffer.from(parts.map(f=>fs.readFileSync(path.join(PAYLOAD,f),'utf8').trim()).join(''),'base64');
fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(TMP,{recursive:true});
const zipPath=path.join(TMP,'release.zip'); fs.writeFileSync(zipPath,zip);
execFileSync('tar',['-tf',zipPath],{stdio:'ignore'});
execFileSync('unzip',['-q',zipPath,'-d',TMP],{stdio:'inherit'});
fs.rmSync(DIST,{recursive:true,force:true}); fs.mkdirSync(path.join(DIST,'assets'),{recursive:true});
for(const rel of ['index.html','assets/app.css','assets/app.js','manifest.webmanifest','icon.svg']){
  const src=path.join(PREFIX,rel), dst=path.join(DIST,rel); if(!fs.existsSync(src)) throw new Error(`Payload missing ${rel}`); fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(src,dst);
}
let html=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
html=html.replace('<!doctype html>\n<!DOCTYPE html>\n','<!doctype html>\n')
 .replace('<link href="/assets/app.css" rel="stylesheet"/><link href="/manifest.webmanifest" rel="manifest"/>','<link href="/assets/app.css" rel="stylesheet"/>')
 .replace('06:00 master-first rebuild · 06:00 / 13:00 / 20:00 hourly reconciled refreshes.','06:00 master-first rebuild · state refreshes 06:00 / 13:00 / 20:00 SAST.')
 .replace('Locked v0.3 interaction model · v0.4 content-parity state','v0.5 reliability architecture · state-only publication')
 .replace('Hourly delta reconcile → reinterpret → PWA refresh','State-only delta reconcile → reinterpret → publish')
 .replace('Locked v0.3 + v0.4 content parity','v0.5 reliability shell')
 .replace('<h3>FULL PRODUCTION REBUILD · 07 SEP 07:11 SAST</h3><p>Built from the latest complete v0.4 archive shell and the current 7 Sep reconciled PWA State. TRAIN and SYSTEM are direct top-level pages, not nested inside TRENDS. TODAY/TRENDS responsive layout rules are normalized and the refresh countdown uses a stable <strong>hh:mm:ss</strong> display.</p>','<h3>v0.5 RELIABILITY ARCHITECTURE</h3><p>Direct static shell, same-origin runtime-state gateway, fail-stale recovery and graph scrubbing. Routine 06:00 / 13:00 / 20:00 refreshes publish validated state only; product or platform changes use a gated release.</p>')
 .replace('FZ Performance PWA · full content-parity production build · canonical master → validated PWA State → complete four-page PWA · TODAY / TRENDS / TRAIN / SYSTEM · motion for comprehension only · reduced-motion aware.','FZ Performance PWA · v0.5 reliability shell · canonical master → validated runtime state → TODAY / TRENDS / TRAIN / SYSTEM · graph scrubbing · fail-stale recovery · reduced-motion aware.');
if(/hourly reconciled refresh|07:00–22:00|FULL PRODUCTION REBUILD · 07 SEP 07:11/.test(html)) throw new Error('Legacy refresh/product copy remains');
fs.writeFileSync(path.join(DIST,'index.html'),html);

// v0.5.1 interaction hardening: Pointer Events + explicit Touch Events + tap/click fallbacks.
// `touch-action: pan-y` remains in CSS, so vertical scrolling is preserved while chart taps/scrubs can select observations.
let app=fs.readFileSync(path.join(DIST,'assets/app.js'),'utf8');
const helperAnchor="function addSvgEl(svg,name,attrs){";
if(!app.includes(helperAnchor)) throw new Error('Touch patch helper anchor missing');
app=app.replace(helperAnchor,`function touchEventPoint(ev){const t=ev.touches?.[0]||ev.changedTouches?.[0];return t?{clientX:t.clientX,clientY:t.clientY,pointerType:'touch'}:null}\n`+helperAnchor);
const indexAnchor="container.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch')container.setPointerCapture?.(ev.pointerId);move(ev)});container.addEventListener('pointerleave'";
const indexReplacement="container.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch')container.setPointerCapture?.(ev.pointerId);move(ev)});container.addEventListener('pointerup',move);container.addEventListener('click',move);container.addEventListener('touchstart',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchmove',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchend',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('pointerleave'";
if(!app.includes(indexAnchor)) throw new Error('Index scrub touch patch anchor missing');
app=app.replace(indexAnchor,indexReplacement);
const scatterAnchor="container.addEventListener('pointerdown',move);container.addEventListener('pointerleave'";
const scatterReplacement="container.addEventListener('pointerdown',move);container.addEventListener('pointerup',move);container.addEventListener('click',move);container.addEventListener('touchstart',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchmove',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchend',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('pointerleave'";
if(!app.includes(scatterAnchor)) throw new Error('Scatter scrub touch patch anchor missing');
app=app.replace(scatterAnchor,scatterReplacement);
fs.writeFileSync(path.join(DIST,'assets/app.js'),app);

const expected={'index.html':'cd5e9667b4e4c3007b335dea0911864830c845ddb2a9f5430b4103dc50a69f73','assets/app.css':'4c220f646f1e120745189488e322e54e8d92e884ef27506ab028851cadb9105e','assets/app.js':'__PIN_AFTER_VALID_BUILD__'};
for(const [rel,want] of Object.entries(expected)){const got=createHash('sha256').update(fs.readFileSync(path.join(DIST,rel))).digest('hex'); if(got!==want) throw new Error(`Release hash mismatch for ${rel}: ${got}`); console.log(`PASS hash ${rel} ${got}`)}
fs.rmSync(TMP,{recursive:true,force:true});
console.log('FZ v0.5.1 deterministic release build complete');
