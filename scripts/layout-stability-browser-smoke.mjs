import http from 'node:http';
import { chromium } from 'playwright';
import fs from 'node:fs';

const layoutJs=fs.readFileSync('src/layout-stability.js','utf8');
const contextJs=fs.readFileSync('src/ui-context-recovery.js','utf8');

function send(res,type,body){res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(body);}
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#000;color:#fff}.main{min-height:2400px}.page{display:none}.page.active{display:block}.spacer{height:1800px}.bottom{position:fixed;bottom:0;background:#111;width:100%;height:60px}</style></head><body>
<main class="main"><section class="page active" id="today"><div class="fz-clean-readiness"><b>82</b></div><div class="spacer"></div></section><section class="page" id="trends"><div class="section"><div class="section-head"><h2>Trajectory & Measurement Gaps</h2><p>old copy</p></div><div class="fz-clean-cap-grid"><div class="cap"><span class="cap-name">Running Economy</span><span class="cap-pri">Priority 1</span></div></div></div><div class="spacer"></div></section></main>
<nav class="bottom"><button data-page="today">TODAY</button><button data-page="trends">TRENDS</button></nav>
<script>window.__childMutations=0;window.__fetchCount=0;const nativeFetch=window.fetch;window.fetch=async url=>{window.__fetchCount++;const path=new URL(url,location.href).pathname;let payload={};if(path==='/api/runtime-state')payload={stateId:'2026-09-10T20:00:00+02:00',renderContract:{readiness:{canonicalReadinessCurrent:true,readinessEngineVersion:'5.0.0-readiness.1',runtimeReadinessDate:'2026-09-10'}}};else if(path==='/api/wellness/today')payload={date:'2026-09-14',wellness:{date:'2026-09-14'}};else if(path==='/api/trends/current')payload={ok:true,capabilities:[{name:'Running Economy',obs:'Observed',inf:'Inference',decision:'Decision'}]};return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}})};new MutationObserver(list=>{window.__childMutations+=list.filter(x=>x.type==='childList').length}).observe(document.querySelector('.main'),{childList:true,subtree:true});</script>
<script type="module" src="/layout-stability.js"></script><script type="module" src="/ui-context-recovery.js"></script>
<script type="module">document.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===b.dataset.page));window.scrollTo({top:0,behavior:'instant'});});window.backgroundRerender=()=>window.scrollTo({top:0,behavior:'instant'});</script>
</body></html>`;

const server=http.createServer((req,res)=>{if(req.url==='/layout-stability.js')return send(res,'text/javascript',layoutJs);if(req.url==='/ui-context-recovery.js')return send(res,'text/javascript',contextJs);return send(res,'text/html',html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const pass=message=>console.log('PASS',message);
function assert(value,message){if(!value)throw new Error(message);pass(message);}
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FZ_LAYOUT_STABILITY?.version==='1.0.0');
  await page.waitForFunction(()=>document.querySelector('.fz-cap-detail'));
  assert(await page.locator('[data-fz-readiness-anchor-note]').count()===0,'current canonical readiness does not gain a stale-anchor note after paint');
  assert((await page.locator('#trends h2').innerText())==='Primary Objective Capability Priorities','TRENDS context reaches its final heading once');
  const firstMutations=await page.evaluate(()=>window.__childMutations);
  await page.waitForTimeout(250);
  const laterMutations=await page.evaluate(()=>window.__childMutations);
  assert(laterMutations===firstMutations,'context enhancement settles instead of self-triggering DOM mutation churn');

  await page.evaluate(()=>window.scrollTo(0,700));
  const before=await page.evaluate(()=>window.scrollY);
  await page.evaluate(()=>window.backgroundRerender());
  await page.waitForTimeout(50);
  const after=await page.evaluate(()=>window.scrollY);
  assert(before>500&&Math.abs(after-before)<2,'same-page canonical rerender cannot force the viewport back to the top');

  await page.locator('[data-page="trends"]').click();
  await page.waitForTimeout(50);
  assert(await page.evaluate(()=>window.scrollY)<2,'deliberate page navigation still resets the viewport to the top');
  pass('TODAY/TRENDS layout stability real-browser acceptance');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
