# GitHub read responsiveness — bounded local MVP plan

Status: proposed v2, planning only; owner review required before implementation.
Date: 14 October 2026. Owning Beads bug: `agent-platform-d185` (P2, planning in progress).

## Outcome and stopping point

Keep chat, health requests and diagnostic export responsive while a Project loads slow or unavailable
GitHub checks or pull requests. Stop when the two read paths are bounded and nonblocking, their
identity and failure behavior are preserved, and connected browser/Electron evidence proves the
improvement. This is one bug fix with three implementation slices, not a new Git platform.

## Evidence and limits

Baseline: staging `1e4bd7af30b092cc9a2d795e9c022ebfd5212176`, the delivered reply fix.
The separate handoff PR319 at `161ebfd3` remains separate; no dependency or merge is assumed.

- [projectsRouter](../../apps/api/src/infrastructure/http/v1/projectsRouter.ts): `ghValue` and
  `ghSuccess` use synchronous child execution with a 10-second timeout per command. Checks call
  version/auth/PR view/commit fallback; PR listing calls version/auth/list. Both GET handlers block
  the API event loop despite being wrapped in `asyncHandler`.
- The same helpers serve writes. `createProjectGithubPullRequest` also calls both read functions
  after successful creation. A global async replacement would risk unawaited validation and writes.
- Checks currently infer the PR branch from the working directory, but commit fallback uses full
  HEAD. Introducing awaits creates branch/remote/HEAD races that must be handled explicitly.
- [API tests](../../apps/api/test/projectsRouter.test.ts) cover PR checks, commit fallback, missing
  remote, listing and create validations using real Git and executable fake gh. They do not prove
  overlapping API responsiveness, disconnect cleanup or identity changes during an in-flight read.
- [BFF](../../apps/web/app/api/v1/[...path]/route.ts) does not forward request cancellation;
  [API client](../../apps/web/lib/apiClient.ts) has no GET signal option. Do not equate navigation
  with cancellation. The Activity panel already loads changes/checks/PRs together.
- Existing evidence under `/Users/letuscode/.codex/context-token-plan-20261013` records GitHub checks
  at 1.47–5.35 seconds and queued changes at 0.63–4.43 seconds, versus local Git at 62–73 ms.
  The reply investigation additionally recorded a correct session POST taking 4.44 seconds.
  These support this target but do not prove the sole cause of historical export or test failures.

## Requirements

| ID    | Proposed behavior                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GR-R1 | Both checks and open-PR GET paths use asynchronous subprocess reads, including version/auth and their local Git identity reads. No synchronous subprocess remains in these two request chains.                                                                                                                                                                                                                                                     |
| GR-R2 | One 10-second wall-clock deadline per read operation, covering metadata, version/auth, query/fallback and final identity check; never reset per command. Combined stdout/stderr is capped at 1 MiB per child. At most four read operations run concurrently per API process; excess requests return the existing unavailable shape with a safe busy reason, without a queue. No cache or automatic retry.                                          |
| GR-R3 | Timeout, output overflow and client disconnect terminate owned subprocesses, settle once and release timers/listeners/capacity. Use a short bounded termination grace (250 ms TERM then KILL, at most a further 500 ms cleanup). Exercise macOS/Linux process-group cleanup, including a descendant fixture. Never kill unrelated processes or wait indefinitely for inherited pipes.                                                              |
| GR-R4 | Capture canonical repository root, origin slug, branch and full HEAD. Address PR lookup by captured branch with explicit repository; pin commit fallback to captured SHA. Recheck identity before returning; changed/missing repository, branch, remote or HEAD means safe unavailable, not a mislabeled success. Do not retry against a different identity.                                                                                       |
| GR-R5 | Preserve existing schemas, check summaries, PR-first/commit-fallback semantics and open-PR limit 30. Missing CLI/auth/read failure returns honest unavailable; malformed successful JSON keeps existing 502 behavior. No raw stderr, credentials or subprocess arguments in user errors/logs. Keep current configured GH binary, no-shell argument arrays, Project path validation and credentials behavior; no new environment/secret forwarding. |
| GR-R6 | Await updated readers in all callers. After a successful PR creation, enrichment failure must still return the known created PR plus an unavailable list and no misleading checks; never retry or repeat the mutation. Cancellation before/during mutation is not redesigned. Only adapt the post-success enrichment boundary, with regression proof.                                                                                              |
| GR-R7 | Real browser/BFF/API and Electron/managed API journeys show chat completion, durable context/model/tool events and readable safe diagnostic export while a read is held. Existing V1 health, drop and timeout reporting stays honest. No timeout increases to hide stalls.                                                                                                                                                                         |

The 10-second total budget is deliberately tighter than today's multiple 10-second command budgets;
it bounds the panel wait, not agent execution or diagnostics limits. Four slots and 1 MiB are small
fixed implementation constants, tested at their boundaries, not a new settings product.

## Scope and exclusions

Expected implementation areas: a focused helper under `apps/api/src/infrastructure/projects/`,
`projectsRouter.ts`, associated API tests, and the existing BFF route limited to the two GET paths
for request-signal propagation. Fixtures and scenarios live under `e2e/` and `apps/desktop/e2e/`;
update their configs only to isolate/register these journeys. Do not add dependencies.

Keep synchronous Git writes, repository create/connect, push/pull/commit, write authentication,
UI redesign, generic caching/job queues, all-route cancellation, new telemetry schemas/dashboards,
local-model selection, release distribution and paused orchestration out of scope. Local filesystem
validation is retained; this is not a guarantee against every filesystem stall. No paid model calls,
real GitHub mutations or new accounts are required. No ADR change: follow ADR-0005/native workflow.

Browser navigation is not guaranteed to cancel existing panel requests. Forward an actual aborted
incoming request only for these two GETs; API-level disconnect and BFF signal tests prove that
bounded contract. The deadline remains the safety net when a client does not propagate cancellation.

## Task, branch and document manifest

| Item                          | Mapping                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Existing task                 | `agent-platform-d185` — Avoid blocking API diagnostics while retrieving GitHub checks                                          |
| Origin relationship           | `discovered-from` closed `agent-platform-context-optimisation`; not a blocking dependency or parent epic                       |
| Blocking upstream/downstream  | None currently; do not manufacture a new epic or dependency on PR319                                                           |
| Repository/worktree           | `jwill9999/agent-platform`; `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`                        |
| Actual planning branches      | `feature/github-read-responsiveness` from staging1e4bd7af; `task/github-read-responsiveness-plan` from feature                 |
| Proposed implementation chain | `task/github-read-responsiveness` from pushed plan tip, then `task/github-read-verification`; one cumulative tip PR to feature |
| Destination                   | Feature integration, later protected staging only with actual owner merge authorization; never main                            |
| Specification                 | [d185](../tasks/agent-platform-d185.md)                                                                                        |
| Verification                  | [scenario contract](../testing/github-read-responsiveness.md)                                                                  |
| Critique/results              | [review record](../reviews/github-read-responsiveness.md)                                                                      |
| Policy                        | [native development](../development/codex-development.md), [ADR-0005](../adr/0005-native-codex-development.md)                 |

The coordinator owns implementation, final integrated evidence, Beads and publication; a distinct
critic owns source-aware review. These are procedural assignments, not technical tool isolation.

## Delivery and effort

1. Reproduce blocking with a child-ready/hold/release fixture and two simultaneous reads. Record
   baseline ordering/failure; audit shared callers before changing source.
2. Add bounded async reads, identity validation, cancellation and caller adaptation. Complete API
   regression/security tests before connected runs.
3. Run Docker browser concurrency with expected export denial, plus managed-loopback browser and
   Electron concurrent chat/tool/diagnostic journeys, inspect V1 reports and retained
   failures, obtain independent implementation review, publish actual results and open the tip PR.

Estimate: 2–3 focused development days including verification/review, excluding CI queue time.
Checkpoint after reproduction and again after API integration. If the required fix expands into Git
write lifecycle, a new scheduler, global auth, or unavailable infrastructure, return with the concrete
finding and a bounded alternative instead of expanding silently. One diagnosed unchanged retry is
reasonable for an external/transient failure; recurring failure requires evidence-backed repair or
explicit blocker, never raised timeouts, skipped required checks or endless reruns.

Current authority is planning only. Product tests below are planned, not passed. Implementation,
owner acceptance, feature merge and staging promotion remain distinct gates.
