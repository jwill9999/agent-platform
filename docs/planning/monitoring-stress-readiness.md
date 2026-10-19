# Monitoring preparation before the owner trial

Status: bounded repair planning, 19 October 2026. This is not stress-test sign-off.
Baseline: staging `50f6e1b50879ad17420ada89cf87f3f4f080066a`, tree
`fc553adaf2e6707a92617baa4a64810de112dcef`.

## Objective and authority

The owner requested preparation for the agreed testing and observability trial. Existing
Stop/monitoring authorization covers necessary bounded repairs, regression tests and independent
review. A subsequent explicit grant permitted one paid model request: the actual retained app
returned `Connection OK.` through OpenAI using its stored configuration. That request is consumed;
there is no permission for more agent-paid calls, new credentials or dependency upgrades here.

The original recording failure remains unexplained. A clean restart/current window is evidence of
recovery, not proof of a cause or permanent fix. Two existing P1 records block the owner trial.

The owner subsequently requested batching related changes to avoid a separate PR/review/pipeline
cycle for every small repair. Keep these two related fixes and their documentation in one cumulative
PR directly into protected staging; a separate focused PR is reserved for an urgent blocker that requires it. Use local
scoped commits/task tips, then normal combined push hooks and hosted qualification. This does not
combine held upgrades, paused orchestration or unrelated work, or weaken any completion gate.

## Task and document manifest

| Task                                                   | Specification                                                                          | Order and destination                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `agent-platform-desktop-fixture-log-isolation`         | [Owned test logs](../tasks/agent-platform-desktop-fixture-log-isolation.md)            | Accepted local first tip `task/desktop-fixture-log-isolation` at staging50f6                                            |
| `agent-platform-monitoring-storage-failure-provenance` | [Failure provenance](../tasks/agent-platform-monitoring-storage-failure-provenance.md) | `task/monitoring-failure-provenance` follows the accepted local first tip; one final PR directly into protected staging |
| `agent-platform-local-mvp-stress-review`               | [Owner trial](../tasks/agent-platform-local-mvp-stress-review.md)                      | Remains OPEN behind both P1 repairs and actual app readiness                                                            |

[Verification](../testing/monitoring-stress-readiness.md) separates planned checks from
[results and critique](../reviews/monitoring-stress-readiness.md). The worktree is
`~/.codex/worktrees/monitoring-stress-readiness/agent-platform`. The running owner checkout,
documentation PR379 delivered at stagingdee20500, held dependency work, main and paused orchestration remain separate.

## Bounded requirements

- LOG01: every managed Electron test launch explicitly selects an owned disposable log directory.
- LOG02: launching, failing, restarting and cleaning a fixture preserve unrelated sentinel logs;
  fixture artifacts retain its own failure evidence before cleanup.
- OBS01: retain a privacy-safe first storage-failure observation, distinguishing operation and cause
  without changing failure, loss accounting, timeout, retry, permission or durability behavior.
- OBS02: make that observation inspectable when the failed store cannot answer a read, and retain
  the agreed evidence across the selected restart path. Do not call process memory or stdout durable.
- OBS03: preserve the original failure and report unknown causes and incomplete coverage truthfully.
- PRE01: before the owner trial, verify actual staged source, recording/export/restart, saved model
  response, at least20 GiB free and the bounded workload/cost/stop rules in the existing trial spec.

## Implementation boundaries

Fix fixture configuration, not production log-path resolution, for LOG01/02. Audit all launch sites,
including shared launch helpers. No local native fixture starts before the isolation fix and its
non-native guard/sentinel checks pass. Never point a fixture at the owner's profile or logs.

OBS01/02 have a bounded source-aware design critique before implementation. Initial review found that
successful window exports return503 after a store failure, while private status can read health
without RPC; supervisor logs are currently truncated on normal launch. A successful-report-only or
log-only addition is insufficient. The provenance spec now defines a strict first-failure health
snapshot plus two small independent private artifacts, one per store, with asynchronous exclusive
atomic publication and honest retention states. No generic log policy or automatic recovery changes
and no cross-store failure recursion. Frozen revised documents and implementation require review.

Keep append1000ms, read200ms, startup3000ms, existing close bounds, busy retry, batch32/queue256,
sampling30seconds and DELETE/FULL durability unchanged. No package/SDK upgrade, new telemetry
service, dashboard, account, global setting, Docker gateway or paused orchestration change.

## Delivery and stopping point

Use the owner-directed single batched task-to-staging route, normal hooks, independent review and
all current-head hosted gates/comments. Green gates do not independently grant merge authority.
The repairs are not complete until their declared delivery and evidence checks pass. Only then
recheck the actual owner app and invite the bounded owner trial. The trial itself remains separate;
no success or production readiness is inferred from this repair or one model response.
