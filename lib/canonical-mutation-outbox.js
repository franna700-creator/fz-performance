import { getSql } from './db.js';

function unique(values=[]){return [...new Set((values||[]).filter(Boolean))];}
function ids(rows=[]){return unique(rows.map(row=>Number(row.mutation_id)).filter(Number.isFinite));}
function nodeList(row){return Array.isArray(row?.changed_nodes)?row.changed_nodes.filter(Boolean):[];}

export async function readPendingCanonicalMutations({limit=250}={}){
  const sql=await getSql();
  const safeLimit=Math.max(1,Math.min(1000,Number(limit)||250));
  return await sql`
    SELECT mutation_id,source_table,source_operation,row_key,changed_nodes,occurred_at,processing_error
    FROM fz_canonical_mutation_outbox
    WHERE processed_at IS NULL
    ORDER BY mutation_id ASC
    LIMIT ${safeLimit}
  `;
}

export async function readCanonicalMutationOutboxStatus(){
  const sql=await getSql();
  const rows=await sql`
    SELECT count(*)::int AS pending_count,min(mutation_id)::bigint AS first_mutation_id,max(mutation_id)::bigint AS latest_mutation_id,
           min(occurred_at) AS oldest_pending_at,max(occurred_at) AS newest_pending_at
    FROM fz_canonical_mutation_outbox WHERE processed_at IS NULL
  `;
  const row=rows?.[0]||{};
  return {
    pendingCount:Number(row.pending_count||0),
    firstMutationId:row.first_mutation_id==null?null:Number(row.first_mutation_id),
    latestMutationId:row.latest_mutation_id==null?null:Number(row.latest_mutation_id),
    oldestPendingAt:row.oldest_pending_at||null,
    newestPendingAt:row.newest_pending_at||null
  };
}

export function canonicalMutationChangedNodes(rows=[]){
  return unique(rows.flatMap(nodeList)).sort();
}

export async function acknowledgeCanonicalMutations({mutationIds=[],revisionId,error=null}={}){
  const sql=await getSql();
  const clean=unique(mutationIds.map(Number).filter(Number.isFinite));
  if(!clean.length)return {acknowledged:0,mutationIds:[]};
  if(revisionId){
    const result=await sql`
      UPDATE fz_canonical_mutation_outbox
      SET processed_at=NOW(),revision_id=${revisionId},processing_error=NULL
      WHERE mutation_id=ANY(${clean}::bigint[]) AND processed_at IS NULL
      RETURNING mutation_id
    `;
    return {acknowledged:result?.length||0,mutationIds:ids(result||[]),revisionId};
  }
  const message=String(error||'canonical_mutation_propagation_failed').slice(0,2000);
  await sql`
    UPDATE fz_canonical_mutation_outbox SET processing_error=${message}
    WHERE mutation_id=ANY(${clean}::bigint[]) AND processed_at IS NULL
  `;
  return {acknowledged:0,mutationIds:clean,error:message};
}

export async function acknowledgeCoveredCanonicalMutations({dependencyClosure=[],revisionId,occurredAt=new Date()}={}){
  if(!revisionId)return {acknowledged:0,mutationIds:[]};
  const sql=await getSql();
  const cutoff=occurredAt instanceof Date?occurredAt.toISOString():new Date(occurredAt).toISOString();
  const pending=await sql`
    SELECT mutation_id,changed_nodes FROM fz_canonical_mutation_outbox
    WHERE processed_at IS NULL AND occurred_at<=${cutoff}
    ORDER BY mutation_id ASC LIMIT 1000
  `;
  const closure=new Set(dependencyClosure||[]);
  const covered=(pending||[]).filter(row=>nodeList(row).length>0&&nodeList(row).every(node=>closure.has(node)));
  return acknowledgeCanonicalMutations({mutationIds:ids(covered),revisionId});
}
