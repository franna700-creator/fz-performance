import { readRecentMaterialityAssessments } from '../../lib/materiality-store.js';
import { MATERIALITY_ENGINE_VERSION, MATERIALITY_LEVELS, MATERIALITY_SOURCE_TYPES } from '../../lib/materiality-engine.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const rows = await readRecentMaterialityAssessments({ limit: req.query?.limit });
    return res.status(200).json({
      ok: true,
      engineVersion: MATERIALITY_ENGINE_VERSION,
      levels: MATERIALITY_LEVELS,
      sourceTypes: MATERIALITY_SOURCE_TYPES,
      count: rows.length,
      assessments: rows.map(row => ({
        id: row.id,
        localDate: row.local_date,
        sourceRecordId: row.source_record_id,
        assessedAt: row.payload?.assessedAt || row.source_updated_at || row.ingested_at,
        evidenceKey: row.payload?.evidenceKey || null,
        evidenceSummary: row.payload?.evidenceSummary || null,
        sourceType: row.payload?.evidenceSourceType || null,
        materiality: row.payload?.materiality || null
      }))
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('FZ materiality read failed', detail);
    return res.status(500).json({ ok: false, error: 'materiality_read_failed', detail });
  }
}
