import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlPath=path.join(root,'dist','index.html');
const outDir=path.join(root,'dist','assets');
const contractPath=path.join(root,'dist','release-ui-contract.json');
const jsSrc=path.join(root,'src','trends-train-redesign-v1.js');
const cssSrc=path.join(root,'src','trends-train-redesign-v1.css');

for(const input of [htmlPath,jsSrc,cssSrc]){
  if(!fs.existsSync(input))throw new Error(`TRENDS/TRAIN v1 build input missing: ${input}`);
}

let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('/assets/trends-train-redesign-v1.css')){
  html=html.replace('</head>','<link href="/assets/trends-train-redesign-v1.css" rel="stylesheet"/></head>');
}
if(!html.includes('/assets/trends-train-redesign-v1.js')){
  html=html.replace('</body>','<script src="/assets/trends-train-redesign-v1.js" type="module"></script></body>');
}
fs.writeFileSync(htmlPath,html);
fs.copyFileSync(jsSrc,path.join(outDir,'trends-train-redesign-v1.js'));
fs.copyFileSync(cssSrc,path.join(outDir,'trends-train-redesign-v1.css'));

if(fs.existsSync(contractPath)){
  const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
  contract.trendsTrainExperienceV1=true;
  contract.requiredAssets=[...new Set([...(contract.requiredAssets||[]),'trends-train-redesign-v1.js','trends-train-redesign-v1.css'])];
  fs.writeFileSync(contractPath,JSON.stringify(contract,null,2));
}
console.log('PASS TRENDS + TRAIN redesign v1 presentation assets wired');
