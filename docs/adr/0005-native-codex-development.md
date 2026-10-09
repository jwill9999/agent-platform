# ADR-0005: Native Codex is the default developer route

- **Status:** Accepted owner direction; repository implementation pending final owner code review
- **Date:** 2026-10-09
- **Decider:** Repository owner
- **Supersedes:** [ADR-0004](0004-codex-development-orchestration-control-plane.md) as default developer policy
- **Task:** [Codex autonomy cleanup](../tasks/agent-platform-codex-autonomy-plan.md)

## Context

Custom managed-run planning, isolation, gateway, budget, admission and exact-material approval
were applied to ordinary developer tickets, creating repeated approvals and prerequisite work.
The owner requires upfront requirements/DoD/test agreement, followed by autonomous native
planning/implementation/QA/repair/review/CI and a final owner acceptance check.

## Decision

Use [native Codex development](../development/codex-development.md) within actual session permissions.
Owner end-to-end authorization covers routine file/subtask choices, test fixes, retries and phases.
Source-aware independent review uses native tools; responsibility prompts do not attest isolation.
Repository profiles inherit actual sandbox/concurrency defaults rather than overriding them.
Beads remains task authority; authorized native MCP/CLI/Git publication and CI paths are normal.
Clarify real changes to owner intent or explicitly reserved actions; final acceptance remains explicit.

The workflow-control package is preserved as a PAUSED explicit prototype. Its enforcement, recovery,
security and tests remain unchanged and apply to deliberate prototype execution only. The prototype
is not required for native development; its old automations/pilot remain paused. A later decision
about its retained value needs a separate review, not a permissive launcher or wholesale deletion.

Agent Platform product runtime permission levels, guards, approval routes/contracts, secrets and
security tests remain unchanged. Developer authority is not product permission authority.
Global settings, installed guidance, memories and connector configurations are outside this change;
[exact proposals](../planning/codex-developer-autonomy/global-follow-ups.md) await owner discussion.
No merge/deployment/paid gateway call/pilot follows from green tests or this ADR.

## Consequences and adoption

Agreed developer tickets can proceed without custom runtime qualification or repeated routine grants.
Existing product/prototype tests remain in workspace gates. Native roles/tools cannot be described
as technically isolated merely because review was assigned read-only. Reviewed repository changes
adopt through ordinary integration and fresh sessions; stale sessions/worktrees/global guidance need
explicit reconciliation without overwriting dirty work. Historical ADR0004 evidence remains retained.
