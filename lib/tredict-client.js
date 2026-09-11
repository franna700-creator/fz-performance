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

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function zoneForHeartRate(heartrate, zones = []) {
  const hr = finiteNumber(heartrate);
  if (hr === null) return null;
  return zones.find(zone => {
    const from = finiteNumber(zone?.from);
    const to = finiteNumber(zone?.to);
    const lowerOk = from === null || from < 0 || hr >= from;
    const upperOk = to === null || to < 0 || hr <= to;
    return lowerOk && upperOk;
  }) || null;
}

export function reconstructHeartRateIntensityDistribution(activity = {}) {
  const summary = activity?.summary && typeof activity.summary === 'object' ? activity.summary : {};
  const existing = summary?.intensityDistribution?.heartrate;
  if (existing && typeof existing === 'object') return activity;

  const samples = activity?.seriesSampled?.data?.heartrate;
  const zones = activity?.currentZones?.heartrate;
  if (!Array.isArray(samples) || !samples.length || !Array.isArray(zones) || !zones.length) return activity;

  const buckets = [0, 0, 0];
  let assigned = 0;
  for (const sample of samples) {
    const zone = zoneForHeartRate(sample, zones);
    const intensity = finiteNumber(zone?.intensity);
    if (intensity === null || intensity < 0 || intensity > 2) continue;
    buckets[intensity] += 1;
    assigned += 1;
  }
  if (!assigned) return activity;

  const duration = finiteNumber(summary.durationTotal ?? summary.duration);
  const seconds = buckets.map(count => duration === null ? count : Math.round((count / assigned) * duration));
  if (duration !== null) {
    const difference = Math.round(duration - seconds.reduce((sum, value) => sum + value, 0));
    if (difference !== 0) {
      const largest = seconds.indexOf(Math.max(...seconds));
      seconds[largest] += difference;
    }
  }

  return {
    ...activity,
    summary: {
      ...summary,
      intensityDistribution: {
        ...(summary.intensityDistribution && typeof summary.intensityDistribution === 'object' ? summary.intensityDistribution : {}),
        heartrate: { 0: seconds[0], 1: seconds[1], 2: seconds[2] }
      },
      _fzIntensityDistributionDerivation: 'seriesSampled.heartrate+currentZones.heartrate'
    }
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
    endDate: args.endDate,
    pageSize,
    extendedSummary: args.extendedSummary ? 1 : undefined
  });
  const rows = data?._embedded?.activityList;
  return Array.isArray(rows) ? rows.map(flattenActivity) : [];
}

async function activityDetail(args = {}) {
  const id = String(args.activityId || args.id || '').trim();
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('invalid Tredict activity id');
  // extraValues=1 is the canonical source for Tredict intensityDistribution.
  // Some valid activity-detail responses have omitted that aggregate while still
  // carrying standard sampled HR series plus the applicable currentZones. In that
  // case reconstruct only the missing 3-lane HR intensity aggregate from canonical
  // Tredict evidence; never infer it from average HR or manufacture missing samples.
  const activity = await requestJson(`activity/${id}`, { extraValues: 1 });
  return reconstructHeartRateIntensityDistribution(activity);
}

// Compatibility interface retained for deterministic production reads.
// The Personal API is the runtime transport; MCP remains an interactive/tooling surface.
export async function callTredictTool(name, args = {}) {
  if (name === 'planned-workout-list') {
    return { structuredContent: await plannedWorkoutList(args) };
  }
  if (name === 'activity-list') {
    return { structuredContent: await activityList(args) };
  }
  if (name === 'activity-detail') {
    return { structuredContent: await activityDetail(args) };
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
