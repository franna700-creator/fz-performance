import fs from 'node:fs';
const app=fs.readFileSync('dist/assets/app-clean.js','utf8'),live=fs.readFileSync('dist/assets/live-physiology.js','utf8'),training=fs.readFileSync('dist/assets/training-auto-sync.js','utf8'),systemUi=fs.readFileSync('dist/assets/system-intelligence.js','utf8'),vercel=JSON.parse(fs.readFileSync('vercel.json','utf8')),trendsApi=fs.readFileSync('api/trends/current.js','utf8'),trainingApi=fs.readFileSync('api/training/memory.js','utf8');
const deploymentGatePath='config/controlled-deployment.json';
const deploymentGate=fs.existsSync(deploymentGatePath)?JSON.parse(fs.readFileSync(deploymentGatePath,'utf8')):null;

function validPinnedReleaseGate(gate){
  return Boolean(
    gate?.enabled===true &&
    gate?.scope==='PINNED_RELEASE_ONLY' &&
    /^TRANCHE_[0-9_]+/.test(String(gate?.release||'')) &&
    /^[0-9a-f]{40}$/.test(String(gate?.validatedCandidateSha||'')) &&
    /^[0-9a-f]{40}$/.test(String(gate?.validatedCandidateTree||'')) &&
    /^release-/.test(String(gate?.releaseBranch||'')) &&
    !gate?.closedOn
  );
}

const controlledPinnedRelease=validPinnedReleaseGate(deploymentGate);
const deploymentSeparationOk=vercel.git?.deploymentEnabled===false||(vercel.git?.deploymentEnabled===true&&controlledPinnedRelease);
if(process.env.VERCEL==='1'&&vercel.git?.deploymentEnabled===true){
  if(process.env.VERCEL_GIT_COMMIT_SHA&&process.env.VERCEL_GIT_COMMIT_SHA!==deploymentGate.validatedCandidateSha) throw new Error('Vercel deployment SHA does not match controlled release candidate');
  if(process.env.VERCEL_GIT_COMMIT_REF&&process.env.VERCEL_GIT_COMMIT_REF!==deploymentGate.releaseBranch) throw new Error('Vercel deployment branch does not match controlled release branch');
}
const checks=[['canonical app rereads all runtime domains',['/api/runtime-state','/api/wellness/today?refresh=0','/api/training/memory?backDays=45&forwardDays=0','/api/trends/current?days=45','/api/system/status'].every(x=>app.includes(x))],['canonical app rereads every five minutes while visible',app.includes("setInterval(()=>{if(document.visibilityState==='visible')loadAll()},300000)")],['physiology source refresh cadence is five minutes',live.includes('autoRefreshMs: 300000')],['training source refresh cadence is five minutes',training.includes('pollMs: 300000')],['source persistence triggers immediate canonical reread',live.includes("window.dispatchEvent(new Event('focus'))")&&training.includes("window.dispatchEvent(new Event('focus'))")],['system observes training/trends/materiality integrity from canonical reads',systemUi.includes('captureCanonicalResponse')&&systemUi.includes('Dynamic Runtime Integrity')],['training refresh owns late relationship reconciliation',trainingApi.includes('training-sync-runtime')],['Trends uses systemic dynamic evidence builder',trendsApi.includes('buildDynamicCurrentTrends')],['dynamic API families are no-store',['/api/wellness/today','/api/training/(.*)','/api/trends/(.*)','/api/system/(.*)','/api/intelligence/(.*)'].every(path=>vercel.headers.some(rule=>rule.source===path&&JSON.stringify(rule.headers).includes('no-store')))],['automatic Git deployments disabled unless one explicit pinned release gate is active',deploymentSeparationOk]];let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++;}if(bad)process.exit(1);console.log('PASS dynamic runtime + generic pinned-release deployment-separation contract');
