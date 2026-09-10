# Migration 005 rehearsal — event/objective graph

Status: PASSED ON ISOLATED NEON BRANCH. Production not modified.

## Rehearsal 1
The RC6 draft was applied to a temporary branch cloned from the current FZ production parent. All seven tables created successfully and the expected PK/FK/check constraints were present. A complete synthetic capability → format → objectives → capability link → source evidence → transfer assessment → revision chain inserted successfully. The branch was discarded without applying to production.

That pass exposed two worthwhile improvements: objective revisions should be referentially anchored to an objective, and common active-objective / reverse-transfer lookups should be indexed.

## Rehearsal 2 — final RC7 migration
The hardened migration was applied to a new temporary branch. It created seven tables, the objective-revision FK, and all expected secondary indexes. A full synthetic relationship chain inserted successfully. A deliberate out-of-range strategic weight was rejected by the database check constraint. A deletion attempt against an objective with revision history was blocked by the revision FK. The DDL was then executed a second time on the same rehearsal branch to verify its `IF NOT EXISTS` path is idempotent.

The final rehearsal branch was discarded with `apply_changes=false`. A direct read of the production parent afterwards confirmed **zero** of the seven new event/objective tables exist there.

## Release rule
Migration rehearsal does not authorize migration application. Production migration 005 remains a separate release-gate action.
