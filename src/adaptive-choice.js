const FZ_CHOICE={current:null,loading:false,renderScheduled:false};
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const words=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
async function readCurrent(){const response=await fetch('/api/intelligence/current',{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${response.status}`);return response.json();}
function active(){return FZ_CHOICE.current?.activeRecommendation||null;}
function decision(){return FZ_CHOICE.current?.athleteDecision||null;}
function recommendedOptions(){const rec=active();return rec?.fzRecommendedLane&&Array.isArray(rec?.lanes?.[rec.fzRecommendedLane])?rec.lanes[rec.fzRecommendedLane]:[];}
function objectiveConnection(){return active()?.explanation?.athleteFacing?.objectiveConnection||'Current objective connection is unavailable.';}
function whyNow(){return active()?.explanation?.athleteFacing?.whyNow||active()?.explanation?.recommendation?.whyThisLane||'Current decision context is unavailable.';}
function optionCard(option,index){return `<article class="card rich fz-option-card"><div class="fz-option-head"><div><span class="eyebrow">OPTION ${index+1}</span><h3>${esc(option.title)}</h3></div><span class="pill">${esc(words(option.expectedCost))}</span></div><p>${esc(option.objective)}</p><div class="fz-option-dose"><b>Dose</b><span>${esc(option.dose)}</span></div><div class="microline"><strong>Why now:</strong> ${esc(option.whyNow)}</div>${option.targetedGaps?.length?`<div class="fz-option-gaps">Evidence target · ${option.targetedGaps.map(esc).join(' · ')}</div>`:''}<div class="fz-option-choice"><code>${esc(option.optionId)}</code><span>Choose this in chat or another authenticated FZ channel.</span></div></article>`;}
function patchToday(){
  const rec=active(),card=document.querySelector('#today .fz-clean-recommendation');if(!card||!rec)return;
  const options=recommendedOptions();
  card.dataset.fz44='1';
  card.innerHTML=`<div class="eyebrow">CURRENT FZ RECOMMENDATION · 4.4</div><div class="fz-rec-line"><h3>${esc(rec.status==='READY'?rec.fzRecommendedLane:'WITHHELD')}</h3><span>${esc(rec.confidence||'—')} confidence</span></div><p>${esc(rec.explanation?.athleteFacing?.headline||whyNow())}</p><div class="microline"><strong>Why now:</strong> ${esc(whyNow())}</div><div class="microline"><strong>Objective:</strong> ${esc(objectiveConnection())}</div>${options[0]?`<div class="fz-today-option"><b>Best current session option</b><span>${esc(options[0].title)} · ${esc(options[0].dose)}</span></div>`:''}${decision()?`<div class="fz-current-choice"><b>Athlete choice</b><span>${esc(decision().option?.title||decision().optionId||'Recorded')} · ${esc(words(decision().selectedLane))}${decision().plannedForDate?` · ${esc(decision().plannedForDate)}`:''}</span></div>`:''}`;
}
function removeDuplicateSections(){
  document.querySelectorAll('[data-fz-context-recovery="today-decision"],[data-fz-context-recovery="today-objective"],[data-fz-context-recovery="train-executions"],[data-fz-context-recovery="trends-objective"]').forEach(node=>node.remove());
}
function renderTrainChoice(){
  const root=document.getElementById('train'),rec=active();if(!root||!rec)return;
  let section=root.querySelector('[data-fz44-choice]');
  if(!section){section=document.createElement('div');section.className='section fz44-choice-section';section.dataset.fz44Choice='1';root.insertBefore(section,root.firstElementChild);}
  const options=recommendedOptions(),selected=decision();
  section.innerHTML=`<div class="section-head"><h2>Current Training Choice</h2><p>FZ recommendation → concrete options → athlete decision → planned intent → execution reconciliation</p></div><div class="fz-choice-summary"><div class="card decision rich"><div class="eyebrow">FZ RECOMMENDED LANE</div><h3>${esc(rec.status==='READY'?rec.fzRecommendedLane:'WITHHELD')}</h3><p>${esc(whyNow())}</p><div class="microline"><strong>Objective connection:</strong> ${esc(objectiveConnection())}</div></div><div class="card rich"><div class="eyebrow">ATHLETE DECISION</div>${selected?`<h3>${esc(selected.option?.title||selected.optionId||'Recorded choice')}</h3><p>${esc(words(selected.selectedLane))}${selected.matchesFzRecommendation?' · accepted FZ direction':' · athlete override retained'}</p><div class="microline"><strong>Planned:</strong> ${esc(selected.plannedForDate||'—')} · <strong>Plan:</strong> ${esc(selected.plannedSessionId||'—')}</div>`:'<h3>Not selected yet</h3><p>Your choice remains separate from FZ’s recommendation until you act.</p><div class="microline">Choose naturally in chat; the browser does not expose the athlete write credential.</div>'}</div></div>${options.length?`<div class="fz-options-grid">${options.map(optionCard).join('')}</div>`:'<div class="card rich"><h3>No concrete session option is currently released.</h3><p>FZ has withheld session composition because the current recommendation context does not support it.</p></div>'}<details class="fz-alternate-lanes"><summary>See alternate lanes</summary><div>${['ABSORB','MAINTAIN','ADAPT'].filter(lane=>lane!==rec.fzRecommendedLane).map(lane=>`<div><b>${lane}</b><span>${(rec.lanes?.[lane]||[]).length} available option(s) in the current context</span></div>`).join('')}</div></details>`;
}
function rationaliseSystem(){
  const section=document.querySelector('#system [data-recommendation-shadow]');if(!section)return;
  section.querySelector('.card.rich')?.remove();
  const current=FZ_CHOICE.current,selected=decision();
  let technical=section.querySelector('[data-fz44-system-choice]');
  if(!technical){technical=document.createElement('div');technical.className='fz-choice-system';technical.dataset.fz44SystemChoice='1';section.appendChild(technical);}
  technical.innerHTML=`<div><small>Option composer</small><b>${esc(active()?.sessionOptionComposerVersion||current?.markers?.sessionOptionComposerVersion||'—')}</b></div><div><small>Athlete decision</small><b>${selected?esc(selected.decisionId||'RECORDED'):'NONE'}</b></div><div><small>Planned intent</small><b>${selected?esc(selected.plannedSessionId||'—'):'NONE'}</b></div><div><small>Recommendation audit</small><b>${esc(active()?.shadowRecommendationId||'—')}</b></div>`;
}
function render(){removeDuplicateSections();patchToday();renderTrainChoice();rationaliseSystem();}
function scheduleRender(){if(FZ_CHOICE.renderScheduled)return;FZ_CHOICE.renderScheduled=true;queueMicrotask(()=>{FZ_CHOICE.renderScheduled=false;render();});}
async function refresh(){if(FZ_CHOICE.loading)return;FZ_CHOICE.loading=true;try{const payload=await readCurrent();if(payload?.ok){FZ_CHOICE.current=payload;scheduleRender();}}catch{}finally{FZ_CHOICE.loading=false;}}
const observer=new MutationObserver(scheduleRender);observer.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(refresh,0);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
