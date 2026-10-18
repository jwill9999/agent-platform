# Task: dependency security checks and remediation

Beads: `agent-platform-dependency-security` (P1). Owner authorized setup and security remediation
with regression tests and critic review; SDK upgrade remains separate.
See the [plan](../planning/dependency-security.md), [verification](../testing/dependency-security.md)
and [results](../reviews/dependency-security-results.md).

## Requirements

- DEP01: official pinned Dependency Review Action rejects newly introduced high/critical advisories
  across runtime/development/unknown scopes;
  no failed/missing analysis qualifies as clean. No write-capable PR token or untrusted install.
- DEP02: Dependabot settings and weekly proposals are configured with bounded concurrency. Record
  actual activation versus pending staging source/protection delivery; no automatic or main merge.
- DEP03: triage and repair actionable existing findings in compatible groups; preserve raw baseline,
  exact package/dependency paths, advisory IDs, fixes and remaining dispositions. Freeze AI SDKs.
- DEP04: preserve chat/tool/Stop/approval/context/diagnostic behavior, database records and native
  startup while upgrading affected dependencies. Use deterministic external fixtures, no paid CI.
- DEP05: independently review source, regressions, audit completeness and exact-head hosted results.
  Do not claim complete while required tests/settings or actionable findings lack disposition.

## Dependencies and implementation

`agent-platform-dependency-security-activation` owns actual required-check/settings activation on
owner-selected default staging; it blocks final closure, not local implementation and tests. No upstream
code task is required for isolated dependency maintenance from actual staging. The
separate SDK P1 owns AI-family upgrades; the migration repair remains independently qualified.
Follow `feature/dependency-security` → `task/dependency-security` → task-tip PR into feature, then
separately authorized protected staging promotion. Keep protected staging activation an explicit boundary.
Complete missing plan details and critic findings before changing package resolution. Commit only
scoped artifacts; preserve owner profiles, primary dirty work and paused refs/worktrees.
The owner-approved two-file test-only exceptions and exact case mappings are recorded in the plan
and results. They do not authorize paused orchestration runtime, PR283 or broader test-budget changes.

## Current setup verification

The source-level DS-I01–03 review findings are repaired: canonical warning decoding, complete quoted/
unquoted pagination parsing and vendor-first complete-inventory binding. The official pinned action
makes advisory decisions; the builtin guard validates provenance/completeness only. All18 local
controls and independent setup-source review pass. Hosted forward/reverse controls, full package
regressions, current audit dispositions and actual required-check activation remain pending.

## Definition of done

Requirements DEP01–05 and linked verification have actual results; independent findings are resolved
or explicitly blocked with evidence. Source is pushed and hosted checks/reviews qualify it. Beads
records actual settings, delivery, remaining advisory ownership and activation limits, then syncs to
terminal Dolt completion. Task-tip integration requires owner merge authority; green CI grants none.
No new external publication or reusable repository skill is required.
