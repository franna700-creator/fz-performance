import fs from 'node:fs';

const jsPath='dist/assets/app.js';
const cssPath='dist/assets/app.css';
if(!fs.existsSync(jsPath)||!fs.existsSync(cssPath))throw new Error('Historical feedback surface requires built dist assets');
let js=fs.readFileSync(jsPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
const marker='FZ_TRANCHE3_HISTORICAL_FEEDBACK_V1';

if(!js.includes(marker)){
  js+=`\n\n/* ${marker} */\nfunction fzRenderHistoricalContext(payload){\n  const memory=document.getElementById('fzTrainingMemory');if(!memory)return;\n  memory.querySelector('.fz-training-unlinked-context')?.remove();\n  const events=[...(payload?.contextEvents||[])].filter(e=>e.actor==='ATHLETE').sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));\n  if(!events.length)return;\n  const panel=document.createElement('div');panel.className='fz-training-unlinked-context';\n  panel.innerHTML='<div><span class="fz-training-kicker">ATHLETE CONTEXT · UNLINKED</span><strong>'+events.length+' historical observation'+(events.length===1?'':'s')+' retained without forced session matching</strong><p>These reports are valid athlete context, but FZ could not confidently attach them to one canonical workout.</p></div><div class="fz-training-unlinked-list">'+events.map(e=>'<div><b>'+fzTrainingEsc(fzTrainingDate(e.occurred_at))+' · '+fzTrainingEsc(fzTrainingTime(e.occurred_at))+'</b><p>'+fzTrainingEsc(e.summary||fzTrainingWords(e.event_type))+'</p></div>').join('')+'</div>';\n  const head=memory.querySelector('.fz-training-memory-head');if(head)head.after(panel);else memory.prepend(panel);\n}\nconst fzRenderTrainingHistoricalBase=fzRenderTraining;\nfzRenderTraining=function(payload){fzRenderTrainingHistoricalBase(payload);queueMicrotask(()=>fzRenderHistoricalContext(payload));};\n`;
}
if(!css.includes(marker)){
  css+=`\n\n/* ${marker} */\n.fz-training-unlinked-context{margin:12px 0;padding:14px 15px;background:#0a0a0a;border:1px dashed #383838;border-radius:14px}.fz-training-unlinked-context>div:first-child>strong{display:block;font-size:13px;line-height:1.35}.fz-training-unlinked-context>div:first-child>p,.fz-training-unlinked-list p{margin:5px 0 0;color:#aaa;font-size:11px;line-height:1.45}.fz-training-unlinked-list{display:grid;gap:8px;margin-top:11px}.fz-training-unlinked-list>div{padding-top:8px;border-top:1px solid #202020}.fz-training-unlinked-list b{font-size:10px;color:#ddd}@media(max-width:700px){.fz-training-unlinked-context{padding:13px 14px}}\n`;
}
fs.writeFileSync(jsPath,js);fs.writeFileSync(cssPath,css);console.log('PASS Tranche 3 historical feedback: unlinked athlete context surface');