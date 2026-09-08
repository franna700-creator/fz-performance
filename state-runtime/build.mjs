import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const INPUT_PATH = path.join(ROOT, 'state-input.json');
const DEFAULT_ORIGIN = 'https://fz-performance-state.vercel.app';
const CHUNK_SIZE = 8192;

const fail = (message) => {
  console.error(`FZ_STATE_BUILD_FAILED: ${message}`);
  process.exit(1);
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
};
const writeBytes = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
const fetchNoStore = async (url) => {
  const join = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${join}cb=${Date.now()}-${Math.random()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) fail(`HTTP ${res.status} fetching ${url}`);
  return res;
};
const requireHex64 = (value, label) => {
  if (!/^[a-f0-9]{64}$/.test(value || '')) fail(`${label} must be sha256 hex`);
};

if (!fs.existsSync(INPUT_PATH)) fail('state-input.json missing');
const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
if (input.inputVersion !== 1) fail('unsupported inputVersion');
if (!['bootstrap-noop', 'publish'].includes(input.mode)) fail('unsupported mode');
const origin = input.stateOrigin || DEFAULT_ORIGIN;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const livePointer = await (await fetchNoStore(`${origin}/current.json`)).json();
if (livePointer.schemaVersion !== '1.1' || !livePointer.current) fail('live pointer is not schema 1.1');
requireHex64(livePointer.current.generationId, 'live current generationId');
if (livePointer.current.compressedSha256 !== livePointer.current.generationId) fail('live current checksum/generation mismatch');

async function copyGeneration(ref) {
  if (!ref) return null;
  requireHex64(ref.generationId, 'generationId');
  const manifestUrl = new URL(ref.manifestPath, origin).toString();
  const manifest = await (await fetchNoStore(manifestUrl)).json();
  if (manifest.schemaVersion !== '1.1') fail(`manifest ${ref.generationId} schema mismatch`);
  if (manifest.generationId !== ref.generationId || manifest.compressedSha256 !== ref.generationId) {
    fail(`manifest ${ref.generationId} identity mismatch`);
  }
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length < 1) fail(`manifest ${ref.generationId} has no chunks`);
  const buffers = [];
  for (const chunk of manifest.chunks) {
    const chunkUrl = new URL(chunk.path, origin).toString();
    const bytes = Buffer.from(await (await fetchNoStore(chunkUrl)).arrayBuffer());
    if (bytes.length !== chunk.size) fail(`chunk size mismatch ${chunk.path}`);
    if (sha256(bytes) !== chunk.sha256) fail(`chunk hash mismatch ${chunk.path}`);
    buffers.push(bytes);
    writeBytes(path.join(DIST, chunk.path.replace(/^\//, '')), bytes);
  }
  const compressed = Buffer.concat(buffers);
  if (sha256(compressed) !== ref.generationId) fail(`generation hash mismatch ${ref.generationId}`);
  writeJson(path.join(DIST, ref.manifestPath.replace(/^\//, '')), manifest);
  return manifest;
}

function deterministicGzip(buffer) {
  const gz = Buffer.from(gzipSync(buffer, { level: 9 }));
  // GZIP MTIME bytes must be zero so generation identity is deterministic.
  if (gz.length >= 8) gz.writeUInt32LE(0, 4);
  return gz;
}

function buildGeneration(state, publishedAt) {
  if (!state || typeof state !== 'object') fail('currentState missing');
  if (state.schemaVersion !== '0.6.1' || state.shellVersion !== '0.6.1') fail('runtime state must be v0.6.1 compatible');
  if (state.masterValidated !== true) fail('runtime masterValidated must be true');
  if (!state.stateId || !state.masterAsOf) fail('runtime stateId/masterAsOf missing');
  if (!Array.isArray(state.scheduleSAST) || state.scheduleSAST.join(',') !== '6,20') fail('scheduleSAST must equal [6,20]');
  for (const page of ['today', 'trends', 'train', 'system']) {
    if (!state.pages?.[page] || typeof state.pages[page] !== 'string') fail(`required page missing: ${page}`);
  }
  if (!Array.isArray(state.datasets?.WELLNESS_HISTORY) || state.datasets.WELLNESS_HISTORY.length < 1) {
    fail('required dataset WELLNESS_HISTORY missing');
  }
  const dates = state.datasets.WELLNESS_HISTORY.map((row) => row?.date);
  if (new Set(dates).size !== dates.length) fail('duplicate WELLNESS_HISTORY dates');
  const currentRows = state.datasets.WELLNESS_HISTORY.filter((row) => row?.status === 'LIVE / PARTIAL');
  if (currentRows.length !== 1) fail('WELLNESS_HISTORY must contain exactly one LIVE / PARTIAL row');

  const runtime = structuredClone(state);
  runtime.publishedAt = publishedAt;
  runtime.runtimePublishedAt = publishedAt;
  const raw = Buffer.from(JSON.stringify(runtime));
  const uncompressedSha256 = sha256(raw);
  const compressed = deterministicGzip(raw);
  const generationId = sha256(compressed);
  const chunks = [];
  let index = 0;
  for (let offset = 0; offset < compressed.length; offset += CHUNK_SIZE) {
    index += 1;
    const bytes = compressed.subarray(offset, Math.min(offset + CHUNK_SIZE, compressed.length));
    const name = `state-${String(index).padStart(2, '0')}.bin`;
    const chunkPath = `/generations/${generationId}/${name}`;
    chunks.push({ path: chunkPath, size: bytes.length, sha256: sha256(bytes) });
    writeBytes(path.join(DIST, chunkPath.replace(/^\//, '')), bytes);
  }
  const manifestPath = `/generations/${generationId}/manifest.json`;
  const manifest = {
    schemaVersion: '1.1',
    generationId,
    stateId: runtime.stateId,
    masterValidated: true,
    masterAsOf: runtime.masterAsOf,
    publishedAt,
    nextRefreshAt: runtime.nextRefreshAt,
    encoding: 'gzip-split',
    compressedSha256: generationId,
    uncompressedSha256,
    chunks
  };
  writeJson(path.join(DIST, manifestPath.replace(/^\//, '')), manifest);
  return {
    generationId,
    manifestPath,
    stateId: runtime.stateId,
    compressedSha256: generationId
  };
}

if (input.mode === 'bootstrap-noop') {
  await copyGeneration(livePointer.current);
  if (livePointer.previous) await copyGeneration(livePointer.previous);
  writeJson(path.join(DIST, 'current.json'), livePointer);
  console.log(JSON.stringify({ outcome: 'BOOTSTRAP_NOOP_CLONE', pointerVersion: livePointer.pointerVersion, stateId: livePointer.current.stateId, generationId: livePointer.current.generationId }));
  process.exit(0);
}

if (!input.base) fail('publish input.base missing');
if (input.base.pointerVersion !== livePointer.pointerVersion) fail(`lease pointerVersion changed: expected ${input.base.pointerVersion}, live ${livePointer.pointerVersion}`);
if (input.base.generationId !== livePointer.current.generationId) fail('lease generationId changed');
if (input.base.stateId !== livePointer.current.stateId) fail('lease stateId changed');
if (!input.publishedAt || Number.isNaN(Date.parse(input.publishedAt))) fail('publishedAt invalid');
if (!input.currentState?.stateId || Date.parse(input.currentState.stateId) <= Date.parse(livePointer.current.stateId)) {
  fail('candidate stateId is not strictly newer than live stateId');
}

// Retain the exact currently validated generation bytes as fallback.
await copyGeneration(livePointer.current);
const currentRef = buildGeneration(input.currentState, input.publishedAt);
const pointer = {
  schemaVersion: '1.1',
  pointerVersion: livePointer.pointerVersion + 1,
  publishedAt: input.publishedAt,
  baseGenerationId: livePointer.current.generationId,
  current: currentRef,
  previous: livePointer.current
};
writeJson(path.join(DIST, 'current.json'), pointer);

// Final local reconstruction/hash gate before Vercel is allowed to publish dist/.
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, currentRef.manifestPath.replace(/^\//, '')), 'utf8'));
const rebuilt = Buffer.concat(manifest.chunks.map((c) => fs.readFileSync(path.join(DIST, c.path.replace(/^\//, '')))));
if (sha256(rebuilt) !== currentRef.generationId) fail('candidate reconstruction hash mismatch');

console.log(JSON.stringify({
  outcome: 'VALIDATED_STATE_PACKAGE',
  pointerVersion: pointer.pointerVersion,
  baseGenerationId: pointer.baseGenerationId,
  stateId: currentRef.stateId,
  generationId: currentRef.generationId,
  chunkCount: manifest.chunks.length
}));
