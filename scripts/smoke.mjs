import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('assets/app.js','utf8'),api=fs.readFileSync('api/runtime-state.js','utf8');
const checks=[
 ['direct external app.js',html.includes('/assets/app.js')],
 ['no document.write',!html.includes('document.write')&&!js.includes('document.write')],
 ['no inline shell script',!/<script>(?!\s*<\/script>)/.test(html)],
 ['three refresh slots',js.includes('SCHEDULE_SAST=[6,13,20]')],
 ['graph pointer scrubbing',js.includes("addEventListener('pointermove'")],
 ['touch haptics',js.includes('navigator.vibrate')],
 ['runtime validation',api.includes('masterValidated===true')],
 ['fail stale fallback',js.includes('fz:last-known-good-state')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
