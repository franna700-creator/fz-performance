import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const js=fs.readFileSync('dist/assets/today-experience.js','utf8');
const css=fs.readFileSync('dist/assets/today-experience.css','utf8');
const checks=[
  ['TODAY JS wired',html.includes('/assets/today-experience.js')],
  ['TODAY CSS wired',html.includes('/assets/today-experience.css')],
  ['visual layer loads last',html.indexOf('/assets/today-experience.js')>html.indexOf('/assets/ui-context-recovery.js')&&html.indexOf('/assets/today-experience.css')>html.indexOf('/assets/fz-design-system.css')],
  ['daily thought deterministic',js.includes('Africa/Johannesburg')&&js.includes('FZ_DAILY_THOUGHTS')&&js.includes('dayOrdinal')],
  ['daily thought always on TODAY',js.includes('fz-thought-section')&&js.includes('FZ THOUGHT OF THE DAY')],
  ['no fake subjective check-in',!js.includes('How are you feeling today')&&!js.includes('Log Update')],
  ['no athlete truth hard-coded',!js.includes('HYROX Johannesburg')&&!js.includes('Hoka Half')&&!js.includes('Deadly Dozen')]
];
let bad=0;for(const[name,ok]of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++;}if(bad)process.exit(1);
await import('./today-redesign-v2-smoke.mjs');
console.log('PASS FZ TODAY legacy compatibility + v2 redesign contracts');
