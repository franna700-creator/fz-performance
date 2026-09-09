# Tranche 3 — Tredict Personal API read adapter

The production Tredict source uses the Personal API bearer token for read-only training ingestion. The direct OAuth-style REST endpoints are preferred for deterministic backend ingestion of planned and executed activity lists; the MCP endpoint remains available for interactive AI tooling.

Required token scope: `activityRead` only.
