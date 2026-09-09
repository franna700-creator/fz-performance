import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  databaseRuntimeEnabled,
  databaseRuntimeRequired,
  loadDatabaseRuntimeState,
  publishDatabaseRuntimeState
} from '../lib/runtime-store.js';

const ORIGIN = 'https://fz-performance-state.vercel.app';
const POINTER_PATH = '/current.json';
const FETCH_TIMEOUT_MS = 5000;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;
const HEX64 = /^[a-f0-9]{64}$/;

const sha256 = value => createHash('sha256').update(value).digest('hex');
const safePath = value => typeof value === 'string' && value.startsWith('/') && !value.includes('..') && !value.includes('\\');

function validRuntimeState(state) {
  return !!(
    state &&
    typeof state === 'object' &&
    typeof state.schemaVersion === 'string' &&
    typeof state.stateId === 'string' && state.stateId.length >= 8 &&
    state.masterValidated === true &&
    typeof state.nextRefreshAt === 'string' &&
    state.pages &&
    ['today', 'trends', 'train', 'system'].every(key => typeof state.pages[key] === 'string' && state.pages[key].length >= 32) &&
    state.datasets &&
    ['AET', 'WELL', 'LOAD', 'RUNS', 'CAP'].every(key => Array.isArray(state.datasets[key]))
  );
}

function validGenerationManifest(manifest, { allowLegacy = false } = {}) {
  if (!manifest || manifest.masterValidated !== true || typeof manifest.stateId !== 'string') return false;
  if (!HEX64.test(manifest.compressedSha256 || '')) return false;
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length < 1) return false;
  if (manifest.uncompressedSha256 && !HEX64.test(manifest.uncompressedSha256)) return false;
  if (!manifest.chunks.every(chunk => safePath(chunk.path) && Number.isInteger(chunk.size) && chunk.size > 0 && chunk.size <= 1024 * 1024 && HEX64.test(chunk.sha256 || ''))) return false;

  if (!allowLegacy) {
    if (manifest.schemaVersion !== '1.1') return false;
    if (!HEX64.test(manifest.generationId || '')) return false;
    if (manifest.generationId !== manifest.compressedSha256) return false;
    if (!manifest.chunks.every(chunk => chunk.path.startsWith(`/generations/${manifest.generationId}/`))) return false;
  }
  return true;
}

function validGenerationRef(ref) {
  return !!(
    ref &&
    HEX64.test(ref.generationId || '') &&
    safePath(ref.manifestPath) &&
    ref.manifestPath === `/generations/${ref.generationId}/manifest.json` &&
    typeof ref.stateId === 'string' && ref.stateId.length >= 8 &&
    HEX64.test(ref.compressedSha256 || '') &&
    ref.compressedSha256 === ref.generationId
  );
}

function validPointer(pointer) {
  return !!(
    pointer &&
    pointer.schemaVersion === '1.1' &&
    Number.isInteger(pointer.pointerVersion) && pointer.pointerVersion >= 1 &&
    typeof pointer.publishedAt === 'string' &&
    validGenerationRef(pointer.current) &&
    (pointer.previous == null || validGenerationRef(pointer.previous)) &&
    (pointer.baseGenerationId == null || HEX64.test(pointer.baseGenerationId))
  );
}

async function fetchNoStore(path) {
  if (!safePath(path)) throw new Error('unsafe state path');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${ORIGIN}${path}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json, application/octet-stream' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`state transport unavailable (${response.status})`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function loadGeneration(manifest, expectedRef = null, { allowLegacy = false } = {}) {
  if (!validGenerationManifest(manifest, { allowLegacy })) throw new Error('invalid generation manifest');
  if (expectedRef) {
    if (manifest.stateId !== expectedRef.stateId) throw new Error('generation stateId mismatch');
    if (manifest.compressedSha256 !== expectedRef.compressedSha256) throw new Error('generation checksum mismatch');
    if (!allowLegacy && manifest.generationId !== expectedRef.generationId) throw new Error('generation id mismatch');
  }

  let total = 0;
  const parts = await Promise.all(manifest.chunks.map(async chunk => {
    total += chunk.size;
    if (total > MAX_COMPRESSED_BYTES) throw new Error('runtime state exceeds compressed size limit');
    const response = await fetchNoStore(chunk.path);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== chunk.size) throw new Error('state chunk size mismatch');
    if (sha256(bytes) !== chunk.sha256) throw new Error('state chunk integrity failure');
    return bytes;
  }));

  const compressed = Buffer.concat(parts);
  if (compressed.length > MAX_COMPRESSED_BYTES) throw new Error('runtime state exceeds compressed size limit');
  if (sha256(compressed) !== manifest.compressedSha256) throw new Error('state payload checksum failure');

  const uncompressed = gunzipSync(compressed);
  if (manifest.uncompressedSha256 && sha256(uncompressed) !== manifest.uncompressedSha256) throw new Error('state uncompressed checksum failure');
  const state = JSON.parse(uncompressed.toString('utf8'));
  if (!validRuntimeState(state)) throw new Error('runtime state schema contract failure');
  if (state.stateId !== manifest.stateId) throw new Error('runtime stateId mismatch');
  return state;
}

async function loadManifestRef(ref) {
  const response = await fetchNoStore(ref.manifestPath);
  const manifest = await response.json();
  const state = await loadGeneration(manifest, ref);
  return { state, manifest, generationId: ref.generationId };
}

async function resolveState() {
  const pointerResponse = await fetchNoStore(POINTER_PATH);
  const pointerOrLegacy = await pointerResponse.json();

  if (validPointer(pointerOrLegacy)) {
    const attempts = [
      ['current', pointerOrLegacy.current],
      ['previous', pointerOrLegacy.previous]
    ].filter(([, ref]) => ref);
    const errors = [];
    for (const [source, ref] of attempts) {
      try {
        const loaded = await loadManifestRef(ref);
        return { ...loaded, source, pointer: pointerOrLegacy };
      } catch (error) {
        errors.push(`${source}:${error.message}`);
      }
    }
    throw new Error(`no validated generation available (${errors.join('; ')})`);
  }

  if (validGenerationManifest(pointerOrLegacy, { allowLegacy: true })) {
    const state = await loadGeneration(pointerOrLegacy, null, { allowLegacy: true });
    return {
      state,
      manifest: pointerOrLegacy,
      generationId: pointerOrLegacy.compressedSha256,
      source: 'legacy-current',
      pointer: null
    };
  }

  throw new Error('invalid runtime state pointer');
}

function sendState(res, { state, sha, generation, source, warning = null }) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-FZ-State-Id', state.stateId);
  res.setHeader('X-FZ-State-SHA256', sha);
  res.setHeader('X-FZ-State-Generation', generation);
  res.setHeader('X-FZ-State-Source', source);
  if (warning) res.setHeader('Warning', warning);
  return res.status(200).json(state);
}

async function bootstrapDatabaseFromImmutable() {
  const immutable = await resolveState();
  const serialized = JSON.stringify(immutable.state);
  const payloadSha256 = sha256(serialized);
  await publishDatabaseRuntimeState({
    state: immutable.state,
    payloadSha256,
    sourceClass: 'FZ_IMMUTABLE_BOOTSTRAP'
  });
  return {
    state: immutable.state,
    payloadSha256,
    stateId: immutable.state.stateId,
    source: 'database-bootstrap'
  };
}

export default async function handler(req, res) {
  if (databaseRuntimeEnabled()) {
    try {
      let loaded = await loadDatabaseRuntimeState();
      if (!loaded) {
        if (databaseRuntimeRequired()) throw new Error('database runtime pointer is empty');
        loaded = await bootstrapDatabaseFromImmutable();
      }
      if (!validRuntimeState(loaded.state)) throw new Error('database runtime state schema contract failure');
      if (loaded.state.stateId !== loaded.stateId) throw new Error('database runtime stateId mismatch');
      if (!HEX64.test(loaded.payloadSha256 || '')) throw new Error('database runtime checksum invalid');
      return sendState(res, {
        state: loaded.state,
        sha: loaded.payloadSha256,
        generation: loaded.payloadSha256,
        source: loaded.source || 'database'
      });
    } catch (error) {
      console.warn('FZ database runtime unavailable', error instanceof Error ? error.message : String(error));
      if (databaseRuntimeRequired()) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(503).json({ ok: false, error: 'database_runtime_state_unavailable' });
      }
    }
  }

  try {
    const loaded = await resolveState();
    return sendState(res, {
      state: loaded.state,
      sha: loaded.manifest.compressedSha256,
      generation: loaded.generationId,
      source: loaded.source,
      warning: loaded.source === 'previous' ? '110 - "FZ serving previous validated runtime state"' : null
    });
  } catch (error) {
    console.error('FZ runtime state unavailable', error instanceof Error ? error.message : String(error));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(503).json({ ok: false, error: 'runtime_state_unavailable' });
  }
}
