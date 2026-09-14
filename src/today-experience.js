const FZ_TODAY_EXPERIENCE={mounted:false,lastDate:null,timer:null};

const FZ_DAILY_THOUGHTS=[
  ['DISCIPLINE','Do the work that makes tomorrow easier.'],
  ['CONSISTENCY','Progress compounds when ordinary days are handled well.'],
  ['EXECUTION','A good plan matters. A well-executed plan matters more.'],
  ['PERSPECTIVE','Not every session must prove fitness. Some sessions build it.'],
  ['RECOVERY','Recovery is not time away from training. It is part of training.'],
  ['ADAPTATION','The signal is only useful if you can absorb it.'],
  ['DISCIPLINE','Motivation can start the session. Discipline finishes the cycle.'],
  ['CONSISTENCY','One perfect day changes little. Repeated good days change everything.'],
  ['EXECUTION','Train the session you need, not the session your ego wants.'],
  ['PERSPECTIVE','Fitness is built quietly long before it becomes obvious.'],
  ['RECOVERY','Rest with intent so the next hard effort can be honest.'],
  ['ADAPTATION','Stress creates the opportunity. Recovery decides what you keep.'],
  ['DISCIPLINE','The standard is simple: show up, pay attention, execute.'],
  ['CONSISTENCY','Small useful exposures beat occasional heroic ones.'],
  ['EXECUTION','Control the first half so you can own the second.'],
  ['PERSPECTIVE','A difficult session is information, not a verdict.'],
  ['RECOVERY','Fresh enough to train well is better than tired enough to feel tough.'],
  ['ADAPTATION','The body responds to patterns, not promises.'],
  ['DISCIPLINE','Keep the agreement you made with the goal.'],
  ['CONSISTENCY','Build a week you can repeat, then earn the right to add more.'],
  ['EXECUTION','Make the next decision well. Then make the next one.'],
  ['PERSPECTIVE','The scoreboard is useful. The process is what moves it.'],
  ['RECOVERY','A lighter day can protect a heavier ambition.'],
  ['ADAPTATION','Train hard enough to create change, not so hard that change cannot happen.'],
  ['DISCIPLINE','You do not need perfect conditions to do useful work.'],
  ['CONSISTENCY','Durability is consistency that survived imperfect weeks.'],
  ['EXECUTION','Pace with intention. Move with purpose. Finish with control.'],
  ['PERSPECTIVE','Today is one data point. Your direction is the story.'],
  ['RECOVERY','When recovery is the limiter, more work is not more progress.'],
  ['ADAPTATION','The goal is not to tolerate training. It is to adapt to it.'],
  ['DISCIPLINE','Confidence grows from evidence. Go create some.'],
  ['CONSISTENCY','The boring basics become remarkable when repeated long enough.'],
  ['EXECUTION','Use the data, trust the preparation, then do the work.'],
  ['PERSPECTIVE','A missed target can still produce a useful lesson.'],
  ['RECOVERY','Sleep is training you perform with your eyes closed.'],
  ['ADAPTATION','Better is often quieter than harder.'],
  ['DISCIPLINE','Start before you feel ready. Adjust once you have real information.'],
  ['CONSISTENCY','The strongest routine is the one that survives real life.'],
  ['EXECUTION','Do not chase intensity. Earn it through readiness and control.'],
  ['PERSPECTIVE','Performance is not one number. It is the pattern behind the numbers.'],
  ['RECOVERY','Protect tomorrow when today has already done enough.'],
  ['ADAPTATION','Every useful session should leave something for the next one.'],
  ['DISCIPLINE','Stay patient enough to become dangerous later.'],
  ['CONSISTENCY','Keep stacking evidence that the athlete you want to be is already forming.'],
  ['EXECUTION','Make quality repeatable. That is where race fitness begins.'],
  ['PERSPECTIVE','Train for the athlete you are becoming, not only the result you want.'],
  ['RECOVERY','Absorb the work. Then ask for more.'],
  ['ADAPTATION','The best programme is alive enough to respond to you.']
];

function sastDateString(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function dayOrdinal(dateString){
  const [year,month,day]=dateString.split('-').map(Number);
  return Math.floor(Date.UTC(year,month-1,day)/86400000);
}
function thoughtFor(dateString){
  const step=17;
  const index=((dayOrdinal(dateString)*step)+5)%FZ_DAILY_THOUGHTS.length;
  const [category,text]=FZ_DAILY_THOUGHTS[index];
  return{category,text,index};
}
function sectionByTitle(root,title){
  return [...root.querySelectorAll(':scope > .section')].find(section=>(section.querySelector('.section-head h2')?.textContent||'').trim()===title)||null;
}
function thoughtMarkup(thought,dateString){
  return `<div class="fz-thought-card" data-fz-thought-card>
    <div class="fz-thought-top"><span>FZ THOUGHT OF THE DAY</span><b>${thought.category}</b></div>
    <blockquote>${thought.text}</blockquote>
    <div class="fz-thought-foot"><span>${dateString}</span><strong>FZ PERFORMANCE</strong></div>
  </div>`;
}
function ensureThought(root){
  const dateString=sastDateString();
  const thought=thoughtFor(dateString);
  let section=root.querySelector(':scope > .fz-thought-section');
  if(!section){
    section=document.createElement('section');
    section.className='section fz-thought-section';
    section.setAttribute('aria-label','FZ Thought of the Day');
    const training=sectionByTitle(root,'Training State');
    if(training?.nextSibling)root.insertBefore(section,training.nextSibling);else root.appendChild(section);
  }
  if(FZ_TODAY_EXPERIENCE.lastDate!==dateString||!section.querySelector('[data-fz-thought-card]')){
    section.innerHTML=thoughtMarkup(thought,dateString);
    FZ_TODAY_EXPERIENCE.lastDate=dateString;
  }
}
function decorateToday(){
  const root=document.getElementById('today');
  if(!root)return;
  root.classList.add('fz-today-v1');
  root.querySelector('.fz-clean-hero')?.classList.add('fz-today-decision-zone');
  const recommendation=root.querySelector('.fz-clean-recommendation');
  if(recommendation){recommendation.classList.add('fz-today-recommendation');recommendation.setAttribute('aria-label','Current FZ recommendation');}
  const readiness=root.querySelector('.fz-clean-readiness');
  if(readiness){readiness.classList.add('fz-today-readiness');readiness.setAttribute('aria-label','Current FZ readiness and recovery context');}
  const live=sectionByTitle(root,'Live Physiology');
  if(live){live.classList.add('fz-today-live');live.setAttribute('aria-label','Live physiology');}
  const training=sectionByTitle(root,'Training State');
  if(training){training.classList.add('fz-today-training');training.setAttribute('aria-label','Current training state');}
  ensureThought(root);
}
function startTodayExperience(){
  if(FZ_TODAY_EXPERIENCE.mounted)return;
  FZ_TODAY_EXPERIENCE.mounted=true;
  const root=document.getElementById('today');
  if(!root)return;
  const observer=new MutationObserver(()=>queueMicrotask(decorateToday));
  observer.observe(root,{childList:true,subtree:true});
  decorateToday();
  FZ_TODAY_EXPERIENCE.timer=setInterval(()=>{
    if(document.visibilityState==='visible'&&FZ_TODAY_EXPERIENCE.lastDate!==sastDateString())decorateToday();
  },60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')decorateToday();});
  window.addEventListener('focus',decorateToday);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startTodayExperience,{once:true});
else startTodayExperience();
