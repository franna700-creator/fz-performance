# Tranche 1 implementation decisions

Selected backend option: PostgreSQL / Neon.

Selected cutover strategy: staged dual-read with immutable fallback.

1. `immutable` — unchanged production baseline.
2. `prefer-database` — database first, immutable state transport fallback.
3. `database-only` — final hard cutover only after validation.

Reasoning: preserve the proven v0.6.1 runtime contract and last-known-good recovery path while proving deployment-free state changes before introducing continuous Garmin ingestion or intraday wellness storage.
