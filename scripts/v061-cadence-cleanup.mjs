import fs from 'node:fs';

const HTML_PATH='dist/index.html';
const APP_PATH='dist/assets/app.js';

let html=fs.readFileSync(HTML_PATH,'utf8');
html=html
  .replaceAll('2026-09-07-v0.5.0','2026-09-07-v0.6.1')
  .replaceAll('06:00 / 13:00 / 20:00','06:00 / 20:00')
  .replaceAll('13:00 + 20:00','20:00')
  .replaceAll('v0.5 reliability architecture','v0.6.1 reliability architecture')
  .replaceAll('v0.5 reliability shell','v0.6.1 reliability shell')
  .replaceAll('v0.5 RELIABILITY ARCHITECTURE','v0.6.1 RELIABILITY ARCHITECTURE')
  .replaceAll('v0.5 RELIABILITY SHELL','v0.6.1 RELIABILITY SHELL');

if(html.includes('13:00')) throw new Error('Stale 13:00 shell copy remains in index.html');
if(/v0\.5 reliability (architecture|shell)/i.test(html)) throw new Error('Stale v0.5 shell label remains in index.html');
if(!html.includes('2026-09-07-v0.6.1')) throw new Error('v0.6.1 build marker missing from index.html');
fs.writeFileSync(HTML_PATH,html);

let app=fs.readFileSync(APP_PATH,'utf8');
app=app
  .replace("const SHELL_VERSION='0.6.0';","const SHELL_VERSION='0.6.1';")
  .replace('const SCHEDULE_SAST=[6,13,20];','const SCHEDULE_SAST=[6,20];')
  .replaceAll('06:00 / 13:00 / 20:00','06:00 / 20:00');

if(!app.includes("const SHELL_VERSION='0.6.1';")) throw new Error('v0.6.1 shell version missing');
if(!app.includes('const SCHEDULE_SAST=[6,20];')) throw new Error('06:00 / 20:00 schedule missing');
if(app.includes('SCHEDULE_SAST=[6,13,20]')||app.includes('13:00')) throw new Error('Stale 13:00 schedule remains in app.js');
fs.writeFileSync(APP_PATH,app);

console.log('PASS v0.6.1 shell/version/cadence cleanup');
