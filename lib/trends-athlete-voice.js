import { getSql } from './db.js';

function dateLabel(localDate) {
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(localDate))) return null;
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short'
  }).format(date);
}

export function deriveCanonicalAthleteVoiceSummary(rows = []) {
  const latest = (Array.isArray(rows) ? rows : []).find(row => {
    const summary = String(row?.summary || '').trim();
    return summary.length > 0;
  });
  if (!latest) return null;

  const summary = String(latest.summary).trim();
  const label = dateLabel(String(latest.local_date || ''));
  return {
    text: label ? `${label} · ${summary}` : summary,
    eventId: latest.event_id ?? null,
    eventKey: latest.event_key || null,
    sessionId: latest.session_id || null,
    eventType: latest.event_type || null,
    certainty: latest.certainty || null,
    occurredAt: latest.occurred_at || null,
    localDate: latest.local_date || null,
    canonicalSummary: summary,
    provenance: 'fz_athlete_events.summary',
    verbatim: false
  };
}

export async function overlayCanonicalAthleteVoiceOnTrends(trends = {}) {
  const startDate = trends?.range?.startDate;
  const endDate = trends?.range?.endDate;
  if (!startDate || !endDate) return trends;

  const sql = await getSql();
  const rows = await sql`
    SELECT event_id,event_key,session_id,event_type,occurred_at,
           local_date::text AS local_date,certainty,summary
    FROM fz_athlete_events
    WHERE actor='ATHLETE'
      AND local_date BETWEEN ${startDate} AND ${endDate}
      AND NULLIF(BTRIM(summary),'') IS NOT NULL
    ORDER BY occurred_at DESC,event_id DESC
    LIMIT 25
  `;
  const current = deriveCanonicalAthleteVoiceSummary(rows);
  if (!current) {
    return {
      ...trends,
      athleteVoice: {
        source: 'fz_athlete_events',
        latest: null,
        contract: 'CANONICAL_INTERPRETED_SUMMARY'
      }
    };
  }

  return {
    ...trends,
    summaries: {
      ...(trends.summaries || {}),
      voice: current.text
    },
    athleteVoice: {
      source: 'fz_athlete_events',
      latest: current,
      contract: 'CANONICAL_INTERPRETED_SUMMARY',
      rawTranscriptIsPrimary: false
    }
  };
}
