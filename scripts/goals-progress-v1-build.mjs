import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlPath=path.join(root,'dist','index.html');
const outDir=path.join(root,'dist','assets');
const contractPath=path.join(root,'dist','release-ui-contract.json');
const jsSrc=path.join(root,'src','goals-progress-v1.js');
const cssSrc=path.join(root,'src','goals-progress-v1.css');

for(const input of [htmlPath,jsSrc,cssSrc]){
  if(!fs.existsSync(input))throw new Error(`Goals & Progress v1 build input missing: ${input}`);
}

let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('data-page="goals"')){
  html=html.replaceAll('<button data-page="train">TRAIN</button><button data-page="system">SYSTEM</button>','<button data-page="train">TRAIN</button><button data-page="goals">GOALS</button><button data-page="system">SYSTEM</button>');
}
if(!html.includes('id="goals"')){
  html=html.replace('<section class="page" id="system">','<section class="page" id="goals"><div class="fz-clean-loading">Loading canonical goals and progress…</div></section>\n<section class="page" id="system">');
}
if(!html.includes('/assets/goals-progress-v1.css')){
  html=html.replace('</head>','<link href="/assets/goals-progress-v1.css" rel="stylesheet"/></head>');
}
if(!html.includes('/assets/goals-progress-v1.js')){
  html=html.replace('</body>','<script src="/assets/goals-progress-v1.js" type="module"></script></body>');
}
if(!html.includes('data-page="goals"')||!html.includes('id="goals"'))throw new Error('Goals navigation/page wiring failed');
fs.writeFileSync(htmlPath,html);
fs.copyFileSync(jsSrc,path.join(outDir,'goals-progress-v1.js'));
fs.copyFileSync(cssSrc,path.join(outDir,'goals-progress-v1.css'));

if(fs.existsSync(contractPath)){
  const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
  contract.goalsProgressExperienceV1=true;
  contract.canonicalGoalsProgress=true;
  contract.requiredAssets=[...new Set([...(contract.requiredAssets||[]),'goals-progress-v1.js','goals-progress-v1.css'])];
  fs.writeFileSync(contractPath,JSON.stringify(contract,null,2));
}
console.log('PASS Goals & Progress v1 canonical athlete surface wired');
await import('./training-exposure-v1-build.mjs');
