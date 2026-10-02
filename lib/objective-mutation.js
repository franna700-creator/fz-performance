import { getSql } from './db.js';
import { propagateCanonicalChangeSafely } from './canonical-propagation.js';

const PROJECT_SCOPE='exercise-project';
const ATHLETE_ID='francois';
const SPEAKER_RESOLUTIONS=new Set(['CONFIRMED','INFERRED_HIGH_CONFIDENCE']);
const OBJECTIVE_TYPES=new Set(['EVENT','EVERGREEN']);
const STATES=new Set(['DORMANT','SCHEDULED','ACTIVE','COMPLETED','CANCELLED','CANDIDATE']);
const ROLES=new Set(['PRIMARY','SECONDARY','VALIDATION','MAINTENANCE','UNCLASSIFIED']);
const KNOWLEDGE=new Set(['QUALIFIED','PROVISIONAL','RESEARCH_REQUIRED','ATHLETE_STRUCTURE_REQUIRED','NOT_APPLICABLE']);
const PARTICIPATION=new Set(['CONSIDERING','PLANNED','ENTERED','CONFIRMED','WITHDRAWN','UNKNOWN']);
const SOURCE_TYPES=new Set(['ATHLETE','OFFICIAL_RULEBOOK','OFFICIAL_EVENT','ORGANISER_RACE_BRIEF','SECONDARY_RESEARCH','STANDARD_REFERENCE','SYSTEM']);

function text(value){return String(value??'').trim();}
function upper(value){return text(value).toUpperCase();}
function own(value,key){return Object.prototype.hasOwnProperty.call(value||{},key);}
function object(value,name){if(value==null)return{};if(typeof value!=='object'||Array.isArray(value))throw new Error(`invalid_${name}`);return value;}
function dateOnly(value,code){
  if(value==null||value==='')return null;
  const v=text(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error(code);
  const d=new Date(v+'T12:00:00Z');
  if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)throw new Error(code);
  return v;
}
function iso(value,code){
  const d=value?new Date(value):new Date();
  if(Number.isNaN(d.getTime()))throw new Error(code);
  return d.toISOString();
}
function number(value,code){
  const n=Number(value);
  if(!Number.isFinite(n))throw new Error(code);
  return n;
}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
}
function semanticRow(row){
  if(!row)return null;
  return stable({
    objectiveId:row.objective_id,
    objectiveType:row.objective_type,
    name:row.name,
    state:row.state,
    role:row.role,
    strategicWeight:Number(row.strategic_weight),
    startsOn:row.starts_on?String(row.starts_on).slice(0,10):null,
    endsOn:row.ends_on?String(row.ends_on).slice(0,10):null,
    formatProfileId:row.format_profile_id||null,
    knowledgeStatus:row.knowledge_status,
    target:row.target||{},
    metadata:row.metadata||{}
  });
}
function assertOwnership(input,actor){
  if(actor!=='ATHLETE')return;
  if(text(input.projectScope).toLowerCase()!==PROJECT_SCOPE)throw new Error('exercise_project_scope_required');
  if(text(input.athleteId).toLowerCase()!==ATHLETE_ID)throw new Error('francois_speaker_required');
  if(!SPEAKER_RESOLUTIONS.has(upper(input.speakerResolution)))throw new Error('speaker_resolution_required');
}
function normalizedEvidence(input={},actor='ATHLETE',reportedAt){
  const supplied=input.evidence&&typeof input.evidence==='object'?input.evidence:null;
  if(!supplied)throw new Error('objective_source_evidence_required');
  const sourceType=upper(supplied.sourceType||actor);
  if(!SOURCE_TYPES.has(sourceType))throw new Error('invalid_objective_source_type');
  const sourceRef=text(supplied.sourceRef||input.idempotencyKey);
  if(!sourceRef)throw new Error('objective_source_ref_required');
  const confidence=supplied.confidence==null?null:number(supplied.confidence,'invalid_objective_source_confidence');
  if(confidence!=null&&(confidence<0||confidence>1))throw new Error('invalid_objective_source_confidence');
  const observedAt=iso(supplied.observedAt||input.occurredAt||reportedAt,'invalid_objective_observed_at');
  return {
    sourceType,sourceRef,observedAt,confidence,
    payload:{
      ...object(supplied.payload,'objective_source_payload'),
      ...(text(input.rawText)?{rawText:text(input.rawText)}:{}),
      ...(text(input.summary)?{summary:text(input.summary)}:{}),
      captureScope:PROJECT_SCOPE,
      athleteId:ATHLETE_ID,
      speakerResolution:text(input.speakerResolution)||null,
      reportedAt,
      observedAt
    }
  };
}

export function normalizeObjectiveMutation(input={},current=null){
  const mutation=input.objective&&typeof input.objective==='object'?input.objective:input;
  const objectiveId=text(mutation.objectiveId||mutation.eventId||current?.objective_id);
  if(!objectiveId)throw new Error('objective_id_required');

  const currentType=upper(current?.objective_type);
  const objectiveType=upper(mutation.objectiveType||currentType||'EVENT');
  if(!OBJECTIVE_TYPES.has(objectiveType))throw new Error('invalid_objective_type');
  if(currentType&&objectiveType!==currentType)throw new Error('objective_type_immutable');

  const name=own(mutation,'name')?text(mutation.name):text(current?.name);
  if(!name)throw new Error('objective_name_required');

  const suppliedState=upper(mutation.state||mutation.status);
  let state=suppliedState||upper(current?.state)||'DORMANT';
  if(!STATES.has(state))throw new Error('invalid_objective_state');
  const candidate=state==='CANDIDATE';
  if(candidate)state='DORMANT';

  let role=own(mutation,'role')?upper(mutation.role):upper(current?.role);
  if(!role)role=objectiveType==='EVERGREEN'?'MAINTENANCE':'UNCLASSIFIED';
  if(!ROLES.has(role))throw new Error('invalid_objective_role');
  if(objectiveType==='EVERGREEN'&&role!=='MAINTENANCE')throw new Error('evergreen_role_must_be_maintenance');

  let strategicWeight;
  if(role==='UNCLASSIFIED'){
    if(own(mutation,'strategicWeight')&&number(mutation.strategicWeight,'invalid_strategic_weight')!==0)throw new Error('unclassified_objective_weight_must_be_zero');
    strategicWeight=0;
  }else if(own(mutation,'strategicWeight')){
    strategicWeight=number(mutation.strategicWeight,'invalid_strategic_weight');
  }else if(current?.strategic_weight!=null){
    strategicWeight=Number(current.strategic_weight);
  }else if(objectiveType==='EVERGREEN'){
    strategicWeight=0;
  }else{
    throw new Error('strategic_weight_required_for_classified_objective');
  }
  if(strategicWeight<0||strategicWeight>1)throw new Error('invalid_strategic_weight');

  let knowledgeStatus=own(mutation,'knowledgeStatus')?upper(mutation.knowledgeStatus):upper(current?.knowledge_status);
  if(!knowledgeStatus)knowledgeStatus=objectiveType==='EVERGREEN'?'NOT_APPLICABLE':'RESEARCH_REQUIRED';
  if(!KNOWLEDGE.has(knowledgeStatus))throw new Error('invalid_objective_knowledge_status');

  const metadata={...(current?.metadata||{}),...object(mutation.metadata,'objective_metadata')};
  if(candidate)metadata.intakeStatus='CANDIDATE';
  else if(own(mutation,'state')||own(mutation,'status'))metadata.intakeStatus=state;

  if(own(mutation,'participationStatus')){
    const participationStatus=upper(mutation.participationStatus);
    if(!PARTICIPATION.has(participationStatus))throw new Error('invalid_participation_status');
    metadata.participationStatus=participationStatus;
  }else if(objectiveType==='EVENT'&&!metadata.participationStatus){
    metadata.participationStatus='UNKNOWN';
  }
  if(own(mutation,'location'))metadata.location=mutation.location==null?null:text(mutation.location);

  let startsOn=current?.starts_on?String(current.starts_on).slice(0,10):null;
  let endsOn=current?.ends_on?String(current.ends_on).slice(0,10):null;
  if(own(mutation,'date')){
    const exact=dateOnly(mutation.date,'invalid_objective_date');
    startsOn=exact;endsOn=exact;metadata.datePrecision=exact?'EXACT':'UNKNOWN';
  }else if(own(mutation,'dateWindow')){
    if(mutation.dateWindow==null){
      startsOn=null;endsOn=null;metadata.datePrecision='UNKNOWN';
    }else{
      const window=object(mutation.dateWindow,'objective_date_window');
      startsOn=dateOnly(window.start,'invalid_objective_date_window_start');
      endsOn=dateOnly(window.end,'invalid_objective_date_window_end');
      if(!startsOn&&!endsOn)throw new Error('objective_date_window_required');
      startsOn=startsOn||endsOn;endsOn=endsOn||startsOn;
      if(endsOn<startsOn)throw new Error('objective_date_window_order');
      const precision=upper(window.precision||'APPROXIMATE');
      if(!['EXACT','DAY_RANGE','WEEK','MONTH','APPROXIMATE','UNKNOWN'].includes(precision))throw new Error('invalid_objective_date_precision');
      metadata.datePrecision=startsOn===endsOn&&precision==='EXACT'?'EXACT':precision;
    }
  }else if(own(mutation,'startsOn')||own(mutation,'endsOn')){
    startsOn=own(mutation,'startsOn')?dateOnly(mutation.startsOn,'invalid_objective_start_date'):startsOn;
    endsOn=own(mutation,'endsOn')?dateOnly(mutation.endsOn,'invalid_objective_end_date'):endsOn;
    if(startsOn&&endsOn&&endsOn<startsOn)throw new Error('objective_date_window_order');
    if(!metadata.datePrecision)metadata.datePrecision=startsOn&&endsOn&&startsOn===endsOn?'EXACT':'APPROXIMATE';
  }

  if(objectiveType==='EVENT'&&!['DORMANT','COMPLETED','CANCELLED'].includes(state)&&!startsOn&&!endsOn)throw new Error('active_objective_date_required');

  const formatProfileId=own(mutation,'formatProfileId')?(mutation.formatProfileId==null?null:text(mutation.formatProfileId)):(current?.format_profile_id||null);
  const target=own(mutation,'target')?object(mutation.target,'objective_target'):(current?.target||{});

  return {
    objectiveId,objectiveType,name,state,role,strategicWeight,startsOn,endsOn,
    formatProfileId,knowledgeStatus,target,metadata
  };
}

export async function recordObjectiveMutation(input={}){
  const reportedAt=iso(input.reportedAt,'invalid_objective_reported_at');
  const actor=upper(input.actor||'ATHLETE');
  if(!['ATHLETE','FZ','SYSTEM'].includes(actor))throw new Error('invalid_objective_actor');
  assertOwnership(input,actor);

  const requested=input.objective&&typeof input.objective==='object'?input.objective:input;
  const objectiveId=text(requested.objectiveId||requested.eventId);
  if(!objectiveId)throw new Error('objective_id_required');

  const sql=await getSql();
  const existingRows=await sql`
    SELECT objective_id,objective_type,name,state,role,strategic_weight,starts_on,ends_on,
           format_profile_id,knowledge_status,target,metadata,created_at,updated_at
    FROM fz_objectives WHERE objective_id=${objectiveId} LIMIT 1
  `;
  const before=existingRows?.[0]||null;
  const next=normalizeObjectiveMutation(input,before);
  const evidence=normalizedEvidence(input,actor,reportedAt);
  const reason=text(input.reason)||'CANONICAL_OBJECTIVE_MUTATION';
  const evidencePayload=JSON.stringify(evidence.payload);
  const mutationMeta=JSON.stringify({
    contract:'FZ_OBJECTIVE_MUTATION_V1',
    reason,
    sourceRef:evidence.sourceRef,
    reportedAt,
    semanticBefore:semanticRow(before),
    semanticAfter:next
  });

  const rows=await sql`
    WITH prior AS (
      SELECT * FROM fz_objectives WHERE objective_id=${next.objectiveId}
    ),
    changed AS (
      INSERT INTO fz_objectives (
        objective_id,objective_type,name,state,role,strategic_weight,starts_on,ends_on,
        format_profile_id,knowledge_status,target,metadata,created_at,updated_at
      ) VALUES (
        ${next.objectiveId},${next.objectiveType},${next.name},${next.state},${next.role},${next.strategicWeight},
        ${next.startsOn}::date,${next.endsOn}::date,${next.formatProfileId},${next.knowledgeStatus},
        ${JSON.stringify(next.target)}::jsonb,${JSON.stringify(next.metadata)}::jsonb,NOW(),NOW()
      )
      ON CONFLICT (objective_id) DO UPDATE SET
        name=EXCLUDED.name,
        state=EXCLUDED.state,
        role=EXCLUDED.role,
        strategic_weight=EXCLUDED.strategic_weight,
        starts_on=EXCLUDED.starts_on,
        ends_on=EXCLUDED.ends_on,
        format_profile_id=EXCLUDED.format_profile_id,
        knowledge_status=EXCLUDED.knowledge_status,
        target=EXCLUDED.target,
        metadata=EXCLUDED.metadata,
        updated_at=NOW()
      WHERE (
        fz_objectives.name,fz_objectives.state,fz_objectives.role,fz_objectives.strategic_weight,
        fz_objectives.starts_on,fz_objectives.ends_on,fz_objectives.format_profile_id,
        fz_objectives.knowledge_status,fz_objectives.target,fz_objectives.metadata
      ) IS DISTINCT FROM (
        EXCLUDED.name,EXCLUDED.state,EXCLUDED.role,EXCLUDED.strategic_weight,
        EXCLUDED.starts_on,EXCLUDED.ends_on,EXCLUDED.format_profile_id,
        EXCLUDED.knowledge_status,EXCLUDED.target,EXCLUDED.metadata
      )
      RETURNING *
    ),
    revision AS (
      INSERT INTO fz_objective_revisions(objective_id,effective_at,actor,reason,payload)
      SELECT
        ${next.objectiveId},${reportedAt}::timestamptz,${actor},${reason},
        jsonb_build_object(
          'contract','FZ_OBJECTIVE_MUTATION_V1',
          'before',(SELECT to_jsonb(p)-'created_at'-'updated_at' FROM prior p),
          'after',to_jsonb(c)-'created_at'-'updated_at',
          'mutation',${mutationMeta}::jsonb
        )
      FROM changed c
      RETURNING revision_id
    ),
    evidence AS (
      INSERT INTO fz_event_source_evidence(
        objective_id,profile_id,source_type,source_ref,observed_at,confidence,payload
      )
      SELECT
        ${next.objectiveId},NULL,${evidence.sourceType},${evidence.sourceRef},
        ${evidence.observedAt}::timestamptz,${evidence.confidence},${evidencePayload}::jsonb
      WHERE EXISTS (SELECT 1 FROM fz_objectives WHERE objective_id=${next.objectiveId})
      ON CONFLICT (objective_id,source_type,source_ref) WHERE source_ref IS NOT NULL DO NOTHING
      RETURNING source_evidence_id
    ),
    current_objective AS (
      SELECT objective_id,objective_type,name,state,role,strategic_weight,starts_on,ends_on,
             format_profile_id,knowledge_status,target,metadata,created_at,updated_at
      FROM fz_objectives WHERE objective_id=${next.objectiveId}
    )
    SELECT
      EXISTS(SELECT 1 FROM changed) AS objective_changed,
      (SELECT revision_id FROM revision LIMIT 1) AS revision_id,
      (SELECT source_evidence_id FROM evidence LIMIT 1) AS source_evidence_id,
      (SELECT to_jsonb(c) FROM current_objective c) AS objective
  `;
  const persisted=rows?.[0]||{};
  const objectiveChanged=persisted.objective_changed===true;
  const evidenceInserted=persisted.source_evidence_id!=null;
  const changedNodes=[
    ...(objectiveChanged?(actor==='ATHLETE'?['source.athlete.objective','objective.graph']:['objective.graph']):[]),
    ...(evidenceInserted?[evidence.sourceType==='ATHLETE'?'source.athlete.event':'source.research.event','event.intake']:[])
  ];

  let propagation=null;
  if(changedNodes.length){
    propagation=await propagateCanonicalChangeSafely({
      changedNodes,
      trigger:{
        type:'OBJECTIVE_MUTATION',
        objectiveId:next.objectiveId,
        objectiveChanged,
        evidenceInserted,
        objectiveRevisionId:persisted.revision_id==null?null:Number(persisted.revision_id),
        sourceType:evidence.sourceType,
        sourceRef:evidence.sourceRef,
        reason
      },
      now:new Date(reportedAt)
    });
  }

  return {
    ok:true,
    contract:'FZ_OBJECTIVE_MUTATION_V1',
    objective:persisted.objective||next,
    objectiveChanged,
    evidenceInserted,
    objectiveRevisionId:persisted.revision_id==null?null:Number(persisted.revision_id),
    sourceEvidenceId:persisted.source_evidence_id==null?null:Number(persisted.source_evidence_id),
    noOp:!objectiveChanged&&!evidenceInserted,
    propagation
  };
}
