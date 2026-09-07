import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT=process.cwd(), PAYLOAD=path.join(ROOT,'release-payload'), DIST=path.join(ROOT,'dist'), TMP=path.join(ROOT,'.release-unpack'), PREFIX=path.join(TMP,'fz-performance-v05');
const parts=fs.readdirSync(PAYLOAD).filter(f=>/^[0-9]+\.b64$/.test(f)).sort();
if(parts.length!==6) throw new Error(`Expected 6 release payload parts; found ${parts.length}`);
const zip=Buffer.from(parts.map(f=>fs.readFileSync(path.join(PAYLOAD,f),'utf8').trim()).join(''),'base64');
fs.rmSync(TMP,{recursive:true,force:true}); fs.mkdirSync(TMP,{recursive:true});
const zipPath=path.join(TMP,'release.zip'); fs.writeFileSync(zipPath,zip);
execFileSync('unzip',['-q',zipPath,'-d',TMP],{stdio:'inherit'});
fs.rmSync(DIST,{recursive:true,force:true}); fs.mkdirSync(path.join(DIST,'assets'),{recursive:true});
for(const rel of ['index.html','assets/app.css','assets/app.js','manifest.webmanifest','icon.svg']){
  const src=path.join(PREFIX,rel), dst=path.join(DIST,rel); if(!fs.existsSync(src)) throw new Error(`Payload missing ${rel}`); fs.mkdirSync(path.dirname(dst),{recursive:true}); fs.copyFileSync(src,dst);
}
let html=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
html=html.replace('<!doctype html>\n<!DOCTYPE html>\n','<!doctype html>\n')
 .replace('<link href="/assets/app.css" rel="stylesheet"/><link href="/manifest.webmanifest" rel="manifest"/>','<link href="/assets/app.css" rel="stylesheet"/>')
 .replace('06:00 master-first rebuild · 06:00 / 13:00 / 20:00 hourly reconciled refreshes.','06:00 master-first rebuild · state refreshes 06:00 / 13:00 / 20:00 SAST.')
 .replace('Locked v0.3 interaction model · v0.4 content-parity state','v0.5 reliability architecture · state-only publication')
 .replace('Hourly delta reconcile → reinterpret → PWA refresh','State-only delta reconcile → reinterpret → publish')
 .replace('Locked v0.3 + v0.4 content parity','v0.5 reliability shell')
 .replace('<h3>FULL PRODUCTION REBUILD · 07 SEP 07:11 SAST</h3><p>Built from the latest complete v0.4 archive shell and the current 7 Sep reconciled PWA State. TRAIN and SYSTEM are direct top-level pages, not nested inside TRENDS. TODAY/TRENDS responsive layout rules are normalized and the refresh countdown uses a stable <strong>hh:mm:ss</strong> display.</p>','<h3>v0.5 RELIABILITY ARCHITECTURE</h3><p>Direct static shell, same-origin runtime-state gateway, fail-stale recovery and graph scrubbing. Routine 06:00 / 13:00 / 20:00 refreshes publish validated state only; product or platform changes use a gated release.</p>')
 .replace('FZ Performance PWA · full content-parity production build · canonical master → validated PWA State → complete four-page PWA · TODAY / TRENDS / TRAIN / SYSTEM · motion for comprehension only · reduced-motion aware.','FZ Performance PWA · v0.5 reliability shell · canonical master → validated runtime state → TODAY / TRENDS / TRAIN / SYSTEM · graph scrubbing · fail-stale recovery · reduced-motion aware.');
if(/hourly reconciled refresh|07:00–22:00|FULL PRODUCTION REBUILD · 07 SEP 07:11/.test(html)) throw new Error('Legacy refresh/product copy remains');
fs.writeFileSync(path.join(DIST,'index.html'),html);

let app=fs.readFileSync(path.join(DIST,'assets/app.js'),'utf8');
const helperAnchor="function addSvgEl(svg,name,attrs){";
if(!app.includes(helperAnchor)) throw new Error('Touch patch helper anchor missing');
app=app.replace(helperAnchor,`function touchEventPoint(ev){const t=ev.touches?.[0]||ev.changedTouches?.[0];return t?{clientX:t.clientX,clientY:t.clientY,pointerType:'touch'}:null}\n`+helperAnchor);
const indexAnchor="container.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch')container.setPointerCapture?.(ev.pointerId);move(ev)});container.addEventListener('pointerleave'";
const indexReplacement="container.addEventListener('pointerdown',ev=>{if(ev.pointerType==='touch')container.setPointerCapture?.(ev.pointerId);move(ev)});container.addEventListener('pointerup',move);container.addEventListener('click',move);container.addEventListener('touchstart',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchmove',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchend',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('pointerleave'";
if(!app.includes(indexAnchor)) throw new Error('Index scrub touch patch anchor missing');
app=app.replace(indexAnchor,indexReplacement);
const scatterAnchor="container.addEventListener('pointerdown',move);container.addEventListener('pointerleave'";
const scatterReplacement="container.addEventListener('pointerdown',move);container.addEventListener('pointerup',move);container.addEventListener('click',move);container.addEventListener('touchstart',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchmove',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('touchend',ev=>{const p=touchEventPoint(ev);if(p)move(p)},{passive:true});container.addEventListener('pointerleave'";
if(!app.includes(scatterAnchor)) throw new Error('Scatter scrub touch patch anchor missing');
app=app.replace(scatterAnchor,scatterReplacement);

app=app.replace("const SHELL_VERSION='0.5.0';","const SHELL_VERSION='0.6.0';");
const bootAnchor="async function boot(){clearLegacyWorkers();const loaded=await loadRuntimeState();runtimeSource=loaded.source;applyRuntimeState(loaded.state);renderTodayDate();";
if(!app.includes(bootAnchor)) throw new Error('Longitudinal boot anchor missing');
const longitudinalCode=String.raw`
const DEFAULT_LONGITUDINAL={
  asOf:'07 Sep 2026',phase:'LONGITUDINAL INTELLIGENCE · ACTIVE',baselineMaturity:'PROVISIONAL',
  baselines:[
    {name:'HRV',current:'81 ms',baseline:'62.9 ms',delta:'+28.8%',signal:'ABOVE PERSONAL BASELINE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight / morning'},
    {name:'Resting HR',current:'54 bpm',baseline:'57.8 bpm',delta:'-3.8 bpm',signal:'FAVOURABLE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Morning anchor'},
    {name:'Sleep duration',current:'7.78 h',baseline:'6.85 h',delta:'+0.93 h',signal:'ABOVE PERSONAL BASELINE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight'},
    {name:'Sleep score',current:'92',baseline:'75.8',delta:'+16.2',signal:'ABOVE PERSONAL BASELINE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Overnight'},
    {name:'Body Battery high',current:'94',baseline:'78.5',delta:'+15.5',signal:'ABOVE PERSONAL BASELINE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Morning / day high'},
    {name:'Completed-day stress',current:'44 · 06 Sep',baseline:'28.0',delta:'+16',signal:'HIGH DISTURBANCE',maturity:'PROVISIONAL',confidence:'MODERATE',grain:'Completed day only'},
    {name:'Completed-day steps',current:'9,073 · 06 Sep',baseline:'11,889',delta:'-23.7%',signal:'BELOW TYPICAL MOVEMENT',maturity:'PROVISIONAL',confidence:'LOW–MODERATE',grain:'Completed day only'},
    {name:'FZ Readiness',current:'82 · 07 Sep',baseline:'Series starts now',delta:'—',signal:'FORWARD-ONLY HISTORY',maturity:'NEW SERIES',confidence:'EXACT CURRENT',grain:'FZ-derived decision state'}],
  insights:{
    recovery:{confidence:'MODERATE',observation:'6 Sep closed with stress 44, sleep 4.73 h / score 31 and HRV 33. On 7 Sep, sleep rebounded to 7.78 h / 92, HRV to 81, RHR to 54 and Body Battery high to 94.',relationship:'The multi-signal disturbance reversed rapidly after a low-load day and strong overnight recovery.',feedback:'No contemporaneous 7 Sep local quad/gait check was available, so systemic recovery cannot substitute for local function.',interpretation:'This is early evidence of rapid recovery resilience rather than proof of a stable trait.',performance:'No matched quality session has yet validated the rebound as performance capacity.',watch:'Repeat the load → overnight response → athlete feeling → execution sequence across future disturbances.'},
    performance:{confidence:'HIGH',observation:'31 Aug matched Run AET delivered 375 W at HR 147 with whole-session RE 0.72 and no meaningful external-output fade.',relationship:'Objective output remained high while the athlete reported the session felt exceptionally good, easier than prior AETs and required restraint around ~4:00/km work pace.',feedback:'Immediate perceived fatigue was minimal/near-zero; no Zone 2 extension occurred because of time rather than fatigue.',interpretation:'Objective output and subjective cost improved in the same direction. That is stronger adaptation evidence than power/HR alone.',performance:'This reinforces the REAL POSITIVE matched Run AET trend while preserving footwear and possible sensor confounds.',watch:'Whether the next matched Run AET maintains or improves output while perceived cost remains low.'},
    cost:{confidence:'HIGH',observation:'2 Sep Wall-ball AET was followed by quad soreness around 6/10 on 3 Sep, progressing to 7–8/10 with difficulty walking by 4 Sep; shoulders were 3/10 and upper traps 2/10 at 48 h.',relationship:'Local quadriceps cost escalated despite the athlete initially feeling better than expected after the session and reporting excellent sleep later.',feedback:'The local limitation was functional: walking became difficult. Calves, glutes and hamstrings were not the dominant issue.',interpretation:'Wall-ball AET currently carries a high local recovery cost relative to its systemic/cardiovascular picture.',performance:'The exposure established station capacity baseline and sequencing cost, but the local opportunity cost disrupted subsequent lower-body quality.',watch:'Whether a matched Wall-ball retest produces lower local cost at similar output before calling it adaptation.'},
    discordance:{confidence:'MODERATE–HIGH',observation:'26 Aug morning wearable recovery was weaker than the prior day: HRV 58, RHR 59, sleep 6.52 h / 75 and Body Battery 70.',relationship:'The athlete nevertheless reported high energy, fresh legs and no systemic fatigue; the unresolved hand remained the local limiter.',feedback:'Later execution remained controlled and the athlete still felt fresh/good with legs not heavy.',interpretation:'Reduced wearable recovery did not equal absent usable capacity. Wearables, athlete voice, local constraints and sequencing must be combined.',performance:'The substituted aerobic session preserved freshness and mechanics, though it does not prove hard-session capacity.',watch:'Future wearable-subjective discordance cases and their next-session/next-day outcomes.'},
    recoveryAttempt:{confidence:'MODERATE–HIGH',observation:'On 3 Sep the athlete attempted very light mixed aerobic recovery while the quads were sore.',relationship:'The legs did not improve, the athlete became tired and stopped; wearable HR noise also reduced confidence in cardiovascular interpretation.',feedback:'The intervention did not feel restorative in that local-tissue state.',interpretation:'Low intensity is not automatically restorative. Recovery-session families should be learned from actual response rather than assumed to help.',performance:'Stopping likely protected future training value better than extending an unhelpful recovery attempt.',watch:'Which easy modalities improve local state versus merely add fatigue under similar conditions.'}},
  voice:[
    {date:'25 Aug',title:'Run AET · strong agreement',text:'Legs/body felt excellent; AET felt excellent, speed felt more comfortable and deliberate restraint was required.'},
    {date:'26 Aug',title:'Wearable-subjective discordance',text:'High energy and fresh legs despite weaker overnight markers; hand remained the local constraint.'},
    {date:'27 Aug',title:'Bike AET · lower perceived cost',text:'Materially better than 20 Aug; legs were no longer the limiting factor.'},
    {date:'29–30 Aug',title:'Hilly-run durability',text:'Felt good during the run, fresh 4–5 h later and excellent lower-body freshness persisted the next day.'},
    {date:'31 Aug',title:'Run AET · exceptionally good',text:'Easier than prior AETs, minimal immediate fatigue and 100% fresh afterwards.'},
    {date:'03–04 Sep',title:'Wall-ball delayed cost',text:'Quad soreness progressed from about 6/10 to 7–8/10 with difficulty walking despite strong sleep.'}],
  trajectory:{strongest:'RUNNING ECONOMY / AEROBIC ENGINE',gaps:'Fixed HYROX 1 km repeatability · compromised running · repeated standardized station capacity',principle:'Evidence-backed convergence, not fabricated progress percentages.',events:[{name:'Deadly Dozen',date:'20 Sep',role:'Developmental checkpoint · protect quality without unnecessary local damage'},{name:'HOKA Half',date:'24 Sep',role:'Running-specific checkpoint · extend economy and durability'},{name:'HYROX Johannesburg',date:'28 Nov',role:'PRIMARY · convert capabilities into repeatable race-specific interaction'}]}}
function escLong(v){return String(v==null?'—':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
function longInsight(title,i){return '<div class="card rich"><div class="eyebrow">'+escLong(title)+' · '+escLong(i.confidence)+'</div><p><strong>Observation</strong><br>'+escLong(i.observation)+'</p><p><strong>Relationship</strong><br>'+escLong(i.relationship)+'</p><p><strong>Athlete feedback</strong><br>'+escLong(i.feedback)+'</p><p><strong>Interpretation</strong><br>'+escLong(i.interpretation)+'</p><p><strong>Performance connection</strong><br>'+escLong(i.performance)+'</p><p><strong>What to watch</strong><br>'+escLong(i.watch)+'</p></div>'}
function ensureLongitudinalTrends(){
  const trends=$('trends'); if(!trends||$('longitudinalLayer'))return;
  const d=(runtimeState&&runtimeState.datasets&&runtimeState.datasets.LONGITUDINAL)||DEFAULT_LONGITUDINAL;
  const wrap=document.createElement('div');wrap.id='longitudinalLayer';
  const baselineCards=(d.baselines||[]).map(function(b){return '<div class="status-card"><small>'+escLong(b.name)+' · '+escLong(b.maturity)+'</small><b class="yellow">'+escLong(b.current)+'</b><p>Personal baseline <strong>'+escLong(b.baseline)+'</strong> · '+escLong(b.delta)+'<br><span class="muted">'+escLong(b.signal)+' · '+escLong(b.confidence)+' · '+escLong(b.grain)+'</span></p></div>'}).join('');
  const voice=(d.voice||[]).map(function(v){return '<div class="card rich"><div class="eyebrow">'+escLong(v.date)+' · ATHLETE FEEDBACK</div><h3>'+escLong(v.title)+'</h3><p>'+escLong(v.text)+'</p></div>'}).join('');
  const events=((d.trajectory&&d.trajectory.events)||[]).map(function(e){return '<div class="event-role"><div class="eyebrow">'+escLong(e.date)+'</div><strong>'+escLong(e.name)+'</strong><p>'+escLong(e.role)+'</p></div>'}).join('');
  wrap.innerHTML='<div class="section"><div class="section-head"><h2>Longitudinal Intelligence</h2><p>Personal baseline → response → performance → cost → athlete voice → event trajectory</p></div><div class="two"><div class="card rich"><div class="eyebrow">CURRENT DEVELOPMENT PHASE</div><h3 class="yellow">'+escLong(d.phase)+'</h3><p>TRENDS now treats time as athlete memory: what FZ knew, what you reported, what was recommended, what was executed and what happened afterwards.</p></div><div class="card rich"><div class="eyebrow">BASELINE MATURITY</div><h3>'+escLong(d.baselineMaturity)+'</h3><p>The current Garmin wellness cohort is useful for personal deviation but not yet mature. Confidence will rise automatically as valid observations accumulate. Readiness history begins from exact retained FZ scores going forward.</p></div></div></div>'+
  '<div class="section"><div class="section-head"><h2>ATHLETE STATE</h2><p>How am I changing? · personal wellness baseline rather than generic thresholds</p></div><div class="status-grid">'+baselineCards+'</div><div class="outlook-strip"><b>Interpretation rule</b><span>Absolute value + personal-baseline deviation + direction/variability + recent load + signal agreement + athlete feedback + subsequent performance.</span></div></div>'+
  '<div class="section"><div class="section-head"><h2>RECOVERY RESPONSE</h2><p>What am I tolerating? · load → overnight physiology → athlete feeling → capacity</p></div><div class="two">'+longInsight('6→7 SEP · RECOVERY RESILIENCE',d.insights.recovery)+longInsight('26 AUG · SUBJECTIVE/OBJECTIVE DISCORDANCE',d.insights.discordance)+'</div></div>'+
  '<div class="section"><div class="section-head"><h2>PERFORMANCE</h2><p>Am I actually getting better? · matched output plus perceived cost</p></div>'+longInsight('31 AUG · MATCHED RUN AET',d.insights.performance)+'</div>'+
  '<div class="section"><div class="section-head"><h2>EXPOSURE COST</h2><p>What does training cost me? · systemic and local response are separate</p></div><div class="two">'+longInsight('02–04 SEP · WALL-BALL LOCAL COST',d.insights.cost)+longInsight('03 SEP · RECOVERY-SESSION RESPONSE',d.insights.recoveryAttempt)+'</div></div>'+
  '<div class="section"><div class="section-head"><h2>ATHLETE VOICE</h2><p>What have I been reporting? · first-class longitudinal evidence</p></div><div class="two">'+voice+'</div><div class="outlook-strip"><b>No invented scores</b><span>Explicit ratings are preserved when supplied. Qualitative comments stay qualitative; Garmin never overwrites local/function feedback.</span></div></div>'+
  '<div class="section"><div class="section-head"><h2>TRAJECTORY</h2><p>Is this moving me toward the event?</p></div><div class="two"><div class="card rich"><div class="eyebrow">STRONGEST CONSOLIDATED SIGNAL</div><h3 class="good">'+escLong(d.trajectory.strongest)+'</h3><p><strong>Largest measurement gaps:</strong> '+escLong(d.trajectory.gaps)+'</p><p>'+escLong(d.trajectory.principle)+'</p></div><div class="card rich"><div class="eyebrow">LONGITUDINAL DECISION STANDARD</div><p><strong>Observation → Relationship → Athlete Feedback → Interpretation → Performance Connection → Confidence → What To Watch.</strong></p><p>Progress is not a chart moving upward; it is multiple capabilities improving while their recovery cost and event value remain acceptable.</p></div></div><div class="three" style="margin-top:12px">'+events+'</div></div>';
  trends.prepend(wrap);
}
`;
const bootInsert="async function boot(){clearLegacyWorkers();const loaded=await loadRuntimeState();runtimeSource=loaded.source;applyRuntimeState(loaded.state);ensureLongitudinalTrends();renderTodayDate();";
app=app.replace(bootAnchor,longitudinalCode+'\n'+bootInsert);
if(!app.includes('ATHLETE STATE')||!app.includes('RECOVERY RESPONSE')||!app.includes('EXPOSURE COST')||!app.includes('ATHLETE VOICE')||!app.includes('TRAJECTORY'))throw new Error('Longitudinal Trends markers missing');
fs.writeFileSync(path.join(DIST,'assets/app.js'),app);

const expected={'index.html':'cd5e9667b4e4c3007b335dea0911864830c845ddb2a9f5430b4103dc50a69f73','assets/app.css':'4c220f646f1e120745189488e322e54e8d92e884ef27506ab028851cadb9105e','assets/app.js':'c0b51889a139fd23a030196830f910c5ed1a055e4d5c02830dc40c6b61a1ffb8'};
for(const [rel,want] of Object.entries(expected)){const got=createHash('sha256').update(fs.readFileSync(path.join(DIST,rel))).digest('hex'); if(got!==want) throw new Error(`Release hash mismatch for ${rel}: ${got}`); console.log(`PASS hash ${rel} ${got}`)}
fs.rmSync(TMP,{recursive:true,force:true});
console.log('FZ v0.6.0 longitudinal trends release build complete');
