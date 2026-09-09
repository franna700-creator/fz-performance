import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const cssPath = path.join(ROOT, 'dist', 'assets', 'app.css');
const htmlPath = path.join(ROOT, 'dist', 'index.html');

if (!fs.existsSync(cssPath) || !fs.existsSync(htmlPath)) {
  throw new Error('Expected built dist assets before mobile safe-area patch');
}

let css = fs.readFileSync(cssPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const marker = 'FZ_TRANCHE2A1_MOBILE_SAFE_AREA';

if (!html.includes('viewport-fit=cover')) {
  throw new Error('Mobile safe-area patch requires viewport-fit=cover');
}
if (!css.includes('@media(max-width:760px)')) {
  throw new Error('Expected mobile breakpoint missing');
}
if (!css.includes('.main{padding:20px 15px 104px}')) {
  throw new Error('Expected base mobile main padding changed; review safe-area patch');
}

if (!css.includes(marker)) {
  css += `\n\n/* ${marker} */\n@media(max-width:760px){\n  .main{padding-top:calc(env(safe-area-inset-top,0px) + 18px);padding-left:max(15px,env(safe-area-inset-left,0px));padding-right:max(15px,env(safe-area-inset-right,0px))}\n  .topbar{margin-bottom:28px}\n  .mast .kicker{margin-bottom:14px;line-height:1.45}\n  .today-date{margin:0 0 14px;gap:10px}\n  .mast h1{margin:0 0 12px;line-height:.96}\n  .subtitle{margin-top:0}\n}\n@media(max-width:470px){\n  .main{padding-top:calc(env(safe-area-inset-top,0px) + 20px)}\n  .mast .kicker{font-size:9px;letter-spacing:.15em;margin-bottom:16px}\n  .today-date{margin-bottom:16px}\n  .mast h1{font-size:36px;line-height:.98;letter-spacing:-.045em}\n}\n`;
}

fs.writeFileSync(cssPath, css);

const required = [
  marker,
  'env(safe-area-inset-top,0px)',
  '.mast .kicker{margin-bottom:14px',
  '.mast h1{margin:0 0 12px'
];
for (const token of required) {
  if (!css.includes(token)) throw new Error(`Mobile safe-area output missing: ${token}`);
}

console.log('PASS Tranche 2A.1: iOS safe-area + mobile hero spacing rebalance');
