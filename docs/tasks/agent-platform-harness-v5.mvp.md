# Composed MVP reliability acceptance

Beads: `agent-platform-harness-v5.mvp`. Parent: `agent-platform-harness-v5`. Priority P1; proposed MVP slice.

## Requirements

QA-1: Reuse the merged provider baseline and extend real Electron and browser/API journeys for policy precedence, Stop, duplicate first resume, renderer reconnect and backend process restart. Model/runner fixtures must be declared; do not mock UI, approval service or persistence under assessment.

QA-2: Each negative case waits for an observable acknowledgement/settled state, then verifies independent file/data effects, durable operation/approval records and provider/runner call counts. Lost-result tests assert no blind replay and truthful uncertainty.

QA-3: UI states, backend run/operation identities and sanitized timeline agree across resumed runs. Include pre-run failure, collector-off/outage and redaction tests using synthetic secret canaries. No live paid provider calls.

QA-4: Retain sanitized JSON evidence and Playwright traces for passing and failing CI journeys with bounded retention (proposed seven days). Fixtures contain no real user content or credentials. Upload failure makes evidence incomplete rather than a pass.

QA-5: All claimed MVP scenarios and required checks pass at the exact committed source. An unsupported runner cancellation or ambiguous outcome passes only by matching the specified honest pending/unknown behavior, not by silently skipping the case.

QA-6: Merge only the approved segment tip into feature/harness-backlog-review after human review. Staging promotion, real packaged macOS VM acceptance, live-provider behavior and broader backlog completion remain separate decisions.

## Dependency order

Upstream hard blockers: `agent-platform-harness-review-gate`, `agent-platform-harness-v4.local`, `agent-platform-harness-baseline-p2`, `agent-platform-harness-baseline-x2`, `agent-platform-harness-baseline-x3`, `agent-platform-harness-baseline-x5`.

Parent is a scope relationship, not a prerequisite for this explicitly bounded child. Existing parent
blockers and broader acceptance remain unchanged; early child implementation still requires explicit
review-gate approval. Proposed Git order and downstream task are in the contract.

## Allowed paths

`apps/desktop/e2e`, `apps/web/e2e`, `apps/api/test`, `packages/harness/test`, `packages/db/test`, `.github/workflows/ci.yml`, this specification and the MVP review/evidence documentation.

## Gherkin E2E Strategy

```gherkin
Feature: Composed MVP reliability acceptance
  Scenario: A full controlled journey stops with an already completed effect
    Then the visible status, saved result and actual file agree
    And no next action starts after cancellation acknowledgement
  Scenario: The backend restarts during an uncertain tool outcome
    Then the UI offers inspection rather than automatic retry
    And the original effect is not duplicated
  Scenario: No collector is configured
    Then local status and diagnostic evidence still work
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
