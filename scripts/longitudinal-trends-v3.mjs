import fs from 'node:fs';
import { createHash } from 'node:crypto';

const appPath='dist/assets/app.js';
const cssPath='dist/assets/app.css';
if(!fs.existsSync(appPath)||!fs.existsSync(cssPath)) throw new Error('Run v2 before longitudinal-trends-v3.mjs');
let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
if(!app.includes('function fzLongStateTable(d)')) throw new Error('Filtered v2 longitudinal layer missing');

const patch=String.raw`
/* FZ v0.6 longitudinal TRENDS hierarchy v3 — visual + scrubbed wellness state */
const FZ_WELLNESS_HISTORY=[
 ['17 Aug',63,59,7.88,81,73,31,12611,null,null,'HISTORICAL'],
 ['18 Aug',60,61,6.95,80,69,25,5354,null,null,'HISTORICAL'],
 ['19 Aug',74,55,8.60,92,100,26,13203,850,null,'HISTORICAL'],
 ['20 Aug',63,60,6.35,74,80,32,11745,849,null,'HISTORICAL'],
 ['21 Aug',56,60,5.87,67,58,32,19702,680,null,'HISTORICAL'],
 ['22 Aug',57,63,5.63,63,55,38,9022,560,null,'HISTORICAL'],
 ['23 Aug',null,null,null,null,null,null,null,null,null,'LEGACY GAP'],
 ['24 Aug',67,56,7.53,87,83,25,11947,552,null,'HISTORICAL'],
 ['25 Aug',74,57,7.07,85,88,29,13466,732,null,'HISTORICAL'],
 ['26 Aug',58,59,6.52,75,70,30,14014,670,82,'HISTORICAL'],
 ['27 Aug',68,57,7.59,80,87,30,7090,754,null,'HISTORICAL'],
 ['28 Aug',61,57,6.48,76,75,29,10296,633,null,'HISTORICAL'],
 ['29 Aug',57,58,7.40,70,76,37,25827,1579,null,'HISTORICAL'],
 ['30 Aug',66,57,7.40,81,88,28,18717,878,null,'HISTORICAL'],
 ['31 Aug',64,57,6.70,81,81,22,13036,782,null,'HISTORICAL'],
 ['01 Sep',63,57,6.80,78,89,25,10482,609,null,'HISTORICAL'],
 ['02 Sep',70,57,6.18,80,87,23,5225,638,null,'HISTORICAL'],
 ['03 Sep',66,55,6.87,82,89,25,7920,495,null,'HISTORICAL'],
 ['04 Sep',75,56,7.17,91,98,22,5479,74,null,'HISTORICAL'],
 ['05 Sep',63,57,7.32,62,88,23,10760,477,null,'HISTORICAL'],
 ['06 Sep',33,58,4.73,31,35,44,9073,450,null,'HISTORICAL'],
 ['07 Sep',81,54,7.78,92,94,null,null,null,82,'LIVE / PARTIAL']
];
const FZ_WELLNESS_METRICS={
 hrv:{label:'HRV',idx:1,unit:'ms',baseline:62.9,baselineLabel:'62.9 ms',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight / morning',latest:'07 Sep',current:'81 ms',delta:'+28.8%',note:'Higher than the provisional personal Garmin baseline. Read with RHR, sleep, load and athlete feedback.'},
 rhr:{label:'Resting HR',idx:2,unit:'bpm',baseline:57.8,baselineLabel:'57.8 bpm',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Morning anchor',latest:'07 Sep',current:'54 bpm',delta:'-3.8 bpm',note:'Below the provisional personal baseline and directionally concordant with the recovery rebound.'},
 sleep:{label:'Sleep duration',idx:3,unit:'h',baseline:6.852,baselineLabel:'6.85 h',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight',latest:'07 Sep',current:'7.78 h',delta:'+0.93 h',note:'Above the provisional cohort mean; useful context rather than a standalone readiness signal.'},
 sleepScore:{label:'Sleep score',idx:4,unit:'',baseline:75.8,baselineLabel:'75.8',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight',latest:'07 Sep',current:'92',delta:'+16.2',note:'Well above the provisional personal mean and concordant with HRV/RHR on 7 Sep.'},
 bb:{label:'Body Battery high',idx:5,unit:'',baseline:78.45,baselineLabel:'78.5',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Morning / day high',latest:'07 Sep',current:'94',delta:'+15.5',note:'Above the provisional personal mean; useful as a supporting recovery signal.'},
 stress:{label:'Completed-day stress',idx:6,unit:'',baseline:28,baselineLabel:'28.0',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Completed day only',latest:'06 Sep',current:'44',delta:'+16',note:'6 Sep was a high-disturbance completed day. The 7 Sep partial-day stress value is intentionally excluded from this chart.'},
 steps:{label:'Completed-day steps',idx:7,unit:'',baseline:11889.26,baselineLabel:'11,889',maturity:'PROVISIONAL',confidence:'LOW–MODERATE',grain:'Completed day only',latest:'06 Sep',current:'9,073',delta:'-23.7%',note:'Movement is highly variable. The baseline is context, not a daily target.'},
 active:{label:'Active energy',idx:8,unit:'kcal',baseline:694.82,baselineLabel:'695 kcal',maturity:'PROVISIONAL',confidence:'LOW–MODERATE',grain:'Completed day only',latest:'06 Sep',current:'450 kcal',delta:'-35.2%',note:'6 Sep active energy was below the provisional completed-day mean, consistent with a lower-load day.'},
 readiness:{label:'FZ Readiness',idx:9,unit:'',baseline:null,baselineLabel:'Series starts now',maturity:'NEW SERIES',confidence:'EXACT RETAINED',grain:'FZ-derived decision state',latest:'07 Sep',current:'82',delta:'—',note:'Only exact retained contemporaneous FZ scores are plotted. No historical readiness scores are recreated.'}
};
let fzWellnessMetric='hrv';
function fzWellFmt(v,m){if(v==null)return'—';if(m==='steps')return Math.round(v).toLocaleString();if(m==='active')return Math.round(v)+' kcal';if(m==='sleep')return Number(v).toFixed(2)+' h';if(m==='hrv')return Math.round(v)+' ms';if(m==='rhr')return Math.round(v)+' bpm';return String(Math.round(v*10)/10)}
function fzWellSeries(metric){const def=FZ_WELLNESS_METRICS[metric];return FZ_WELLNESS_HISTORY.map((r,i)=>({i,date:r[0],value:r[def.idx],status:r[10]}))}
function fzWellDelta(v,def){if(v==null||def.baseline==null)return'—';const abs=v-def.baseline;const pct=def.baseline?abs/def.baseline*100:null;const sign=abs>0?'+':'';if(def.unit==='bpm')return sign+abs.toFixed(1)+' bpm';if(def.unit==='h')return sign+abs.toFixed(2)+' h';if(def.unit==='ms')return sign+pct.toFixed(1)+'%';if(def.label.includes('steps')||def.label.includes('energy'))return sign+pct.toFixed(1)+'%';return sign+abs.toFixed(1)}
function fzWellPath(points,x,y){let out='',open=false;for(const p of points){if(p.value==null){open=false;continue}out+=(open?'L':'M')+x(p.i).toFixed(1)+','+y(p.value).toFixed(1)+' ';open=true}return out.trim()}
function fzRenderWellnessChart(metric,selectedIndex=null){
 const host=document.querySelector('#fzWellnessChart'); if(!host)return;
 const def=FZ_WELLNESS_METRICS[metric],series=fzWellSeries(metric),valid=series.filter(x=>Number.isFinite(x.value));
 if(!valid.length){host.innerHTML='<div class="well-empty">No retained observations for this metric.</div>';return}
 const W=1000,H=340,L=54,R=24,T=25,B=42;
 let vals=valid.map(x=>x.value);if(def.baseline!=null)vals.push(def.baseline);
 let min=Math.min(...vals),max=Math.max(...vals);let pad=(max-min)*.18||1;min-=pad;max+=pad;
 if(metric==='steps'||metric==='active'){min=Math.max(0,min)}
 const x=i=>L+i*(W-L-R)/(FZ_WELLNESS_HISTORY.length-1);const y=v=>T+(max-v)/(max-min)*(H-T-B);
 let grid='';for(let j=0;j<5;j++){const yy=T+j*(H-T-B)/4;const vv=max-j*(max-min)/4;grid+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" class="well-grid"/><text x="'+(L-10)+'" y="'+(yy+4)+'" class="well-axis" text-anchor="end">'+escLong(fzWellFmt(vv,metric).replace(/ kcal| bpm| ms| h/g,''))+'</text>'}
 let baseline='';if(def.baseline!=null){const by=y(def.baseline);baseline='<line x1="'+L+'" y1="'+by+'" x2="'+(W-R)+'" y2="'+by+'" class="well-baseline"/><text x="'+(W-R)+'" y="'+(by-7)+'" class="well-baseline-label" text-anchor="end">PERSONAL BASELINE · '+escLong(def.baselineLabel)+'</text>'}
 const circles=valid.map(p=>'<circle cx="'+x(p.i)+'" cy="'+y(p.value)+'" r="'+(p.i===selectedIndex?7:4)+'" class="well-dot '+(p.i===selectedIndex?'selected':'')+'" data-well-i="'+p.i+'"/>').join('');
 const gap=series[6].value==null?'<g><line x1="'+x(6)+'" y1="'+T+'" x2="'+x(6)+'" y2="'+(H-B)+'" class="well-gap"/><text x="'+x(6)+'" y="'+(T+12)+'" class="well-gap-label" text-anchor="middle">23 AUG · GAP</text></g>':'';
 const labels=[0,5,10,15,21].map(i=>'<text x="'+x(i)+'" y="'+(H-12)+'" class="well-axis" text-anchor="middle">'+FZ_WELLNESS_HISTORY[i][0]+'</text>').join('');
 const sel=selectedIndex==null?valid[valid.length-1]:series[selectedIndex];const sx=sel&&sel.value!=null?x(sel.i):null;
 const scrub=sx==null?'':'<line id="wellScrubLine" x1="'+sx+'" y1="'+T+'" x2="'+sx+'" y2="'+(H-B)+'" class="well-scrub"/>';
 host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-label="'+escLong(def.label)+' longitudinal chart">'+grid+baseline+'<path d="'+fzWellPath(series,x,y)+'" class="well-line"/>'+gap+scrub+circles+labels+'</svg><div id="wellTooltip" class="well-tooltip"></div>';
 function choose(clientX,clientY){const rect=host.getBoundingClientRect();const rel=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));const i=Math.max(0,Math.min(series.length-1,Math.round(rel*(series.length-1))));fzSelectWellnessPoint(metric,i,clientX-rect.left,clientY-rect.top)}
 host.onpointermove=e=>choose(e.clientX,e.clientY);host.onpointerdown=e=>choose(e.clientX,e.clientY);host.onclick=e=>choose(e.clientX,e.clientY);
 host.ontouchstart=e=>{const p=touchEventPoint(e);if(p)choose(p.clientX,p.clientY)};host.ontouchmove=e=>{const p=touchEventPoint(e);if(p)choose(p.clientX,p.clientY)};host.ontouchend=e=>{const p=touchEventPoint(e);if(p)choose(p.clientX,p.clientY)};
 fzSelectWellnessPoint(metric,sel?.i??valid[valid.length-1].i,null,null,true);
}
function fzSelectWellnessPoint(metric,i,left=null,top=null,quiet=false){
 const def=FZ_WELLNESS_METRICS[metric],r=FZ_WELLNESS_HISTORY[i],v=r[def.idx],status=r[10];
 const dateEl=document.querySelector('#wellSelectedDate'),valueEl=document.querySelector('#wellSelectedValue'),deltaEl=document.querySelector('#wellSelectedDelta'),statusEl=document.querySelector('#wellSelectedStatus'),tip=document.querySelector('#wellTooltip');
 if(dateEl)dateEl.textContent=r[0];if(valueEl)valueEl.textContent=v==null?'NO RECORD':fzWellFmt(v,metric);if(deltaEl)deltaEl.textContent=v==null?'—':fzWellDelta(v,def);if(statusEl)statusEl.textContent=status;
 const line=document.querySelector('#wellScrubLine');if(line){const W=1000,L=54,R=24,x=L+i*(W-L-R)/(FZ_WELLNESS_HISTORY.length-1);line.setAttribute('x1',x);line.setAttribute('x2',x)}
 document.querySelectorAll('#fzWellnessChart .well-dot').forEach(c=>c.classList.toggle('selected',Number(c.dataset.wellI)===i));
 if(tip&&!quiet){tip.style.display='block';tip.style.left=Math.min((tip.parentElement?.clientWidth||500)-190,Math.max(8,(left||0)+12))+'px';tip.style.top=Math.max(8,(top||0)-35)+'px';tip.innerHTML='<b>'+escLong(r[0])+'</b><span>'+escLong(v==null?'No retained observation':fzWellFmt(v,metric))+'</span><small>'+escLong(v==null?status:fzWellDelta(v,def)+' vs baseline · '+status)+'</small>'}
}
function fzSetWellnessMetric(metric){fzWellnessMetric=metric;const def=FZ_WELLNESS_METRICS[metric];document.querySelectorAll('[data-well-metric]').forEach(b=>b.classList.toggle('active',b.dataset.wellMetric===metric));
 const title=document.querySelector('#wellMetricTitle'),base=document.querySelector('#wellBaselineValue'),maturity=document.querySelector('#wellMaturity'),confidence=document.querySelector('#wellConfidence'),grain=document.querySelector('#wellGrain'),note=document.querySelector('#wellMetricNote');
 if(title)title.textContent=def.label;if(base)base.textContent=def.baselineLabel;if(maturity)maturity.textContent=def.maturity;if(confidence)confidence.textContent=def.confidence;if(grain)grain.textContent=def.grain;if(note)note.textContent=def.note;
 fzRenderWellnessChart(metric);
}
fzLongStateTable=function(d){
 const buttons=[['hrv','HRV'],['rhr','RHR'],['sleep','SLEEP'],['sleepScore','SLEEP SCORE'],['bb','BODY BATTERY'],['stress','STRESS'],['steps','STEPS'],['active','ACTIVE KCAL'],['readiness','READINESS']].map(([id,label])=>'<button data-well-metric="'+id+'" class="'+(id==='hrv'?'active':'')+'">'+label+'</button>').join('');
 const compact=(d.baselines||[]).map(b=>'<div><b>'+escLong(b.name)+'</b><span>'+escLong(b.current)+'</span><small>'+escLong(b.delta)+' vs '+escLong(b.baseline)+'</small></div>').join('');
 setTimeout(()=>{document.querySelectorAll('[data-well-metric]').forEach(b=>b.addEventListener('click',()=>fzSetWellnessMetric(b.dataset.wellMetric)));fzSetWellnessMetric('hrv')},0);
 return '<div class="well-explorer"><div class="well-metric-tabs">'+buttons+'</div><div class="well-visual-grid"><div class="well-chart-card"><div class="well-chart-head"><div><div class="eyebrow">SCRUB HISTORY · 17 AUG → 07 SEP</div><h3 id="wellMetricTitle">HRV</h3></div><div class="well-chart-meta"><span id="wellGrain">Overnight / morning</span><b id="wellMaturity">PROVISIONAL</b></div></div><div id="fzWellnessChart" class="well-chart"></div></div><aside class="well-readout"><div class="well-selected"><small>SELECTED DAY</small><b id="wellSelectedDate">07 Sep</b><strong id="wellSelectedValue">81 ms</strong><span id="wellSelectedStatus">LIVE / PARTIAL</span></div><div class="well-stat"><small>PERSONAL BASELINE</small><b id="wellBaselineValue">62.9 ms</b></div><div class="well-stat"><small>DEVIATION</small><b id="wellSelectedDelta">+28.8%</b></div><div class="well-stat"><small>CONFIDENCE</small><b id="wellConfidence">MODERATE</b></div><p id="wellMetricNote">Higher than the provisional personal Garmin baseline. Read with RHR, sleep, load and athlete feedback.</p></aside></div><details class="well-details"><summary>Show compact baseline snapshot</summary><div class="well-baseline-grid">'+compact+'</div></details></div>';
};
`;

app += '\n'+patch+'\n';
css += String.raw`

/* FZ longitudinal TRENDS v3 — visual wellness explorer */
.well-explorer{border:1px solid #292929;border-radius:14px;background:#080808;overflow:hidden}.well-metric-tabs{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid #242424;overflow-x:auto;scrollbar-width:none}.well-metric-tabs::-webkit-scrollbar{display:none}.well-metric-tabs button{appearance:none;white-space:nowrap;border:1px solid #2d2d2d;background:#101010;color:#aaa;border-radius:999px;padding:8px 10px;font:800 8px/1 inherit;letter-spacing:.07em;cursor:pointer}.well-metric-tabs button.active{background:var(--yellow);border-color:var(--yellow);color:#080808}.well-visual-grid{display:grid;grid-template-columns:minmax(0,1fr) 235px;min-height:390px}.well-chart-card{padding:14px 14px 8px;min-width:0}.well-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:8px}.well-chart-head h3{margin:4px 0 0;font-size:20px}.well-chart-meta{text-align:right}.well-chart-meta span,.well-chart-meta b{display:block}.well-chart-meta span{font-size:8px;color:var(--muted)}.well-chart-meta b{font-size:10px;color:var(--yellow);margin-top:4px}.well-chart{height:310px;position:relative;touch-action:pan-y;user-select:none}.well-chart svg{width:100%;height:100%;display:block;overflow:visible}.well-grid{stroke:#202020;stroke-width:1}.well-axis{fill:#777;font-size:9px}.well-line{fill:none;stroke:var(--yellow);stroke-width:3;vector-effect:non-scaling-stroke}.well-dot{fill:#090909;stroke:var(--yellow);stroke-width:2.5;vector-effect:non-scaling-stroke}.well-dot.selected{fill:var(--yellow);stroke:#fff;stroke-width:2.5}.well-baseline{stroke:#8b8b8b;stroke-width:1.5;stroke-dasharray:7 7;vector-effect:non-scaling-stroke}.well-baseline-label{fill:#999;font-size:8px;letter-spacing:.04em}.well-gap{stroke:#353535;stroke-width:1;stroke-dasharray:3 5}.well-gap-label{fill:#666;font-size:7px}.well-scrub{stroke:#fff;stroke-width:1.3;opacity:.65;vector-effect:non-scaling-stroke}.well-tooltip{display:none;position:absolute;z-index:7;pointer-events:none;min-width:165px;padding:9px 10px;border:1px solid #444;border-radius:9px;background:rgba(5,5,5,.95);box-shadow:0 8px 28px rgba(0,0,0,.35)}.well-tooltip b,.well-tooltip span,.well-tooltip small{display:block}.well-tooltip b{color:var(--yellow);font-size:9px}.well-tooltip span{font-weight:900;font-size:15px;margin:3px 0}.well-tooltip small{color:#aaa;font-size:8px;line-height:1.35}.well-readout{border-left:1px solid #242424;padding:14px;background:linear-gradient(180deg,#0e0e0e,#080808);display:flex;flex-direction:column;gap:9px}.well-selected{padding:12px;border:1px solid #313131;border-radius:11px;background:#0b0b0b}.well-selected small,.well-stat small{display:block;color:#777;font-size:8px;letter-spacing:.08em}.well-selected b{display:block;color:#ddd;font-size:11px;margin:4px 0}.well-selected strong{display:block;color:var(--yellow);font-size:31px;letter-spacing:-.03em}.well-selected span{display:block;color:#888;font-size:8px;margin-top:4px}.well-stat{padding:9px 10px;border:1px solid #242424;border-radius:9px}.well-stat b{display:block;font-size:13px;margin-top:4px}.well-readout p{margin:2px 0 0;color:#aaa;font-size:9px;line-height:1.55}.well-details{border-top:1px solid #242424}.well-details summary{cursor:pointer;padding:10px 12px;color:#8d8d8d;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.well-baseline-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 12px 12px}.well-baseline-grid>div{padding:9px;border:1px solid #232323;border-radius:9px}.well-baseline-grid b,.well-baseline-grid span,.well-baseline-grid small{display:block}.well-baseline-grid b{font-size:9px}.well-baseline-grid span{color:var(--yellow);font-size:13px;margin:4px 0}.well-baseline-grid small{color:#777;font-size:7px;line-height:1.35}
@media(max-width:900px){.well-visual-grid{grid-template-columns:1fr}.well-readout{border-left:0;border-top:1px solid #242424;display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr}.well-readout p{grid-column:1/-1}.well-baseline-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.well-chart{height:260px}.well-readout{grid-template-columns:1fr 1fr}.well-selected{grid-column:1/-1}.well-baseline-grid{grid-template-columns:1fr 1fr}.well-chart-meta{display:none}}
`;

fs.writeFileSync(appPath,app);fs.writeFileSync(cssPath,css);
for(const token of ['FZ_WELLNESS_HISTORY','fzRenderWellnessChart','data-well-metric','well-baseline','touchstart','READINESS']){if(!app.includes(token))throw new Error(`Missing v3 visual wellness token ${token}`)}
if(!css.includes('.well-chart')||!css.includes('.well-tooltip')||!css.includes('.well-readout')) throw new Error('Missing v3 wellness CSS');
console.log('PASS longitudinal TRENDS v3: visual scrubbed wellness state');
console.log('FINAL app.js sha256',createHash('sha256').update(app).digest('hex'));
console.log('FINAL app.css sha256',createHash('sha256').update(css).digest('hex'));
