/* FZ cross-surface rationalisation v3 — mutation-stable freshness + longitudinal evidence only. */
const api={runtime:'/api/runtime-state',wellness:'/api/wellness/today?refresh=0',trends:'/api/trends/current?days=45'};
let snapshot={runtime:null,wellness:null,trends:null},enhancing=false,refreshTimer=null;
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const setText=(node,value)=>{const next=String(value??'');if(node&&node.textContent!==next)node.textContent=next;};
async function getJson(url){const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${response.status}`);return response.json();}
async function refreshSnapshot(){const entries=await Promise.allSettled(Object.entries(api).map(async([key,url])=>[key,await getJson(url)]));for(const item of entries){if(item.status!=='fulfilled')continue;const[key,value]=item.value;snapshot[key]=value;}enhance();}
function runtimeReadiness(){return snapshot.runtime?.renderContract?.readiness||null;}
function runtimeAnchorDate(){return String(snapshot.runtime?.stateId||snapshot.runtime?.masterAsOf||runtimeReadiness()?.runtimeReadinessDate||'').slice(0,10)||null;}
function wellnessDate(){return snapshot.wellness?.date||snapshot.wellness?.wellness?.date||null;}
function runtimeAnchorIsCurrent(){return Boolean(runtimeAnchorDate()&&wellnessDate()&&runtimeAnchorDate()===wellnessDate());}
function canonicalReadinessIsCurrent(){const readiness=runtimeReadiness();return readiness?.canonicalReadinessCurrent===true&&Boolean(readiness?.readinessEngineVersion);}
function decorateReadinessFreshness(){
  const card=document.querySelector('#today .fz-clean-readiness');if(!card)return;
  let note=card.querySelector('[data-fz-readiness-anchor-note]');
  if(canonicalReadinessIsCurrent()||runtimeAnchorIsCurrent()){note?.remove();return;}
  if(!note){note=document.createElement('div');note.dataset.fzReadinessAnchorNote='1';note.className='fz-readiness-anchor-note';card.appendChild(note);}
  setText(note,`Readiness score = last validated anchor (${runtimeAnchorDate()||'unknown date'}). Current physiology and the active recommendation remain separate live contracts.`);
}
function capabilitySection(root){return [...root.querySelectorAll(':scope > .section')].find(item=>{const title=item.querySelector('.section-head h2')?.textContent?.trim();return title==='Trajectory & Measurement Gaps'||title==='Primary Objective Capability Priorities';})||null;}
function tagCapabilities(){
  const root=document.getElementById('trends');if(!root)return;
  const section=capabilitySection(root);
  if(section){
    const h2=section.querySelector('.section-head h2'),p=section.querySelector('.section-head p');
    setText(h2,'Primary Objective Capability Priorities');
    setText(p,'Longitudinal evidence hierarchy · current recommendation is intentionally kept on TODAY/TRAIN');
  }
  const cards=[...root.querySelectorAll('.fz-clean-cap-grid .cap')];
  for(const card of cards){
    const priority=card.querySelector('.cap-pri')?.textContent?.trim()||'';
    const target=/Priority [1-3]/i.test(priority)?'fz-cap-primary':/Priority [4-5]/i.test(priority)?'fz-cap-secondary':'fz-cap-support';
    for(const klass of ['fz-cap-primary','fz-cap-secondary','fz-cap-support'])card.classList.toggle(klass,klass===target);
    if(card.querySelector('.fz-cap-detail'))continue;
    const name=card.querySelector('.cap-name')?.textContent?.trim(),cap=(snapshot.trends?.capabilities||[]).find(item=>item.name===name);if(!cap)continue;
    const details=document.createElement('details');details.className='fz-cap-detail';details.innerHTML=`<summary>Evidence detail</summary><div><small>Observation</small><p>${esc(cap.obs)}</p><small>Inference</small><p>${esc(cap.inf)}</p><small>Coaching judgement</small><p>${esc(cap.decision)}</p></div>`;card.appendChild(details);
  }
}
function removeLegacyContextSections(){document.querySelectorAll('[data-fz-context-recovery="today-decision"],[data-fz-context-recovery="today-objective"],[data-fz-context-recovery="train-intent"],[data-fz-context-recovery="train-executions"],[data-fz-context-recovery="trends-objective"]').forEach(node=>node.remove());}
function enhance(){if(enhancing)return;enhancing=true;try{removeLegacyContextSections();decorateReadinessFreshness();tagCapabilities();}finally{enhancing=false;}}
function scheduleEnhance(){clearTimeout(refreshTimer);refreshTimer=setTimeout(enhance,40);}
const observerRoot=document.querySelector('.main')||document.documentElement;
const observer=new MutationObserver(scheduleEnhance);observer.observe(observerRoot,{childList:true,subtree:true});
window.addEventListener('focus',refreshSnapshot);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSnapshot();});document.addEventListener('fz:source-persisted',refreshSnapshot);setTimeout(refreshSnapshot,0);setInterval(()=>{if(document.visibilityState==='visible')refreshSnapshot();},60000);
