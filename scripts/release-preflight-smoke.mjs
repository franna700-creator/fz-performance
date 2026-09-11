import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function apiFunctions(dir = 'api') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...apiFunctions(full));
    else if (entry.isFile() && /\.(?:js|mjs|cjs|ts)$/.test(entry.name)) out.push(full.replaceAll('\\', '/'));
  }
  return out.sort();
}

function validPinnedReleaseGate(gate) {
  return Boolean(
    gate?.enabled === true &&
    gate?.scope === 'PINNED_RELEASE_ONLY' &&
    /^TRANCHE_[0-9_]+/.test(String(gate?.release || '')) &&
    /^[0-9a-f]{40}$/.test(String(gate?.validatedCandidateSha || '')) &&
    /^[0-9a-f]{40}$/.test(String(gate?.validatedCandidateTree || '')) &&
    /^release-/.test(String(gate?.releaseBranch || '')) &&
    !gate?.closedOn
  );
}

const pkg = json('package.json');
const vercel = json('vercel.json');
const gate = json('config/controlled-deployment.json');
const envContract = json('config/release-environment-contract.json');
const functions = apiFunctions();
const maxFunctions = Number(envContract.hosting?.maxServerlessFunctions || 0);
const systemApi = fs.readFileSync('api/system/status.js', 'utf8');

assert.equal(pkg.engines?.node, '24.x', 'Node must be pinned to Vercel Node 24.x; floating >= ranges caused avoidable release drift warnings');
assert.equal(Number(envContract.hosting?.nodeMajor), 24, 'release environment contract must match Node 24');
assert.equal(vercel.buildCommand, 'npm run build', 'Vercel must execute the same build gate CI validates');
assert.equal(vercel.outputDirectory, 'dist', 'Vercel output directory must remain dist');
assert.ok(maxFunctions > 0, 'serverless function limit must be declared');
assert.ok(functions.length <= maxFunctions, `serverless function budget exceeded: ${functions.length}/${maxFunctions}: ${functions.join(', ')}`);

const rewriteMap = new Map((vercel.rewrites || []).map(rule => [rule.source, rule.destination]));
assert.equal(rewriteMap.get('/api/intelligence/current'), '/api/system/status?operation=intelligence-current', 'intelligence current must share the SYSTEM function');
assert.equal(rewriteMap.get('/api/intelligence/refresh'), '/api/system/status?operation=intelligence-refresh', 'intelligence refresh must share the SYSTEM function');
assert.equal(fs.existsSync('api/intelligence/current.js'), false, 'standalone intelligence current function would exceed Hobby function budget');
assert.equal(fs.existsSync('api/intelligence/refresh.js'), false, 'standalone intelligence refresh function would exceed Hobby function budget');

assert.match(systemApi, /releaseEnvironment:\{databaseConfigured:databaseConfigured\(\),writeTokenConfigured:Boolean\(process\.env\.FZ_STATE_WRITE_TOKEN\)/, 'SYSTEM must expose secret-safe release environment probes');
assert.match(systemApi, /secretsExposed:false/, 'SYSTEM release probes must explicitly remain secret-safe');

const environmentNames = new Set((envContract.requiredRuntimeEnvironment || []).flatMap(item => item.alternatives || []));
assert.ok(environmentNames.has('DATABASE_URL') && environmentNames.has('POSTGRES_URL'), 'database env alternatives must be declared for preview and production');
assert.ok(environmentNames.has('FZ_STATE_WRITE_TOKEN'), 'runtime write protection env must be declared');
for (const requirement of envContract.requiredRuntimeEnvironment || []) {
  assert.deepEqual(requirement.targets, ['preview', 'production'], `${requirement.name} must be required in Preview and Production`);
}
assert.equal(envContract.promotionPolicy?.previewRequired, true, 'pinned Preview must precede Production promotion');
assert.equal(envContract.promotionPolicy?.previewEnvironmentMustPass, true, 'Preview env probe is a hard promotion gate');
assert.equal(envContract.promotionPolicy?.productionPromotionFromExactPreviewCandidateOnly, true, 'Production must promote the exact validated preview candidate');
assert.equal(envContract.promotionPolicy?.directProductionTroubleshootingForbidden, true, 'Production may not be used as a troubleshooting environment');

if (gate.enabled === true) {
  assert.equal(vercel.git?.deploymentEnabled, true, 'an armed release gate requires Git deployment enabled in the same pinned release commit');
  assert.ok(validPinnedReleaseGate(gate), 'armed deployment gate is incomplete or stale');
} else {
  assert.equal(vercel.git?.deploymentEnabled, false, 'ordinary development must keep automatic Git deployments disabled');
}

if (process.env.VERCEL === '1' && vercel.git?.deploymentEnabled === true) {
  assert.equal(process.env.VERCEL_GIT_COMMIT_SHA, gate.validatedCandidateSha, 'Vercel build SHA must equal the armed candidate SHA');
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, gate.releaseBranch, 'Vercel build branch must equal the armed release branch');
}

console.log(`PASS zero-failure release preflight: ${functions.length}/${maxFunctions} serverless functions, Node ${pkg.engines.node}, deployment aperture ${gate.enabled ? 'PINNED' : 'CLOSED'}`);
