import crypto from 'node:crypto';
import { getSql } from './db.js';

const TZ='Africa/Johannesburg';
const TERMINAL_STATES=new Set(['RECOMPUTED','RECONCILED','PROVEN_UNAFFECTED','WITHHELD']);
const VALID_STATES=new Set(['INVALIDATED','RECOMPUTED','RECONCILED','PROVEN_UNAFFECTED','WITHHELD','FAILED']);

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function hash(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function unique(values=[]){return [...new Set((values||[]).filter(Boolean))];}
function date(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))throw new Error('invalid_canonical_revision_time');return d;}
function localDate(value){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date(value));}
function text(value){return String(value??'').trim();}
function sourceType(trigger={}){return text(trigger.type||trigger.sourceType||'CANONICAL_CHANGE').toUpperCase();}
function sourceKey(trigger={}){return text(trigger.sourceKey||trigger.evidenceKey||trigger.decisionId||trigger.sessionId||trigger.objectiveId)||null;}

export function canonicalRevisionIdentity({changedNodes=[],dependencyClosure=[],affectedSurfaces=[],trigger={},materiality=null,now=new Date()}={}){
  const occurredAt=date(now).toISOString();
  const basis={
    sourceType:sourceType(trigger),sourceKey:sourceKey(trigger),occurredAt,localDate:localDate(now),
    changedNodes:unique(changedNodes).sort(),dependencyClosure:unique(dependencyClosure).sort(),affectedSurfaces:unique(affectedSurfaces).sort(),
    trigger:stable(trigger||{}),
    materiality:materiality?{
      engineVersion:materiality.engineVersion||null,level:materiality.level||null,reasonCodes:materiality.reasonCodes||[],
      affectedDomains:materiality.affectedDomains||[],shouldUpdateState:materiality.shouldUpdateState===true,
      shouldRecomputeRecommendation:materiality.shouldRecomputeRecommendation===true,blocksExistingRecommendation:materiality.blocksExistingRecommendation===true
    }:null
  };
  const revisionSha256=hash(basis);
  return {revisionId:`rev:${revisionSha256.slice(0,28)}`,revisionSha256,occurredAt,localDate:basis.localDate,basis};
}

export async function createCanonicalRevision({changedNodes=[],dependencyClosure=[],affectedSurfaces=[],trigger={},materiality=null,now=new Date()}={}){
  const sql=await getSql();
  const identity=canonicalRevisionIdentity({changedNodes,dependencyClosure,affectedSurfaces,trigger,materiality,now});
  await sql`
    INSERT INTO fz_canonical_revisions
      (revision_id,revision_sha256,source_type,source_key,occurred_at,local_date,changed_nodes,dependency_closure,affected_surfaces,trigger,materiality)
    VALUES
      (${identity.revisionId},${identity.revisionSha256},${sourceType(trigger)},${sourceKey(trigger)},${identity.occurredAt},${identity.localDate},
       ${JSON.stringify(unique(changedNodes))}::jsonb,${JSON.stringify(unique(dependencyClosure))}::jsonb,${JSON.stringify(unique(affectedSurfaces))}::jsonb,
       ${JSON.stringify(trigger||{})}::jsonb,${materiality?JSON.stringify(materiality):null}::jsonb)
    ON CONFLICT (revision_id) DO NOTHING
  `;
  for(const node of unique(dependencyClosure)){
    await sql`
      INSERT INTO fz_convergence_ledger (revision_id,node_id,state,detail)
      VALUES (${identity.revisionId},${node},'INVALIDATED','{}'::jsonb)
      ON CONFLICT (revision_id,node_id) DO NOTHING
    `;
  }
  return identity;
}

export async function markConvergenceNode(revisionId,nodeId,state,detail={}){
  if(!revisionId||!nodeId)throw new Error('convergence_revision_and_node_required');
  if(!VALID_STATES.has(state))throw new Error(`invalid_convergence_state:${state}`);
  const sql=await getSql();
  await sql`
    INSERT INTO fz_convergence_ledger (revision_id,node_id,state,detail,updated_at)
    VALUES (${revisionId},${nodeId},${state},${JSON.stringify(detail||{})}::jsonb,NOW())
    ON CONFLICT (revision_id,node_id) DO UPDATE SET state=EXCLUDED.state,detail=EXCLUDED.detail,updated_at=NOW()
  `;
  return {revisionId,nodeId,state,detail};
}

export async function markConvergenceNodes(revisionId,nodes=[],state,detail={}){
  const results=[];
  for(const node of unique(nodes))results.push(await markConvergenceNode(revisionId,node,state,detail));
  return results;
}

export async function readConvergenceStatus(revisionId=null){
  const sql=await getSql();
  let revision=null;
  if(revisionId){
    const rows=await sql`SELECT * FROM fz_canonical_revisions WHERE revision_id=${revisionId} LIMIT 1`;
    revision=rows?.[0]||null;
  }else{
    const rows=await sql`SELECT * FROM fz_canonical_revisions ORDER BY occurred_at DESC,created_at DESC LIMIT 1`;
    revision=rows?.[0]||null;
  }
  if(!revision)return {status:'NO_REVISION',revision:null,rows:[],pending:true,failed:[],invalidated:[]};
  const rows=await sql`
    SELECT node_id,state,detail,updated_at
    FROM fz_convergence_ledger
    WHERE revision_id=${revision.revision_id}
    ORDER BY node_id
  `;
  const invalidated=rows.filter(row=>row.state==='INVALIDATED').map(row=>row.node_id);
  const failed=rows.filter(row=>row.state==='FAILED').map(row=>row.node_id);
  const terminal=rows.filter(row=>TERMINAL_STATES.has(row.state)).length;
  const expected=Array.isArray(revision.dependency_closure)?revision.dependency_closure.length:rows.length;
  const pending=invalidated.length>0||failed.length>0||terminal<expected;
  return {
    status:pending?'PENDING':'CONVERGED',revision,rows,pending,failed,invalidated,
    counts:{expected,terminal,invalidated:invalidated.length,failed:failed.length}
  };
}

export function isTerminalConvergenceState(state){return TERMINAL_STATES.has(state);}
