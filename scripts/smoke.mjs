import fs from 'node:fs';
const base=fs.existsSync('dist/index.html')?'dist/': '';
const html=fs.readFileSync(base+'index.html','utf8'),js=fs.readFileSync(base+'assets/app.js','utf8'),css=fs.readFileSync(base+'assets/app.css','utf8'),api=fs.readFileSync('api/runtime-state.js','utf8');
const checks=[
 ['direct external app.js',html.includes('/assets/app.js')],
 ['no document.write',!html.includes('document.write')&&!js.includes('document.write')],
 ['no inline shell script',!/<script>(?!\s*<\/script>)/.test(html)],
 ['three refresh slots',js.includes('SCHEDULE_SAST=[6,13,20]')],
 ['today date',html.includes('id="todayDate"')&&js.includes('renderTodayDate')],
 ['graph pointer scrubbing',js.includes("addEventListener('pointermove'")&&js.includes('installIndexScrubber')],
 ['graph touch scrubbing',js.includes("addEventListener('pointerdown'")],
 ['scrub tooltip styling',css.includes('.chart-scrub-tooltip')&&css.includes('.scrub-halo')],
 ['touch haptics',js.includes('navigator.vibrate')],
 ['same-origin runtime',js.includes("fetch('/api/runtime-state'")],
 ['runtime validation',/masterValidated\s*===\s*true/.test(api)],
 ['immutable generation gateway',api.includes('validGenerationRef')&&api.includes('/generations/${ref.generationId}/manifest.json')],
 ['previous server fallback',api.includes("['previous', pointerOrLegacy.previous]")&&api.includes("X-FZ-State-Source")),
 ['payload integrity',api.includes('state chunk integrity failure')&&api.includes('state payload checksum failure')],
 ['formal schema files',['runtime-state.schema.json','state-generation-manifest.schema.json','state-pointer.schema.json'].every(name=>fs.existsSync('schemas/'+name))],
 ['fail stale browser fallback',js.includes('fz:last-known-good-state')],
 ['no legacy hourly copy',!html.includes('hourly reconciled refreshes')&&!html.includes('07:00–22:00')],
 ['four pages',['today','trends','train','system'].every(id=>html.includes(`id="${id}"`))]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
