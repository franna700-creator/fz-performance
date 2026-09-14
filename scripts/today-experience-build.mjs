import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlPath=path.join(root,'dist','index.html');
const assets=path.join(root,'dist','assets');
const jsSource=path.join(root,'src','today-experience.js');
const cssSource=path.join(root,'src','today-experience.css');
for(const file of [htmlPath,jsSource,cssSource])if(!fs.existsSync(file))throw new Error(`TODAY experience input missing: ${file}`);

fs.copyFileSync(jsSource,path.join(assets,'today-experience.js'));
fs.copyFileSync(cssSource,path.join(assets,'today-experience.css'));
let html=fs.readFileSync(htmlPath,'utf8');
const cssTag='<link href="/assets/today-experience.css" rel="stylesheet"/>';
const scriptTag='<script src="/assets/today-experience.js" type="module"></script>';
if(!html.includes(cssTag)){
  const anchor='<link href="/assets/ui-context-recovery.css" rel="stylesheet"/>';
  if(!html.includes(anchor))throw new Error('TODAY experience CSS anchor missing');
  html=html.replace(anchor,anchor+cssTag);
}
if(!html.includes(scriptTag)){
  const anchor='<script src="/assets/ui-context-recovery.js" type="module"></script>';
  if(!html.includes(anchor))throw new Error('TODAY experience JS anchor missing');
  html=html.replace(anchor,anchor+scriptTag);
}
if(html.indexOf('/assets/today-experience.css')<html.indexOf('/assets/fz-design-system.css'))throw new Error('TODAY experience CSS must load after the shared design system');
if(html.indexOf('/assets/today-experience.js')<html.indexOf('/assets/ui-context-recovery.js'))throw new Error('TODAY experience JS must load after canonical/adaptive UI modules');
fs.writeFileSync(htmlPath,html);
console.log('PASS TODAY experience assets wired after canonical clean shell');
