const API_BASE = process.env.TREDICT_API_URL || 'https://www.tredict.com/api/oauth/v2';

function apiToken() {
  const token = String(process.env.TREDICT_API_TOKEN || '').trim();
  if (!token) throw new Error('TREDICT_API_TOKEN is not configured');
  return token;
}

function safeUrl(value) {
  const base = `${String(API_BASE).replace(/\/+$/, '')}/`;
  const relative = String(value || '').replace(/^\/+/, '');
  const url = new URL(relative, base);
  if (url.protocol !== 'https:' || url.hostname !== 'www.tredict.com' || !url.pathname.startsWith('/api/oauth/v2/')) {
    throw new Error('Tredict API returned an unexpected URL');
  }
  return url;
}

async function requestJson(path, params = {}) {
  const url = safeUrl(path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      Accept: 'application/json;charset=UTF-8'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Tredict Personal API denied access (HTTP 403): token invalid, inactive, or missing activityRead scope');
    }
    if (response.status === 401) {
      throw new Error('Tredict Personal API authorization header was rejected (HTTP 401)');
    }
    throw new Error(`Tredict Personal API request failed (HTTP ${response.status})`);
  }

  return response.json();
}

function flattenActivity(activity) {
  const summary = activity?.summary && typeof activity.summary === 'object' ? activity.summary : {};
  return {
    ...activity,
    'summary.durationTotal': summary.durationTotal ?? activity['summary.durationTotal'] ?? '',
    'summary.duration': summary.duration ?? activity['summary.duration'] ?? '',
    'summary.distance': summary.distance ?? activity['summary.distance'] ?? '',
    'summary.heartrate': summary.heartrate ?? activity['summary.heartrate'] ?? ''
  };
}

async function plannedWorkoutList(args = {}) {
  const data = await requestJson('plannedTrainingList', {
    startDate: args.startDate,
    endDate: args.endDate,
    sportType: args.sportType
  });
  const rows = data?._embedded?.plannedWorkoutList;
  return Array.isArray(rows) ? rows : [];
}

async function activityList(args = {}) {
  const pageSize = Math.min(1000, Math.max(50, Number(args.pageSize) || 200));
  const data = await requestJson('activityList', {
    startDate: args.startDate,
    pageSize,
    extendedSummary: args.extendedSummary ? 1 : undefined
  });
  const rows = data?._embedded?.activityList;
  return Array.isArray(rows) ? rows.map(flattenActivity) : [];
}

// Compatibility interface retained for the Tranche 3 sync layer. Production
// ingestion is deliberately backed by Tredict's Personal API REST endpoints;
// the MCP endpoint remains an interactive/tooling surface rather than runtime
// plumbing for deterministic scheduled ingestion.
export async function callTredictTool(name, args = {}) {
  if (name === 'planned-workout-list') {
    return { structuredContent: await plannedWorkoutList(args) };
  }
  if (name === 'activity-list') {
    return { structuredContent: await activityList(args) };
  }
  throw new Error(`Unsupported Tredict production read operation: ${name}`);
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

export async function probeTredictActivityRead() {
  const data = await requestJson('activityList', { pageSize: 50 });
  return {
    ok: true,
    count: Number(data?.count) || 0
  };
}

export function tredictConfigured() {
  return Boolean(String(process.env.TREDICT_API_TOKEN || '').trim());
}
