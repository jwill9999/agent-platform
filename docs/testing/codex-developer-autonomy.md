# Codex developer autonomy verification

Planned scenarios below are not results. Results: [review/report](../reviews/codex-developer-autonomy.md).
Requirements: [AUT-01–08](../tasks/agent-platform-codex-autonomy-plan.md).

| Scenario | Requirements / owner task     | Action and independent oracle                                                                                                                                                           | Expected evidence                                                                                                                              |
| -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01     | AUT-01–04 / policy + guidance | Parse project/all six profile TOML; absence of sandbox/approval/network override and custom concurrency; semantic native critic traverses AGENTS/shared/skills/ADR links                | Valid profiles; native tools/default route; routine details don't request approval; no-tool gate absent                                        |
| V-02     | AUT-05–08 / all               | SHA-256 before/after of 789 protected files, paused dirty 13 files, global config/skills, automation status; supplemental all worktree dirty hashes                                     | Identical protected bytes; all four recorded monitors paused; no prototype resumption                                                          |
| V-03     | AUT-06 / acceptance           | Existing harness approvalPolicy/pathJail/toolDispatch and API approvalRequestsRouter tests after build                                                                                  | Approved path effects retained; denied/path escape has no prohibited effects; permissions/approval persistence unchanged                       |
| V-04     | AUT-03–05 / guidance          | Inspect app imports, CLI/MCP registration, scripts/hooks and workspace participation                                                                                                    | No automatic managed launch; package remains in recursive gates; bootstrap commands documented as explicit paused prototype                    |
| V-05     | AUT-01/04/08 / acceptance     | Fresh native session/critic reads changed files and reports actual observed tools and effective config; bounded disposable development smoke                                            | Adoption observed; no unsupported inherited-tool isolation claim; unavailable capability reported                                              |
| V-06     | AUT-01/03/06 / acceptance     | Specify later owner-selected representative product ticket with implementation, connected QA, repair, native source review and CI; use this cleanup as bounded native development smoke | No intermediate approval for smoke; no claim that future product journey was run; no pilot or paid call                                        |
| V-07     | AUT-02/08 / acceptance        | Explicit changed Markdown/skill formatting and relative-link validation; normal affected gates; exact-head PR checks and unresolved-review inspection                                   | All required executed CI succeeds; staging-only packaged VM may skip on feature-target PR; full mirrors read back; owner code review requested |

No new tests merely duplicating prose. Retain every product/prototype security test unchanged.
V-01 uses TOML structural checks plus independent semantic source review. V-02 uses external
hash comparison, not a permanent machine-specific unit test. For this docs/profile change no
new product UI/API behavior is introduced; connected product E2E remains required on later tickets
that change such behavior. Hosted general E2E is still inspected when CI executes it.

Environments: Node24/pnpm9 frozen dependencies, Python3.11+ TOML parser, existing local Docker
only for repository tooling; no managed launch. Native tests use disposable SQLite/files/temp roots.
Hosted feature-target workflows: verify, Docker/API-web E2E, desktop Linux build, docs/lychee,
CodeQL/Sonar/security checks as actually registered. Inspect current-head checks, latest attempts,
review findings/threads and artifact links; prior branch checks do not validate this tip.

Fresh session must use actual platform defaults. Do not add blanket network/full-access settings.
If CLI session needs a paid external call, do not run it: use native collaboration within the existing
session, record actual adoption/tool observations, and disclose any parent-default/profile reload
limitation. Product acceptance ticket is deferred, not a blocker fabricated from pilot prerequisites.

Final review material includes exact source SHA, scoped diff, independent verdict/findings/dispositions,
commands/counts/logs, preserved-byte report, profile/default observations, all hosted check URLs,
full Notion mirror receipts and unapplied global follow-ups. Owner final acceptance is not fabricated.
