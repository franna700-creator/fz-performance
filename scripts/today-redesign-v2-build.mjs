import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlPath=path.join(root,'dist','index.html');
const outDir=path.join(root,'dist','assets');
const jsSrc=path.join(root,'src','today-redesign-v2.js');
const cssSrc=path.join(root,'src','today-redesign-v2.css');
const topsideCssSrc=path.join(root,'src','fz-topside-shell.css');
const heroCssSrc=path.join(root,'src','fz-hero-responsive.css');
const heroDesktopSrc=path.join(root,'src','fz-hero-desktop.webp');
const heroMobileSrc=path.join(root,'src','fz-hero-mobile.webp');

for(const input of [htmlPath,jsSrc,cssSrc,topsideCssSrc,heroCssSrc,heroDesktopSrc,heroMobileSrc]){
  if(!fs.existsSync(input))throw new Error(`TODAY v2 build input missing: ${input}`);
}

function assertWebp(filePath,label){
  const image=fs.readFileSync(filePath);
  const riff=image.subarray(0,4).toString('ascii');
  const webp=image.subarray(8,12).toString('ascii');
  if(image.length<1024||riff!=='RIFF'||webp!=='WEBP')throw new Error(`TODAY v2 hero source invalid: ${label}`);
  return image;
}

let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('/assets/today-redesign-v2.css'))html=html.replace('</head>','<link href="/assets/today-redesign-v2.css" rel="stylesheet"/></head>');
if(!html.includes('/assets/fz-topside-shell.css'))html=html.replace('/assets/today-redesign-v2.css" rel="stylesheet"/>','/assets/today-redesign-v2.css" rel="stylesheet"/><link href="/assets/fz-topside-shell.css" rel="stylesheet"/>');
if(!html.includes('/assets/fz-hero-responsive.css'))html=html.replace('/assets/fz-topside-shell.css" rel="stylesheet"/>','/assets/fz-topside-shell.css" rel="stylesheet"/><link href="/assets/fz-hero-responsive.css" rel="stylesheet"/>');
if(!html.includes('/assets/today-redesign-v2.js'))html=html.replace('</body>','<script src="/assets/today-redesign-v2.js" type="module"></script></body>');
fs.writeFileSync(htmlPath,html);

fs.copyFileSync(jsSrc,path.join(outDir,'today-redesign-v2.js'));
fs.copyFileSync(cssSrc,path.join(outDir,'today-redesign-v2.css'));
fs.copyFileSync(topsideCssSrc,path.join(outDir,'fz-topside-shell.css'));
fs.copyFileSync(heroCssSrc,path.join(outDir,'fz-hero-responsive.css'));
fs.writeFileSync(path.join(outDir,'fz-hero-desktop.webp'),assertWebp(heroDesktopSrc,'fz-hero-desktop.webp'));
fs.writeFileSync(path.join(outDir,'fz-hero-mobile.webp'),assertWebp(heroMobileSrc,'fz-hero-mobile.webp'));
console.log('PASS TODAY redesign v2 + verified responsive WebP hero + topside shell assets wired');
await import('./trends-train-redesign-v1-build.mjs');
