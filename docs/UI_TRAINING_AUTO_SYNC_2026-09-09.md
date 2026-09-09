# Training auto-sync correction — 2026-09-09

The consolidated FZ client rendered canonical Training Memory from Neon but called `/api/training/memory` without `refresh=1`. That meant the visible five-minute application refresh could reread the same persisted training ledger without asking Tredict/Garmin whether a newly completed workout had arrived.

This correction restores the persisted-first source-refresh pattern for training:

1. `app-clean` renders the current canonical Neon training ledger immediately.
2. A separate training auto-sync controller requests `/api/training/memory?backDays=45&forwardDays=0&refresh=1` in the background.
3. The existing server-side `syncTrainingSources` path reads Tredict/Garmin, reconciles source evidence and persists canonical training state.
4. After successful persistence, the canonical app rereads Training Memory, Trends and System state so TODAY/TRAIN/TRENDS can reflect the new workout without a deployment.
5. While the PWA is visible, the source check repeats every five minutes. Focus/visibility wake-ups can trigger a check when the last source sync is older than two minutes.
6. A visible `Sync workouts` action provides an explicit manual refresh.

The browser never contacts Garmin, Fitness AI or Tredict directly. All source work remains behind the same-origin FZ training API.

This is a consolidation/runtime orchestration correction and does not implement Tranche 4.2 recommendation recomputation. Tranche 4.1 materiality remains the current intelligence boundary.
