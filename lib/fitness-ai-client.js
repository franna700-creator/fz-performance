import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  beginSourceAuthorization,
  clearSourceTokens,
  loadSourceConnection,
  markSourceConnected,
  markSourceError,
  saveSourceSecretState
} from './source-connection-store.js';

const MCP_URL = 'https://garmin-mcp-nuqd.onrender.com/mcp';
const CANONICAL_BASE_URL = 'https://fz-performance-mvp.vercel.app';

function publicBaseUrl() {
  return String(process.env.FZ_PUBLIC_BASE_URL || CANONICAL_BASE_URL).replace(/\/$/, '');
}

function callbackUrl() {
  return `${publicBaseUrl()}/api/source/fitness-ai/callback`;
}

class FzOAuthProvider {
  constructor(connection) {
    this.connection = connection;
    this.secretState = { ...(connection?.secretState || {}) };
    this.authorizationUrl = null;
  }

  get redirectUrl() {
    return callbackUrl();
  }

  get clientMetadata() {
    return {
      client_name: 'FZ Performance',
      client_uri: publicBaseUrl(),
      redirect_uris: [callbackUrl()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    };
  }

  async state() {
    if (!this.connection?.authState) throw new Error('OAuth state is not initialized');
    return this.connection.authState;
  }

  async clientInformation() {
    return this.secretState.clientInformation;
  }

  async saveClientInformation(clientInformation) {
    this.secretState.clientInformation = clientInformation;
    await saveSourceSecretState(this.secretState);
  }

  async tokens() {
    return this.secretState.tokens;
  }

  async saveTokens(tokens) {
    this.secretState.tokens = tokens;
    await saveSourceSecretState(this.secretState);
  }

  async redirectToAuthorization(authorizationUrl) {
    this.authorizationUrl = new URL(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier) {
    this.secretState.codeVerifier = codeVerifier;
    await saveSourceSecretState(this.secretState);
  }

  async codeVerifier() {
    const verifier = this.secretState.codeVerifier;
    if (!verifier) throw new Error('OAuth PKCE verifier is missing');
    return verifier;
  }

  async saveDiscoveryState(discoveryState) {
    this.secretState.discoveryState = discoveryState;
    await saveSourceSecretState(this.secretState);
  }

  async discoveryState() {
    return this.secretState.discoveryState;
  }

  async invalidateCredentials(scope) {
    if (scope === 'all' || scope === 'tokens') delete this.secretState.tokens;
    if (scope === 'all' || scope === 'client') delete this.secretState.clientInformation;
    if (scope === 'all' || scope === 'verifier') delete this.secretState.codeVerifier;
    if (scope === 'all' || scope === 'discovery') delete this.secretState.discoveryState;
    await saveSourceSecretState(this.secretState);
  }
}

function buildClient(connection) {
  const provider = new FzOAuthProvider(connection);
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    authProvider: provider
  });
  const client = new Client(
    { name: 'fz-performance', version: '0.6.1' },
    { versionNegotiation: { mode: 'auto' } }
  );
  return { provider, transport, client };
}

export async function beginFitnessAiAuthorization() {
  const pending = await beginSourceAuthorization();
  const connection = await loadSourceConnection();
  const { provider, transport, client } = buildClient(connection);
  try {
    await client.connect(transport);
    await markSourceConnected();
    await client.close();
    return { status: 'CONNECTED', authorizationUrl: null, authState: pending.authState };
  } catch (error) {
    try { await client.close(); } catch {}
    if (provider.authorizationUrl) {
      return {
        status: 'AUTH_REQUIRED',
        authorizationUrl: provider.authorizationUrl.toString(),
        authState: pending.authState
      };
    }
    await markSourceError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function finishFitnessAiAuthorization(callbackParams) {
  const connection = await loadSourceConnection();
  if (!connection || connection.status !== 'AUTH_PENDING') throw new Error('no pending Fitness AI authorization');
  const returnedState = callbackParams.get('state');
  if (!returnedState || returnedState !== connection.authState) throw new Error('OAuth state mismatch');

  const { transport, client } = buildClient(connection);
  try {
    await transport.finishAuth(callbackParams);
    const refreshed = await loadSourceConnection();
    const rebuilt = buildClient(refreshed);
    await rebuilt.client.connect(rebuilt.transport);
    await markSourceConnected();
    await rebuilt.client.close();
    return { status: 'CONNECTED' };
  } catch (error) {
    try { await client.close(); } catch {}
    await markSourceError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function callFitnessAiTool(name, args = {}) {
  const connection = await loadSourceConnection();
  if (!connection || connection.status !== 'CONNECTED' || !connection.secretState?.tokens) {
    throw new Error('Fitness AI source is not connected');
  }

  const { client, transport } = buildClient(connection);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/401|unauthori[sz]ed|invalid[_ -]?token/i.test(message)) {
      await clearSourceTokens();
    } else {
      await markSourceError(message);
    }
    throw error;
  } finally {
    try { await client.close(); } catch {}
  }
}

export function parseFitnessAiToolResult(result) {
  const structured = result?.structuredContent;
  if (structured && typeof structured === 'object') return structured;

  const text = Array.isArray(result?.content)
    ? result.content.find(item => item?.type === 'text' && typeof item.text === 'string')?.text
    : null;
  if (!text) throw new Error('Fitness AI tool returned no structured payload');

  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  throw new Error('Fitness AI tool payload is not machine-readable');
}
