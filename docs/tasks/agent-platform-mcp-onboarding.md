# Task: Make existing MCP server onboarding reliable

**Beads issue:** `agent-platform-mcp-onboarding` (P1, in progress).  
**Parent epic:** `agent-platform-capability-registry` — Capability registry and policy profiles.  
**Status:** planning proposal; implementation awaits owner agreement.  
**Spec file:** `docs/tasks/agent-platform-mcp-onboarding.md`.

## Task requirements

Implement MCP-01 through MCP-08 in the [bounded plan](../planning/mcp-onboarding-mvp.md), once accepted. Deliver import/review/save, protected credential storage, consistent test/chat configuration, eligible discovery, assignment and a real permitted tool call after restart. Preserve existing permission denials and report safe actionable failures. No universal installer or claim of host isolation.

## Dependency order

No blocking upstream or downstream issues are declared. The epic parent is organizational, not a prerequisite to closing this slice. Source baseline includes delivered diagnostics/context MVP and PR311 at `26e90126a1987b1dc6e689438b471fe5ed932235`. Closed browser-tools authentication/selection records are historical context, not proof of current functionality. If a genuine external prerequisite is found, create/link it in Beads and update the plan; do not invent a dependency on the paused prototype.

## Implementation plan and Git workflow

Planning uses `task/mcp-onboarding-plan` from `feature/mcp-onboarding` at staging26e. Once accepted, chain proposed `task/mcp-onboarding-connection` then `task/mcp-onboarding-verification` from the preceding pushed tip. One owning task covers internal slices A/B/C from the plan. The final verification branch opens one cumulative PR into the feature. The same task owner is responsible for final cross-slice integration, not just isolated tests. Future feature promotion is via protected staging PR with applicable owner authority; never main.

Expected areas: shared MCP contract/public DTO; DB registry/secret ownership; API application connection service and MCP router; adapter transport/session/manager; harness factory/trust-filter integration; existing MCP dashboard and agent editor; related unit/integration tests, root `e2e` and desktop `e2e`. No workflow-control changes, SDK upgrade or unrelated runtime rewrite. Reuse model-config secret patterns and V1 diagnostic facilities.

## Tests and Gherkin E2E strategy

The [verification map](../testing/mcp-onboarding-mvp.md) assigns V01–V09 to this task. All are required product gates; none has been executed by this planning phase. Follow the implementation skill's diagnostic-review checkpoints before changes, during connected E2E and at final acceptance.

```gherkin
Feature: Connect and use a trusted MCP server
  Background:
    Given the real application has isolated data and a preinstalled fixture server
    And a deterministic model provider selects a known eligible fixture tool

  Scenario: Configure, test, assign and use after restart
    When I import a supported server and review its host and credential settings
    Then saving makes no connection and starts no process
    When I test it and assign it to an agent
    Then I see its connection result and eligible tools
    When I restart the app and approve its requested tool call in chat
    Then I see the result and the fixture records exactly one approved effect

  Scenario: Denial and failed connection do not imply success
    When I deny a requested tool call
    Then the fixture records no tool effect after the request settles
    When I test with an invalid credential or missing executable
    Then I see safe corrective guidance and no saved successful test state

  Scenario: Existing settings and ordinary chat remain usable
    When I edit or duplicate a server and switch agents
    Then stale test results and credentials are not copied as usable configuration
    And unrelated agent settings, ordinary chat and system-tool permissions still work
```

## Definition of done and pre-close sign-off

Planning sign-off is distinct from product completion: all five documents validated/pushed, independent critique resolved, full Notion mirrors/readbacks, Beads links and sync verified, and an owner briefing ready. Keep this task in progress awaiting discussion; do not close it because the plan exists.

Product pre-close requires every MCP requirement and V01–V09 to pass at the actual reviewed revision; actual UI/backend/effect evidence and sanitized diagnostic evaluation; local affected build/typecheck/lint/format/tests, applicable Sonar/Problems fallback and hosted checks; no unresolved actionable code/security findings; updated source-bound results and full documentation mirrors; pushed chain and authorized segment-tip merge into the feature. Any required skipped/blocked journey prevents completion. Owner acceptance and staging promotion are separately recorded, never inferred from planning or unit tests.

## Post-close verification

After eventual product gates pass, record actual close reason, merged revision and evidence, read Beads back as closed and sync Dolt. Reconcile downstream readiness without closing the parent epic. Refresh session and preservation evidence. No product close or implementation acceptance is claimed in this planning handoff.
