import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlPath=path.join(root,'dist','index.html');
const outDir=path.join(root,'dist','assets');
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
console.log('PASS TRENDS + TRAIN redesign v1 presentation assets wired');
