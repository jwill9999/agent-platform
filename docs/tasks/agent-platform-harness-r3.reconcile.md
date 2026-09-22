# Interrupted action reconciliation

Beads: `agent-platform-harness-r3.reconcile`. Parent: `agent-platform-harness-r3`. Priority P1; proposed MVP slice.

## Requirements

REC-1: Persist operation identity, run/session linkage, effect classification, intent and dispatch/result state transactionally before side-effect dispatch. Claim/reconcile resumes atomically across concurrent requests; a reused approval cannot execute twice.

REC-2: Inject process death before dispatch, after effect but before result storage, and after result storage. On restart show respectively interrupted-before-dispatch, outcome-unknown, and the persisted completed result. Startup never blindly reruns work.

REC-3: A lost response after an effect is not a retryable transport failure by itself. No automatic retry of non-idempotent or uncertain operations. Permit automatic retry only for classified pre-dispatch failures/read-only actions or an explicitly supported stable idempotency key; unknown classification defaults to no replay.

REC-4: Explicit user continuation of provably undispatched work revalidates current project binding, permissions, approval and model/tool configuration. Revoked permission, changed arguments or incompatible schema/configuration refuses continuation and requires a new reviewed action.

REC-5: No unattended recovery while the app is closed, distributed worker guarantee, arbitrary shell exactly-once promise or framework persistence migration. Reconciliation UI offers inspect/acknowledge; acknowledging uncertainty never silently authorizes retry.

REC-6: Additive SQLite migration, backup/restore verification, bounded metadata and no raw prompts/credentials. Preserve unresolved intents and approvals; storage failure before intent commit fails closed before an effect.

## Dependency order

Upstream hard blockers: `agent-platform-harness-review-gate`, `agent-platform-harness-v1`, `agent-platform-harness-r3.cancel`.

Parent is a scope relationship, not a prerequisite for this explicitly bounded child. Existing parent
blockers and broader acceptance remain unchanged; early child implementation still requires explicit
review-gate approval. Proposed Git order and downstream task are in the contract.

## Allowed paths

`apps/web/app/page.tsx` owns selected Project/session chat integration; wire controls there.
The separate IDE surface is outside this tranche.

`apps/api/src`, `apps/api/test`, `packages/harness/src`, `packages/harness/test`, `packages/contracts/src`, `packages/contracts/test`, `packages/db/src`, `packages/db/test`, `packages/db/drizzle`, `apps/web/components/chat`, `apps/web/hooks`, `apps/web/test`, `apps/desktop/e2e`, this specification and the MVP review/evidence documentation.

## Gherkin E2E Strategy

```gherkin
Feature: Interrupted action reconciliation
  Scenario: The backend stops after a file effect but before saving the result
    When I reopen the application
    Then I see an uncertain outcome with an inspect action
    And the file effect is not repeated automatically
  Scenario: Two clients first resume the same approval together
    Then at most one execution succeeds and both receive truthful outcomes
  Scenario: Permission changed while the run was interrupted
    When I ask to continue
    Then current policy is checked and prohibited work is not dispatched
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
