import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const MCP_URL = process.env.TREDICT_MCP_URL || 'https://www.tredict.com/api/mcp/v2';

function apiToken() {
  const token = String(process.env.TREDICT_API_TOKEN || '').trim();
  if (!token) throw new Error('TREDICT_API_TOKEN is not configured');
  return token;
}

function buildClient() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${apiToken()}`
      }
    }
  });
  const client = new Client(
    { name: 'fz-performance', version: '0.6.1' },
    { versionNegotiation: { mode: 'auto' } }
  );
  return { client, transport };
}

export async function callTredictTool(name, args = {}) {
  const { client, transport } = buildClient();
  try {
    await client.connect(transport);
    return await client.callTool({ name, arguments: args });
  } finally {
    try { await client.close(); } catch {}
  }
}

function resultText(result) {
  if (!Array.isArray(result?.content)) return '';
  return result.content
    .filter(item => item?.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n');
}

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

export function parseTredictCsvResult(result) {
  const structured = result?.structuredContent;
  if (structured && Array.isArray(structured)) return structured;
  if (structured && Array.isArray(structured?.items)) return structured.items;

  const text = resultText(result);
  if (!text) return [];
  const separator = text.lastIndexOf('----');
  const csv = (separator >= 0 ? text.slice(separator + 4) : text).trim();
  if (!csv) return [];

  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export function tredictConfigured() {
  return Boolean(String(process.env.TREDICT_API_TOKEN || '').trim());
}
