function add(findings, code, severity, message, detail = null) { findings.push({ code, severity, message, detail }); }

export function runSystemicReconciliationSweep({ training = null, trends = null, objectives = null, eventIntelligence = null } = {}) {
  const findings = [];
  if (!training?.ok) add(findings,'TRAINING_UNAVAILABLE','ERROR','Canonical training contract is unavailable.');
  if (!trends?.ok) add(findings,'TRENDS_UNAVAILABLE','ERROR','Canonical Trends contract is unavailable.');

  if (training?.ok) {
    const integrity = training.integrity || {};
    const unresolved = Number(integrity.unlinkedSessionFeedback || 0);
    if (unresolved > 0) add(findings,'ATHLETE_MEMORY_UNRESOLVED','WARN',`${unresolved} session-related athlete event(s) remain unlinked after reconciliation.`,{ count:unresolved });
    const sessions = Array.isArray(training.sessions) ? training.sessions : [];
    for (const session of sessions) {
      if (session.status === 'COMPLETED' && !session.presentation?.displayTitle && !session.title && !session.sport_type) {
        add(findings,'SESSION_IDENTITY_MISSING','WARN','Completed session has no usable canonical identity.',{ sessionId:session.session_id, date:session.local_date });
      }
    }
  }

  if (trends?.ok) {
    const series = Array.isArray(trends?.load?.series) ? trends.load.series : [];
    for (const point of series) {
      if (Number(point.sessions || 0) > 0 && point.value === 0) add(findings,'FALSE_ZERO_LOAD','ERROR','Workout day is represented as zero NCL.',{ date:point.date, sessions:point.sessions });
      if (point.state === 'PENDING_DETAIL' && point.value !== null) add(findings,'PENDING_WITH_VALUE','ERROR','Pending-detail NCL point must not masquerade as final value.',{ date:point.date, value:point.value });
    }
    const policy = trends?.quality?.evidencePolicy;
    if (policy && policy !== 'MONOTONIC_BEST_AVAILABLE') add(findings,'EVIDENCE_POLICY_DRIFT','ERROR','Trends evidence policy drifted from monotonic best-available.',{ policy });
  }

  if (objectives) {
    if (!objectives.primaryEvent && Array.isArray(objectives.upcomingEvents) && objectives.upcomingEvents.some(event => event.role === 'PRIMARY')) {
      add(findings,'PRIMARY_OBJECTIVE_RESOLUTION','ERROR','Upcoming PRIMARY event exists but objective context did not resolve it.');
    }
    if (objectives.nextEvergreenCandidate && objectives.primaryEvent) add(findings,'EVERGREEN_PREMATURE','ERROR','Evergreen maintenance objective surfaced while a primary event is still active.');
  }

  if (eventIntelligence) {
    for (const event of eventIntelligence.eventKnowledge || []) {
      if (event.knowledgeStatus === 'PENDING_RESEARCH' && event.overlapToPrimary) add(findings,'UNQUALIFIED_EVENT_TRANSFER','ERROR','Unqualified event is contributing overlap before its structure is known.',{ eventId:event.eventId });
      if (event.knowledgeStatus === 'PENDING_RESEARCH') add(findings,'EVENT_RESEARCH_REQUIRED','WARN','Scheduled event cannot influence capability priorities until its demand profile is qualified.',{ eventId:event.eventId, eventName:event.eventName });
    }
    const qualifiedIds = new Set((eventIntelligence.eventKnowledge || []).filter(event => event.knowledgeStatus === 'QUALIFIED').map(event => event.eventId));
    for (const priority of eventIntelligence.capabilityPriorities || []) {
      for (const source of priority.events || []) {
        if (!qualifiedIds.has(source.eventId)) add(findings,'UNQUALIFIED_CAPABILITY_PRIORITY','ERROR','Capability priority contains an event whose format has not passed the knowledge gate.',{ capabilityId:priority.capabilityId, eventId:source.eventId });
      }
    }
  }

  const errors = findings.filter(item => item.severity === 'ERROR').length;
  const warnings = findings.filter(item => item.severity === 'WARN').length;
  return { ok: errors === 0, errors, warnings, findings, checkedAt: new Date().toISOString() };
}
