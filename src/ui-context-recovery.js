/* FZ cross-surface rationalisation v2 — freshness + longitudinal evidence only. Current recommendation/choice belongs to adaptive-choice.js. */
const api={runtime:'/api/runtime-state',wellness:'/api/wellness/today?refresh=0',trends:'/api/trends/current?days=45'};
let snapshot={runtime:null,wellness:null,trends:null},enhancing=false,refreshTimer=null;
const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
async function getJson(url){const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`${response.status}`);return response.json();}
async function refreshSnapshot(){const entries=await Promise.allSettled(Object.entries(api).map(async([key,url])=>[key,await getJson(url)]));for(const item of entries){if(item.status!=='fulfilled')continue;const[key,value]=item.value;snapshot[key]=value;}enhance();}
function runtimeAnchorDate(){return String(snapshot.runtime?.stateId||snapshot.runtime?.masterAsOf||'').slice(0,10)||null;}
function wellnessDate(){return snapshot.wellness?.date||snapshot.wellness?.wellness?.date||null;}
function runtimeAnchorIsCurrent(){return Boolean(runtimeAnchorDate()&&wellnessDate()&&runtimeAnchorDate()===wellnessDate());}
function decorateReadinessFreshness(){
  const card=document.querySelector('#today .fz-clean-readiness');if(!card)return;
  let note=card.querySelector('[data-fz-readiness-anchor-note]');
  if(runtimeAnchorIsCurrent()){note?.remove();return;}
  if(!note){note=document.createElement('div');note.dataset.fzReadinessAnchorNote='1';note.className='fz-readiness-anchor-note';card.appendChild(note);}
  note.textContent=`Readiness score = last validated anchor (${runtimeAnchorDate()||'unknown date'}). Current physiology and the active recommendation remain separate live contracts.`;
}
function tagCapabilities(){
  const root=document.getElementById('trends');if(!root)return;
  const section=[...root.querySelectorAll(':scope > .section')].find(item=>item.querySelector('.section-head h2')?.textContent?.trim()==='Trajectory & Measurement Gaps'||item.querySelector('.section-head h2')?.textContent?.trim()==='Primary Objective Capability Priorities');
  if(section){const h2=section.querySelector('.section-head h2'),p=section.querySelector('.section-head p');if(h2)h2.textContent='Primary Objective Capability Priorities';if(p)p.textContent='Longitudinal evidence hierarchy · current recommendation is intentionally kept on TODAY/TRAIN';}
  const cards=[...root.querySelectorAll('.fz-clean-cap-grid .cap')];
  for(const card of cards){
    const priority=card.querySelector('.cap-pri')?.textContent?.trim()||'';card.classList.remove('fz-cap-primary','fz-cap-secondary','fz-cap-support');
    if(/Priority [1-3]/i.test(priority))card.classList.add('fz-cap-primary');else if(/Priority [4-5]/i.test(priority))card.classList.add('fz-cap-secondary');else card.classList.add('fz-cap-support');
    if(card.querySelector('.fz-cap-detail'))continue;
    const name=card.querySelector('.cap-name')?.textContent?.trim(),cap=(snapshot.trends?.capabilities||[]).find(item=>item.name===name);if(!cap)continue;
    const details=document.createElement('details');details.className='fz-cap-detail';details.innerHTML=`<summary>Evidence detail</summary><div><small>Observation</small><p>${esc(cap.obs)}</p><small>Inference</small><p>${esc(cap.inf)}</p><small>Coaching judgement</small><p>${esc(cap.decision)}</p></div>`;card.appendChild(details);
  }
}
function removeLegacyContextSections(){document.querySelectorAll('[data-fz-context-recovery="today-decision"],[data-fz-context-recovery="today-objective"],[data-fz-context-recovery="train-intent"],[data-fz-context-recovery="train-executions"],[data-fz-context-recovery="trends-objective"]').forEach(node=>node.remove());}
function enhance(){if(enhancing)return;enhancing=true;try{removeLegacyContextSections();decorateReadinessFreshness();tagCapabilities();}finally{enhancing=false;}}
const observer=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(enhance,30);});observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',refreshSnapshot);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSnapshot();});setTimeout(refreshSnapshot,0);setInterval(()=>{if(document.visibilityState==='visible')refreshSnapshot();},60000);
