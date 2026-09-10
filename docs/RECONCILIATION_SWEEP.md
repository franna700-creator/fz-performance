# FZ Performance Systemic Reconciliation Sweep

Status: v0.7 foundation; pure audit logic prepared before scheduled/runtime activation.

The sweep is an architecture janitor. It inspects canonical contracts for invariant violations rather than patching data itself.

Initial checks include:
- training or Trends contract unavailable;
- session-related Athlete Memory still unresolved after reconciliation;
- completed session with no usable identity;
- workout day represented as zero NCL;
- pending-detail NCL carrying a false final value;
- Trends evidence policy drifting away from `MONOTONIC_BEST_AVAILABLE`;
- objective graph resolving an upcoming PRIMARY event incorrectly;
- evergreen maintenance surfacing while a primary event is still active.

The sweep returns findings. It does not mutate source or canonical history. Future activation can expose findings in SYSTEM and trigger safe reconciliation work through the dependency graph.

## Event intelligence
The sweep also protects the event knowledge gate. A `PENDING_RESEARCH` event may remain in scheduled context but must not carry an overlap result or appear inside qualified capability priorities. If it does, that is an invariant error. Pending research itself is a warning/context state, not a fabricated zero-overlap conclusion.
