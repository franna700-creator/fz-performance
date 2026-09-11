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
assert.equal(vercel.git?.deploymentEnabled, false, 'Git auto-deploy must stay permanently disabled; releases are explicit pinned Preview deployments');
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
assert.ok(environmentNames.has('DATABASE_URL') && environmentNames.has('POSTGRES_URL'), 'database env alternatives must be declared for Preview and Production');
assert.ok(environmentNames.has('FZ_STATE_WRITE_TOKEN'), 'runtime write protection env must be declared');
for (const requirement of envContract.requiredRuntimeEnvironment || []) {
  assert.deepEqual(requirement.targets, ['preview', 'production'], `${requirement.name} must be required in Preview and Production`);
}
assert.equal(envContract.promotionPolicy?.previewRequired, true, 'pinned Preview must precede Production promotion');
assert.equal(envContract.promotionPolicy?.previewEnvironmentMustPass, true, 'Preview env probe is a hard promotion gate');
assert.equal(envContract.promotionPolicy?.productionPromotionFromExactPreviewCandidateOnly, true, 'Production must promote the exact validated Preview candidate');
assert.equal(envContract.promotionPolicy?.rollbackCandidateRequiredBeforePromotion, true, 'rollback candidate must exist before promotion');
assert.equal(envContract.promotionPolicy?.directProductionTroubleshootingForbidden, true, 'Production may not be used as a troubleshooting environment');

if (gate.enabled === true) assert.ok(validPinnedReleaseGate(gate), 'armed release metadata is incomplete or stale');

console.log(`PASS zero-failure release preflight: ${functions.length}/${maxFunctions} serverless functions, Node ${pkg.engines.node}, Git auto-deploy OFF, release metadata ${gate.enabled ? 'PINNED' : 'CLOSED'}`);
