import fs from 'node:fs';
const base=fs.existsSync('dist/index.html')?'dist/': '';
const html=fs.readFileSync(base+'index.html','utf8'),js=fs.readFileSync(base+'assets/app.js','utf8'),css=fs.readFileSync(base+'assets/app.css','utf8'),api=fs.readFileSync('api/runtime-state.js','utf8');
const checks=[
 ['direct external app.js',html.includes('/assets/app.js')],
 ['no document.write',!html.includes('document.write')&&!js.includes('document.write')],
 ['no inline shell script',!/<script>(?!\s*<\/script>)/.test(html)],
 ['two refresh slots',js.includes('SCHEDULE_SAST=[6,20]')&&!js.includes('SCHEDULE_SAST=[6,13,20]')],
 ['no 13:00 shell copy',!html.includes('13:00')&&!js.includes('13:00')],
 ['today date',html.includes('id="todayDate"')&&js.includes('renderTodayDate')],
 ['graph pointer scrubbing',js.includes("addEventListener('pointermove'")&&js.includes('installIndexScrubber')],
 ['graph touch scrubbing',js.includes("addEventListener('touchstart'")&&js.includes("addEventListener('touchend'")],
 ['scrub tooltip styling',css.includes('.chart-scrub-tooltip')&&css.includes('.scrub-halo')],
 ['touch haptics',js.includes('navigator.vibrate')],
 ['same-origin runtime',js.includes("fetch('/api/runtime-state'")],
 ['runtime validation',api.includes('masterValidated')&&api.includes('validRuntimeState')],
 ['immutable generation gateway',api.includes('validGenerationRef')&&api.includes('generationId')&&api.includes('manifest.json')&&api.includes('/generations/')],
 ['previous server fallback',api.includes('pointerOrLegacy.previous')&&api.includes('X-FZ-State-Source')&&api.includes("loaded.source === 'previous'")],
 ['payload integrity',api.includes('state chunk integrity failure')&&api.includes('state payload checksum failure')],
 ['formal schema files',['runtime-state.schema.json','state-generation-manifest.schema.json','state-pointer.schema.json'].every(name=>fs.existsSync('schemas/'+name))],
 ['fail stale browser fallback',js.includes('fz:last-known-good-state')],
 ['no legacy hourly copy',!html.includes('hourly reconciled refreshes')&&!html.includes('07:00–22:00')],
 ['four pages',['today','trends','train','system'].every(id=>html.includes(`id="${id}"`))],
 ['v0.6.1 shell',js.includes("SHELL_VERSION='0.6.1'")&&html.includes('2026-09-07-v0.6.1')],
 ['no stale v0.5 shell labels',!/v0\.5 reliability (architecture|shell)/i.test(html)],
 ['longitudinal injector',js.includes('ensureLongitudinalTrends')&&js.includes('datasets.LONGITUDINAL')],
 ['longitudinal primary surface',js.includes('trends.prepend(wrap);')&&!js.includes('trends.append(wrap);')],
 ['visual wellness explorer',js.includes('FZ_WELLNESS_HISTORY')&&js.includes('fzRenderWellnessChart')&&js.includes('fzWellnessChart')],
 ['live wellness runtime sync',js.includes('fzRuntimeWellnessHistory')&&js.includes('fzRuntimeWellnessDef')&&js.includes('CURRENT MASTER-VALIDATED UPDATE')&&js.includes('SCRUB HISTORY · 17 AUG → LIVE')],
 ['wellness metric tabs',['HRV','RHR','SLEEP','SLEEP SCORE','BODY BATTERY','STRESS','STEPS','ACTIVE KCAL','READINESS'].every(x=>js.includes(x))],
 ['longitudinal Trends domains',['ATHLETE STATE','RECOVERY RESPONSE','PERFORMANCE','EXPOSURE COST','ATHLETE VOICE','TRAJECTORY'].every(x=>js.includes(x))],
 ['readiness forward-only rule',js.includes('Readiness history begins from exact retained FZ scores going forward')],
 ['baseline maturity',js.includes('PROVISIONAL')&&js.includes('Personal baseline')]
];
let bad=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)bad++}if(bad)process.exit(1);
