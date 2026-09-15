# Project Chat journey evaluation

## Purpose and coverage boundaries

This bounded evaluation checks whether one requested change is held for approval, executed once after approval, and prevented after rejection. It reuses the existing Electron command journey. It is not a framework migration or a claim that all workflows are reliable.

| Existing coverage                                 | What it proves                                                                                   | What it does not prove                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Browser MVP fixture pages (`e2e/mvp-e2e.spec.ts`) | Tool and approval UI states render                                                               | Real backend dispatch or file effects                                                     |
| Electron Project access                           | Project navigation, session binding and instructions onboarding                                  | Every subsequent model/tool workflow                                                      |
| Packaged-command Electron journey                 | Real UI/API approval path and command-result presentation; unhealthy runner fails visibly        | Default fake runner output is not real VM execution proof                                 |
| Harness/API unit and integration tests            | Focused permission, dispatch, approval transition and denial rules                               | All layers work together through desktop UI                                               |
| New disposable edit scenarios                     | UI, actual backend, durable approval/audit and a fixed fixture file effect correlated in one run | Live model decisions, disabled evaluator nodes, real VM isolation or SDK migration parity |

## Test design and best-practice assessment

The inspected suite has useful layers, not uniformly full end-to-end coverage. Keep fixture-page tests for fast presentation checks and label their evidence accordingly. The new journey drives real Project Chat controls and keeps the API, approval persistence and harness tool dispatch real. Only the existing model reasoning hook and external command-runner boundary are deterministic doubles. The fake runner recognizes one fixed append command; it does not execute arbitrary shell input.

Each decision gets its own disposable project, SQLite database, runtime and ports. No dependence on previous sessions or developer project data. The file is unchanged while approval is pending. After a completed decision turn, compare its exact contents and durable audit status, including exactly one successful execution after approval and none after rejection. Denial is tested after the turn settles, rather than merely sleeping and assuming nothing happened.

Use accessible locators and auto-waiting assertions. Persist a Playwright context trace explicitly for Electron, because a browser trace is not a backend trace. Attach backend plugin events, response-stream records, approval/audit evidence and a readable summary before deleting temporary data. Missing required evidence fails the scenario; known instrumentation gaps remain explicit limitations.

This follows [Playwright best practices](https://playwright.dev/docs/best-practices) for user-visible behavior, isolation and controlled external dependencies. The additional backend/file assertions establish application effects; the report does not infer them from UI copy. This is a focused assessment, not certification of the entire existing suite.

## Reproduction and interpretation

Use Node 24 and the repository's locked dependencies. Build the repository before executing the desktop tests. From the repository root:

```sh
pnpm build
PLAYWRIGHT_HTML_OUTPUT_DIR=.agent-platform/journey-report pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts packaged-vm-command.e2e.ts --grep 'disposable edit' --output=.agent-platform/journey-results --reporter=list,html
pnpm exec playwright show-report .agent-platform/journey-report
```

Each scenario attaches `journey-evaluation` JSON, `journey-summary` Markdown and `journey-browser-trace`. The default run uses no paid models. The existing optional packaged-VM resources setting can select real VM execution when separately provisioned; never label default fixture results as that mode.

The raw harness graph trace is not currently exported here as a full persistent span tree. Captured backend plugin events and durable tool audit rows provide partial runtime evidence. Approval resume can use a new run identifier, so the session and approval record bridge those phases. Provider latency, real token cost, planner/critic quality and crash recovery remain outside this test's conclusions.

## Initial execution outcome

Local evaluation on September 15, 2026: **PASS for the two deterministic application journeys**. The two pre-existing command scenarios also passed (four tests in the shared file); after strengthening streamed-event/backend-event assertions, both new scenarios passed again. Desktop unit tests: 112 passed. Repository build, desktop source typecheck, explicit E2E-file typecheck and scoped desktop lint passed. No Sonar local-analysis or IDE diagnostics interface was available; these local checks are the fallback evidence. Hosted checks and PR review remain separate gates.

| Scenario | File result                                                | Durable records                                                      | Captured plugin events |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| Approve  | Original content plus exactly one approved line            | Approval approved/resumed; one successful execution                  | 6                      |
| Deny     | Original content unchanged after response stream completed | Approval rejected/resumed; denial record and no successful execution | 5                      |

Both traces captured approval-required events followed by the relevant tool result or explicit rejection event. Audit history retains a pending-approval entry alongside the subsequent execution/denial row; this historical row does not mean the durable approval is still pending. The evidence report includes both rather than dropping inconvenient records.

Initial test failures were test-assumption/fixture issues, not established product defects: the button is labelled Deny, the resume UI presents a completed approval card without the mock final-text message, and the backend rewrites the relative output path to `/workspace/journey.txt`. The fake runner initially matched only the unrewritten command, so UI success alone would have missed its absent file effect. The independent file assertion caught it; the fixture was corrected to recognize the exact translated command. No application behavior was changed.

Initial broad desktop lint also encountered generated HTML-report JavaScript under the package directory. Scoped source lint passed, and the reproduction command now writes reports under the ignored task-artifact directory. This is why report destinations should be declared in the test plan.

## Skill improvement

The repository now includes the [Playwright quality-gate skill](../../.agents/skills/playwright-quality-gate/SKILL.md), synchronized with the installed user skill. Its added evidence contract requires coverage classification, real/mocked boundaries, backend postconditions and negative-effect checks for end-to-end claims, correlated artifacts and honest treatment of missing telemetry. Page-only tests retain their narrower purpose. Skill validation passed; this is a targeted update, not a broad skill evaluation.

Task status and integration gates remain in `agent-platform-workflow-journey-evaluation` in Beads. No framework migration, real-model quality or real-VM isolation conclusion follows from these results.
