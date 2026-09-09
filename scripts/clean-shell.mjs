import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
const htmlPath=path.join(dist,'index.html');
const cssPath=path.join(dist,'assets','app.css');
const cleanJs=path.join(root,'src','app-clean.js');
const cleanCss=path.join(root,'src','clean.css');
if(!fs.existsSync(htmlPath)||!fs.existsSync(cssPath)||!fs.existsSync(cleanJs)||!fs.existsSync(cleanCss))throw new Error('Clean shell inputs missing');

let html=fs.readFileSync(htmlPath,'utf8');
const start=html.indexOf('<section class="page active" id="today">');
const end=html.indexOf('</main></div>',start);
if(start<0||end<0)throw new Error('Unable to locate legacy page block');
const pages=`<section class="page active" id="today"><div class="fz-clean-loading">Loading current athlete state…</div></section>
<section class="page" id="trends"><div class="fz-clean-loading">Loading canonical longitudinal data…</div></section>
<section class="page" id="train"><div class="fz-clean-loading">Loading Training Memory and Athlete Memory…</div></section>
<section class="page" id="system"><div class="fz-clean-loading">Loading system truth and provenance…</div></section>
`;
html=html.slice(0,start)+pages+html.slice(end);
html=html
  .replace(/<meta content="[^"]+" name="fz-build"\/>/, '<meta content="2026-09-09-consolidation-v1" name="fz-build"/>')
  .replace('<link href="/assets/app.css" rel="stylesheet"/>','<link href="/assets/app.css" rel="stylesheet"/><link href="/assets/clean.css" rel="stylesheet"/>')
  .replace(/<div class="subtitle">[\s\S]*?<\/div><\/div><div class="fresh">/, '<div class="subtitle">Current state → longitudinal change → execution memory → provenance. Each page has one job; canonical data is rendered at runtime.</div></div><div class="fresh">')
  .replace(/<div class="side-note">[\s\S]*?<\/div><\/aside>/, '<div class="side-note">Canonical runtime · Neon operational truth · Drive audit copy.</div></aside>')
  .replace('Scheduled refreshes · 06:00 / 13:00 / 20:00 SAST','Scheduled intelligence state · 06:00 / 20:00 SAST')
  .replace('Scheduled refreshes · 06:00 / 20:00 SAST','Scheduled intelligence state · 06:00 / 20:00 SAST')
  .replace('<script src="/assets/app.js" type="module"></script>','<script src="/assets/app-clean.js" type="module"></script>');
if(html.includes('STRONG SYSTEMIC REBOUND')||html.includes('Matched Run AET · Power/HR')||html.includes('Google Drive master</b><span class="pill">CANONICAL'))throw new Error('Stale athlete-state content remains in static shell');
if(html.includes('06:00 / 13:00 / 20:00'))throw new Error('Stale three-slot cadence remains in clean shell');
if(!html.includes('/assets/app-clean.js')||!html.includes('/assets/clean.css'))throw new Error('Clean runtime assets not wired');
fs.writeFileSync(htmlPath,html);
fs.copyFileSync(cleanJs,path.join(dist,'assets','app-clean.js'));
fs.copyFileSync(cleanCss,path.join(dist,'assets','clean.css'));
console.log('PASS clean shell: neutral static HTML + runtime-owned TODAY/TRENDS/TRAIN/SYSTEM');
