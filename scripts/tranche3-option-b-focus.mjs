import fs from 'node:fs';

const jsPath = 'dist/assets/app.js';
if (!fs.existsSync(jsPath)) throw new Error('Tranche 3 focus hardening requires built app.js');

let js = fs.readFileSync(jsPath, 'utf8');
const marker = 'FZ_TRANCHE3_OPTION_B_FOCUS_V1';

if (!js.includes(marker)) {
  const pattern = /function fzTrainingFocus\(payload\)\{[\s\S]*?\n\}\n\nfunction fzTrainingCompactMeaning/;
  if (!pattern.test(js)) throw new Error('Tranche 3 focus function anchor missing');

  const replacement = `/* ${marker} */
function fzTrainingFocusScore(session){
  const status=String(session?.status||'UNKNOWN').toUpperCase();
  const athlete=fzTrainingAthleteEvents(session).length;
  const hypotheses=fzTrainingHypotheses(session).length;
  const lifecycleWeight=({STOPPED_EARLY:140,ABORTED:140,SKIPPED:120,MODIFIED:100,SUBSTITUTED:100,COMPLETED:0,UNKNOWN:0})[status]??60;
  const kindWeight=session?.session_kind?8:0;
  return lifecycleWeight+Math.min(75,athlete*25)+Math.min(20,hypotheses*10)+kindWeight;
}

function fzTrainingMeaningfulExecution(executed){
  if(!executed.length)return null;
  const newestDate=fzTrainingLocalDate(executed[0].actual_start_at);
  const cohort=executed.filter(session=>fzTrainingLocalDate(session.actual_start_at)===newestDate);
  return cohort.sort((a,b)=>{
    const score=fzTrainingFocusScore(b)-fzTrainingFocusScore(a);
    if(score!==0)return score;
    return new Date(b.actual_start_at)-new Date(a.actual_start_at);
  })[0]||executed[0];
}

function fzTrainingFocus(payload){
  const sessions=(payload?.sessions||[]).filter(s=>s.status!=='SUPERSEDED');
  if(!sessions.length)return null;
  const now=Date.now();const today=payload?.date;
  const future=sessions.filter(s=>s.planned_start_at&&!s.actual_start_at&&new Date(s.planned_start_at).getTime()>=now).sort((a,b)=>new Date(a.planned_start_at)-new Date(b.planned_start_at));
  const todayFuture=future.filter(s=>fzTrainingLocalDate(s.planned_start_at)===today);
  if(todayFuture[0])return {session:todayFuture[0],mode:'NEXT SESSION'};

  const executed=sessions.filter(s=>s.actual_start_at&&new Date(s.actual_start_at).getTime()<=now).sort((a,b)=>new Date(b.actual_start_at)-new Date(a.actual_start_at));
  const todayExecuted=executed.filter(s=>fzTrainingLocalDate(s.actual_start_at)===today);
  if(todayExecuted.length)return {session:fzTrainingMeaningfulExecution(todayExecuted),mode:'TODAY · KEY EXECUTION'};
  if(future[0])return {session:future[0],mode:'NEXT SESSION'};
  if(executed[0])return {session:fzTrainingMeaningfulExecution(executed),mode:'LAST KEY EXECUTION'};
  return {session:sessions[0],mode:'CURRENT SESSION'};
}

function fzTrainingCompactMeaning`;

  js = js.replace(pattern, replacement);
}

fs.writeFileSync(jsPath, js);

if (!js.includes(marker)) throw new Error('Tranche 3 focus marker missing');
if (!js.includes('fzTrainingFocusScore') || !js.includes('LAST KEY EXECUTION')) throw new Error('Meaningful lifecycle focus hardening missing');
console.log('PASS Tranche 3 Option B focus: lifecycle-rich execution outranks later trivial fragments');
