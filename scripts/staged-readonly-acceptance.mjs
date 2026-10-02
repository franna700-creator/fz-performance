import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = (process.env.FZ_PROD_URL || '').replace(/\/$/, '');
assert.ok(BASE, 'FZ_PROD_URL is required');

const browser = await chromium.launch({ headless: true });
try {
  for (const [label, options] of [
    ['desktop', { viewport: { width: 1440, height: 1000 } }],
    ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]
  ]) {
    const context = await browser.newContext(options);

    async function read(path) {
      const response = await context.request.get(BASE + path, { headers: { accept: 'application/json' } });
      assert.equal(response.status(), 200, path + ' must return 200');
      return response.json();
    }

    const [runtime, wellness, training, trends, goals, system, intelligence] = await Promise.all([
      read('/api/runtime-state'),
      read('/api/wellness/today?refresh=0'),
      read('/api/training/memory?backDays=45&forwardDays=0'),
      read('/api/trends/current?days=45'),
      read('/api/goals/current'),
      read('/api/system/status'),
      read('/api/intelligence/current')
    ]);

    assert.equal(runtime.masterValidated, true, 'runtime base must remain validated');
    assert.equal(runtime.renderContract?.intelligence?.runtimeBase?.role, 'VALIDATED_BASE_ENVELOPE', 'runtime must expose validated-base semantics');
    assert.equal(runtime.renderContract?.intelligence?.runtimeBase?.currentTruthSource, 'NEON_CANONICAL_INTELLIGENCE', 'runtime current truth must be Neon canonical intelligence');
    assert.equal(system.architecture?.operationalTruth, 'Neon', 'SYSTEM operational truth must remain Neon');
    assert.equal(system.runtime?.role, 'VALIDATED_BASE_ENVELOPE', 'SYSTEM must expose the runtime base role');
    assert.equal(system.runtime?.currentTruthSource, 'NEON_CANONICAL_INTELLIGENCE', 'SYSTEM must expose current Neon truth separately from the base');
    assert.ok(system.runtime?.currentLocalDate, 'SYSTEM must expose current canonical local date');
    assert.equal(system.systemIntegrity?.ok, true, 'SYSTEM integrity must be green for staged acceptance');
    assert.equal(intelligence.pendingPropagation, false, 'staged acceptance requires converged current intelligence');
    assert.equal(intelligence.currentReadiness?.status, 'READY', 'canonical readiness must be READY');
    assert.equal(intelligence.currentReadiness?.evidence?.wellnessSource?.sourceKey, 'intervals-icu', 'readiness must remain anchored to Intervals.icu');
    assert.equal(training.ok, true, 'training memory must be healthy');
    assert.equal(trends.ok, true, 'trends must be healthy');
    assert.equal(goals.ok, true, 'goals must be healthy');
    assert.equal(system.tredict?.configured, true, 'Tredict credential must remain configured even when upstream health is ERROR');
    assert.ok(['CONNECTED','ERROR','CONFIGURED'].includes(system.tredict?.status), 'Tredict source health must be explicit rather than inferred from configuration');

    await context.route('**/api/wellness/today*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(wellness)
    }));
    await context.route('**/api/training/memory*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(training)
    }));
    await context.route('**/api/intelligence/refresh*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        afterRevision: intelligence.revision || null,
        pendingPropagation: intelligence.pendingPropagation === true,
        pending: intelligence.pending || null,
        currentReadiness: intelligence.currentReadiness || null,
        activeRecommendation: intelligence.activeRecommendation || null,
        affectedSurfaces: intelligence.affectedSurfaces || []
      })
    }));

    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.ok(response?.ok(), label + ' root must load');
    await page.waitForSelector('.fz2-top-shell', { timeout: 30000 });

    const viewer = page.getByRole('button', { name: /Continue in Viewer Mode/i });
    await viewer.waitFor({ state: 'visible', timeout: 5000 });
    await viewer.click();
    const overlay = page.locator('[data-fz-mode-overlay]');
    if (await overlay.count()) await overlay.waitFor({ state: 'hidden', timeout: 5000 });

    await page.waitForSelector('#today .fz2-phys-summary', { timeout: 15000 });
    await page.waitForSelector('#today .fz2-training', { timeout: 15000 });

    for (const id of ['trends','train','goals','system','today']) {
      const button = page.locator('[data-page="' + id + '"]:visible').first();
      assert.ok(await button.count(), label + ' ' + id + ' nav must exist');
      await button.click();
      await page.waitForFunction(pageId => document.getElementById(pageId)?.classList.contains('active'), id);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 2, label + ' must not horizontally overflow');
    assert.deepEqual(pageErrors, [], label + ' page errors');
    assert.deepEqual(consoleErrors, [], label + ' console errors');

    await context.close();
  }
  console.log('PASS read-only staged browser acceptance');
} finally {
  await browser.close();
}
