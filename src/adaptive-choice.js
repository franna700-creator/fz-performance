const FZ_CHOICE={current:null,loading:false,renderScheduled:false,rendering:false,auth:{available:null,configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null},authBusy:false,landingDismissed:false};
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const words=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
async function readCurrent(){const response=await fetch('/api/intelligence/current',{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${response.status}`);return response.json();}
async function readAuthStatus(){
  try{
    const response=await fetch('/api/training/athlete-event?operation=athlete-auth-status',{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`${response.status}`);
    const payload=await response.json();
    if(!payload?.ok||!payload.auth)throw new Error('invalid_auth_status');
    FZ_CHOICE.auth={available:true,...payload.auth};
    if(payload.auth.authenticated)FZ_CHOICE.landingDismissed=true;
    else if(sessionStorage.getItem('fzViewerMode')==='1')FZ_CHOICE.landingDismissed=true;
    return payload.auth;
  }catch{
    FZ_CHOICE.auth={available:false,configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null};
    FZ_CHOICE.landingDismissed=true;
    return null;
  }
}
async function authPost(payload){
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  if(payload.action==='LOGOUT'&&FZ_CHOICE.auth.csrfToken)headers['X-FZ-CSRF']=FZ_CHOICE.auth.csrfToken;
  const response=await fetch('/api/training/athlete-event',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify({kind:'ATHLETE_AUTH',...payload})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.detail||body.error||`Authentication failed (${response.status})`);
  FZ_CHOICE.auth={available:true,...body.auth};
  FZ_CHOICE.landingDismissed=true;
  sessionStorage.removeItem('fzViewerMode');
  return body.auth;
}
function active(){return FZ_CHOICE.current?.activeRecommendation||null;}
function decision(){return FZ_CHOICE.current?.athleteDecision||null;}
function recommendedOptions(){const rec=active();return rec?.fzRecommendedLane&&Array.isArray(rec?.lanes?.[rec.fzRecommendedLane])?rec.lanes[rec.fzRecommendedLane]:[];}
function objectiveConnection(){return active()?.explanation?.athleteFacing?.objectiveConnection||'Current objective connection is unavailable.';}
function whyNow(){return active()?.explanation?.athleteFacing?.whyNow||active()?.explanation?.recommendation?.whyThisLane||'Current decision context is unavailable.';}
function athleteMode(){return FZ_CHOICE.auth.available===true&&FZ_CHOICE.auth.authenticated===true&&FZ_CHOICE.auth.mode==='ATHLETE';}
function choiceFingerprint(){
  const current=FZ_CHOICE.current||{},rec=active(),selected=decision();
  return [current.revision||'no-revision',rec?.recommendationVersion||rec?.shadowRecommendationId||rec?.fzRecommendedLane||'no-recommendation',selected?.decisionId||selected?.optionId||selected?.selectedLane||'no-decision',athleteMode()?'athlete':'viewer'].join('|');
}
function renderBlocks(items=[]){return items.length?`<div class="fz-rx-list">${items.map(item=>typeof item==='string'?`<div class="fz-rx-line"><span>${esc(item)}</span></div>`:`<div class="fz-rx-line"><b>${esc(item.label)}</b><span>${esc(item.instructions)}${item.target?` · ${esc(item.target)}`:''}</span></div>`).join('')}</div>`:'<div class="muted">No additional instruction.</div>';}
function prescriptionDetails(option){
  const p=option.prescription;if(!p)return'';
  const direct=p.comparisonClass==='BENCHMARK_EXACT'?'Benchmark · directly comparable within this protocol version':p.comparisonClass==='FAMILY_COMPARABLE'?'Family comparable · compare only the declared valid metrics':'Training-only · useful exposure, not direct performance evidence';
  const release=p.selectionReady===false?`<div class="fz-rx-withheld"><b>Not released</b><span>${esc(p.releaseReason||'This prescription is not execution-ready.')}</span></div>`:'';
  return `<details class="fz-execution-prescription"><summary>Full execution prescription</summary><div class="fz-execution-body"><div class="fz-protocol-meta"><span>${esc(p.protocolFamilyId||'NO FAMILY')}</span><span>v${esc(p.protocolVersion||'—')}</span><span>${esc(words(p.measurementPriority||'LOW'))} measurement priority</span></div><p class="fz-comparison-class">${esc(direct)}</p>${release}<section><h4>Pre-session gate</h4>${renderBlocks(p.preSessionGate)}</section><section><h4>Equipment</h4>${renderBlocks(p.equipment)}</section><section><h4>Warm-up</h4>${renderBlocks(p.warmup)}</section><section><h4>Main set</h4>${renderBlocks(p.mainSet)}</section><section><h4>Decision rules</h4>${renderBlocks(p.decisionRules)}</section><section><h4>Success criteria</h4>${renderBlocks(p.successCriteria)}</section><section><h4>Cool-down</h4>${renderBlocks(p.coolDown)}</section><section><h4>Report back</h4>${renderBlocks(p.postSessionReport)}</section></div></details>`;
}
function optionGuidance(option){
  const evidence=Array.isArray(option.evidenceBasis)?option.evidenceBasis.filter(Boolean):[];
  return `<details class="fz-option-guidance"><summary>How to execute this well</summary><div class="fz-option-guidance-body"><div><b>Success</b><span>${esc(option.successCondition||'Complete the intended dose without materially worsening the next valuable training opportunity.')}</span></div><div><b>Modify / stop</b><span>${esc(option.stopCondition||'Modify or stop if new pain, illness, GI, local-tissue or recovery evidence materially changes tolerance.')}</span></div><div><b>Confidence</b><span>${esc(words(option.confidence||'UNKNOWN'))}</span></div>${evidence.length?`<div><b>Evidence basis</b><span>${evidence.map(esc).join(' · ')}</span></div>`:''}</div></details>`;
}
function selectionControl(option,lane){
  if(option.prescription?.selectionReady===false)return `<div class="fz-option-choice fz-choice-disabled"><span>${esc(option.prescription.releaseReason||'This protocol is not released for selection.')}</span><button type="button" disabled>Not released</button></div>`;
  if(!athleteMode())return `<div class="fz-option-choice"><span>To select it, tell FZ: “I’ll do ${esc(option.title)}.” Or enter Athlete Mode to select securely in the app.</span><button type="button" data-athlete-login>Athlete Login</button></div>`;
  return `<div class="fz-option-choice"><span>This stores the exact protocol/version/fingerprint as your planned intent.</span><button type="button" data-select-option="${esc(option.optionId)}" data-select-lane="${esc(lane)}">Select this session</button></div>`;
}
function optionCard(option,index,lane){return `<article class="card rich fz-option-card"><div class="fz-option-head"><div><span class="eyebrow">OPTION ${index+1}</span><h3>${esc(option.title)}</h3></div><span class="pill">${esc(words(option.expectedCost))}</span></div><p>${esc(option.objective)}</p><div class="fz-option-dose"><b>Dose</b><span>${esc(option.dose)}</span></div><div class="microline"><strong>Why now:</strong> ${esc(option.whyNow)}</div>${option.targetedGaps?.length?`<div class="fz-option-gaps">Evidence target · ${option.targetedGaps.map(esc).join(' · ')}</div>`:''}${optionGuidance(option)}${prescriptionDetails(option)}${selectionControl(option,lane)}</article>`;}
function alternateLaneBlock(rec,lane){
  const options=Array.isArray(rec?.lanes?.[lane])?rec.lanes[lane]:[];
  return `<section class="fz-alternate-lane" data-alternate-lane="${esc(lane)}"><div class="fz-alternate-lane-head"><div><b>${esc(lane)}</b><span>${options.length} available option${options.length===1?'':'s'} in the current context</span></div></div>${options.length?`<div class="fz-options-grid fz-alternate-options">${options.map((option,index)=>optionCard(option,index,lane)).join('')}</div>`:'<p class="muted fz-alternate-empty">No session option is currently released for this lane.</p>'}</section>`;
}
function patchToday(){
  const rec=active(),card=document.querySelector('#today .fz-clean-recommendation');if(!card||!rec)return;
  const fingerprint=`today:${choiceFingerprint()}`;
  if(card.dataset.fz44Fingerprint===fingerprint)return;
  const options=recommendedOptions();
  card.dataset.fz44='1';
  card.dataset.fz44Fingerprint=fingerprint;
  card.innerHTML=`<div class="eyebrow">CURRENT FZ RECOMMENDATION · 4.4${rec.localDate?` · ${esc(rec.localDate)}`:''}</div><div class="fz-rec-line"><h3>${esc(rec.status==='READY'?rec.fzRecommendedLane:'WITHHELD')}</h3><span>${esc(rec.confidence||'—')} confidence</span></div><p>${esc(rec.explanation?.athleteFacing?.headline||whyNow())}</p><div class="microline"><strong>Why now:</strong> ${esc(whyNow())}</div><div class="microline"><strong>Objective:</strong> ${esc(objectiveConnection())}</div>${options[0]?`<div class="fz-today-option"><b>Best current session option</b><span>${esc(options[0].title)} · ${esc(options[0].dose)}</span></div>`:''}${decision()?`<div class="fz-current-choice"><b>Athlete choice</b><span>${esc(decision().option?.title||decision().optionId||'Recorded')} · ${esc(words(decision().selectedLane))}${decision().plannedForDate?` · ${esc(decision().plannedForDate)}`:''}</span></div>`:''}`;
}
function removeDuplicateSections(){
  document.querySelectorAll('[data-fz-context-recovery="today-decision"],[data-fz-context-recovery="today-objective"],[data-fz-context-recovery="train-executions"],[data-fz-context-recovery="trends-objective"]').forEach(node=>node.remove());
}
function renderTrainChoice(){
  const root=document.getElementById('train'),rec=active();if(!root||!rec)return;
  let section=root.querySelector('[data-fz44-choice]');
  if(!section){section=document.createElement('div');section.className='section fz44-choice-section';section.dataset.fz44Choice='1';root.insertBefore(section,root.firstElementChild);}
  const fingerprint=`train:${choiceFingerprint()}`;
  if(section.dataset.fz44Fingerprint===fingerprint)return;
  const options=recommendedOptions(),selected=decision();
  section.dataset.fz44Fingerprint=fingerprint;
  const alternateLanes=['ABSORB','MAINTAIN','ADAPT'].filter(lane=>lane!==rec.fzRecommendedLane);
  section.innerHTML=`<div class="section-head"><h2>Current Training Choice</h2><p>FZ recommendation → concrete options → exact protocol → athlete decision → planned intent → execution reconciliation</p></div><div class="fz-choice-summary"><div class="card decision rich"><div class="eyebrow">FZ RECOMMENDED LANE${rec.localDate?` · ${esc(rec.localDate)}`:''}</div><h3>${esc(rec.status==='READY'?rec.fzRecommendedLane:'WITHHELD')}</h3><p>${esc(whyNow())}</p><div class="microline"><strong>Objective connection:</strong> ${esc(objectiveConnection())}</div></div><div class="card rich"><div class="eyebrow">ATHLETE DECISION</div>${selected?`<h3>${esc(selected.option?.title||selected.optionId||'Recorded choice')}</h3><p>${esc(words(selected.selectedLane))}${selected.matchesFzRecommendation?' · accepted FZ direction':' · athlete override retained'}</p><div class="microline"><strong>Planned:</strong> ${esc(selected.plannedForDate||'—')} · <strong>Plan:</strong> ${esc(selected.plannedSessionId||'—')}</div>`:'<h3>Not selected yet</h3><p>Your choice remains separate from FZ’s recommendation until you act.</p><div class="microline">Choose naturally in chat or use authenticated Athlete Mode; FZ preserves the recommendation and your decision separately.</div>'}</div></div>${options.length?`<div class="fz-options-grid">${options.map((option,index)=>optionCard(option,index,rec.fzRecommendedLane)).join('')}</div>`:'<div class="card rich"><h3>No concrete session option is currently released.</h3><p>FZ has withheld session composition because the current recommendation context does not support it.</p></div>'}<details class="fz-alternate-lanes"><summary>See alternate lanes</summary><div class="fz-alternate-lane-list">${alternateLanes.map(lane=>alternateLaneBlock(rec,lane)).join('')}</div></details>`;
}
function rationaliseSystem(){
  const section=document.querySelector('#system [data-recommendation-shadow]');if(!section)return;
  if(section.dataset.fz44Rationalised!=='1'){
    section.querySelector('.card.rich')?.remove();
    section.dataset.fz44Rationalised='1';
  }
  const current=FZ_CHOICE.current,selected=decision();
  let technical=section.querySelector('[data-fz44-system-choice]');
  if(!technical){technical=document.createElement('div');technical.className='fz-choice-system';technical.dataset.fz44SystemChoice='1';section.appendChild(technical);}
  const fingerprint=`system:${choiceFingerprint()}`;
  if(technical.dataset.fz44Fingerprint===fingerprint)return;
  technical.dataset.fz44Fingerprint=fingerprint;
  technical.innerHTML=`<div><small>Option composer</small><b>${esc(active()?.sessionOptionComposerVersion||current?.markers?.sessionOptionComposerVersion||'—')}</b></div><div><small>Prescription composer</small><b>${esc(active()?.sessionPrescriptionComposerVersion||'—')}</b></div><div><small>Athlete Mode</small><b>${athleteMode()?'AUTHENTICATED':'VIEWER'}</b></div><div><small>Athlete decision</small><b>${selected?esc(selected.decisionId||'RECORDED'):'NONE'}</b></div><div><small>Planned intent</small><b>${selected?esc(selected.plannedSessionId||'—'):'NONE'}</b></div><div><small>Recommendation audit</small><b>${esc(active()?.shadowRecommendationId||'—')}</b></div>`;
}
function renderModeControl(){
  const topbar=document.querySelector('.topbar');if(!topbar)return;
  let control=topbar.querySelector('[data-fz-athlete-mode]');
  if(!control){control=document.createElement('div');control.className='fz-athlete-mode-control';control.dataset.fzAthleteMode='1';topbar.appendChild(control);}
  const fp=`${FZ_CHOICE.auth.available}:${FZ_CHOICE.auth.configured}:${athleteMode()}`;if(control.dataset.fingerprint===fp)return;control.dataset.fingerprint=fp;
  if(FZ_CHOICE.auth.available===false){control.innerHTML='<span class="fz-mode-pill">VIEWER MODE</span>';return;}
  if(athleteMode())control.innerHTML='<span class="fz-mode-pill athlete">ATHLETE MODE · EDITING ENABLED</span><button type="button" data-lock-athlete>Lock Athlete Mode</button>';
  else control.innerHTML='<span class="fz-mode-pill">VIEWER MODE</span><button type="button" data-athlete-login>Athlete Login</button>';
}
function landingMarkup(){
  const configured=FZ_CHOICE.auth.configured;
  return `<div class="fz-mode-gate-card"><div class="logo">FZ</div><div class="eyebrow">FZ PERFORMANCE · SECURE ACCESS</div><h2>${configured?'Choose how you want to enter':'Set up Athlete Access or continue read-only'}</h2><p>Viewer Mode can inspect FZ without changing athlete state. Athlete Mode securely enables workout selection.</p><div class="fz-mode-gate-actions"><button type="button" data-enter-viewer>Continue in Viewer Mode</button><button type="button" class="primary" data-open-auth>${configured?'Athlete Login':'Set up Athlete Access'}</button></div></div>`;
}
function authFormMarkup(mode){
  const setup=mode==='SETUP'||mode==='RESET';
  return `<div class="fz-auth-card"><button class="fz-auth-close" type="button" data-auth-close>×</button><div class="eyebrow">${mode==='LOGIN'?'ATHLETE LOGIN':mode==='RESET'?'RESET ATHLETE PIN':'FIRST-TIME ATHLETE ACCESS'}</div><h2>${mode==='LOGIN'?'Enter your PIN':mode==='RESET'?'Choose a new PIN':'Choose your Athlete PIN'}</h2><p>${setup?'Use the one-time setup/recovery proof from the trusted FZ administrative path. Your permanent PIN is chosen here and is never sent through chat.':'Successful login enables secure in-app workout selection for this browser session.'}</p><form data-athlete-auth-form data-action="${mode}">${setup?'<label>One-time setup/recovery proof<input name="bootstrapProof" autocomplete="one-time-code" required></label>':''}<label>PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="current-password" required></label>${setup?'<label>Confirm PIN<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="new-password" required></label>':''}<div class="fz-auth-error" role="alert"></div><button class="primary" type="submit">${mode==='LOGIN'?'Enter Athlete Mode':mode==='RESET'?'Reset PIN':'Create Athlete Access'}</button>${mode==='LOGIN'?'<button type="button" class="fz-text-button" data-reset-pin>Reset PIN</button>':''}</form></div>`;
}
function ensureOverlay(){let overlay=document.querySelector('[data-fz-mode-overlay]');if(!overlay){overlay=document.createElement('div');overlay.className='fz-mode-overlay';overlay.dataset.fzModeOverlay='1';overlay.hidden=true;document.body.appendChild(overlay);}return overlay;}
function showLanding(){const overlay=ensureOverlay();overlay.innerHTML=landingMarkup();overlay.hidden=false;document.body.classList.add('fz-modal-open');}
function showAuth(mode){const overlay=ensureOverlay();overlay.innerHTML=authFormMarkup(mode);overlay.hidden=false;document.body.classList.add('fz-modal-open');queueMicrotask(()=>overlay.querySelector('input')?.focus());}
function hideOverlay(){const overlay=ensureOverlay();overlay.hidden=true;overlay.innerHTML='';document.body.classList.remove('fz-modal-open');}
function reconcileLanding(){
  if(FZ_CHOICE.auth.available!==true||athleteMode()||FZ_CHOICE.landingDismissed){hideOverlay();return;}
  showLanding();
}
async function selectOption(lane,optionId,button){
  const rec=active();if(!athleteMode()||!rec?.recommendationVersion)return;
  button.disabled=true;const previous=button.textContent;button.textContent='Saving…';
  try{
    const nonce=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const response=await fetch('/api/training/athlete-event',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-FZ-CSRF':FZ_CHOICE.auth.csrfToken||'','X-FZ-Idempotency-Key':nonce},body:JSON.stringify({kind:'ADAPTIVE_CHOICE',choice:{recommendationVersion:rec.recommendationVersion,lane,optionId}})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.detail||payload.error||`Selection failed (${response.status})`);
    button.textContent='Selected';await refresh();
  }catch(error){button.disabled=false;button.textContent=previous;window.alert?.(String(error?.message||error));}
}
async function submitAuth(form){
  if(FZ_CHOICE.authBusy)return;FZ_CHOICE.authBusy=true;
  const data=new FormData(form),action=String(form.dataset.action||'LOGIN'),pin=String(data.get('pin')||''),confirmPin=String(data.get('confirmPin')||''),bootstrapProof=String(data.get('bootstrapProof')||''),errorNode=form.querySelector('.fz-auth-error'),submit=form.querySelector('button[type="submit"]');
  errorNode.textContent='';if((action==='SETUP'||action==='RESET')&&pin!==confirmPin){errorNode.textContent='The two PIN entries do not match.';FZ_CHOICE.authBusy=false;return;}
  submit.disabled=true;
  try{await authPost({action,pin,...((action==='SETUP'||action==='RESET')?{bootstrapProof}:{})});form.reset();hideOverlay();scheduleRender();}
  catch(error){errorNode.textContent=String(error?.message||error);submit.disabled=false;}
  finally{FZ_CHOICE.authBusy=false;}
}
async function lockAthleteMode(){
  if(!athleteMode())return;
  try{await authPost({action:'LOGOUT'});}catch{}
  FZ_CHOICE.auth={available:true,configured:true,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null};FZ_CHOICE.landingDismissed=true;sessionStorage.setItem('fzViewerMode','1');scheduleRender();
}
function render(){
  if(FZ_CHOICE.rendering)return;
  FZ_CHOICE.rendering=true;
  observer.disconnect();
  try{removeDuplicateSections();patchToday();renderTrainChoice();rationaliseSystem();renderModeControl();reconcileLanding();}
  finally{observer.observe(observerRoot,{childList:true,subtree:true});FZ_CHOICE.rendering=false;}
}
function scheduleRender(){
  if(FZ_CHOICE.renderScheduled||FZ_CHOICE.rendering)return;
  FZ_CHOICE.renderScheduled=true;
  setTimeout(()=>{FZ_CHOICE.renderScheduled=false;render();},0);
}
async function refresh(){if(FZ_CHOICE.loading)return;FZ_CHOICE.loading=true;try{const payload=await readCurrent();if(payload?.ok){FZ_CHOICE.current=payload;scheduleRender();}}catch{}finally{FZ_CHOICE.loading=false;}}
async function boot(){await readAuthStatus();await refresh();scheduleRender();}

document.addEventListener('click',event=>{
  const login=event.target.closest('[data-athlete-login],[data-open-auth]');if(login){showAuth(FZ_CHOICE.auth.configured?'LOGIN':'SETUP');return;}
  if(event.target.closest('[data-enter-viewer]')){FZ_CHOICE.landingDismissed=true;sessionStorage.setItem('fzViewerMode','1');hideOverlay();scheduleRender();return;}
  if(event.target.closest('[data-auth-close]')){hideOverlay();return;}
  if(event.target.closest('[data-reset-pin]')){showAuth('RESET');return;}
  if(event.target.closest('[data-lock-athlete]')){lockAthleteMode();return;}
  const select=event.target.closest('[data-select-option]');if(select)selectOption(select.dataset.selectLane,select.dataset.selectOption,select);
});
document.addEventListener('submit',event=>{const form=event.target.closest('[data-athlete-auth-form]');if(!form)return;event.preventDefault();submitAuth(form);});
const observerRoot=document.querySelector('.main')||document.documentElement;
const observer=new MutationObserver(scheduleRender);observer.observe(observerRoot,{childList:true,subtree:true});
setTimeout(boot,0);window.addEventListener('focus',()=>{refresh();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
