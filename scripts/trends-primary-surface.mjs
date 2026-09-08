import fs from 'node:fs';
import { createHash } from 'node:crypto';

const appPath='dist/assets/app.js';
const cssPath='dist/assets/app.css';
if(!fs.existsSync(appPath)||!fs.existsSync(cssPath)) throw new Error('Run longitudinal v4 before trends-primary-surface.mjs');

let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');

const old='trends.append(wrap);';
if(!app.includes(old)) throw new Error('Longitudinal Trends insertion point not found');
app=app.replace(old,'trends.prepend(wrap);');

if(!app.includes("data-long-lens=\"state\"")||!app.includes('FZ_WELLNESS_HISTORY')||!app.includes('fzRenderWellnessChart')){
  throw new Error('Rich longitudinal Trends implementation missing');
}

css += String.raw`

/* FZ TRENDS primary-surface correction — longitudinal experience opens first */
#trends>#longitudinalLayer{margin-top:0;padding-top:0;border-top:0;margin-bottom:28px}
#trends>#longitudinalLayer .long-title{padding-top:2px}
#trends>#longitudinalLayer .long-filter{margin-top:2px}
`;

fs.writeFileSync(appPath,app);
fs.writeFileSync(cssPath,css);
console.log('TRENDS primary surface: longitudinal layer promoted to top');
console.log('app sha256',createHash('sha256').update(app).digest('hex'));
console.log('css sha256',createHash('sha256').update(css).digest('hex'));
