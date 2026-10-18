# Task: activate reviewed dependency policy

Beads: `agent-platform-dependency-security-activation` (P1).
Blocks final closure of [dependency security](agent-platform-dependency-security.md), not its local
implementation. See the [plan](../planning/dependency-security.md).

## Requirements and delivery

Owner explicitly selected `staging` as default on17October; API readback confirms it. Activate the
reviewed Dependabot configuration, scheduled staging audit and required review check after normal
protected staging delivery. No main policy proposal or application promotion is required.

Read back actual graph/alerts/update settings, valid API access and live proposal targets. Require
the exact `Dependency Review` job through the staging ruleset after it has actually qualified;
record pending enforcement rather than call an installed action a merge blocker prematurely.

Owner requests staging-first validation. GitHub security updates follow the default branch,
regardless of target-branch version-update configuration. The explicit owner choice and successful
default change supersede the earlier policy question. PR346 now targets staging. No automatic merge.

## Verification and closure

Independently review exact proposed configuration and authorized dependency changes. Verify settings,
configuration location, workflow triggers, actual base/head checks and ruleset/context source.
Record live activation and limitations, owner decision and delivery revision; read back/sync Beads.
Do not close on source-only configuration or permission/schedule assumptions. SDK upgrades, paused
orchestration and the disabled Docker gateway remain separate.
