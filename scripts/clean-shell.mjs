import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dist=path.join(root,'dist');
const htmlPath=path.join(dist,'index.html');
const cssPath=path.join(dist,'assets','app.css');
const cleanJs=path.join(root,'src','app-clean.js');
const cleanCss=path.join(root,'src','clean.css');
const liveJs=path.join(root,'src','live-physiology.js');
const liveCss=path.join(root,'src','live-physiology.css');
const trainingSyncJs=path.join(root,'src','training-auto-sync.js');
const trainingSyncCss=path.join(root,'src','training-auto-sync.css');
const systemIntelligenceJs=path.join(root,'src','system-intelligence.js');
const fzDesignCss=path.join(root,'src','fz-design-system.css');
if(!fs.existsSync(htmlPath)||!fs.existsSync(cssPath)||!fs.existsSync(cleanJs)||!fs.existsSync(cleanCss)||!fs.existsSync(liveJs)||!fs.existsSync(liveCss)||!fs.existsSync(trainingSyncJs)||!fs.existsSync(trainingSyncCss)||!fs.existsSync(systemIntelligenceJs)||!fs.existsSync(fzDesignCss))throw new Error('Clean shell inputs missing');

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
  .replace(/<meta content="[^"]+" name="fz-build"\/>/, '<meta content="2026-09-10-v0.7.0-rc7" name="fz-build"/>')
  .replace('<link href="/assets/app.css" rel="stylesheet"/>','<link href="/assets/app.css" rel="stylesheet"/><link href="/assets/clean.css" rel="stylesheet"/><link href="/assets/live-physiology.css" rel="stylesheet"/><link href="/assets/training-auto-sync.css" rel="stylesheet"/><link href="/assets/fz-design-system.css" rel="stylesheet"/>')
  .replace(/<div class="subtitle">[\s\S]*?<\/div><\/div><div class="fresh">/, '<div class="subtitle">Current state → live physiology → training memory → longitudinal change → provenance. Dynamic source data updates without shell deployment.</div></div><div class="fresh">')
  .replace(/<div class="side-note">[\s\S]*?<\/div><\/aside>/, '<div class="side-note">v0.7 dynamic runtime · Neon operational truth · Drive audit copy.</div></aside>')
  .replace('Scheduled refreshes · 06:00 / 13:00 / 20:00 SAST','Scheduled intelligence state · 06:00 / 20:00 SAST')
  .replace('Scheduled refreshes · 06:00 / 20:00 SAST','Scheduled intelligence state · 06:00 / 20:00 SAST')
  .replace('<script src="/assets/app.js" type="module"></script>','<script src="/assets/live-physiology.js" type="module"></script><script src="/assets/system-intelligence.js" type="module"></script><script src="/assets/training-auto-sync.js" type="module"></script><script src="/assets/app-clean.js" type="module"></script>');
if(html.includes('STRONG SYSTEMIC REBOUND')||html.includes('Matched Run AET · Power/HR')||html.includes('Google Drive master</b><span class="pill">CANONICAL'))throw new Error('Stale athlete-state content remains in static shell');
if(html.includes('06:00 / 13:00 / 20:00'))throw new Error('Stale three-slot cadence remains in clean shell');
for(const asset of ['/assets/app-clean.js','/assets/clean.css','/assets/live-physiology.js','/assets/live-physiology.css','/assets/training-auto-sync.js','/assets/training-auto-sync.css','/assets/system-intelligence.js','/assets/fz-design-system.css']) if(!html.includes(asset))throw new Error(`Clean runtime asset not wired: ${asset}`);
if(html.indexOf('/assets/live-physiology.js')>html.indexOf('/assets/app-clean.js'))throw new Error('Live Physiology fetch interceptor must load before app-clean');
if(html.indexOf('/assets/system-intelligence.js')>html.indexOf('/assets/app-clean.js'))throw new Error('System intelligence interceptor must load before app-clean');
if(html.indexOf('/assets/training-auto-sync.js')>html.indexOf('/assets/app-clean.js'))throw new Error('Training auto-sync controller must load before app-clean');
fs.writeFileSync(htmlPath,html);
fs.copyFileSync(cleanJs,path.join(dist,'assets','app-clean.js'));fs.copyFileSync(cleanCss,path.join(dist,'assets','clean.css'));fs.copyFileSync(liveJs,path.join(dist,'assets','live-physiology.js'));fs.copyFileSync(liveCss,path.join(dist,'assets','live-physiology.css'));fs.copyFileSync(trainingSyncJs,path.join(dist,'assets','training-auto-sync.js'));fs.copyFileSync(trainingSyncCss,path.join(dist,'assets','training-auto-sync.css'));fs.copyFileSync(systemIntelligenceJs,path.join(dist,'assets','system-intelligence.js'));fs.copyFileSync(fzDesignCss,path.join(dist,'assets','fz-design-system.css'));
console.log('PASS clean shell v0.7.0-rc7: dynamic physiology + training + 4.1 observability + runtime-owned TODAY/TRENDS/TRAIN/SYSTEM');
