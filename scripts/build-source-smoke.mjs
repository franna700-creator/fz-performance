import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildShell } from './build.mjs';

function inventory(root, relative = '') {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? inventory(root, name) : [[name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]];
  });
}

// Only current source is copied: no archive, previous dist, unzip, hotfix or
// HTML injector can rescue a missing canonical build dependency.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fz-shell-source-'));
try {
  fs.cpSync('src', path.join(root, 'src'), { recursive: true });
  const sourceBefore = inventory(path.join(root, 'src'));
  buildShell(root);
  const first = inventory(path.join(root, 'dist'));
  assert.deepEqual(first, inventory('dist'), 'source-only build must reproduce the shipped artifact');
  fs.writeFileSync(path.join(root, 'dist/assets/app.js'), 'obsolete release');
  fs.writeFileSync(path.join(root, 'dist/stale.json'), '{}');
  buildShell(root);
  assert.deepEqual(inventory(path.join(root, 'dist')), first, 'rebuild must be deterministic and remove obsolete output');
  assert.deepEqual(inventory(path.join(root, 'src')), sourceBefore, 'build must never mutate source');

  const html = fs.readFileSync('dist/index.html', 'utf8');
  assert.equal(html, fs.readFileSync('src/shell/index.html', 'utf8'), 'neutral shell must be shipped without patching');
  const scripts = [...html.matchAll(/<script src="\/assets\/([^"]+)" type="module"><\/script>/g)].map(match => match[1]);
  const renderer = scripts.indexOf('app-clean.js');
  assert.ok(renderer >= 0, 'canonical renderer must be present');
  for (const name of ['layout-stability.js', 'live-physiology.js', 'system-intelligence.js', 'training-auto-sync.js', 'intelligence-refresh.js']) {
    assert.ok(scripts.indexOf(name) >= 0 && scripts.indexOf(name) < renderer, `${name} must initialize before canonical reads`);
  }
  for (const name of ['training-memory-rich.js', 'adaptive-choice.js', 'ui-context-recovery.js']) {
    assert.ok(scripts.indexOf(name) > renderer, `${name} must follow the canonical renderer`);
  }
  assert.ok(scripts.indexOf('ui-context-recovery.js') > scripts.indexOf('adaptive-choice.js'));

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.doesNotMatch(pkg.scripts.build, /hotfix\.mjs|clean-shell\.mjs|redesign-v\d-build\.mjs|exposure-v1-build\.mjs|progress-v1-build\.mjs/, 'build must not depend on source or HTML patchers');
  assert.equal(fs.existsSync('release-payload'), false, 'obsolete athlete payload must not be a build input');

  // Missing current source fails closed and retains the validated output.
  fs.unlinkSync(path.join(root, 'src/app-clean.js'));
  assert.throws(() => buildShell(root), /ENOENT/);
  assert.deepEqual(inventory(path.join(root, 'dist')), first);
  console.log('PASS canonical source build: independent of legacy payload, deterministic, source-immutable, fail-closed, runtime order preserved');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
