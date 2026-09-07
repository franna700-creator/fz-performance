import fs from 'node:fs';
import { createHash } from 'node:crypto';

const appPath='dist/assets/app.js';
const cssPath='dist/assets/app.css';
if(!fs.existsSync(appPath)||!fs.existsSync(cssPath)) throw new Error('Run build.mjs before longitudinal-trends-v2.mjs');
let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
if(!app.includes('function ensureLongitudinalTrends(){')) throw new Error('v0.6 longitudinal base not found');
if(!app.includes('const DEFAULT_LONGITUDINAL=')) throw new Error('Longitudinal dataset missing');

const override=String.raw`
/* FZ v0.6 longitudinal TRENDS hierarchy v2 — filtered depth, integrated metrics */
function fzTrendSection(title){return [...document.querySelectorAll('#trends .section')].find(s=>(s.querySelector('.section-head h2')?.textContent||'').trim()===title)}
function fzLongBase(d,name){return (d.baselines||[]).find(x=>x.name===name)}
function fzLongMetric(b,label=b?.name){if(!b)return'';return '<div class="long-metric"><small>'+escLong(label)+'</small><b>'+escLong(b.current)+'</b><span>'+escLong(b.delta)+' vs '+escLong(b.baseline)+'</span><em>'+escLong(b.signal)+' · '+escLong(b.maturity)+'</em></div>'}
function fzLongInsightCompact(title,i){return '<article class="long-insight"><div class="eyebrow">'+escLong(title)+' · '+escLong(i.confidence)+'</div><h3>'+escLong(i.interpretation)+'</h3><div class="long-insight-grid"><p><strong>Evidence</strong><br>'+escLong(i.observation)+'</p><p><strong>Relationship</strong><br>'+escLong(i.relationship)+'</p><p><strong>Athlete voice</strong><br>'+escLong(i.feedback)+'</p><p><strong>Performance connection</strong><br>'+escLong(i.performance)+'</p></div><div class="long-watch"><strong>What to watch</strong><span>'+escLong(i.watch)+'</span></div></article>'}
function fzLongStateTable(d){return '<div class="long-table"><div class="long-row head"><span>Metric</span><span>Current</span><span>Personal baseline</span><span>Deviation</span><span>Confidence</span></div>'+(d.baselines||[]).map(b=>'<div class="long-row"><span><b>'+escLong(b.name)+'</b><small>'+escLong(b.grain)+'</small></span><span>'+escLong(b.current)+'</span><span>'+escLong(b.baseline)+'</span><span>'+escLong(b.delta)+'</span><span><b>'+escLong(b.maturity)+'</b><small>'+escLong(b.confidence)+'</small></span></div>').join('')+'</div>'}
function fzLongVoice(d){return '<div class="long-voice-list">'+(d.voice||[]).map(v=>'<article><time>'+escLong(v.date)+'</time><div><b>'+escLong(v.title)+'</b><p>'+escLong(v.text)+'</p></div></article>').join('')+'</div>'}
function fzLongTrajectory(d){const t=d.trajectory||{};return '<div class="two"><div class="card rich"><div class="eyebrow">STRONGEST CONSOLIDATED SIGNAL</div><h3 class="good">'+escLong(t.strongest)+'</h3><p><strong>Measurement gaps</strong><br>'+escLong(t.gaps)+'</p><p>'+escLong(t.principle)+'</p></div><div class="card rich"><div class="eyebrow">EVENT RUNWAY</div><div class="long-event-list">'+(t.events||[]).map(e=>'<div><b>'+escLong(e.date)+' · '+escLong(e.name)+'</b><span>'+escLong(e.role)+'</span></div>').join('')+'</div></div></div>'}
function fzActivateLens(wrap,lens){wrap.querySelectorAll('[data-long-lens]').forEach(b=>b.classList.toggle('active',b.dataset.longLens===lens));wrap.querySelectorAll('.long-pane').forEach(p=>p.classList.toggle('active',p.dataset.lens===lens));const label=wrap.querySelector('#longLensLabel');if(label)label.textContent=({state:'Athlete State',response:'Recovery Response',performance:'Performance',cost:'Exposure Cost',voice:'Athlete Voice',trajectory:'Trajectory'})[lens]||lens}

ensureLongitudinalTrends=function(){
  const trends=$('trends');if(!trends||$('longitudinalLayer'))return;
  const legacy=new Set(['ATHLETE STATE','RECOVERY RESPONSE','PERFORMANCE','EXPOSURE COST','ATHLETE VOICE','TRAJECTORY']);
  [...trends.querySelectorAll(':scope > .section')].forEach(section=>{const title=(section.querySelector('.section-head h2')?.textContent||'').trim();if(legacy.has(title))section.remove()});
  const d=(runtimeState&&runtimeState.datasets&&runtimeState.datasets.LONGITUDINAL)||DEFAULT_LONGITUDINAL;

  const recovery=fzTrendSection('Recovery & Load Trend');
  if(recovery&&!$('wellnessBaselineStrip')){
    const block=document.createElement('div');block.id='wellnessBaselineStrip';block.className='long-integrated-block';
    block.innerHTML='<div class="long-integrated-head"><div><div class="eyebrow">PERSONAL WELLNESS CONTEXT</div><h3>Current state against your own provisional baseline</h3></div><span class="pill">'+escLong(d.baselineMaturity)+'</span></div><div class="long-metric-strip">'+fzLongMetric(fzLongBase(d,'HRV'))+fzLongMetric(fzLongBase(d,'Resting HR'))+fzLongMetric(fzLongBase(d,'Sleep score'))+fzLongMetric(fzLongBase(d,'Body Battery high'))+fzLongMetric(fzLongBase(d,'Completed-day stress'),'Prior-day stress')+'</div><p class="long-integrated-note"><strong>Interpretation:</strong> current recovery is read as a multi-signal position relative to personal history, not as isolated Garmin greens. Completed-day stress remains a separate grain from live current-day stress.</p>';
    recovery.querySelector('.section-head')?.after(block);
  }

  const performance=fzTrendSection('Performance Trajectory');
  if(performance&&!$('performanceCostIntegration')){
    const i=d.insights?.performance;
    const block=document.createElement('div');block.id='performanceCostIntegration';block.className='long-performance-bridge';
    block.innerHTML='<div><small>MATCHED ADAPTATION</small><b>+4.8% P/HR</b><span>2.434 → 2.551 · 375 W @ HR147 latest</span></div><div><small>ATHLETE-REPORTED COST</small><b>EXCEPTIONALLY GOOD</b><span>Easier than prior AETs · minimal immediate fatigue</span></div><div><small>FZ INTERPRETATION</small><b>OBJECTIVE + SUBJECTIVE AGREEMENT</b><span>'+escLong(i?.confidence||'HIGH')+' confidence · strongest current adaptation signal</span></div>';
    const kpi=performance.querySelector('.kpi-row');(kpi||performance.querySelector('.section-head'))?.after(block);
  }

  const wrap=document.createElement('div');wrap.id='longitudinalLayer';wrap.className='section long-shell';
  wrap.innerHTML='<div class="section-head long-title"><div><h2>Longitudinal Intelligence</h2><p>Deeper athlete memory without an ever-longer page · select the lens you want to inspect</p></div><div class="long-maturity"><small>Baseline maturity</small><b>'+escLong(d.baselineMaturity)+'</b></div></div>'+
  '<div class="long-filter" role="tablist" aria-label="Longitudinal trend lens"><button class="active" data-long-lens="state">STATE</button><button data-long-lens="response">RESPONSE</button><button data-long-lens="performance">PERFORMANCE</button><button data-long-lens="cost">COST</button><button data-long-lens="voice">ATHLETE VOICE</button><button data-long-lens="trajectory">TRAJECTORY</button></div>'+
  '<div class="long-context"><span>Viewing</span><b id="longLensLabel">Athlete State</b><em>Readiness history starts from exact retained FZ scores going forward; no invented historical series.</em></div>'+
  '<div class="long-pane active" data-lens="state"><div class="long-pane-head"><div><div class="eyebrow">HOW AM I CHANGING?</div><h3>Personal wellness state</h3></div><p>Values are shown against compatible personal baselines. Provisional means useful, not mature.</p></div>'+fzLongStateTable(d)+'</div>'+
  '<div class="long-pane" data-lens="response"><div class="long-pane-head"><div><div class="eyebrow">WHAT AM I TOLERATING?</div><h3>Recovery response</h3></div><p>Load → overnight physiology → athlete feeling → subsequent capacity.</p></div><div class="two">'+fzLongInsightCompact('6→7 SEP · RECOVERY RESILIENCE',d.insights.recovery)+fzLongInsightCompact('26 AUG · SIGNAL DISCORDANCE',d.insights.discordance)+'</div></div>'+
  '<div class="long-pane" data-lens="performance"><div class="long-pane-head"><div><div class="eyebrow">AM I ACTUALLY GETTING BETTER?</div><h3>Performance adaptation</h3></div><p>Matched metrics are interpreted together with perceived execution cost.</p></div>'+fzLongInsightCompact('31 AUG · MATCHED RUN AET',d.insights.performance)+'</div>'+
  '<div class="long-pane" data-lens="cost"><div class="long-pane-head"><div><div class="eyebrow">WHAT DOES TRAINING COST ME?</div><h3>Exposure cost</h3></div><p>Systemic recovery and local tissue/function remain separate response channels.</p></div><div class="two">'+fzLongInsightCompact('02–04 SEP · WALL-BALL LOCAL COST',d.insights.cost)+fzLongInsightCompact('03 SEP · RECOVERY ATTEMPT',d.insights.recoveryAttempt)+'</div></div>'+
  '<div class="long-pane" data-lens="voice"><div class="long-pane-head"><div><div class="eyebrow">WHAT HAVE I BEEN REPORTING?</div><h3>Athlete voice</h3></div><p>Meaningful dated feedback, not a transcript dump. Explicit ratings stay explicit; qualitative feedback stays qualitative.</p></div>'+fzLongVoice(d)+'</div>'+
  '<div class="long-pane" data-lens="trajectory"><div class="long-pane-head"><div><div class="eyebrow">IS THIS MOVING ME TOWARD THE EVENT?</div><h3>Trajectory</h3></div><p>Capabilities, measurement gaps and event runway — without fabricated completion percentages.</p></div>'+fzLongTrajectory(d)+'</div>';
  trends.append(wrap);
  wrap.querySelectorAll('[data-long-lens]').forEach(b=>b.addEventListener('click',()=>fzActivateLens(wrap,b.dataset.longLens)));
};
`;

app += '\n'+override+'\n';
css += String.raw`

/* FZ longitudinal TRENDS v2 */
.long-integrated-block{margin:0 0 14px;padding:14px;border:1px solid #2d2d2d;border-radius:14px;background:linear-gradient(180deg,#111,#0a0a0a)}
.long-integrated-head,.long-title,.long-pane-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.long-integrated-head h3,.long-pane-head h3{margin:4px 0 0}.long-integrated-note{margin:12px 0 0;color:var(--muted);font-size:11px;line-height:1.55}
.long-metric-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}.long-metric{padding:11px;border:1px solid #292929;border-radius:11px;background:#0b0b0b;min-width:0}.long-metric small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.long-metric b{display:block;color:var(--yellow);font-size:20px;margin:5px 0 2px}.long-metric span,.long-metric em{display:block;font-size:9px;line-height:1.45}.long-metric em{color:var(--muted);font-style:normal;margin-top:4px}
.long-performance-bridge{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.long-performance-bridge>div{padding:12px;border:1px solid #2b2b2b;border-radius:12px;background:#0b0b0b}.long-performance-bridge small{display:block;color:var(--muted);font-size:9px;letter-spacing:.08em}.long-performance-bridge b{display:block;color:var(--yellow);font-size:15px;margin:5px 0}.long-performance-bridge span{font-size:9px;color:var(--muted);line-height:1.45}
.long-shell{border-top:1px solid #2d2d2d;margin-top:26px;padding-top:22px}.long-title{align-items:end}.long-maturity{text-align:right}.long-maturity small{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.long-maturity b{color:var(--yellow);font-size:14px}.long-filter{display:flex;gap:7px;overflow-x:auto;padding:12px 0 8px;scrollbar-width:none}.long-filter::-webkit-scrollbar{display:none}.long-filter button{appearance:none;white-space:nowrap;border:1px solid #303030;background:#101010;color:#aaa;border-radius:999px;padding:9px 12px;font:800 9px/1 inherit;letter-spacing:.08em;cursor:pointer}.long-filter button.active{background:var(--yellow);border-color:var(--yellow);color:#090909}.long-context{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 11px;border:1px solid #252525;border-radius:10px;background:#090909;margin-bottom:10px}.long-context span,.long-context em{font-size:9px;color:var(--muted);font-style:normal}.long-context b{font-size:10px;color:#fff}.long-context em{margin-left:auto}.long-pane{display:none}.long-pane.active{display:block}.long-pane-head{margin:14px 0 10px}.long-pane-head p{max-width:460px;margin:0;color:var(--muted);font-size:10px;line-height:1.5;text-align:right}
.long-table{border:1px solid #272727;border-radius:12px;overflow:hidden}.long-row{display:grid;grid-template-columns:1.25fr .8fr 1fr .75fr 1fr;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid #232323;font-size:10px}.long-row:first-child{border-top:0}.long-row.head{background:#111;color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.08em}.long-row span{min-width:0}.long-row small{display:block;color:var(--muted);font-size:8px;margin-top:3px}.long-row b{color:#eee}
.long-insight{border:1px solid #2a2a2a;border-radius:13px;background:#0b0b0b;padding:14px}.long-insight h3{font-size:15px;line-height:1.35;margin:7px 0 12px}.long-insight-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.long-insight-grid p{margin:0;padding:9px;border:1px solid #222;border-radius:9px;color:#bbb;font-size:9px;line-height:1.55}.long-insight-grid strong{color:#eee}.long-watch{display:grid;grid-template-columns:105px 1fr;gap:10px;margin-top:9px;padding:9px 10px;background:#161300;border:1px solid #3a3200;border-radius:9px;font-size:9px;line-height:1.5}.long-watch strong{color:var(--yellow)}
.long-voice-list{border:1px solid #272727;border-radius:12px;overflow:hidden}.long-voice-list article{display:grid;grid-template-columns:78px 1fr;gap:13px;padding:12px;border-top:1px solid #232323}.long-voice-list article:first-child{border-top:0}.long-voice-list time{color:var(--yellow);font-size:9px;font-weight:900}.long-voice-list b{font-size:11px}.long-voice-list p{margin:4px 0 0;color:var(--muted);font-size:9px;line-height:1.5}.long-event-list>div{padding:9px 0;border-top:1px solid #272727}.long-event-list>div:first-child{border-top:0}.long-event-list b,.long-event-list span{display:block}.long-event-list b{font-size:10px;color:var(--yellow)}.long-event-list span{font-size:9px;color:var(--muted);margin-top:3px;line-height:1.45}
@media(max-width:900px){.long-metric-strip{grid-template-columns:repeat(2,1fr)}.long-performance-bridge{grid-template-columns:1fr}.long-row{grid-template-columns:1.1fr .8fr .9fr}.long-row span:nth-child(4),.long-row span:nth-child(5),.long-row.head span:nth-child(4),.long-row.head span:nth-child(5){display:none}.long-insight-grid{grid-template-columns:1fr}.long-title,.long-pane-head,.long-integrated-head{display:block}.long-maturity{text-align:left;margin-top:8px}.long-pane-head p{text-align:left;margin-top:7px}.long-context em{width:100%;margin-left:0}}
@media(max-width:520px){.long-metric-strip{grid-template-columns:1fr 1fr}.long-row{grid-template-columns:1.2fr .8fr .9fr;padding:9px}.long-watch{grid-template-columns:1fr}.long-voice-list article{grid-template-columns:62px 1fr}}
`;

if(!app.includes("legacy=new Set(['ATHLETE STATE'")) throw new Error('Legacy longitudinal removal guard missing');
if(!app.includes('fzActivateLens')||!app.includes('wellnessBaselineStrip')||!app.includes('performanceCostIntegration')) throw new Error('Longitudinal v2 JS patch failed');
if(!css.includes('.long-filter')||!css.includes('.long-metric-strip')) throw new Error('Longitudinal v2 CSS patch failed');
fs.writeFileSync(appPath,app);
fs.writeFileSync(cssPath,css);
const sha=v=>createHash('sha256').update(v).digest('hex');
console.log('PASS longitudinal TRENDS v2: legacy stack removed + integrated metrics + filtered bottom layer');
console.log('FINAL app.js sha256',sha(app));
console.log('FINAL app.css sha256',sha(css));
