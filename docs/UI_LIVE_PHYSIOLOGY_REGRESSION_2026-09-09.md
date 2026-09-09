# Live Physiology regression note — 2026-09-09

During consolidation, the clean TODAY surface retained the canonical wellness data but replaced the Tranche 2 interactive intraday scrub charts with static metric cards. The clean client also switched its wellness reads to `/api/wellness/today?refresh=0`, which means the visible 5-minute application refresh re-read Neon but did not request a fresh Garmin/Fitness AI sync.

The underlying wellness contract still retains 15-minute `heart_rate`, `stress`, `body_battery`, and `respiration` series, and the server endpoint still supports live source refreshes (default) plus forced refresh (`refresh=1`). This is therefore a UI/client orchestration regression rather than a source or database loss.

Required correction:
- restore scrub-enabled intraday charts for Body Battery, Stress, Heart Rate, and Respiration;
- keep the cleaner consolidated TODAY hierarchy;
- load persisted wellness immediately, then request a source refresh in the background;
- auto-request a wellness source refresh every 5 minutes while visible;
- refresh when the app regains focus/visibility;
- provide a visible `Refresh Garmin` action for an explicit forced refresh;
- show source observation time, FZ persistence time, freshness, and refresh state clearly;
- never call Garmin/Fitness AI directly from the browser; all requests stay same-origin through `/api/wellness/today`.
