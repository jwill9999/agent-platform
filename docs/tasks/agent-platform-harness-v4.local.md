# Local run status and diagnostics

Beads: `agent-platform-harness-v4.local`. Parent: `agent-platform-harness-v4`. Priority P1; proposed MVP slice.

## Requirements

UI-1: The selected Project conversation shows backend-authoritative running, waiting_for_approval, stop_requested, cancelled, completed, failed, interrupted and outcome_unknown states. Waiting is not running; silence is not success or failure.

UI-2: Display current action, elapsed time, last confirmed update and a concise next action. A lost connection is a separate freshness indicator, not a fabricated terminal run state. Proposed default: after 30 seconds without a heartbeat, show status unavailable; a 15-second backend heartbeat lets a long healthy tool remain running.

UI-3: Restore status and pending approvals after renderer reload from supported backend reads. Switching sessions cannot show or stop another session’s run. Terminal state persists; approval decisions stay in the existing authorized path.

UI-4: In controlled tests a backend state transition appears within two seconds after delivery. Use accessible labels and keyboard controls; display plain language in primary UI. Technical identifiers and sanitized event details live in expandable diagnostics and redacted export.

UI-5: Local diagnostics remain available without external collectors. Missing or stale evidence is explicitly identified; no spinning forever with invented progress percentages. Running-but-slow is distinguishable from disconnected, but there is no automatic stall verdict or kill solely from elapsed time.

UI-6: Owner explicitly accepted this smaller in-app panel as a planning requirement on September 23. It does not replace the broader activity panel or authorize implementation.

## Dependency order

Upstream hard blockers: `agent-platform-harness-review-gate`, `agent-platform-harness-v1`, `agent-platform-harness-r3.cancel`, `agent-platform-harness-r3.reconcile`.

Parent is a scope relationship, not a prerequisite for this explicitly bounded child. Existing parent
blockers and broader acceptance remain unchanged; early child implementation still requires explicit
review-gate approval. Proposed Git order and downstream task are in the contract.

## Allowed paths

`apps/web/app/page.tsx` owns selected Project/session chat integration; wire controls there.
The separate IDE surface is outside this tranche.

`apps/web/components/chat`, `apps/web/hooks`, `apps/web/lib`, `apps/web/test`, `apps/api/src`, `apps/api/test`, `packages/contracts/src`, `packages/contracts/test`, `apps/desktop/e2e`, this specification and the MVP review/evidence documentation.

## Gherkin E2E Strategy

```gherkin
Feature: Local run status and diagnostics
  Scenario: Approval waits while the connection is healthy
    Then I see Waiting for approval and can use the existing approval control
    And I do not see an active execution spinner
  Scenario: The status connection is lost
    Then I see that current status is unavailable and the last confirmed update
    And the app does not claim completion or failure
  Scenario: Reload without an external monitoring service
    Then the selected conversation restores its backend status and redacted diagnostics
```

## Implementation plan and boundaries

Implement only after the owner accepts the versioned current-stack plan and required Beads blockers
are satisfied. Keep the installed TypeScript/LangGraph/AI SDK stack, current permission precedence and
single-user local model. No package upgrades, authentication build, paid provider calls, automatic
production promotion or autonomous work while the app is closed. Reuse existing routes, approval
records, session locks and tests before introducing new mechanisms. New APIs and additive database
migrations require the accepted contract and focused integration tests.

## Tests and definition of done

Every numbered requirement above has a named test and exact-source evidence. Include happy path,
negative and race/reload cases. Run build, format, lint, typecheck, focused unit/integration tests,
real browser/Electron journeys and SonarCloud (or the repository Problems fallback). Tests substitute
only declared external boundaries and verify UI plus independent saved state and file/data effects.
Capture a failure before any small repair and rerun relevant checks. Broader behavior, security or
architecture changes return to review. Two repair attempts per finding and two infrastructure retries
are the proposed limit before escalation. No arbitrary sleeps stand in for terminal-state evidence.

This is an intermediate task unless designated the segment tip in the contract. Completion requires
exact-head local evidence, independent review, pushed branch and the declared integration checks;
the final acceptance task additionally requires its PR merged into the feature branch with hosted
checks passing. Completing this child does not complete or supersede its broader parent. During an
active managed run, all mutations and sync use journaled brokers; otherwise use the manual Beads flow.

## Sign-off

Planning only. Owner implementation approval: pending. Runtime evidence: pending. A schema-valid
contract or critic approval is not owner authorization. See the [MVP plan](../planning/mvp-reliability/plan.md).
