import { getSql } from '../../lib/db.js';
import { loadDatabaseRuntimeState, runtimeStoreMode } from '../../lib/runtime-store.js';
import { tredictConfigured } from '../../lib/tredict-client.js';
import { readRecentMaterialityAssessments } from '../../lib/materiality-store.js';
import { MATERIALITY_ENGINE_VERSION, MATERIALITY_LEVELS } from '../../lib/materiality-engine.js';
import { readRecentRecommendationShadows } from '../../lib/recommendation-shadow-store.js';
import { RECOMMENDATION_ENGINE_VERSION, RECOMMENDATION_ENGINE_MODE } from '../../lib/recommendation-engine.js';
import { readIntelligenceCurrent } from '../../lib/intelligence-current.js';
import { refreshIntelligence } from '../../lib/intelligence-refresh.js';

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

function crossSiteBrowser(req) {
  const site = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  return site === 'cross-site';
}

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

async function intelligenceCurrent(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const current = await readIntelligenceCurrent();
    return res.status(200).json({ ok: true, ...current });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: 'intelligence_current_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function intelligenceRefresh(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (crossSiteBrowser(req)) {
    return res.status(403).json({ ok: false, error: 'cross_site_refresh_forbidden' });
  }

  const input = requestBody(req);
  if (input === null) return res.status(400).json({ ok: false, error: 'invalid_json' });

  try {
    const result = await refreshIntelligence({
      refreshSources: input.sources === true,
      forceWellness: false,
      now: new Date()
    });
    return res.status(result.pendingPropagation ? 202 : 200).json(result);
  } catch (error) {
    return res.status(503).json({
      ok: false,
      error: 'intelligence_refresh_unavailable',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function systemStatus(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const sql = await getSql();
    const [runtime, sources, evidence, wellness, athlete, materialityRows, shadowRows, intelligenceCurrentState] = await Promise.all([
      loadDatabaseRuntimeState().catch(() => null),
      sql`SELECT source_key,status,connected_at,last_sync_at,last_error,updated_at FROM fz_source_connections ORDER BY source_key`,
      sql`SELECT source_key,record_type,count(*)::int AS records,max(ingested_at) AS latest_ingest,min(local_date)::text AS earliest_date,max(local_date)::text AS latest_date FROM fz_training_source_records GROUP BY source_key,record_type ORDER BY source_key,record_type`,
      sql`SELECT local_date::text AS local_date,source_as_of,ingested_at,source_status FROM fz_wellness_current ORDER BY local_date DESC,source_as_of DESC NULLS LAST LIMIT 1`,
      sql`SELECT count(*)::int AS events,max(occurred_at) AS latest_event FROM fz_athlete_events WHERE actor='ATHLETE'`,
      readRecentMaterialityAssessments({ limit: req.query?.materialityLimit || 20 }),
      readRecentRecommendationShadows({ limit: req.query?.shadowLimit || 20 }),
      readIntelligenceCurrent().catch(() => null)
    ]);
    return res.status(200).json({
      ok:true,generatedAt:new Date().toISOString(),
      architecture:{operationalTruth:'Neon',sourceEvidence:['Garmin / Fitness AI','Tredict','Athlete Memory'],recommendationTruth:'Versioned FZ runtime/intelligence state',shadowRecommendationTruth:'Tranche 4.2 append-only FZ intelligence ledger',activeRecommendationTruth:'Tranche 4.3 controlled projection of immutable shadow',auditRepresentation:'Google Drive',driveRole:'human-owned audit / flight recorder; not runtime engine',runtimeStoreMode:runtimeStoreMode()},
      releaseEnvironment:{databaseConfigured:databaseConfigured(),writeTokenConfigured:Boolean(process.env.FZ_STATE_WRITE_TOKEN),previewMustPassBeforePromotion:true,secretsExposed:false},
      runtime:runtime?{source:runtime.source,stateId:runtime.stateId,pointerVersion:runtime.pointerVersion,masterAsOf:runtime.state?.masterAsOf||null,generatedAt:runtime.state?.generatedAt||null,masterValidated:runtime.state?.masterValidated===true}:null,
      sources,tredict:{configured:tredictConfigured(),latestEvidence:evidence.filter(row=>row.source_key==='tredict')},
      garmin:{connection:sources.find(row=>row.source_key==='fitness-ai')||sources.find(row=>row.source_key==='fitness_ai')||sources.find(row=>row.source_key==='garmin')||null,latestWellness:wellness[0]||null,latestEvidence:evidence.filter(row=>row.source_key==='garmin')},
      trainingEvidence:evidence,athleteMemory:athlete[0]||{events:0,latest_event:null},
      intelligence:{
        current:intelligenceCurrentState,
        materiality:{engineVersion:MATERIALITY_ENGINE_VERSION,levels:MATERIALITY_LEVELS,count:materialityRows.length,assessments:materialityRows.map(row=>({id:row.id,localDate:row.local_date,assessedAt:row.payload?.assessedAt||row.source_updated_at||row.ingested_at,evidenceKey:row.payload?.evidenceKey||null,evidenceSummary:row.payload?.evidenceSummary||null,sourceType:row.payload?.evidenceSourceType||null,materiality:row.payload?.materiality||null}))},
        recommendationShadow:{engineVersion:RECOMMENDATION_ENGINE_VERSION,mode:RECOMMENDATION_ENGINE_MODE,activeRecommendationWrite:true,todayActivation:true,count:shadowRows.length,evaluations:shadowRows.map(row=>({id:row.id,localDate:row.local_date,evaluatedAt:row.source_updated_at||row.ingested_at,recommendationId:row.payload?.recommendationId||null,status:row.payload?.status||null,lane:row.payload?.lane||null,confidence:row.payload?.confidence||null,trigger:row.payload?.trigger||null,contextSummary:row.payload?.contextSummary||null,explanation:row.payload?.explanation||null}))}
      }
    });
  } catch (error) {
    console.error('FZ system status failed', error instanceof Error ? error.message : String(error));
    return res.status(503).json({ok:false,error:'system_status_unavailable',detail:error instanceof Error?error.message:String(error)});
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const operation = String(req.query?.operation || '');
  if (operation === 'intelligence-current') return intelligenceCurrent(req, res);
  if (operation === 'intelligence-refresh') return intelligenceRefresh(req, res);
  return systemStatus(req, res);
}
