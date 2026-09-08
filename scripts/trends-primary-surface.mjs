import fs from 'node:fs';
import { createHash } from 'node:crypto';

const appPath='dist/assets/app.js';
const cssPath='dist/assets/app.css';
if(!fs.existsSync(appPath)||!fs.existsSync(cssPath)) throw new Error('Run longitudinal v4 before trends-primary-surface.mjs');

let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');

function mustReplace(from,to,label){
  if(!app.includes(from)) throw new Error(`TRENDS patch point missing: ${label}`);
  app=app.replace(from,to);
}

mustReplace('trends.append(wrap);','trends.prepend(wrap);','primary insertion point');

// Close 7 Sep with the actual completed-day Garmin values. This is the migration seed only;
// future history is expected from runtime datasets.WELLNESS_HISTORY.
mustReplace(
  "['07 Sep',81,54,7.78,92,94,null,null,null,82,'LIVE / PARTIAL']",
  "['07 Sep',81,54,7.78,92,94,24,6611,439,82,'HISTORICAL']",
  '7 Sep completed wellness seed'
);

// Runtime state can legitimately ship a static #longitudinalLayer narrative. The rich shell
// must replace that static state-rendered block instead of treating its ID as proof that the
// interactive explorer has already mounted.
const runtimeCollision="const trends=$('trends');if(!trends||$('longitudinalLayer'))return;";
const runtimeAware="const trends=$('trends');if(!trends)return;const existingLong=$('longitudinalLayer');if(existingLong){if(existingLong.classList.contains('long-shell'))return;existingLong.remove();}";
mustReplace(runtimeCollision,runtimeAware,'runtime longitudinal collision guard');

// The visual explorer prefers the canonical runtime history dataset. The stable shell seed is
// only a backward-compatible fallback until the state publisher carries the richer history.
const liveHelpers=String.raw`
function fzWellDateLabel(v){
 if(typeof v!=='string')return String(v||'—');
 if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const p=v.split('-').map(Number),m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return String(p[2]).padStart(2,'0')+' '+m[p[1]-1]}
 return v;
}
function fzRuntimeHistoryRow(r){
 if(Array.isArray(r))return [...r];
 if(!r||typeof r!=='object')return null;
 return [fzWellDateLabel(r.dateLabel||r.date),r.hrv??null,r.rhr??null,r.sleepHours??null,r.sleepScore??null,r.bodyBatteryHigh??null,r.completedDayStress??r.stress??null,r.completedDaySteps??r.steps??null,r.completedDayActiveCalories??r.activeCalories??null,r.fzReadiness??r.readiness??null,r.status||'HISTORICAL'];
}
function fzRuntimeWellnessHistory(){
 const canonical=runtimeState?.datasets?.WELLNESS_HISTORY;
 const rows=Array.isArray(canonical)&&canonical.length?canonical.map(fzRuntimeHistoryRow).filter(Boolean):FZ_WELLNESS_HISTORY.map(r=>[...r]);
 const live=runtimeState?.liveToday||runtimeState?.renderContract?.liveToday;
 const readiness=runtimeState?.renderContract?.readiness?.score;
 const stateId=runtimeState?.stateId;
 if(!live||typeof stateId!=='string'||stateId.length<10)return rows;
 const label=fzWellDateLabel(stateId.slice(0,10));
 const row=[label,live.hrv??null,live.rhr??null,live.sleepHours??null,live.sleepScore??null,live.bodyBatteryHigh??null,null,null,null,Number.isFinite(readiness)?readiness:null,'LIVE / PARTIAL'];
 const existing=rows.findIndex(r=>r?.[0]===label);
 if(existing>=0){
   const old=rows[existing];
   rows[existing]=[label,row[1]??old[1],row[2]??old[2],row[3]??old[3],row[4]??old[4],row[5]??old[5],old[6]??null,old[7]??null,old[8]??null,row[9]??old[9],old[10]==='HISTORICAL'?'HISTORICAL':'LIVE / PARTIAL'];
 }else{if(rows.at(-1)?.[10]==='LIVE / PARTIAL')rows.at(-1)[10]='HISTORICAL';rows.push(row)}
 return rows;
}
function fzWellBaselineFmt(v,m){if(!Number.isFinite(v))return'—';if(m==='hrv')return v.toFixed(2)+' ms';if(m==='rhr')return v.toFixed(2)+' bpm';if(m==='sleep')return v.toFixed(2)+' h';if(m==='sleepScore'||m==='bb')return v.toFixed(1);return fzWellFmt(v,m)}
function fzRuntimeWellnessDef(metric){
 const def={...FZ_WELLNESS_METRICS[metric]},rows=fzRuntimeWellnessHistory();
 if(['hrv','rhr','sleep','sleepScore','bb','stress','steps','active'].includes(metric)){
   const completed=rows.filter(r=>r?.[10]!=='LIVE / PARTIAL'),vals=completed.map(r=>r[def.idx]).filter(Number.isFinite);
   if(vals.length){def.baseline=vals.reduce((a,b)=>a+b,0)/vals.length;def.baselineLabel=fzWellBaselineFmt(def.baseline,metric)}
 }
 let hit=null;for(let i=rows.length-1;i>=0;i--){if(Number.isFinite(rows[i][def.idx])){hit=rows[i];break}}
 if(hit){def.latest=hit[0];def.current=fzWellFmt(hit[def.idx],metric);def.delta=fzWellDelta(hit[def.idx],def)}
 return def;
}
function fzRuntimeLongitudinalData(){
 const source=(runtimeState&&runtimeState.datasets&&runtimeState.datasets.LONGITUDINAL)||DEFAULT_LONGITUDINAL;
 const d={...source,baselines:(source.baselines||[]).map(b=>({...b}))};
 const ids={'HRV':'hrv','Resting HR':'rhr','Sleep duration':'sleep','Sleep score':'sleepScore','Body Battery high':'bb','Completed-day stress':'stress','Completed-day steps':'steps','Active energy':'active','FZ Readiness':'readiness'};
 d.baselines=d.baselines.map(b=>{const id=ids[b.name];if(!id)return b;const x=fzRuntimeWellnessDef(id);return {...b,current:x.current,baseline:x.baselineLabel,delta:x.delta,maturity:x.maturity,confidence:x.confidence,grain:x.grain}});
 return d;
}
function fzInjectCurrentTrendSummaries(){
 const wrap=document.querySelector('#longitudinalLayer'),t=runtimeState?.renderContract?.trends;if(!wrap||!t)return;
 const map={response:'recovery',performance:'performance',cost:'exposure',voice:'voice',trajectory:'trajectory'};
 for(const [lens,key] of Object.entries(map)){
   const pane=wrap.querySelector('.long-pane[data-lens="'+lens+'"]'),text=t[key];if(!pane||!text||pane.querySelector('.runtime-trend-update'))continue;
   const head=pane.querySelector('.long-pane-head');if(!head)continue;
   head.insertAdjacentHTML('afterend','<div class="card rich runtime-trend-update"><div class="eyebrow">CURRENT MASTER-VALIDATED UPDATE</div><p>'+escLong(text)+'</p></div>');
 }
}
`;
mustReplace("let fzWellnessMetric='hrv';","let fzWellnessMetric='hrv';\n"+liveHelpers,'runtime wellness helpers');

mustReplace(
 "function fzWellSeries(metric){const def=FZ_WELLNESS_METRICS[metric];return FZ_WELLNESS_HISTORY.map((r,i)=>({i,date:r[0],value:r[def.idx],status:r[10]}))}",
 "function fzWellSeries(metric){const def=fzRuntimeWellnessDef(metric),rows=fzRuntimeWellnessHistory();return rows.map((r,i)=>({i,date:r[0],value:r[def.idx],status:r[10]}))}",
 'runtime wellness series'
);
mustReplace(
 "const def=FZ_WELLNESS_METRICS[metric],series=fzWellSeries(metric),valid=series.filter(x=>Number.isFinite(x.value));",
 "const history=fzRuntimeWellnessHistory(),def=fzRuntimeWellnessDef(metric),series=fzWellSeries(metric),valid=series.filter(x=>Number.isFinite(x.value));",
 'runtime wellness chart definition'
);
app=app.replaceAll('FZ_WELLNESS_HISTORY.length-1','history.length-1');
mustReplace(
 "const labels=[0,5,10,15,21].map(i=>'<text x=\"'+x(i)+'\" y=\"'+(H-12)+'\" class=\"well-axis\" text-anchor=\"middle\">'+FZ_WELLNESS_HISTORY[i][0]+'</text>').join('');",
 "const labelIdx=[0,5,10,15,history.length-2,history.length-1].filter((v,i,a)=>v>=0&&v<history.length&&a.indexOf(v)===i);const labels=labelIdx.map(i=>'<text x=\"'+x(i)+'\" y=\"'+(H-12)+'\" class=\"well-axis\" text-anchor=\"middle\">'+history[i][0]+'</text>').join('');",
 'dynamic wellness x labels'
);
mustReplace(
 "const def=FZ_WELLNESS_METRICS[metric],r=FZ_WELLNESS_HISTORY[i],v=r[def.idx],status=r[10];",
 "const history=fzRuntimeWellnessHistory(),def=fzRuntimeWellnessDef(metric),r=history[i],v=r[def.idx],status=r[10];",
 'runtime wellness selected point'
);
mustReplace(
 "function fzSetWellnessMetric(metric){fzWellnessMetric=metric;const def=FZ_WELLNESS_METRICS[metric];",
 "function fzSetWellnessMetric(metric){fzWellnessMetric=metric;const def=fzRuntimeWellnessDef(metric);",
 'runtime wellness metric definition'
);
mustReplace(
 "const compact=(d.baselines||[]).map(b=>'<div><b>'+escLong(b.name)+'</b><span>'+escLong(b.current)+'</span><small>'+escLong(b.delta)+' vs '+escLong(b.baseline)+'</small></div>').join('');",
 "const compact=['hrv','rhr','sleep','sleepScore','bb','stress','steps','active','readiness'].map(id=>{const b=fzRuntimeWellnessDef(id);return '<div><b>'+escLong(b.label)+'</b><span>'+escLong(b.current)+'</span><small>'+escLong(b.delta)+' vs '+escLong(b.baselineLabel)+'</small></div>'}).join('');",
 'runtime compact baseline snapshot'
);
app=app.replaceAll('SCRUB HISTORY · 17 AUG → 07 SEP','SCRUB HISTORY · 17 AUG → LIVE');
app=app.replaceAll("const d=(runtimeState&&runtimeState.datasets&&runtimeState.datasets.LONGITUDINAL)||DEFAULT_LONGITUDINAL;","const d=fzRuntimeLongitudinalData();");

mustReplace(
 "function fzDeepenLongitudinal(){const wrap=document.querySelector('#longitudinalLayer');if(!wrap)return;const set=(lens,html)=>{const p=wrap.querySelector('.long-pane[data-lens=\"'+lens+'\"]');if(p){const head=p.querySelector('.long-pane-head');p.innerHTML='';if(head)p.append(head);p.insertAdjacentHTML('beforeend',html)}};set('response',fzResponseHtml());set('performance',fzPerformanceHtml());set('cost',fzCostHtml());set('voice',fzVoiceHtml());set('trajectory',fzTrajectoryHtml());fzRenderResponse();fzRenderPerformance();fzRenderCost();fzRenderVoice()}",
 "function fzDeepenLongitudinal(){const wrap=document.querySelector('#longitudinalLayer');if(!wrap)return;const set=(lens,html)=>{const p=wrap.querySelector('.long-pane[data-lens=\"'+lens+'\"]');if(p){const head=p.querySelector('.long-pane-head');p.innerHTML='';if(head)p.append(head);p.insertAdjacentHTML('beforeend',html)}};set('response',fzResponseHtml());set('performance',fzPerformanceHtml());set('cost',fzCostHtml());set('voice',fzVoiceHtml());set('trajectory',fzTrajectoryHtml());fzRenderResponse();fzRenderPerformance();fzRenderCost();fzRenderVoice();fzInjectCurrentTrendSummaries()}",
 'current runtime trend summaries'
);

if(!app.includes('existingLong.remove()')||!app.includes("data-long-lens=\"state\"")||!app.includes('fzRuntimeWellnessHistory')||!app.includes('WELLNESS_HISTORY')||!app.includes('fzInjectCurrentTrendSummaries')||!app.includes('fzRenderWellnessChart')){
  throw new Error('Rich runtime-synchronised longitudinal Trends implementation missing');
}

css += String.raw`

/* FZ TRENDS primary-surface correction — longitudinal experience opens first */
#trends>#longitudinalLayer{margin-top:0;padding-top:0;border-top:0;margin-bottom:28px}
#trends>#longitudinalLayer .long-title{padding-top:2px}
#trends>#longitudinalLayer .long-filter{margin-top:2px}
.runtime-trend-update{margin:0 0 14px;border-left:3px solid var(--yellow)}
`;

fs.writeFileSync(appPath,app);
fs.writeFileSync(cssPath,css);
console.log('TRENDS primary surface: interactive longitudinal layer + canonical runtime wellness history');
console.log('app sha256',createHash('sha256').update(app).digest('hex'));
console.log('css sha256',createHash('sha256').update(css).digest('hex'));
