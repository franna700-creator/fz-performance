import { ADAPTIVE_LANES } from './adaptive-lanes.js';
import { heartRateIntensitySeconds, mergeEvidenceRows } from './training-evidence.js';

const GENERIC_TITLES = new Set(['', 'HIIT', 'MISC', 'CARDIO', 'WORKOUT', 'TRAINING', 'ACTIVITY', 'OTHER']);
function text(value) { return String(value ?? '').trim(); }
function upper(value) { return text(value).toUpperCase(); }
function normalized(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function eventText(events = []) { return events.filter(event => event?.actor === 'ATHLETE').map(event => `${event.summary || ''} ${JSON.stringify(event.payload || {})}`).join(' ').toLowerCase(); }
function sourceText(sources = []) { return sources.map(source => { const p=source?.payload||{}; return [p.title,p.notes,p.sportType,p.subSportType,p.name,p.activity_name,p.activity_type,p.activityType,p.type,p.sport].filter(Boolean).join(' '); }).join(' ').toLowerCase(); }
function explicitModality(haystack) {
  const patterns=[['ASSAULT_BIKE','Assault Bike',/\b(assault bike|echo bike|air bike)\b/],['SKI_ERG','SkiErg',/\b(ski\s?erg|skierg)\b/],['ROWING','Rower',/\b(rower|rowing|row\s?erg|rowerg)\b/],['ELLIPTICAL','Elliptical',/\b(elliptical|cross trainer)\b/],['RUNNING','Running',/\b(run|running|treadmill)\b/],['CYCLING','Cycling',/\b(cycling|cycle|bike ride|road bike|indoor bike)\b/],['WALL_BALL','Wall Ball',/\bwall balls?\b/],['MOBILITY','Mobility',/\b(mobility|stretching|mobility work)\b/],['STRENGTH','Strength',/\b(strength|back squat|front squat|bench press|shoulder press|deadlift|lifting)\b/],['HYROX_MIXED','HYROX mixed',/\bhyrox\b/]];
  return patterns.find(([, , regex]) => regex.test(haystack)) || null;
}
function sourceModality(session = {}, sources = []) {
  const athlete=eventText(session.events||[]), fromAthlete=explicitModality(athlete);
  if(fromAthlete) return {code:fromAthlete[0],label:fromAthlete[1],strength:3,reason:'athlete-described modality'};
  const combined=`${text(session.title)} ${text(session.sport_type)} ${sourceText(sources)}`.toLowerCase(), explicit=explicitModality(combined);
  if(explicit) return {code:explicit[0],label:explicit[1],strength:2,reason:'source-described modality'};
  const sport=normalized(session.sport_type);
  if(sport&&!['misc','generic','other','hiit','cardio','workout','training'].includes(sport)) return {code:upper(sport).replace(/\s+/g,'_'),label:sport.replace(/\b\w/g,char=>char.toUpperCase()),strength:1,reason:'source sport type'};
  return {code:'OTHER',label:'Training',strength:0,reason:'modality unresolved'};
}
function mergedTredict(sources = []) { return mergeEvidenceRows(sources.filter(source => source.source_key === 'tredict' && source.record_type === 'executed_activity')); }
function adaptiveIntent(session, events, sources, modality) {
  const reasons=[], athlete=eventText(events), raw=`${text(session.title)} ${text(session.session_kind)} ${athlete}`.toLowerCase(), merged=mergedTredict(sources), distribution=heartRateIntensitySeconds(merged.payload);
  let lowShare=null,moderateShare=null,highShare=null;
  if(distribution){const total=distribution.reduce((sum,value)=>sum+value,0);if(total>0)[lowShare,moderateShare,highShare]=distribution.map(value=>value/total);}
  const kind=upper(session.session_kind);
  if(['AET','CPH','HYROX'].includes(kind)||/\b(aet|cph|intervals?|threshold|race[- ]?pace|quality session)\b/.test(raw)){reasons.push(kind?`session kind ${kind}`:'explicit quality-session evidence');return {lane:'ADAPT',reasons,distribution,lowShare,moderateShare,highShare};}
  if(modality.code==='MOBILITY'){reasons.push('mobility / low-cost movement');return {lane:'ABSORB',reasons,distribution,lowShare,moderateShare,highShare};}
  if(/\b(zone ?2|z2|easy aerobic|low aerobic|recovery (?:ride|run|session)|light aerobic|very light|easy session)\b/.test(raw)){reasons.push('explicit low-aerobic / recovery description');return {lane:'ABSORB',reasons,distribution,lowShare,moderateShare,highShare};}
  if(lowShare!==null&&lowShare>=0.85&&(highShare??0)<=0.03){reasons.push(`HR distribution ${(lowShare*100).toFixed(0)}% low intensity`);return {lane:'ABSORB',reasons,distribution,lowShare,moderateShare,highShare};}
  if(highShare!==null&&(highShare>=0.10||((moderateShare??0)+highShare)>=0.35)){reasons.push('material moderate/high-intensity exposure');return {lane:'ADAPT',reasons,distribution,lowShare,moderateShare,highShare};}
  if(modality.code==='STRENGTH'||/\b(technique|maintenance|steady|controlled)\b/.test(raw)){reasons.push('maintenance-oriented execution evidence');return {lane:'MAINTAIN',reasons,distribution,lowShare,moderateShare,highShare};}
  reasons.push('no recovery or high-adaptation signal strong enough to override maintenance');return {lane:'MAINTAIN',reasons,distribution,lowShare,moderateShare,highShare};
}
function genericTitle(value){return GENERIC_TITLES.has(upper(value));}
function intentDescriptor(lane,modality,session){if(modality.code==='MOBILITY')return 'Mobility';if(upper(session.session_kind)==='AET')return `${modality.label} · AET`;if(lane==='ABSORB')return `${modality.label} · easy aerobic`;if(lane==='ADAPT')return `${modality.label} · adaptive quality`;return `${modality.label} · maintenance`;}
export function classifyTrainingSession({session={},events=[],sources=[]}={}){
  const sessionWithEvents={...session,events}, modality=sourceModality(sessionWithEvents,sources), intent=adaptiveIntent(session,events,sources,modality);
  if(!ADAPTIVE_LANES.includes(intent.lane))throw new Error(`invalid adaptive intent: ${intent.lane}`);
  const rawTitle=text(session.title), replaceGeneric=genericTitle(rawTitle)&&modality.code!=='OTHER', displayTitle=replaceGeneric?intentDescriptor(intent.lane,modality,session):(rawTitle||intentDescriptor(intent.lane,modality,session)), basis=unique([modality.reason,...intent.reasons]);
  const confidence=modality.strength>=2&&(intent.distribution||upper(session.session_kind))?'HIGH':modality.strength>=1||intent.distribution?'MODERATE':'LOW';
  return {version:'1.0.0',displayTitle,modality:modality.code,modalityLabel:modality.label,adaptiveIntent:intent.lane,confidence,basis,overrodeGenericIdentity:replaceGeneric,sourceIdentity:{title:rawTitle||null,sportType:text(session.sport_type)||null,sessionKind:text(session.session_kind)||null},physiology:intent.distribution?{hrIntensitySeconds:intent.distribution,lowShare:intent.lowShare,moderateShare:intent.moderateShare,highShare:intent.highShare}:null};
}
