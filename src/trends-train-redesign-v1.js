/* FZ Performance — TRENDS + TRAIN redesign v1. Presentation only. */

const FZ_PHASE2={scheduled:false};

function phase2Section(root,title){
  return [...root.querySelectorAll(':scope > .section')].find(section=>section.querySelector(':scope > .section-head h2')?.textContent?.trim()===title)||null;
}
function phase2Lead(root,kind){
  let lead=root.querySelector(':scope > .fz-phase2-lead');
  if(lead)return lead;
  lead=document.createElement('header');
  lead.className=`fz-phase2-lead fz-phase2-lead-${kind}`;
  lead.dataset.fzPhase2Lead=kind;
  if(kind==='trends'){
    lead.innerHTML='<span>TRENDS</span><h1>What is changing — and how strong is the evidence?</h1><p>Interpretation first. Evidence next. Provenance when you want it.</p>';
  }else{
    lead.innerHTML='<span>TRAIN</span><h1>Execute the right work. Learn from what actually happened.</h1><p>Current choice first, exact execution next, then canonical training memory and Athlete Voice.</p>';
  }
  return lead;
}
function phase2Kicker(section,label){
  if(!section)return;
  section.classList.add('fz-phase2-section');
  const head=section.querySelector(':scope > .section-head');
  if(!head||head.querySelector(':scope > .fz-phase2-kicker'))return;
  const kicker=document.createElement('span');
  kicker.className='fz-phase2-kicker';
  kicker.textContent=label;
  head.prepend(kicker);
}
function phase2PlaceFirst(root,node){if(node&&root.firstElementChild!==node)root.insertBefore(node,root.firstElementChild);}
function phase2PlaceAfter(root,node,previous){
  if(!node||!previous)return previous;
  if(previous.nextElementSibling!==node)root.insertBefore(node,previous.nextElementSibling);
  return node;
}
function decorateTrends(){
  const root=document.getElementById('trends');
  if(!root)return;
  const summary=phase2Section(root,'Longitudinal Signals');
  if(!summary)return;
  const gaps=phase2Section(root,'Trajectory & Measurement Gaps')||phase2Section(root,'Primary Objective Capability Priorities');
  const recovery=phase2Section(root,'Recovery Response');
  const exposure=phase2Section(root,'Exposure Cost');
  const performance=phase2Section(root,'Performance Trajectory');
  const voice=phase2Section(root,'Athlete Voice');
  const lead=phase2Lead(root,'trends');
  root.classList.add('fz-phase2-trends');
  phase2PlaceFirst(root,lead);
  let cursor=lead;
  for(const node of [summary,gaps,recovery,exposure,performance,voice])cursor=phase2PlaceAfter(root,node,cursor);
  summary.classList.add('fz-phase2-summary');
  gaps?.classList.add('fz-phase2-gaps');
  recovery?.classList.add('fz-phase2-recovery');
  exposure?.classList.add('fz-phase2-exposure');
  performance?.classList.add('fz-phase2-performance');
  voice?.classList.add('fz-phase2-voice');
  phase2Kicker(summary,'CURRENT DIRECTION');
  phase2Kicker(gaps,'EVIDENCE QUALITY');
  phase2Kicker(recovery,'RECOVERY RESPONSE');
  phase2Kicker(exposure,'TRAINING COST');
  phase2Kicker(performance,'MATCHED PERFORMANCE');
  phase2Kicker(voice,'ATHLETE CONTEXT');
  root.querySelectorAll(':scope > .section').forEach(section=>{
    if(!section.querySelector(':scope > .section-head h2'))section.classList.add('fz-phase2-provenance');
  });
}
function primeRecommendedPrescription(choice){
  if(!choice)return;
  const fingerprint=choice.dataset.fz44Fingerprint||'current';
  if(choice.dataset.fzPhase2PrescriptionFor===fingerprint)return;
  const prescription=choice.querySelector(':scope .fz-options-grid > .fz-option-card:first-child .fz-execution-prescription');
  if(!prescription)return;
  prescription.open=true;
  choice.dataset.fzPhase2PrescriptionFor=fingerprint;
}
function decorateTrain(){
  const root=document.getElementById('train');
  if(!root)return;
  const training=phase2Section(root,'Training Memory');
  const athlete=phase2Section(root,'Athlete Memory');
  const choice=root.querySelector(':scope > .fz44-choice-section');
  if(!training&&!athlete&&!choice)return;
  const lead=phase2Lead(root,'train');
  root.classList.add('fz-phase2-train');
  phase2PlaceFirst(root,lead);
  let cursor=lead;
  if(choice){choice.classList.add('fz-phase2-choice');cursor=phase2PlaceAfter(root,choice,cursor);}
  if(training){training.classList.add('fz-phase2-training-memory');cursor=phase2PlaceAfter(root,training,cursor);}
  if(athlete){athlete.classList.add('fz-phase2-athlete-memory');cursor=phase2PlaceAfter(root,athlete,cursor);}
  phase2Kicker(choice,'CURRENT / NEXT EXECUTION');
  phase2Kicker(training,'CANONICAL EXECUTION MEMORY');
  phase2Kicker(athlete,'ATHLETE VOICE / SUBJECTIVE CONTEXT');
  primeRecommendedPrescription(choice);
}
function applyPhase2(){
  FZ_PHASE2.scheduled=false;
  decorateTrends();
  decorateTrain();
}
function schedulePhase2(){
  if(FZ_PHASE2.scheduled)return;
  FZ_PHASE2.scheduled=true;
  queueMicrotask(applyPhase2);
}

new MutationObserver(schedulePhase2).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{if(event.target.closest('[data-page],[data-open-page]'))schedulePhase2();});
window.addEventListener('focus',schedulePhase2);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedulePhase2();});
schedulePhase2();
