/* FZ Performance — Training Exposure v1. Projection over canonical /api/trends/current only. */

const FZ_EXPOSURE={data:null,window:'28',metric:'TIME',modality:'ALL',customStart:null,customEnd:null,loading:false};

const EXPOSURE_MODALITIES=[
  ['ALL','All'],['RUNNING','Run'],['STRENGTH','Strength'],['BIKE','Bike'],['ROWING','Row'],['SKI_ERG','Ski'],['ELLIPTICAL','Elliptical'],['MOBILITY_WALKING','Mobility / Walk'],['OTHER','Other']
];

function exposureEsc(v){return String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function exposureNum(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function exposureFmt(v,d=0){const n=exposureNum(v);return n===null?'—':n.toLocaleString('en-ZA',{minimumFractionDigits:d,maximumFractionDigits:d});}
function exposureDate(v){if(!v)return'—';const d=new Date(`${v}T12:00:00Z`);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('en-ZA',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);}
function addDays(date,days){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function modalityBucket(modality){
  const m=String(modality||'OTHER').toUpperCase();
  if(m==='CYCLING'||m==='ASSAULT_BIKE'||m==='BIKE'||m==='BIKE_ERG')return'BIKE';
  if(m==='MOBILITY'||m==='WALKING')return'MOBILITY_WALKING';
  if(['RUNNING','STRENGTH','ROWING','SKI_ERG','ELLIPTICAL'].includes(m))return m;
  return'OTHER';
}
function modalityLabel(bucket){return EXPOSURE_MODALITIES.find(([id])=>id===bucket)?.[1]||'Other';}
function exposureRoot(){return document.querySelector('#trends');}
function findExposureAnchor(root){return [...root.querySelectorAll(':scope > .section')].find(section=>section.querySelector(':scope > .section-head h2')?.textContent?.trim()==='Exposure Cost')||null;}
function allSessions(){return Array.isArray(FZ_EXPOSURE.data?.trainingExposure?.sessions)?FZ_EXPOSURE.data.trainingExposure.sessions:[];}
function canonicalRange(){return FZ_EXPOSURE.data?.range||{};}
function selectedRange(){
  const range=canonicalRange();
  const end=FZ_EXPOSURE.window==='CUSTOM'?(FZ_EXPOSURE.customEnd||range.endDate):range.endDate;
  const start=FZ_EXPOSURE.window==='CUSTOM'?(FZ_EXPOSURE.customStart||range.startDate):addDays(end,-(Number(FZ_EXPOSURE.window)-1));
  return {start:start<range.startDate?range.startDate:start,end:end>range.endDate?range.endDate:end};
}
function selectedSessions(){
  const {start,end}=selectedRange();
  return allSessions().filter(s=>s.date>=start&&s.date<=end&&(FZ_EXPOSURE.modality==='ALL'||modalityBucket(s.modality)===FZ_EXPOSURE.modality));
}
function exposureDays(){
  const {start,end}=selectedRange();const days=[];
  for(let d=start;d<=end;d=addDays(d,1))days.push(d);
  return days;
}
function sessionValue(session,metric){
  if(metric==='TIME')return exposureNum(session.durationMin);
  if(metric==='LOAD')return session.nclAvailable?exposureNum(session.ncl):null;
  if(metric==='VOLUME'){
    const bucket=modalityBucket(session.modality);
    if(bucket==='STRENGTH')return exposureNum(session.strengthSetCount);
    return exposureNum(session.distanceKm);
  }
  return null;
}
function metricUnit(){
  if(FZ_EXPOSURE.metric==='TIME')return'min';
  if(FZ_EXPOSURE.metric==='LOAD')return'NCL';
  if(FZ_EXPOSURE.modality==='STRENGTH')return'sets';
  return'km';
}
function volumeComparable(){
  if(FZ_EXPOSURE.metric!=='VOLUME')return true;
  if(FZ_EXPOSURE.modality==='ALL')return false;
  if(['MOBILITY_WALKING','OTHER'].includes(FZ_EXPOSURE.modality))return false;
  return true;
}
function dailySeries(){
  const sessions=selectedSessions();const days=exposureDays();
  return days.map(date=>{
    const rows=sessions.filter(s=>s.date===date);const buckets={};let known=0,missing=0,total=0;
    for(const s of rows){const value=sessionValue(s,FZ_EXPOSURE.metric);if(value===null){missing++;continue;}known++;total+=value;const bucket=modalityBucket(s.modality);buckets[bucket]=(buckets[bucket]||0)+value;}
    return {date,total,known,missing,buckets};
  });
}
function summary(){
  const sessions=selectedSessions();
  const duration=sessions.map(s=>exposureNum(s.durationMin)).filter(v=>v!==null);
  const loads=sessions.filter(s=>s.nclAvailable).map(s=>exposureNum(s.ncl)).filter(v=>v!==null);
  const distance=sessions.map(s=>exposureNum(s.distanceKm)).filter(v=>v!==null);
  const strength=sessions.map(s=>exposureNum(s.strengthSetCount)).filter(v=>v!==null);
  const hr=sessions.map(s=>Array.isArray(s.hrDistributionSeconds)?s.hrDistributionSeconds:null).filter(Boolean);
  const hrTotals=hr.reduce((acc,row)=>row.map((v,i)=>acc[i]+Number(v||0)),[0,0,0]);
  const hrAll=hrTotals.reduce((a,b)=>a+b,0);
  const buckets={};
  for(const s of sessions){const bucket=modalityBucket(s.modality);const min=exposureNum(s.durationMin);if(min!==null)buckets[bucket]=(buckets[bucket]||0)+min;}
  return {
    sessions:sessions.length,
    durationMin:duration.reduce((a,b)=>a+b,0),durationKnown:duration.length,
    ncl:loads.reduce((a,b)=>a+b,0),nclKnown:loads.length,
    distanceKm:distance.reduce((a,b)=>a+b,0),distanceKnown:distance.length,
    strengthSets:strength.reduce((a,b)=>a+b,0),strengthKnown:strength.length,
    hrTotals,hrAll,buckets
  };
}
function formatDuration(min){if(!Number.isFinite(min))return'—';const h=Math.floor(min/60),m=Math.round(min%60);return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m} min`;}
function interpretation(sum){
  if(!sum.sessions)return'No canonical sessions match this window and modality filter.';
  const ordered=Object.entries(sum.buckets).sort((a,b)=>b[1]-a[1]);
  const lead=ordered[0];
  if(!lead)return`${sum.sessions} canonical session${sum.sessions===1?'':'s'} are present, but duration detail is incomplete.`;
  const share=sum.durationMin>0?Math.round(lead[1]/sum.durationMin*100):null;
  return `${modalityLabel(lead[0])} is the largest time exposure${share!==null?` at ${share}% of recorded training time`:''} in this view. ${sum.nclKnown<sum.sessions?'Relative load coverage is partial, so missing NCL is not treated as zero.':'Relative load coverage is complete for the filtered sessions.'}`;
}
function controls(){
  const range=canonicalRange();const {start,end}=selectedRange();
  return `<div class="fz-exposure-controls">
    <div class="fz-exposure-control-group" aria-label="Exposure window">${[['7','7 DAYS'],['28','28 DAYS'],['CUSTOM','CUSTOM']].map(([id,label])=>`<button type="button" data-exposure-window="${id}" class="${FZ_EXPOSURE.window===id?'active':''}">${label}</button>`).join('')}</div>
    ${FZ_EXPOSURE.window==='CUSTOM'?`<div class="fz-exposure-custom"><label>From <input type="date" data-exposure-start min="${range.startDate}" max="${end}" value="${start}"/></label><label>To <input type="date" data-exposure-end min="${start}" max="${range.endDate}" value="${end}"/></label></div>`:''}
    <div class="fz-exposure-control-group fz-exposure-modalities" aria-label="Exposure modality">${EXPOSURE_MODALITIES.map(([id,label])=>`<button type="button" data-exposure-modality="${id}" class="${FZ_EXPOSURE.modality===id?'active':''}">${label}</button>`).join('')}</div>
    <div class="fz-exposure-control-group" aria-label="Exposure measure">${['TIME','LOAD','VOLUME'].map(id=>`<button type="button" data-exposure-metric="${id}" class="${FZ_EXPOSURE.metric===id?'active':''}">${id}</button>`).join('')}</div>
  </div>`;
}
function summaryStrip(sum){
  return `<div class="fz-exposure-summary">
    <div><small>Training time</small><b>${formatDuration(sum.durationMin)}</b><span>${sum.durationKnown}/${sum.sessions} sessions covered</span></div>
    <div><small>Relative load</small><b>${sum.nclKnown?exposureFmt(sum.ncl,1):'—'}</b><span>${sum.nclKnown}/${sum.sessions} sessions with NCL</span></div>
    <div><small>Distance evidence</small><b>${sum.distanceKnown?`${exposureFmt(sum.distanceKm,1)} km`:'—'}</b><span>Only source-supported distance</span></div>
    <div><small>Strength detail</small><b>${sum.strengthKnown?`${exposureFmt(sum.strengthSets)} sets`:'—'}</b><span>${sum.strengthKnown}/${sum.sessions} sessions with set detail</span></div>
  </div>`;
}
function chart(){
  if(!volumeComparable())return `<div class="fz-exposure-empty"><b>Choose one modality for volume.</b><span>FZ will not sum running kilometres, machine distance and strength sets into one synthetic volume number.</span></div>`;
  const series=dailySeries();const max=Math.max(...series.map(p=>p.total),0);const unit=metricUnit();
  const visible=series.filter((_,i)=>series.length<=14||i%Math.ceil(series.length/14)===0||i===series.length-1);
  return `<div class="fz-exposure-chart" role="img" aria-label="Training exposure over selected dates">${series.map((point,index)=>{
    const height=max>0?Math.max(2,Math.round(point.total/max*100)):0;
    const label=visible.includes(point)?new Intl.DateTimeFormat('en-ZA',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${point.date}T12:00:00Z`)):'';
    const segments=Object.entries(point.buckets).sort((a,b)=>b[1]-a[1]);let offset=0;
    const stacked=segments.map(([bucket,value])=>{const pct=point.total>0?value/point.total*100:0;const html=`<i data-bucket="${bucket}" style="height:${pct}%;bottom:${offset}%" title="${exposureEsc(modalityLabel(bucket))}: ${exposureFmt(value,1)} ${unit}"></i>`;offset+=pct;return html;}).join('');
    return `<div class="fz-exposure-day"><div class="fz-exposure-value">${point.total?exposureFmt(point.total,0):''}${point.missing?'<sup>•</sup>':''}</div><div class="fz-exposure-bar" style="height:${height}%">${stacked}</div><span>${label}</span></div>`;
  }).join('')}</div>`;
}
function composition(sum){
  const ordered=Object.entries(sum.buckets).sort((a,b)=>b[1]-a[1]);
  if(!ordered.length)return'';
  return `<div class="fz-exposure-composition">${ordered.map(([bucket,min])=>{const pct=sum.durationMin>0?min/sum.durationMin*100:0;return `<div><div><b>${exposureEsc(modalityLabel(bucket))}</b><span>${formatDuration(min)} · ${Math.round(pct)}%</span></div><meter min="0" max="100" value="${pct}"></meter></div>`;}).join('')}</div>`;
}
function intensity(sum){
  if(!sum.hrAll)return`<div class="fz-exposure-quality"><b>Intensity composition unavailable</b><span>No HR-zone distribution is present in the filtered sessions. FZ does not infer intensity from duration alone.</span></div>`;
  const names=['Low','Moderate','High'];
  return `<div class="fz-exposure-intensity"><div class="fz-exposure-intensity-head"><b>Tredict relative intensity mix</b><span>HR-zone time from covered sessions</span></div><div class="fz-exposure-intensity-bar">${sum.hrTotals.map((v,i)=>`<i data-zone="${i}" style="width:${v/sum.hrAll*100}%" title="${names[i]}: ${Math.round(v/60)} min"></i>`).join('')}</div><div class="fz-exposure-intensity-legend">${sum.hrTotals.map((v,i)=>`<span><i data-zone="${i}"></i>${names[i]} ${Math.round(v/sum.hrAll*100)}%</span>`).join('')}</div></div>`;
}
function renderExposure(){
  const root=exposureRoot();if(!root||!FZ_EXPOSURE.data)return;
  const anchor=findExposureAnchor(root);if(!anchor)return;
  let section=root.querySelector(':scope > .fz-training-exposure-v1');
  if(!section){section=document.createElement('section');section.className='section fz-phase2-section fz-training-exposure-v1';anchor.insertAdjacentElement('afterend',section);}
  const sum=summary();const {start,end}=selectedRange();
  section.innerHTML=`<div class="section-head"><div><span class="fz-phase2-kicker">TRAINING EXPOSURE</span><h2>What have I actually trained?</h2><p>Filter canonical training by date, modality and exposure measure. Time is universal; load is Tredict-derived; volume stays modality-specific.</p></div></div>
    <div class="fz-exposure-shell">
      <div class="fz-exposure-interpretation"><span>${exposureEsc(exposureDate(start))} → ${exposureEsc(exposureDate(end))}</span><h3>${exposureEsc(interpretation(sum))}</h3></div>
      ${controls()}${summaryStrip(sum)}
      <div class="fz-exposure-plot"><div class="fz-exposure-plot-head"><div><b>${exposureEsc(FZ_EXPOSURE.metric==='TIME'?'Training time':FZ_EXPOSURE.metric==='LOAD'?'Relative training load':'Modality-specific volume')}</b><span>${exposureEsc(FZ_EXPOSURE.modality==='ALL'?'All canonical modalities':modalityLabel(FZ_EXPOSURE.modality))}</span></div><span>${exposureEsc(metricUnit())}</span></div>${chart()}</div>
      <div class="fz-exposure-lower">${composition(sum)}${intensity(sum)}</div>
      <div class="fz-exposure-quality"><b>Evidence coverage</b><span>${sum.durationKnown}/${sum.sessions} sessions have duration · ${sum.nclKnown}/${sum.sessions} have canonical NCL · bullet markers on the chart indicate missing detail. Missing evidence is never plotted as zero.</span></div>
    </div>`;
}
async function loadExposure(){
  if(FZ_EXPOSURE.loading||FZ_EXPOSURE.data)return;
  FZ_EXPOSURE.loading=true;
  try{
    const response=await fetch('/api/trends/current?days=90',{cache:'no-store'});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
    const data=await response.json();if(!data?.ok||!data?.trainingExposure?.sessions)throw new Error('Training Exposure projection unavailable');
    FZ_EXPOSURE.data=data;FZ_EXPOSURE.customStart=data.range?.startDate||null;FZ_EXPOSURE.customEnd=data.range?.endDate||null;renderExposure();
  }catch(error){
    const root=exposureRoot(),anchor=root&&findExposureAnchor(root);if(root&&anchor){let section=root.querySelector(':scope > .fz-training-exposure-v1');if(!section){section=document.createElement('section');section.className='section fz-training-exposure-v1';anchor.insertAdjacentElement('afterend',section);}section.innerHTML=`<div class="fz-exposure-empty"><b>Training Exposure unavailable</b><span>${exposureEsc(error?.message||'Canonical exposure projection could not be loaded.')}</span></div>`;}
  }finally{FZ_EXPOSURE.loading=false;}
}
function scheduleExposure(){queueMicrotask(()=>{const root=exposureRoot();if(!root)return;if(findExposureAnchor(root)){if(FZ_EXPOSURE.data)renderExposure();else loadExposure();}});}

document.addEventListener('click',event=>{
  const windowButton=event.target.closest('[data-exposure-window]');if(windowButton){FZ_EXPOSURE.window=windowButton.dataset.exposureWindow;renderExposure();return;}
  const modalityButton=event.target.closest('[data-exposure-modality]');if(modalityButton){FZ_EXPOSURE.modality=modalityButton.dataset.exposureModality;renderExposure();return;}
  const metricButton=event.target.closest('[data-exposure-metric]');if(metricButton){FZ_EXPOSURE.metric=metricButton.dataset.exposureMetric;renderExposure();return;}
  if(event.target.closest('[data-page="trends"],[data-open-page="trends"]'))scheduleExposure();
});
document.addEventListener('change',event=>{
  if(event.target.matches('[data-exposure-start]')){FZ_EXPOSURE.customStart=event.target.value;if(FZ_EXPOSURE.customEnd<FZ_EXPOSURE.customStart)FZ_EXPOSURE.customEnd=FZ_EXPOSURE.customStart;renderExposure();}
  if(event.target.matches('[data-exposure-end]')){FZ_EXPOSURE.customEnd=event.target.value;if(FZ_EXPOSURE.customStart>FZ_EXPOSURE.customEnd)FZ_EXPOSURE.customStart=FZ_EXPOSURE.customEnd;renderExposure();}
});
new MutationObserver(scheduleExposure).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('focus',scheduleExposure);
scheduleExposure();
