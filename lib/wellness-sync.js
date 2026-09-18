import {
  INTERVALS_ICU_SOURCE_KEY,
  fetchIntervalsWellnessRange,
  intervalsIcuConfigured,
  markIntervalsIcuError,
  markIntervalsIcuSynced,
  normalizeIntervalsWellnessRecord
} from './intervals-icu-client.js';
import { getWellnessToday, ingestNormalizedWellness, localDateSast } from './wellness-store.js';
import { assessWellnessCurrentMateriality } from './source-materiality.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';

const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const BASELINE_LOOKBACK_DAYS = 14;

function shiftIsoDate(date, days) {
  const base = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) throw new Error('invalid_wellness_sync_date');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export async function syncWellnessToday({ force = false, date = localDateSast(), recomputeRecommendation = true } = {}) {
  if (!intervalsIcuConfigured()) {
    return { status: 'DISCONNECTED', wellness: await getWellnessToday(date), materiality: null, propagation: null };
  }

  const persisted = await getWellnessToday(date, { sourceKey: INTERVALS_ICU_SOURCE_KEY });
  const lastSyncMs = persisted?.ingestedAt ? Date.parse(persisted.ingestedAt) : 0;
  if (!force && lastSyncMs && Date.now() - lastSyncMs < MIN_SYNC_INTERVAL_MS) {
    return { status: 'THROTTLED', wellness: persisted, materiality: null, propagation: null };
  }

  const oldest = shiftIsoDate(date, -BASELINE_LOOKBACK_DAYS);
  let records;
  try {
    records = await fetchIntervalsWellnessRange({ oldest, newest: date });
    for (const record of records) await ingestNormalizedWellness(normalizeIntervalsWellnessRecord(record));
    await markIntervalsIcuSynced();
  } catch (error) {
    await markIntervalsIcuError(error instanceof Error ? error.message : String(error)).catch(() => null);
    throw error;
  }

  const wellness = await getWellnessToday(date, { sourceKey: INTERVALS_ICU_SOURCE_KEY });
  if (!wellness) {
    return {
      status: 'NO_CURRENT_DATA',
      wellness: null,
      materiality: null,
      propagation: null,
      warning: 'Intervals.icu is connected but has not returned a wellness record for today yet.'
    };
  }

  let materiality = null;
  let warning = null;
  try {
    materiality = await assessWellnessCurrentMateriality({ date });
  } catch (error) {
    warning = `Wellness materiality: ${error instanceof Error ? error.message : String(error)}`;
  }

  let propagation = null;
  if (recomputeRecommendation && materiality?.assessment) {
    propagation = await propagateCanonicalChangeSafely({
      changedNodes: ['source.garmin.wellness', 'wellness.current', 'wellness.history', 'materiality.current'],
      materiality: materiality.assessment,
      trigger: {
        type: 'WELLNESS_SYNC',
        sourceKey: INTERVALS_ICU_SOURCE_KEY,
        sourceOrigin: 'GARMIN',
        transport: 'INTERVALS_ICU',
        evidenceKey: materiality.evidenceKey || null,
        materialityLevel: materiality.assessment.level,
        reasonCodes: materiality.assessment.reasonCodes || [],
        date
      },
      now: new Date()
    });
    if (propagation?.warnings?.length) warning = [warning, ...propagation.warnings].filter(Boolean).join(' | ');
  }

  return {
    status: 'SYNCED',
    sourceKey: INTERVALS_ICU_SOURCE_KEY,
    recordsRead: records.length,
    wellness,
    materiality,
    propagation,
    warning
  };
}
