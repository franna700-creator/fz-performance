const ELIGIBLE_POST_TYPES = new Set(['POST_SESSION_FEEDBACK','STOPPED_EARLY','ABORTED','ATHLETE_MODIFIED']);

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function normalized(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function words(value) { return new Set(normalized(value).split(/\s+/).filter(word => word.length > 2)); }
function overlap(left, right) {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common += 1;
  return common / Math.max(1, Math.min(a.size, b.size));
}
function categories(event) {
  return Array.isArray(event?.payload?.memoryCategories)
    ? event.payload.memoryCategories.map(value => String(value).toUpperCase())
    : [];
}
function modalityToken(text) {
  const value = normalized(text);
  if (/\b(aet)\b/.test(value)) return 'AET';
  if (/\b(assault bike|echo bike|air bike|cycle|cycling|bike)\b/.test(value)) return 'BIKE';
  if (/\b(run|running|treadmill)\b/.test(value)) return 'RUN';
  if (/\b(row|rower|rowing)\b/.test(value)) return 'ROW';
  if (/\b(ski erg|skierg|ski)\b/.test(value)) return 'SKI';
  if (/\b(mobility|stretch)\b/.test(value)) return 'MOBILITY';
  if (/\b(strength|squat|press|deadlift)\b/.test(value)) return 'STRENGTH';
  return null;
}
function sessionText(session) {
  return `${session.title || ''} ${session.sport_type || ''} ${session.session_kind || ''}`;
}
function day(value) { return String(value || '').slice(0, 10); }

export function lateAssociationCandidates(event, sessions = []) {
  const occurred = new Date(event?.occurred_at).getTime();
  if (!Number.isFinite(occurred)) return [];
  const type = String(event?.event_type || '').toUpperCase();
  const eventDay = day(event?.local_date);
  const isContextSession = type === 'CONTEXT' && categories(event).includes('SESSION');
  const isNextDay = type === 'NEXT_DAY_RESPONSE';
  if (!ELIGIBLE_POST_TYPES.has(type) && !isContextSession && !isNextDay) return [];
  const raw = `${event?.summary || ''} ${JSON.stringify(event?.payload || {})}`;
  const token = modalityToken(raw);
  const plausible = [];
  for (const session of sessions) {
    if (!session?.actual_start_at || session.status === 'SUPERSEDED') continue;
    const start = new Date(session.actual_start_at).getTime();
    if (!Number.isFinite(start)) continue;
    const deltaHours = (occurred - start) / 3600000;
    const sameDay = day(session.local_date) === eventDay;
    if (isNextDay) {
      if (!(deltaHours >= 4 && deltaHours <= 36)) continue;
    } else {
      if (!sameDay || deltaHours < -0.08 || deltaHours > 6) continue;
      if (isContextSession && deltaHours < 0) continue;
    }
    plausible.push({ session, deltaHours });
  }
  return plausible.map(({ session, deltaHours }) => {
    let score = 0;
    const reasons = [];
    if (ELIGIBLE_POST_TYPES.has(type)) { score += 0.16; reasons.push('post-session event type'); }
    if (isContextSession) { score += 0.15; reasons.push('session-context event after start'); }
    if (isNextDay) { score += 0.20; reasons.push('next-day response'); }
    if (!isNextDay) {
      if (deltaHours <= 0.5) { score += 0.50; reasons.push('within 30 min of session start'); }
      else if (deltaHours <= 2) { score += 0.42; reasons.push('within 2 h of session start'); }
      else if (deltaHours <= 4) { score += 0.32; reasons.push('within 4 h of session start'); }
      else { score += 0.20; reasons.push('same-day training window'); }
    } else if (deltaHours <= 18) { score += 0.30; reasons.push('overnight response window'); }
    else { score += 0.22; reasons.push('next-day response window'); }
    const o = overlap(raw, sessionText(session));
    if (o >= 0.5) { score += 0.18; reasons.push('strong text overlap'); }
    else if (o >= 0.25) { score += 0.10; reasons.push('text overlap'); }
    const sessionToken = modalityToken(sessionText(session));
    if (token && sessionToken && token === sessionToken) { score += token === 'AET' ? 0.24 : 0.16; reasons.push(`modality match ${token}`); }
    if (token === 'AET' && String(session.session_kind || '').toUpperCase() === 'AET') { score += 0.24; reasons.push('AET match'); }
    if (plausible.length === 1) { score += 0.18; reasons.push('only plausible session in time window'); }
    return { session, score: Math.min(1, score), reasons, deltaHours };
  }).sort((a, b) => b.score - a.score);
}

export function resolveLateAssociation(event, sessions = []) {
  const ranked = lateAssociationCandidates(event, sessions);
  if (!ranked.length) return { session: null, confidence: 0, method: 'LATE_NO_CANDIDATE', candidates: [] };
  const best = ranked[0], second = ranked[1];
  const margin = second ? best.score - second.score : best.score;
  if (best.score >= 0.65 && (!second || margin >= 0.12)) {
    return { session: best.session, confidence: Number(best.score.toFixed(2)), method: 'LATE_TIME_CONTEXT_MATCH', reasons: best.reasons, candidates: ranked.slice(0, 3).map(row => ({ sessionId: row.session.session_id, score: Number(row.score.toFixed(2)) })) };
  }
  return { session: null, confidence: Number(best.score.toFixed(2)), method: 'LATE_AMBIGUOUS_CONTEXT', reasons: best.reasons, candidates: ranked.slice(0, 3).map(row => ({ sessionId: row.session.session_id, score: Number(row.score.toFixed(2)) })) };
}
