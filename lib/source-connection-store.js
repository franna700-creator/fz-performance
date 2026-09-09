import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getSql } from './db.js';

export const FITNESS_AI_SOURCE_KEY = 'fitness-ai';

function encryptionSecret() {
  const value = String(process.env.FZ_SOURCE_TOKEN_KEY || '').trim();
  if (!value) throw new Error('FZ_SOURCE_TOKEN_KEY is not configured');
  return value;
}

function encryptionKey() {
  return createHash('sha256').update(encryptionSecret()).digest();
}

function encryptJson(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value || {}), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptJson(value) {
  if (!value) return {};
  const [version, ivText, tagText, encryptedText] = String(value).split('.');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) throw new Error('invalid encrypted source state');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

export async function loadSourceConnection({ includeSecrets = true } = {}) {
  const sql = await getSql();
  const rows = await sql`
    SELECT source_key, status, auth_state, encrypted_oauth_state,
           connected_at, last_sync_at, last_error, updated_at
    FROM fz_source_connections
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
    LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) return null;
  return {
    sourceKey: row.source_key,
    status: row.status,
    authState: row.auth_state,
    secretState: includeSecrets ? decryptJson(row.encrypted_oauth_state) : undefined,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    updatedAt: row.updated_at
  };
}

export async function beginSourceAuthorization() {
  const sql = await getSql();
  let existing = {};
  try {
    const current = await loadSourceConnection();
    existing = current?.secretState || {};
  } catch {
    existing = {};
  }

  const authState = randomBytes(24).toString('base64url');
  const nextSecretState = {
    clientInformation: existing.clientInformation,
    discoveryState: existing.discoveryState
  };
  const encrypted = encryptJson(nextSecretState);

  await sql`
    INSERT INTO fz_source_connections (
      source_key, status, auth_state, encrypted_oauth_state, last_error, updated_at
    ) VALUES (
      ${FITNESS_AI_SOURCE_KEY}, 'AUTH_PENDING', ${authState}, ${encrypted}, NULL, NOW()
    )
    ON CONFLICT (source_key) DO UPDATE SET
      status = 'AUTH_PENDING',
      auth_state = EXCLUDED.auth_state,
      encrypted_oauth_state = EXCLUDED.encrypted_oauth_state,
      last_error = NULL,
      updated_at = NOW()
  `;

  return { authState, secretState: nextSecretState };
}

export async function saveSourceSecretState(secretState, { status } = {}) {
  const sql = await getSql();
  const encrypted = encryptJson(secretState || {});
  const normalizedStatus = status || null;
  await sql`
    UPDATE fz_source_connections
    SET encrypted_oauth_state = ${encrypted},
        status = COALESCE(${normalizedStatus}::text, status),
        updated_at = NOW()
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
  `;
}

export async function markSourceConnected() {
  const sql = await getSql();
  await sql`
    UPDATE fz_source_connections
    SET status = 'CONNECTED',
        connected_at = COALESCE(connected_at, NOW()),
        auth_state = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
  `;
}

export async function markSourceSynced() {
  const sql = await getSql();
  await sql`
    UPDATE fz_source_connections
    SET status = 'CONNECTED',
        last_sync_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
  `;
}

export async function markSourceError(message) {
  const sql = await getSql();
  const safeMessage = String(message || 'source error').slice(0, 1000);
  await sql`
    UPDATE fz_source_connections
    SET status = CASE WHEN connected_at IS NULL THEN 'ERROR' ELSE status END,
        last_error = ${safeMessage},
        updated_at = NOW()
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
  `;
}

export async function clearSourceTokens() {
  const current = await loadSourceConnection();
  const secretState = current?.secretState || {};
  delete secretState.tokens;
  delete secretState.codeVerifier;
  await saveSourceSecretState(secretState, { status: 'DISCONNECTED' });
  const sql = await getSql();
  await sql`
    UPDATE fz_source_connections
    SET auth_state = NULL, connected_at = NULL, last_sync_at = NULL,
        last_error = NULL, updated_at = NOW()
    WHERE source_key = ${FITNESS_AI_SOURCE_KEY}
  `;
}

export async function publicSourceStatus() {
  const connection = await loadSourceConnection({ includeSecrets: false });
  return connection ? {
    source: 'Fitness AI Connector / Garmin Health API',
    status: connection.status,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    updatedAt: connection.updatedAt
  } : {
    source: 'Fitness AI Connector / Garmin Health API',
    status: 'DISCONNECTED',
    connectedAt: null,
    lastSyncAt: null,
    lastError: null,
    updatedAt: null
  };
}
