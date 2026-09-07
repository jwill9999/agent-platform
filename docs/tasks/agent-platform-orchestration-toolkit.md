# Epic: Investigate a reusable orchestration toolkit

**Beads issue:** `agent-platform-orchestration-toolkit`  
**Spec file:** `docs/tasks/agent-platform-orchestration-toolkit.md`  
**Priority:** P3 backlog; research only after current delivery and pilot learning.  
**Status:** Proposed; owner refinement is required before implementation children.

The Beads description must begin with `Spec: docs/tasks/agent-platform-orchestration-toolkit.md`.

## Objective

Investigate making the repository-local orchestration reusable across projects and by other users,
potentially as a separately maintained project and versioned package. Distribution format, runtime,
repository ownership and release timing are deliberately undecided.

## Capability map

- Shared core: workflow transitions, scoped roles, evidence, approvals, callbacks and recovery.
- Project adapters: task tracker, source control, CI, tests, protected targets and workspace layout.
- Guided initialization: detect safe defaults, ask for missing project choices, preview changes,
  and generate readable configuration and Markdown role/workflow documentation.
- Validation: a doctor command identifies missing setup and gives actionable remediation;
  credentials are verified separately and never embedded in generated configuration.
- Distribution: version pinning, upgrades, migration, compatibility and maintainer ownership.

## Candidate architecture for investigation

```text
Versioned shared toolkit
  |-- Project configuration and Markdown playbooks
  |-- Tracker / Git / CI / execution adapters
  `-- Isolated per-project state and credential references
```

This is a hypothesis, not an approved implementation architecture. Host resumption limitations
must be explicit; importing a package must not falsely imply unattended operation is supported.

## Proposed research sequence

First incorporate pilot findings and inventory repository-specific assumptions. Then compare
distribution options and define init/doctor behavior, safe defaults, configuration ownership,
credential boundaries and migration. Finally propose a bounded extraction and validation plan
for owner refinement. Create implementation child issues only after that approval.

## Dependency order

Upstream: `agent-platform-multi-agent` pilot learning and acceptance. Product-delivery timing
remains an owner scheduling decision; no arbitrary delivery epic is selected as a dependency.
No downstream implementation children exist yet. Keep actual ordering in Beads.

## Tests and verification strategy

The future proposal must cover at least two repositories with differing layouts or toolchains;
fresh and repeated init, partial configuration, doctor failures, secret non-disclosure,
cross-project state isolation, unsupported hosts, upgrade/rollback, and approval/callback recovery.
Specify unit, integration and end-to-end gates when an implementation plan is refined.
This backlog document requires formatting, Markdown and link checks only; it changes no runtime.

## Definition of done

An owner-reviewed feasibility and release proposal identifies reusable core versus adapters,
distribution/versioning options, guided init and doctor behavior, safe configuration and state,
migration/upgrade strategy, and validation in at least two differing repositories. Technical
decisions remain proposals until refinement approval. Capturing this epic does not satisfy it.

## Sign-off

Owner requested future backlog capture; implementation, external publishing and a separate project
have not been authorized. Research review and implementation approval remain pending.
