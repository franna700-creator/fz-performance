import { webkit } from 'playwright';

const target = process.env.FZ_PRODUCTION_URL || 'https://fz-performance-mvp.vercel.app/';
const canonicalPaths = [
  '/api/runtime-state',
  '/api/wellness/today',
  '/api/training/memory',
  '/api/trends/current',
  '/api/system/status'
];

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const pageErrors = [];
const canonicalResponses = new Map();
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('response', response => {
  try {
    const pathname = new URL(response.url()).pathname;
    if (canonicalPaths.includes(pathname)) canonicalResponses.set(pathname, response.status());
  } catch {}
});

let ok = true;
try {
  const url = new URL(target);
  url.searchParams.set('fzBrowserSmoke', String(Date.now()));
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 15000 });

  await page.waitForFunction(() => {
    const today = document.getElementById('today');
    const stamp = document.getElementById('stateStamp');
    if (!today || !stamp) return false;
    const todayText = today.textContent || '';
    const stampText = stamp.textContent || '';
    return !todayText.includes('Loading current athlete state')
      && todayText.trim().length > 100
      && !stampText.includes('SYNCING CANONICAL STATE');
  }, { timeout: 12000 });

  await page.waitForTimeout(1500);
  const todayStable = await page.evaluate(() => ({
    loadingGone: !document.getElementById('today')?.textContent?.includes('Loading current athlete state'),
    stamp: document.getElementById('stateStamp')?.textContent || '',
    todayLength: document.getElementById('today')?.textContent?.trim().length || 0,
    materialitySections: document.querySelectorAll('[data-materiality-observability]').length,
    integritySections: document.querySelectorAll('[data-dynamic-integrity]').length
  }));

  if (!todayStable.loadingGone || todayStable.todayLength < 100 || todayStable.stamp.includes('SYNCING CANONICAL STATE')) {
    ok = false;
    console.error('FAIL production TODAY did not remain stably rendered', todayStable);
  } else {
    console.log(`PASS production TODAY rendered and stayed stable: stamp="${todayStable.stamp}"`);
  }

  for (const name of ['trends', 'train', 'system']) {
    await page.locator(`.bottom button[data-page="${name}"]`).click();
    await page.waitForTimeout(350);
    const state = await page.evaluate(pageName => {
      const root = document.getElementById(pageName);
      return {
        active: root?.classList.contains('active') || false,
        loading: Boolean(root?.querySelector('.fz-clean-loading')),
        length: root?.textContent?.trim().length || 0
      };
    }, name);
    if (!state.active || state.loading || state.length < 100) {
      ok = false;
      console.error(`FAIL production ${name.toUpperCase()} render`, state);
    } else {
      console.log(`PASS production ${name.toUpperCase()} render`);
    }
  }

  await page.waitForTimeout(1200);
  const observerStable = await page.evaluate(() => ({
    materialitySections: document.querySelectorAll('[data-materiality-observability]').length,
    integritySections: document.querySelectorAll('[data-dynamic-integrity]').length,
    todayLoading: Boolean(document.querySelector('#today .fz-clean-loading')),
    systemLoading: Boolean(document.querySelector('#system .fz-clean-loading'))
  }));
  if (observerStable.materialitySections > 1 || observerStable.integritySections > 1 || observerStable.todayLoading || observerStable.systemLoading) {
    ok = false;
    console.error('FAIL production observer stability', observerStable);
  } else {
    console.log('PASS production observer remains idempotent after tab navigation');
  }

  for (const path of canonicalPaths) {
    const status = canonicalResponses.get(path);
    if (status !== 200) {
      ok = false;
      console.error(`FAIL ${path} browser response status: ${status ?? 'missing'}`);
    } else {
      console.log(`PASS ${path} browser response 200`);
    }
  }

  if (pageErrors.length) {
    ok = false;
    console.error('FAIL page errors:', pageErrors.join('\n'));
  } else {
    console.log('PASS no WebKit page errors');
  }
} catch (error) {
  ok = false;
  console.error('FAIL production mobile refresh smoke:', error?.stack || error);
} finally {
  await browser.close().catch(() => {});
}

if (!ok) process.exit(1);
console.log('PASS live production WebKit canonical refresh smoke');
