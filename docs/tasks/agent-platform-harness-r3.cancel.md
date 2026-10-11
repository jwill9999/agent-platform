# Acknowledged Stop for Project Chat

Beads: `agent-platform-harness-r3.cancel`. Parent: `agent-platform-harness-r3`. Priority P1; proposed MVP slice.

## Requirements

STOP-1: Show an accessible Stop button only for the selected active Project Chat run. Send a session-and-run-scoped idempotent cancellation request; never cancel a newly started run or a different session through a stale control.

STOP-2: Backend acknowledges the stop request within two seconds in controlled local tests, records stop_requested durably, and refuses any new dispatch for that run after acknowledgement. A successful request does not itself mean execution has stopped.

STOP-3: Forward cancellation through provider, harness and supported runner boundaries. Preserve completed effects. If a runner cannot acknowledge termination, retain stopping or outcome_unknown with an explanation; never claim rollback or successful cancellation.

STOP-4: Repeated Stop, Stop racing completion, Stop while waiting for approval and reconnect after Stop have deterministic terminal outcomes. Approval of a stopped run cannot dispatch its pending action; backend validates the run state at the effect boundary.

STOP-5: Existing tool risk, Ask/Automatic/Block precedence, approval and project/path restrictions are unchanged. A stop control is not a new permission to execute or resume.

## Dependency order

Upstream hard blockers: `agent-platform-harness-review-gate`, `agent-platform-harness-v1`.

Parent is a scope relationship, not a prerequisite for this explicitly bounded child. Existing parent
blockers and broader acceptance remain unchanged; early child implementation still requires explicit
review-gate approval. Proposed Git order and downstream task are in the contract.

## Allowed paths

`apps/web/app/page.tsx` owns selected Project/session chat integration; wire controls there.
The separate IDE surface is outside this tranche.

`apps/web/components/chat`, `apps/web/hooks`, `apps/web/test`, `apps/api/src`, `apps/api/test`, `packages/harness/src`, `packages/harness/test`, `packages/contracts/src`, `packages/contracts/test`, `packages/db/src`, `packages/db/test`, `packages/db/drizzle`, `apps/desktop/e2e`, this specification and the MVP review/evidence documentation.

## Gherkin E2E Strategy

```gherkin
Feature: Acknowledged Stop for Project Chat
  Scenario: Stop before another action starts
    Given a controlled provider has returned an action and the run is active
    When I press Stop and the backend acknowledges it
    Then no subsequent action starts for that run
    And the UI shows the backend-confirmed outcome and any completed effects
  Scenario: The in-flight runner cannot stop
    When I request Stop during that action
    Then I see that stopping is pending or the outcome is unknown
    And the app does not claim that file changes were rolled back
  Scenario: A stale Stop arrives after completion
    Then the completed result is preserved and a new run is unaffected
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
