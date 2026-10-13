# GitHub read responsiveness — verification contract

Status: owner-approved v2 verification contract; execution results are recorded in the linked review. Task owner for every case and final integration:
`agent-platform-d185` implementer. [Requirements](../planning/github-read-responsiveness.md) and
[task](../tasks/agent-platform-d185.md); [findings/results](../reviews/github-read-responsiveness.md).

## Environment and feasibility

On 14 October planning inspection Docker Desktop engine29.8 was reachable and dev macOS runner
online/idle. Node24 and existing Playwright/Electron fixtures are available. This is availability,
not a product test pass; provision isolated services/data again at execution and record versions.
Use owned Git roots with explicit synthetic GitHub origins/commits/branches, isolated app/diagnostic
SQLite databases and ports, network-denied fake gh executable selected via existing GH_BINARY seam,
and deterministic loopback model/provider. No user repositories, tokens, chats or paid calls.

Browser runs use an isolated Docker stack with a test-only mounted executable configured at API
startup, real BFF/API/persistence and actual UI. Its normal API_PROXY_URL=http://api:3000
topology must continue denying diagnostics export with403; it cannot prove successful V1 export.
Use the existing managed-loopback Chromium path in
`apps/desktop/e2e/support/chatReplyJourney.ts`/`contextTokenFixture.ts` for the separate required
browser export journey: managed API on owned loopback ports, standalone renderer with the existing
server-only diagnostics capability/host setup. Preserve local-diagnostics-server checks; do not
copy capabilities to browser code or relax loopback validation. Do not mutate a shared live API environment or replace
its routes with page mocks. Electron runs use the existing managed API/standalone renderer fixture,
real native export/save flow with test picker destination, and disposable data. If a tool effect uses
a VM/command fixture, disclose that boundary; these tests do not qualify VM isolation or distribution.
Actual packaged VM qualification is the existing protected staging gate, not a new local requirement.

## Scenario matrix

| ID / requirements | Inputs and actions                                                                                                                                                                                                   | Expected assertions and evidence                                                                                                                                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-T01 / R1,R7    | Run real API + owned Git + executable gh that announces ready and holds; start checks and PR list concurrently, then issue health and session reads. Repeat on baseline and fix.                                     | On fix unrelated requests complete before release, within 1 second in isolated local/API test; capture child markers and request order. Baseline must demonstrate blocking or be explicitly reported inconclusive; a fast fake or Promise.all alone is not proof.                                                                               |
| GR-T02 / R1,R5    | Existing projectsRouter tests plus version/auth failure, missing remote/HEAD/CLI, valid PR, no-PR fallback, open PR list, malformed JSON.                                                                            | Same response schemas, summaries, unavailable flags and existing malformed-success 502; exact repo/branch/SHA args, limit30, no broad workflow history or secret output.                                                                                                                                                                        |
| GR-T03 / R2,R3    | Stall each command stage; overflow combined output; fixture ignores TERM and spawns descendant; abort before spawn and mid-read.                                                                                     | Entire operation ends by 10s + 750ms cleanup (controlled timing tolerance recorded, never increased as repair). No subsequent fallback after exhausted budget; process/group and pipe cleanup, listeners/timers/slots released once. Use real child tests plus fake clock boundary tests.                                                       |
| GR-T04 / R2,R3    | Hold four operations; send fifth; cancel one and issue a fresh read.                                                                                                                                                 | At most four operation slots, one child per operation at a time; fifth returns safe busy unavailable without queue/spawn; healthy fresh request succeeds after capacity frees. No shared cancellation or cross-project output.                                                                                                                  |
| GR-T05 / R4       | Change branch, HEAD, origin or remove repo while a child is held; test detached HEAD, no PR, two Projects and adversarial branch/path strings.                                                                       | Explicit captured PR branch and full-SHA fallback; no mixed-identity success, safe unavailable on final mismatch; no shell interpretation, unrelated effects or cross-project checks.                                                                                                                                                           |
| GR-T06 / R6       | Existing PR-create validations plus successful fake creation followed by auth/query/parse/timeout failure or disconnect during enrichment.                                                                           | Creation invoked exactly once; known created PR retained and list unavailable/checks omitted when enrichment fails. No validation bypass, no new retry, no mutation after failed precondition. Successful enrichment still works.                                                                                                               |
| GR-T07 / R3       | Direct API socket disconnect, and actual aborted GET through BFF; also exercise non-Git GET and POST proxy regression.                                                                                               | Owned read is terminated/reclaimed; no write after closed response or unhandled rejection. Only two target GET paths gain forwarded cancellation. Navigation alone is not counted as a disconnect.                                                                                                                                              |
| GR-T08 / R1,R4,R7 | Two browser modes: Docker UI starts held checks/list and sends allowed tool chat; verify expected export denial. Managed-loopback Chromium repeats overlap and performs successful diagnostic export; release reads. | Docker reply, file effect and health finish while reads remain held; diagnostics remains403. Managed browser additionally exports successfully while held; correct checks after release in both. Read SQLite/audit and managed V1 report independently for context/model/tool events, identity, honest health/drop flags and content redaction. |
| GR-T09 / R3,R5,R7 | Actual Electron same overlap + timeout then healthy refresh; denied/cancelled agent action under held reads; native Save As export and restart readback.                                                             | No lost reply/diagnostic503 caused by held read; correct unavailable/recovery UI, no denied effect after terminal settlement, report bytes written and parseable. Persisted messages/events survive restart, without re-executing tools.                                                                                                        |
| GR-T10 / all      | Final cumulative regression and source-aware review.                                                                                                                                                                 | API suite, relevant BFF tests, browser/Electron journeys, diagnostics performance suite, affected workspace gates and current hosted CI/reviews all clear; exact source/evidence/mirror provenance recorded.                                                                                                                                    |

For GR-T08/09 use a controlled eight-second external hold as a failure safety limit; prove required
operations finish before release. Keep the 1-second criterion for lightweight health/session probes;
chat/provider/tool and supported managed-browser/native export retain their existing scenario deadlines and must finish during the held
window. If existing startup or tool setup cannot fit, finish setup before holding the CLI rather than
relax the acceptance or production deadlines. Stable fixtures explicitly signal ready/release/exit.
Durable report expectations use a healthy isolated diagnostics store; inject unavailable/locked
conditions in existing diagnostics regressions and require honest degraded status, never fabricated
complete telemetry. Inspect V1 reports at investigation, changed-journey and final review checkpoints.

## Commands, evidence and completion

Use Node24, `WORKFLOW_GIT_BINARY=/usr/bin/git`, one Vitest fork and tracing off for isolated tests.
Run focused new subprocess/API tests with the affected package test command, then complete API tests;
BFF Vitest where changed. Register Docker browser `e2e/github-read-responsiveness.spec.ts` plus managed Chromium and Electron modes in
`apps/desktop/e2e/github-read-responsiveness.e2e.ts` in existing configs with isolation so hosted CI
actually discovers them. Reuse existing context/reply/diagnostic fixture helpers only where their
boundaries match. Full `pnpm build`, `pnpm typecheck`, `pnpm lint`, formatting of touched files,
`pnpm deps:check-cycles`, docs checks and normal hooks remain required before delivery.

Retain exact source hashes, process-ready/exit logs, bounded timings, browser traces/screenshots,
Electron traces, network request IDs, session/run/attempt IDs, safe diagnostic exports, synthetic
SQLite/audit/effect readbacks, cleanup verification and critic findings outside build/lint inputs.
No credential-bearing environment dumps or raw real provider payloads. Failed or missing required
evidence blocks completion. Report pass/fail/skip/blocked/not-run separately; live GitHub/provider
compatibility remains untested by doubles. Do not infer a historical stall's sole cause from success.

The original planning checkpoint covered documents/links/source traceability only. Actual GR-T
results, retained first failures, source hashes and coverage limits are recorded in the linked review.
