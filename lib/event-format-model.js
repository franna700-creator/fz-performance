function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

export function validateEventFormatRegistry(registry = {}) {
  const errors = [];
  if (registry.version !== '1.0') errors.push('event format registry version must be 1.0');
  const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
  const ids = new Set();
  for (const profile of profiles) {
    if (!profile?.id || ids.has(profile.id)) errors.push(`invalid or duplicate profile id: ${profile?.id || 'missing'}`);
    ids.add(profile?.id);
    const format = profile?.format || {};
    if (format.runSegments != null && n(format.runSegments, -1) < 0) errors.push(`invalid runSegments for ${profile.id}`);
    if (format.stationCount != null && n(format.stationCount, -1) < 0) errors.push(`invalid stationCount for ${profile.id}`);
    if (Array.isArray(profile.stations) && format.stationCount != null && profile.stations.length !== Number(format.stationCount)) {
      errors.push(`${profile.id} station count does not match station array`);
    }
  }
  for (const rule of registry.transferRules || []) {
    if (!ids.has(rule.from) || !ids.has(rule.to)) errors.push(`transfer rule references unknown profile: ${rule.from} -> ${rule.to}`);
    if (n(rule.transfer, -1) < 0 || n(rule.transfer, 2) > 1) errors.push(`transfer must be 0..1: ${rule.fromElement}`);
  }
  return { ok: errors.length === 0, errors };
}

export function profileById(registry, id) {
  return (registry?.profiles || []).find(profile => profile.id === id) || null;
}

export function eventFormatTransfer(registry, fromId, toId) {
  const rules = (registry?.transferRules || []).filter(rule => rule.from === fromId && rule.to === toId);
  if (!rules.length) return { fromId, toId, score: 0, rules: [] };
  const score = rules.reduce((sum, rule) => sum + n(rule.transfer), 0) / rules.length;
  return { fromId, toId, score: Math.round(score * 1000) / 1000, rules: [...rules].sort((a,b) => b.transfer - a.transfer) };
}

export function formatDemandSummary(profile) {
  if (!profile) return null;
  const f = profile.format || {};
  return {
    profileId: profile.id,
    eventFamily: profile.eventFamily,
    runSegments: f.runSegments ?? null,
    runSegmentMeters: f.runSegmentMeters ?? null,
    totalRunMeters: f.totalRunMeters ?? f.continuousRunMeters ?? null,
    stationCount: f.stationCount ?? (profile.stations || []).length,
    transitionDensity: f.transitionDensity || null,
    dominantDemands: profile.dominantDemands || [],
    stationNames: (profile.stations || []).map(station => station.name)
  };
}

export function resolveEventDateConflict({ athleteDate, officialDate, athleteConfirmed = false, confirmedAt = null }) {
  if (!athleteDate || !officialDate || athleteDate === officialDate) {
    return { status: 'ALIGNED', activeDate: athleteDate || officialDate || null, athleteDate: athleteDate || null, officialDate: officialDate || null };
  }
  if (athleteConfirmed) {
    return {
      status: 'RESOLVED_ATHLETE_CONFIRMED',
      activeDate: athleteDate,
      athleteDate,
      officialDate,
      confirmedAt,
      rule: 'ATHLETE_CONFIRMED_SCHEDULE_IS_ACTIVE; EXTERNAL_DISCREPANCY_RETAINED_AS_PROVENANCE'
    };
  }
  return {
    status: 'CONFLICT_REQUIRES_CONFIRMATION',
    activeDate: athleteDate,
    athleteDate,
    officialDate,
    rule: 'ATHLETE_SCHEDULE_REMAINS_ACTIVE_UNTIL_CONFLICT_IS_RESOLVED'
  };
}
