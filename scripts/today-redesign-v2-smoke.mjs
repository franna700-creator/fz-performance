import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('dist/index.html','utf8');
const js=fs.readFileSync('dist/assets/today-redesign-v2.js','utf8');
const css=fs.readFileSync('dist/assets/today-redesign-v2.css','utf8');
const topside=fs.readFileSync('dist/assets/fz-topside-shell.css','utf8');
const heroCss=fs.readFileSync('dist/assets/fz-hero-responsive.css','utf8');
const desktopHero=fs.readFileSync('dist/assets/fz-hero-desktop.webp');
const mobileHero=fs.readFileSync('dist/assets/fz-hero-mobile.webp');

assert.ok(html.includes('/assets/today-redesign-v2.css'),'TODAY v2 CSS is wired');
assert.ok(html.includes('/assets/fz-topside-shell.css'),'topside shell CSS is wired');
assert.ok(html.includes('/assets/fz-hero-responsive.css'),'responsive hero CSS is wired');
assert.ok(html.includes('/assets/today-redesign-v2.js'),'TODAY v2 JS is wired');
assert.ok(!html.includes('/assets/today-experience.js')&&!html.includes('/assets/today-experience.css'),'superseded TODAY v1 assets are not wired');
assert.ok(js.includes("v2Json('/api/runtime-state')")&&js.includes("v2Json('/api/wellness/today?refresh=0')")&&js.includes("v2Json('/api/training/memory?backDays=45&forwardDays=0')"),'TODAY v2 uses existing canonical read contracts');
assert.ok(js.includes('FZ_TODAY_V2_QUOTES')&&js.includes('v2Quote()')&&js.includes('v2DayOrdinal()'),'daily quote system is deterministic by SAST day');
assert.ok(js.includes('v2MountTopShell()')&&js.includes("v2TopNavButton('today'")&&js.includes("v2TopNavButton('trends'")&&js.includes("v2TopNavButton('train'")&&js.includes("v2TopNavButton('system'"),'topside desktop navigation is implemented through existing page contracts');
assert.ok(js.includes('function v2LiveKind(')&&js.includes('v2DecorateLive(root)')&&js.includes("['heart','cyan']")&&js.includes("['moon','violet']"),'semantic colour/icon decoration is presentation-only and runtime driven');
assert.ok(css.includes('.fz2-stage')&&css.includes('.fz2-photo')&&css.includes('.fz2-legacy-live'),'new editorial composition preserves the real live physiology engine');
assert.ok(!css.includes('fz-training-hero.jpg'),'superseded personal-photo fallback is absent from TODAY v2 CSS');
assert.ok(topside.includes('.fz2-top-shell')&&topside.includes('body.fz2-topside-active .side{display:none!important}'),'legacy left rail is replaced by topside shell');
assert.ok(topside.includes('--fz2-green')&&topside.includes('--fz2-cyan')&&topside.includes('--fz2-violet'),'semantic accent palette is present');
assert.ok(topside.includes('.fz2-lower{display:contents!important}')&&topside.includes('.fz2-thought{order:2!important;'),'mobile feed promotes Daily FZ Thought ahead of physiology');
assert.ok(heroCss.includes("url('/assets/fz-hero-desktop.webp')")&&heroCss.includes("url('/assets/fz-hero-mobile.webp')"),'responsive hero selects dedicated desktop and mobile imagery');
for(const [label,photo] of [['desktop',desktopHero],['mobile',mobileHero]]){
  assert.equal(photo.subarray(0,4).toString('ascii'),'RIFF',`${label} hero begins with RIFF`);
  assert.equal(photo.subarray(8,12).toString('ascii'),'WEBP',`${label} hero is valid WebP`);
  assert.ok(photo.length>1024,`${label} hero has a non-placeholder payload`);
}
assert.notDeepEqual(desktopHero,mobileHero,'desktop and mobile hero assets are dedicated variants');
assert.ok(!fs.existsSync('dist/assets/fz-training-hero.jpg'),'superseded hero JPEG is not emitted');
assert.ok(!js.includes('How are you feeling'),'undeveloped subjective check-in is not exposed');
assert.ok(!js.includes('Goals & Progress'),'Goals & Progress remains out of tranche 1 live UI');
console.log('PASS FZ TODAY redesign v2 release-candidate visual contract');
