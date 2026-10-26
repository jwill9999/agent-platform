# Major dependency upgrade preview review

19October2026 draft. Exact stagingbe153; independent read-only researcher sdk_router_worker inspected
current code/lock/actions, PR368–372 and official sources. No package/runtime/settings change.
Findings and initial estimates are in the [plan](../planning/dependency-upgrade-preview.md).

Confirmed obsolete ai4→5 recommendation versus stagedai7.0.143; Electron42 published EOL20October;
Next15 approaching inferred two-year boundary21October while still listed MaintenanceLTS. Do not
present inferred Next date as an explicit new vendor EOL notice. PR370 inventory mismatch is a
provenance failure, not proof of a particular vulnerable dependency. Broad groups and paused manifest
changes need explicit disposition. The original user concern is valid: major upgrades need reviewed
scope; enabling proposals does not enable merge or approve changes.

Distinct plan critique found UP-P01: Next16 changes existing plain dev/build commands to default
Turbopack. The plan and verification map now explicitly require a retain-Webpack versus qualify-
Turbopack decision, monorepo tracing/standalone Docker assembly and desktop renderer coverage.
Corrected plan passed distinct source-aware critique with zero findings (UP-P01 resolved).
Document publication and the owner discussion remain pending; no implementation or merge is approved. Future upgrades/tests are
proposed, not implemented or run. No owner decision on runtime targets/distribution floor is assumed.

## PR373 review response — 26 October 2026

Sourcery raised five medium findings on PR373. Responses, after rebasing onto staging `d59e392c`:

- **Setup-node upgrade lacks qualification:** accepted. The plan adds a PR369 slice (12 uses across five
  workflows, runner and cache impact by release, effort, checks) and the verification map adds its checks.
- **Action proposals lack exact revisions:** accepted. The plan adds an Action revisions table with
  current refs, proposal heads/bases and resolved target SHAs; PR353/354 are recorded as closed.
- **Rollback boundaries remain unspecified:** accepted. The plan adds per-slice rollback checkpoints,
  triggers and recovery scope, and makes unverifiable boundaries an owner-decision prerequisite.
- **Task sign-off is missing:** accepted. The task spec adds planning-specific definition-of-done,
  pre-close and post-close sections with runtime gates marked N/A.
- **Branch exceeds stated scope:** not accepted. The branch's scope is this planning task (plan, task,
  verification, review and handoff records), as declared in the task spec; no guidance-only scope
  applies. The PR now targets staging directly instead of the unused feature branch.
