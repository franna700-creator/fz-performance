import { callFitnessAiTool, parseFitnessAiToolResult } from './fitness-ai-client.js';
import { loadSourceConnection } from './source-connection-store.js';
import { getWellnessToday, ingestWellnessPayload, localDateSast } from './wellness-store.js';
import { assessWellnessCurrentMateriality } from './source-materiality.js';

const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export async function syncWellnessToday({ force = false, date = localDateSast() } = {}) {
  const connection = await loadSourceConnection();
  if (!connection || connection.status !== 'CONNECTED') {
    return { status: 'DISCONNECTED', wellness: await getWellnessToday(date), materiality: null };
  }

  const lastSyncMs = connection.lastSyncAt ? Date.parse(connection.lastSyncAt) : 0;
  if (!force && lastSyncMs && Date.now() - lastSyncMs < MIN_SYNC_INTERVAL_MS) {
    return { status: 'THROTTLED', wellness: await getWellnessToday(date), materiality: null };
  }

  const result = await callFitnessAiTool('get_health_summary', {
    date,
    data_types: 'daily,sleep,stress,hrv',
    include_series: 'heart_rate,stress,body_battery,respiration',
    interval_s: 900
  });
  const payload = parseFitnessAiToolResult(result);
  const wellness = await ingestWellnessPayload(payload);
  let materiality = null;
  let warning = null;
  try {
    materiality = await assessWellnessCurrentMateriality({ date });
  } catch (error) {
    warning = `Wellness materiality: ${error instanceof Error ? error.message : String(error)}`;
  }
  return { status: 'SYNCED', wellness, materiality, warning };
}
