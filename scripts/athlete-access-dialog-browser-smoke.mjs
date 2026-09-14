import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const adaptiveChoice=fs.readFileSync('dist/assets/adaptive-choice.js','utf8');
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<div class="main"><div class="topbar"></div><section id="today"></section><section id="train"></section><section id="system"></section></div>
<script type="module" src="/assets/adaptive-choice.js"></script></body></html>`;

function json(res,status,payload){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(payload));}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/assets/adaptive-choice.js'){
    res.writeHead(200,{'content-type':'text/javascript'});res.end(adaptiveChoice);return;
  }
  if(url.pathname==='/api/training/athlete-event'&&url.searchParams.get('operation')==='athlete-auth-status'){
    json(res,200,{ok:true,auth:{configured:false,authenticated:false,mode:'VIEWER',csrfToken:null,expiresAt:null,authVersion:'4.6.0-auth.1'}});return;
  }
  if(url.pathname==='/api/intelligence/current'){
    json(res,200,{ok:true,revision:'dialog-stability-r1',markers:{},activeRecommendation:null,athleteDecision:null});return;
  }
  res.writeHead(200,{'content-type':'text/html'});res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
try{
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-fz-mode-overlay]:not([hidden])');
  await page.locator('[data-open-auth]').click();
  await page.waitForSelector('form[data-athlete-auth-form][data-action="SETUP"]');
  await page.locator('input[name="bootstrapProof"]').fill('proof-stays-put');
  await page.locator('input[name="pin"]').fill('123456');
  await page.locator('input[name="confirmPin"]').fill('123456');

  // Reproduce the production failure mode: canonical surface mutations schedule the adaptive-choice rerender.
  await page.evaluate(()=>{
    const root=document.querySelector('.main');
    for(let i=0;i<5;i++){const n=document.createElement('div');n.dataset.dialogStabilityMutation=String(i);root.appendChild(n);}
  });
  await page.waitForTimeout(150);

  assert.equal(await page.locator('form[data-athlete-auth-form][data-action="SETUP"]').count(),1,'setup form survives a canonical rerender');
  assert.equal(await page.locator('input[name="bootstrapProof"]').inputValue(),'proof-stays-put','bootstrap proof is not discarded by rerender');
  assert.equal(await page.locator('input[name="pin"]').inputValue(),'123456','PIN is not discarded by rerender');
  assert.equal(await page.locator('input[name="confirmPin"]').inputValue(),'123456','PIN confirmation is not discarded by rerender');
  const overlayText=await page.locator('[data-fz-mode-overlay]').innerText();
  assert.match(overlayText,/FIRST-TIME ATHLETE ACCESS/,'auth dialog remains the active overlay');
  assert.doesNotMatch(overlayText,/Set up Athlete Access or continue read-only/,'landing gate must not overwrite active auth dialog');
  console.log('PASS Athlete Access setup dialog remains stable across adaptive rerenders');
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
