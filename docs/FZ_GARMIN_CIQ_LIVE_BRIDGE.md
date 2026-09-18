# FZ Garmin Connect IQ Live Physiology Bridge

## Purpose

Restore near-real-time Garmin physiology to FZ without making the daily recovery layer dependent on a commercial Garmin Health API integration.

## Source responsibilities

### Garmin via Intervals.icu — daily recovery authority

Intervals.icu remains the preferred source for daily and overnight recovery anchors:

- overnight HRV
- resting heart rate
- sleep duration
- sleep score
- daily steps
- Body Battery high / low when configured

Intervals subjective wellness stress is not Garmin physiological stress and is never mapped as such.

### fēnix 8 via Connect IQ — intraday physiology transport

The Connect IQ watch app contributes only fields it can genuinely observe on-device:

- heart-rate history / latest heart rate
- physiological stress history / current stress score
- Body Battery history / latest Body Battery, with the native Body Battery complication as a fallback
- current respiration rate, sampled when the background task runs
- current-day steps
- sleep score from the native Garmin complication only as a fallback when the daily recovery source has not supplied today's sleep score

The watch app registers a temporal background event at Garmin's five-minute minimum interval. Each run sends a bounded recent history payload to the authenticated FZ endpoint.

## Canonical composition

Both sources use the existing wellness persistence model:

- `fz_wellness_snapshots`
- `fz_wellness_series_points`

No database migration is required.

`getWellnessToday()` composes fields rather than choosing one entire payload:

- daily recovery fields come from Intervals.icu (or the legacy daily fallback);
- intraday fields come from `garmin-ciq` when available;
- current watch observations are timestamped on ingest so FZ can build live traces even when Garmin SensorHistory returns no historical samples;
- a watch sleep score may fill a missing daily sleep-score field, but never overrides an Intervals.icu sleep score;
- sparse watch packets cannot erase richer daily recovery evidence;
- provenance is retained separately for daily and intraday sources.

The resulting mode is:

- `LIVE_INTRADAY` when genuine watch physiology is present;
- `DAILY_RECOVERY` when FZ is operating from daily recovery data only.

## TODAY semantics

TODAY is source-capability aware.

When Connect IQ intraday evidence is available, the panel is **Live Physiology** and may show timestamped Body Battery, stress, heart-rate and respiration traces.

When the watch bridge is absent, delayed beyond the useful window, or not configured, the panel degrades to **Recovery Physiology**. It shows daily recovery anchors and explicitly leaves unsupported current physiology unknown. It does not fabricate traces or label Body Battery Max as a current value.

## Endpoint and security

Watch uploads use:

`POST /api/wellness/today?source=garmin-ciq`

To preserve FZ's serverless-function budget, Connect IQ writes share the existing wellness API boundary and are dispatched only for `POST` requests with `source=garmin-ciq`. Authentication uses a dedicated `FZ_CIQ_INGEST_TOKEN` supplied as a Bearer token (an `x-fz-ciq-token` header is also accepted by the server adapter).

The token is never committed to the repository. The Connect IQ app exposes a local application setting so the athlete can configure the token on the device through Garmin's app settings.

Payloads are constrained by:

- accepted physiology ranges;
- maximum 48-hour backfill;
- maximum 15-minute future clock skew;
- server-side source normalization before canonical ingestion.

## Deployment sequence

1. Merge the Intervals.icu source adapter release.
2. Deploy the Connect IQ bridge backend/UI release with `FZ_CIQ_INGEST_TOKEN` configured.
3. Compile the watch app for `fenix847mm` using Garmin Connect IQ SDK.
4. Install the private app on the athlete's fēnix 8.
5. Configure the endpoint/token in Garmin app settings.
6. Observe the first authenticated watch upload.
7. Verify `garmin-ciq` source health and the automatic TODAY transition from Recovery Physiology to Live Physiology.
8. Verify that overnight anchors continue to come from the daily source and that recommendation/readiness logic remains daily-anchor based.

## Failure behaviour

If the watch bridge stops reporting, FZ does not lose wellness. Intervals.icu remains available for daily recovery intelligence and TODAY automatically presents the honest daily-recovery view.

If Intervals.icu is unavailable but the watch bridge is reporting, FZ may still show current intraday observations but will not manufacture missing sleep, HRV or resting-HR recovery anchors.

## Release boundary

This is an application/API/UI capability addition, so it is a controlled software release. Once deployed, ordinary watch observations are runtime data and require no subsequent Vercel deployment.
