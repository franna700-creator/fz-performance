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

// Runtime state can legitimately ship a static #longitudinalLayer narrative. The rich shell
// must replace that static state-rendered block instead of treating its ID as proof that the
// interactive explorer has already mounted.
const runtimeCollision="const trends=$('trends');if(!trends||$('longitudinalLayer'))return;";
const runtimeAware="const trends=$('trends');if(!trends)return;const existingLong=$('longitudinalLayer');if(existingLong){if(existingLong.classList.contains('long-shell'))return;existingLong.remove();}";
if(!app.includes(runtimeCollision)) throw new Error('Runtime longitudinal collision guard not found');
app=app.replace(runtimeCollision,runtimeAware);

if(!app.includes('existingLong.remove()')||!app.includes("data-long-lens=\"state\"")||!app.includes('FZ_WELLNESS_HISTORY')||!app.includes('fzRenderWellnessChart')){
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
console.log('TRENDS primary surface: runtime static layer replaced by interactive longitudinal layer');
console.log('app sha256',createHash('sha256').update(app).digest('hex'));
console.log('css sha256',createHash('sha256').update(css).digest('hex'));
