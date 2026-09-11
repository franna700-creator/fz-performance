import { getSql } from './db.js';
import { recordExerciseAthleteResponse, EXERCISE_PROJECT_SCOPE, FZ_ATHLETE_ID } from './athlete-response-capture.js';

function text(value){return String(value??'').trim();}

export async function findOrphanedEmbeddedAthleteContext({limit=20}={}){
  const sql=await getSql();
  const safeLimit=Math.max(1,Math.min(50,Number(limit)||20));
  return sql`
    SELECT r.id,r.source_record_id,r.source_hash,r.source_updated_at,r.ingested_at,r.local_date::text AS local_date,r.payload,
           link.session_id
    FROM fz_training_source_latest r
    LEFT JOIN LATERAL (
      SELECT l.session_id
      FROM fz_training_session_sources l
      JOIN fz_training_sessions s ON s.session_id=l.session_id
      WHERE l.source_record_pk=r.id AND s.status<>'SUPERSEDED'
      ORDER BY l.match_confidence DESC NULLS LAST,l.linked_at DESC
      LIMIT 1
    ) link ON TRUE
    WHERE r.source_key='conversation'
      AND r.record_type='executed_activity'
      AND NULLIF(BTRIM(r.payload#>>'{interpretation_notes,athlete_confirmed_context}'),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM fz_athlete_events e
        WHERE e.actor='ATHLETE'
          AND (
            e.payload#>>'{provenance,sourceRecordPk}'=r.id::text
            OR e.payload#>>'{recoveryProvenance,sourceRecordPk}'=r.id::text
          )
      )
    ORDER BY COALESCE(r.source_updated_at,r.ingested_at) ASC,r.id ASC
    LIMIT ${safeLimit}
  `;
}

export async function repairOrphanedEmbeddedAthleteContext({limit=20}={}){
  const rows=await findOrphanedEmbeddedAthleteContext({limit});
  const repaired=[];
  const errors=[];
  for(const row of rows||[]){
    const payload=row.payload&&typeof row.payload==='object'?row.payload:{};
    const summary=text(payload?.interpretation_notes?.athlete_confirmed_context);
    if(!summary)continue;
    const occurredAt=payload.source_capture_time_local||row.source_updated_at||row.ingested_at||new Date().toISOString();
    try{
      const result=await recordExerciseAthleteResponse({
        projectScope:EXERCISE_PROJECT_SCOPE,
        athleteId:FZ_ATHLETE_ID,
        speakerResolution:'CONFIRMED',
        summary,
        rawText:'',
        eventType:'POST_SESSION_FEEDBACK',
        occurredAt,
        reportedAt:occurredAt,
        occurrencePrecision:'recovered-source-capture-time',
        sessionId:row.session_id||undefined,
        relatedSession:row.session_id?undefined:{localDate:row.local_date},
        idempotencyKey:`embedded-athlete-context:${row.id}:${row.source_hash||'latest'}`,
        ingestSourceKey:'conversation',
        payload:{
          provenance:{
            verbatim:false,
            sourceRecordPk:Number(row.id),
            sourceRecordId:row.source_record_id,
            sourceArtifact:payload.source_artifact||null,
            reconstructionMethod:'recovered from athlete-confirmed context embedded in conversation evidence'
          },
          integrityRepair:'EMBEDDED_ATHLETE_CONTEXT_WITHOUT_CANONICAL_MEMORY'
        }
      });
      repaired.push({sourceRecordPk:Number(row.id),sourceRecordId:row.source_record_id,eventKey:result.eventKey,eventId:result.eventId,sessionId:result.resolution?.linkedSession?.session_id||row.session_id||null,propagation:result.propagation});
    }catch(error){
      errors.push({sourceRecordPk:Number(row.id),sourceRecordId:row.source_record_id,error:error instanceof Error?error.message:String(error)});
    }
  }
  return {scanned:rows?.length||0,repaired,errors};
}
