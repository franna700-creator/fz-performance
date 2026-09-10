import { syncTrainingSources as syncRawTrainingSources } from './training-sync.js';
import { reconcileUnlinkedAthleteEvents } from './athlete-memory-reconcile.js';

export async function syncTrainingSources({ startDate, endDate }) {
  const source = await syncRawTrainingSources({ startDate, endDate });
  let athleteMemory = { scanned: 0, linked: 0, ambiguous: 0, noCandidate: 0, changes: [] };
  const warnings = [...(source.warnings || [])];
  try {
    athleteMemory = await reconcileUnlinkedAthleteEvents({ startDate, endDate });
  } catch (error) {
    warnings.push(`Athlete Memory late-link: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { ...source, athleteMemory, warnings };
}
