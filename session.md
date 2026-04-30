# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-04-26
- **Session:** `task/agent-platform-7d1` merged into `feature/agent-platform-ui-ux` and closed in Beads. Next chain task started: `task/agent-platform-de4` claimed (`in_progress`).
- **Date:** 2026-04-27
- **Session:** Completed UI input refactor and feedback-only changes; closed `agent-platform-de4`, `agent-platform-ucg`, and `agent-platform-lt6` in Beads.
- **Date:** 2026-04-29
- **Session:** Created HITL epic/task specs and branches; completed `agent-platform-hitl.1` deny-by-default approval gate on `task/agent-platform-hitl.1`.
- **Date:** 2026-04-29
- **Session:** Addressed Sourcery review feedback for HITL.1 approval gating and audit risk-tier handling.
- **Date:** 2026-04-29
- **Session:** HITL.1 was merged into `feature/agent-platform-hitl`; completed `agent-platform-hitl.2` approval request persistence/API on `task/agent-platform-hitl.2`.
- **Date:** 2026-04-29
- **Session:** HITL.2 was merged into `feature/agent-platform-hitl`; started `agent-platform-hitl.3` on `task/agent-platform-hitl.3`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-hitl.3` approval-required NDJSON events on `task/agent-platform-hitl.3`; ready for PR into `feature/agent-platform-hitl`.
- **Date:** 2026-04-29
- **Session:** Addressed HITL.3 review feedback: pending approvals now audit as pending, approval output has a fallback renderer, and API stream tests assert no assistant text leaks on approval halt.
- **Date:** 2026-04-29
- **Session:** HITL.3 was merged into `feature/agent-platform-hitl`; claimed next task `agent-platform-hitl.4` and created `task/agent-platform-hitl.4` from the updated feature branch.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-hitl.4` durable approval resume execution on `task/agent-platform-hitl.4`; ready for PR into `feature/agent-platform-hitl`.
- **Date:** 2026-04-29
- **Session:** Queried SonarCloud PR `#93` duplicate-code metrics; refactored shared chat test helpers and amended `agent-platform-hitl.4`.
- **Date:** 2026-04-29
- **Session:** Refactored `chatRouter.ts` runtime error/finalization helpers to clear remaining SonarCloud duplicate-code block.
- **Date:** 2026-04-29
- **Session:** HITL.4 was merged into `feature/agent-platform-hitl`; selected `agent-platform-hitl.5` as the next epic task.
- **Date:** 2026-04-29
- **Session:** Started HITL.5 frontend approval UX: hook state, inline approval cards, decision/resume handling, and focused tests.
- **Date:** 2026-04-29
- **Session:** Fixed OpenAI tool-schema rejection for MCP schemas using unsupported `propertyNames` keyword.
- **Date:** 2026-04-29
- **Session:** Fixed replay of unresolved pending approval tool calls causing OpenAI missing tool response errors.
- **Date:** 2026-04-29
- **Session:** Fixed HITL approval resume to reuse the selected model config and block new prompts while an approval is unresolved.
- **Date:** 2026-04-29
- **Session:** Fixed approval-resume draft accumulation across DoD revisions and stopped DoD cap failures from showing as global chat errors.
- **Date:** 2026-04-29
- **Session:** Added spacing above the final critic review block in chat output.
- **Date:** 2026-04-29
- **Session:** Made shell command failure results feed back to the assistant in plain language instead of raw stdout/stderr/exitCode jargon.
- **Date:** 2026-04-29
- **Session:** Refactored duplicated HITL stream/lifecycle handling in `chatRouter.ts` and `use-harness-chat.ts` for SonarCloud PR 94.
- **Date:** 2026-04-29
- **Session:** `feature/agent-platform-hitl` merged into `main`; closed `agent-platform-hitl.5` and auto-closed HITL epic in Beads.
- **Date:** 2026-04-29
- **Session:** Planned next epic `agent-platform-ws` for host workspace storage, with six chained Beads tasks and task specs.
- **Date:** 2026-04-29
- **Session:** Started workspace storage epic on `task/agent-platform-ws.1`; documented host workspace conventions and config names for Linux, macOS, and Windows.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.1a` platform behavior: workspace config resolver, `make workspace-init`, startup lifecycle wiring, and PathJail-backed file path normalization.
- **Date:** 2026-04-29
- **Session:** Added backlog task `agent-platform-ws.6` for guarded host workspace data removal on uninstall/reset.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.2` Docker runtime mount wiring: `/workspace` and `/data` are host-backed through workspace env vars, with compose/docs/tests updated.
- **Date:** 2026-04-29
- **Session:** Fixed CI E2E startup for `agent-platform-ws.2` by adding `make workspace-init` before `docker compose up`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.3` workspace PathJail/tool-policy enforcement on `task/agent-platform-ws.3`.
- **Date:** 2026-04-29
- **Session:** Addressed SonarCloud regex backtracking risk in the `agent-platform-ws.3` bash workspace policy.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.4` workspace file UI/API on `task/agent-platform-ws.4`.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-ws.6` guarded workspace data cleanup flow on `task/agent-platform-ws.6`.
- **Date:** 2026-04-29
- **Session:** Fixed the `agent-platform-ws.6` E2E pipeline failure in `workspace-init.mjs`; GitHub pipelines are passing.
- **Date:** 2026-04-29
- **Session:** Started `agent-platform-ws.5` final workspace verification on `task/agent-platform-ws.5`; added compose persistence/security verification and Workspace UI e2e coverage.
- **Date:** 2026-04-29
- **Session:** Added user-facing workspace storage documentation and README references for setup, security, cleanup, UI/API, and verification behavior.
- **Date:** 2026-04-29
- **Session:** `task/agent-platform-ws.5` merged into `feature/agent-platform-workspace-storage`; removed generated workspace test artifacts from the feature-to-main PR.
- **Date:** 2026-04-29
- **Session:** `feature/agent-platform-workspace-storage` merged into `main`; workspace epic and all child tasks are closed in Beads.
- **Date:** 2026-04-29
- **Session:** Started post-epic harness capability review; converted top-level architecture diagrams to Mermaid and added a coding/general automation gap-analysis report.
- **Date:** 2026-04-29
- **Session:** Added memory management architecture covering short-term memory, long-term memory, and self-learning from mistakes.
- **Date:** 2026-04-29
- **Session:** Created Highest-Value Additions epics in Beads and added matching epic specification files under `docs/tasks/`.
- **Date:** 2026-04-29
- **Session:** Broke down `agent-platform-code-tools` into seven Beads child tasks with detailed linked specs.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-code-tools.1` on `task/agent-platform-code-tools.1`; added coding runtime baseline policy, API runner CLI installs, runtime verification wiring, and documentation links.
- **Date:** 2026-04-29
- **Session:** Completed `agent-platform-code-tools.2` on `task/agent-platform-code-tools.2`; documented coding tool contracts, shared evidence artifacts, audit events, and truncation/storage rules.
- **Date:** 2026-04-30
- **Session:** Fixed chat UI/model-config override and API-key error leakage on `task/ui-chat-api-key-error-redaction`.
- **Date:** 2026-04-30
- **Session:** Follow-up local fix: chat now leaves agents without an assigned model config on the platform default path, and the Next.js BFF no longer injects its own env key as an explicit API override.
- **Date:** 2026-04-30
- **Session:** Added ignored local runtime-config backup/restore support for encrypted saved model configs, agent model assignments, and MCP server assignments.
- **Date:** 2026-04-30
- **Session:** Created Beads follow-up `agent-platform-runtime-backup-auto` and task spec for stage-two automatic runtime-config backup refresh.
- **Date:** 2026-04-30
- **Session:** Addressed SonarCloud hotspot `javascript:S4036` by using a fixed absolute sqlite3 path for runtime-config backup.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.3` structured edit tool on `task/agent-platform-code-tools.3`.
- **Date:** 2026-04-30
- **Session:** Follow-up Sonar cleanup on `task/agent-platform-code-tools.3`: deduplicated coding-envelope audit log tests.
- **Date:** 2026-04-30
- **Session:** Verified `agent-platform-code-tools.3` is closed, pushed, and paused before starting `agent-platform-code-tools.4`.
- **Date:** 2026-04-30
- **Session:** Started `agent-platform-code-tools.4` on `task/agent-platform-code-tools.4`; implemented read-only git status/diff/log/branch/changed-file tools with focused tests.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.4` read-only git tools on `task/agent-platform-code-tools.4`.
- **Date:** 2026-04-30
- **Session:** `task/agent-platform-code-tools.4` pipelines are green; claimed `agent-platform-code-tools.5` and created `task/agent-platform-code-tools.5`.
- **Date:** 2026-04-30
- **Session:** Implemented `agent-platform-code-tools.5` governed quality-gate runner on `task/agent-platform-code-tools.5`.
- **Date:** 2026-04-30
- **Session:** Completed `agent-platform-code-tools.5` governed quality-gate runner; Beads is closed/synced and the branch is ready for PR after push.
- **Date:** 2026-04-30
- **Session:** Reverted IDE folder-picker follow-up commits and disabled runtime chat evaluator nodes so internal DoD/critic JSON cannot replace normal assistant responses.
- **Date:** 2026-04-30
- **Session:** Created follow-up `agent-platform-ide-rethink` to reassess the browser IDE/code viewing direction before further implementation.
- **Date:** 2026-04-30
- **Session:** Fixed quality-gate package filters so chat agents can run lint/typecheck/build/test when they infer workspace paths such as `apps/web`.
- **Date:** 2026-04-30
- **Session:** Fixed CI unit-test failure in `qualityGateTool.test.ts` by resolving pnpm from absolute npm/pnpm environment paths before local fallback paths.
- **Date:** 2026-04-30
- **Session:** Closed out `agent-platform-code-tools.5` after green pipelines; claimed `agent-platform-code-tools.6` and created `task/agent-platform-code-tools.6` from the `.5` chain tip.
- **Date:** 2026-04-30
- **Session:** Implemented `agent-platform-code-tools.6` repository map, code search, and related-test discovery tools on `task/agent-platform-code-tools.6`.
- **Date:** 2026-04-30
- **Session:** Started `agent-platform-code-tools.7` on `task/agent-platform-code-tools.7`; changed chat tool activity to render separately from final assistant text and collapse after completion.

### Session-close guardrail (required)

- Local-only changes are not complete.
- Before ending a task/session, ensure work is committed and pushed to `origin`.
- Verify the remote branch/ref exists (for example `git ls-remote --heads origin <branch>` or `git status -sb` showing `origin/<branch>` tracking).
- `--no-verify` is high-risk: it skips Husky/local checks. If used, you must run the skipped build/typecheck/test checks manually and confirm they pass before closing work.

---

## What happened (this session)

### Chat UI model-config and stream error handling fixed

Branch state: `task/ui-chat-api-key-error-redaction` contains an unrelated UI/runtime bug fix before continuing the coding-tools epic.

- Changed the chat page to default the model selector to the selected agent's saved model config instead of blindly using the first stored config as a request override.
- Follow-up: changed the chat page so agents without an assigned saved model config send no `modelConfigId`, preserving the platform default model/key path.
- Follow-up: changed the Next.js `/api/chat` proxy so it forwards only an explicit caller `x-openai-key`; it no longer turns `AGENT_OPENAI_API_KEY`/`NEXT_OPENAI_API_KEY` from the web process into an API override.
- Follow-up: changed the API model resolver so the first saved Settings > Models config with credentials is the platform default before env-var fallback.
- Follow-up: excluded `**/.next` from Docker build context and removed OpenAI key env injection from the web container so stale web bundles/env cannot override API model resolution.
- Runtime finding: workspace-storage changed Docker SQLite from named volume `agent-platform_sqlite_data` to host bind mount `.agent-platform/data/agent.sqlite`; the previously saved model configs were still in the old named volume.
- Migrated only `model_configs` and referenced `secret_refs` from the old named volume DB into the current host-mounted DB. Both restored OpenAI model configs pass `POST /v1/model-configs/:id/test`.
- Added focused regression tests for model selection precedence and BFF header forwarding.
- Added a harness regression test proving built-in system tools are passed to the SDK with provider-safe names and strict schemas.
- Added an API integration test proving chat uses an encrypted saved model config when the agent has no override and no env key is configured.
- Sanitized streamed NDJSON output, API stream error events, web stream error rendering, and observability task/error events so provider messages cannot leak API-key-shaped values.
- Added a `MODEL_AUTH_FAILED` stream code for provider authentication failures that happen after NDJSON headers are already sent.
- Added regression coverage for API post-header auth errors, web stream error rendering, harness NDJSON redaction, output guard OpenAI key detection, and observability redaction.

### Local runtime config backup added

Follow-up owner request: preserve local default agent/model/API-key/MCP setup across accidental DB wipes without committing secrets or encrypted secret material to Git.

- Added `scripts/runtime-config-backup.mjs` with `backup` and `restore` actions.
- Added `make runtime-config-backup` and `make runtime-config-restore`.
- Backup writes to ignored `.agent-platform/backups/runtime-config.sqlite` by default.
- Backup captures saved `model_configs`, referenced encrypted `secret_refs`, agent `model_config_id` assignments, `mcp_servers`, and `agent_mcp_servers`.
- Restore copies encrypted secret envelopes as-is; it does not decrypt or print API keys.
- Set local runtime data so seeded Personal assistant uses `gpt-5.4-nano` and seeded Coding uses `gpt-5.4`, then created a local ignored backup containing 2 model configs, 2 encrypted secret refs, 2 MCP servers, 1 agent MCP assignment, and 2 agent model assignments.
- Documented the recovery flow in `docs/workspace-storage.md`: `make reset`, `make runtime-config-restore`, `make restart`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness run test -- test/outputGuard.test.ts test/backpressure.test.ts`
- `pnpm --filter @agent-platform/web run test -- test/use-harness-chat.test.ts`
- `pnpm --filter @agent-platform/plugin-observability run test -- test/observability.test.ts`
- `pnpm --filter @agent-platform/web run test`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/plugin-observability run test`
- `pnpm --filter @agent-platform/web run typecheck`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/plugin-observability run typecheck`
- `pnpm --filter @agent-platform/web run lint`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/plugin-observability run lint`
- `pnpm --filter @agent-platform/api run test -- test/sessionChat.integration.test.ts` (run with escalation because Supertest binds local ports)
- `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts` (run with escalation because Supertest binds local ports)
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `node --test scripts/runtime-config-backup.test.mjs scripts/workspace-clean.test.mjs`
- `node --check scripts/runtime-config-backup.mjs`
- `node --check scripts/runtime-config-backup.test.mjs`
- `pnpm exec prettier --check scripts/runtime-config-backup.mjs scripts/runtime-config-backup.test.mjs docs/workspace-storage.md`
- `make runtime-config-backup`
- Restore smoke check against `/private/tmp/agent-platform-restore-check.sqlite`
- SonarCloud hotspot fix checks:
  - `node --test scripts/runtime-config-backup.test.mjs scripts/workspace-clean.test.mjs`
  - `node --check scripts/runtime-config-backup.mjs`
  - `pnpm exec prettier --check scripts/runtime-config-backup.mjs scripts/runtime-config-backup.test.mjs`
  - `pnpm lint`
  - `git diff --check`

### Runtime backup automation follow-up tracked

- Created Beads task `agent-platform-runtime-backup-auto`.
- Added `docs/tasks/agent-platform-runtime-backup-auto.md` describing the stage-two automation work: refresh the ignored local runtime-config backup after successful model config, agent assignment, MCP server, and agent MCP assignment writes.
- Synced Beads/Dolt remote state with `bd dolt push`.

### SonarCloud runtime backup hotspot fixed

- SonarCloud hotspot `AZ3btIyTPSDrC3lo9zwa` flagged `scripts/runtime-config-backup.mjs` for searching OS commands via `PATH`.
- Updated runtime-config backup to invoke `/usr/bin/sqlite3` by default instead of `sqlite3`.
- Added `SQLITE3_BIN` override support only when set to an absolute path.
- Added regression coverage that relative command overrides are rejected.

### Structured coding edit tool implemented

- Created `task/agent-platform-code-tools.3` from `task/agent-platform-code-tools.2`.
- Added shared coding tool schemas in `packages/contracts/src/codingTool.ts`.
- Added built-in `coding_apply_patch` as a medium-risk structured edit tool.
- The tool supports exact text replacement, create/append behavior when `oldText` is omitted, dry-run previews, changed-file output, diff stats, inline diff evidence, and coding evidence envelopes.
- Dispatch now enforces PathJail on nested patch operation paths before native execution and rejects traversal/symlink escapes before mutation.
- Audit logging now records `ok: false` coding envelopes as `error` or `denied` instead of `success`.

### Quality gate workspace path filters fixed

Follow-up from manual UI testing on `task/agent-platform-code-tools.5`: chat could call `run_quality_gate`, but lint requests inferred from UI/file context could send a safe workspace path such as `apps/web` as `packageName`. The tool contract only accepted scoped pnpm package names like `@agent-platform/web`, so validation denied the run before lint started.

- Extended the quality-gate input schema to accept `@agent-platform/<name>`, `apps/<name>`, and `packages/<name>`.
- Added runtime normalization from workspace package paths to the package name in that path's `package.json`.
- Kept execution constrained to pnpm allowlisted profiles and validated `@agent-platform/*` package names before command construction.
- Added harness coverage proving `packageName: "apps/web"` runs as `pnpm --filter @agent-platform/web run lint`.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run build`
- `pnpm --filter @agent-platform/contracts run typecheck`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
- `pnpm --filter @agent-platform/harness exec vitest run test/qualityGateTool.test.ts`
- `pnpm exec prettier --check packages/contracts/src/codingTool.ts packages/harness/src/tools/qualityGateTool.ts packages/harness/test/qualityGateTool.test.ts docs/coding-tool-contracts.md`
- `git diff --check`
- MCP trust guard now prevents MCP tools from shadowing `coding_apply_patch`.
- Added regression coverage for schema round-trips, coding tool allowlist behavior, dry-run/apply/create, binary denial, traversal denial, symlink denial, and coding audit statuses.

### Sonar duplicate-code follow-up

- Refactored duplicated coding-envelope setup in `packages/harness/test/toolAuditLog.test.ts` into a shared helper while keeping distinct error/denied status assertions.

### Read-only git tools implemented

- Created `task/agent-platform-code-tools.4` from the pushed `.3` chain tip.
- Claimed `agent-platform-code-tools.4` in Beads and synced Beads/Dolt.
- Added structured contracts for git status, diff, log, branch info, and changed-file result payloads.
- Added low-risk built-in tools: `sys_git_status`, `sys_git_diff`, `sys_git_log`, `sys_git_branch_info`, and `sys_git_changed_files`.
- Git tools use absolute `/usr/bin/git`, bounded output, workspace/repository scoping, structured coding evidence envelopes, and no mutating git commands.
- PathJail now treats `repoPath` as path-like, dispatch read-enforces all git tools, and MCP trust guard blocks git tool name shadowing.
- Added temporary-repo regression tests for clean/dirty status, staged/unstaged/untracked files, bounded diff truncation, log, branch info, non-repo denial, outside-workspace denial, and unknown tool IDs.
- Closed `agent-platform-code-tools.4` in Beads and synced Beads/Dolt.
- Pushed `task/agent-platform-code-tools.4`; GitHub pipelines passed green.

### Governed test runner task claimed

- Claimed `agent-platform-code-tools.5` in Beads and synced Beads/Dolt.
- Created `task/agent-platform-code-tools.5` from the `.4` chain tip.
- Added strict shared contracts for `run_quality_gate` input/output, profiles, failures, command display, timeout status, and bounded stdout/stderr tails.
- Added medium-risk built-in tool `sys_run_quality_gate` / `run_quality_gate`.
- The runner uses fixed profile-to-script mappings (`test`, `typecheck`, `lint`, `format`, `docs`, `build`, `e2e`), `execFile` without a shell, fixed absolute `pnpm` discovery, timeout controls, output truncation, and structured coding evidence.
- Arbitrary command-shaped input is denied by strict schema validation; package filters are limited to package-supported profiles.
- PathJail read-enforces `repoPath`, and MCP trust guard prevents MCP tools from shadowing `run_quality_gate`.
- Added regression tests for allowed passing runs, non-zero exits with failure summaries, timeout, truncation, arbitrary-command denial, unsupported package filters, workspace escape denial, registration, and unknown tool IDs.
- Completed broad terminal quality gates for `.5`.
- Closed `agent-platform-code-tools.5` in Beads and synced Beads/Dolt.

### Chat runtime evaluator leak fixed

- Manual testing found chat could return internal DoD criteria JSON, for example `{"criteria":[...]}`, instead of a normal assistant response.
- Reverted the three IDE folder-picker follow-up commits on `task/agent-platform-code-tools.5`; the bespoke IDE folder tree work is paused for a separate product/architecture rethink.
- Disabled critic/DoD evaluator nodes in the user-facing runtime chat graph for now, so the main assistant response is the only model output streamed back to chat.
- Added API regression coverage proving the chat runtime does not run DoD criteria-generation prompts and does not persist streamed criteria JSON as the assistant response.
- Created Beads follow-up `agent-platform-ide-rethink` with spec `docs/tasks/agent-platform-ide-rethink.md` for deciding whether to keep the bespoke browser IDE, integrate a proven editor/file browser, or rely on repository tools plus external IDE workflows.

### Quality-gate follow-ups completed

- Fixed quality-gate package filters so chat agents can send workspace paths like `apps/web` or `packages/harness`; the tool normalizes those paths to scoped pnpm package names before running allowlisted profiles.
- Fixed the GitHub Actions unit-test failure where `qualityGateTool.test.ts` only looked for Homebrew/system pnpm locations; tests now resolve absolute `npm_execpath` or `PNPM_HOME/pnpm` before local fallback paths.
- Latest `.5` pipeline was green after commit `8e27369`.

### Repository discovery tools implemented

- Added low-risk built-in tools `sys_repo_map` / `repo_map`, `sys_code_search` / `code_search`, and `sys_find_related_tests` / `find_related_tests`.
- Repository discovery uses a bounded Node walker, skips symlinks, excludes ignored directories such as `.git`, `.agent-platform`, `.next`, `dist`, `coverage`, `node_modules`, and `test-results`, and enforces workspace scoping through PathJail dispatch checks.
- `repo_map` returns bounded file summaries, package boundaries, detected test directories, ignored directory names, total counts, and truncation state.
- `code_search` supports literal and explicit regex search with bounded file bytes, result counts, snippets, line/column locations, and structured search evidence.
- `find_related_tests` maps source files to likely tests by basename and repository proximity, returning bounded structured evidence.
- Added shared contracts, schema round-trip coverage, harness tool tests, MCP shadowing protection, docs, and system tool registration.

### Coding tool visibility follow-up started

- Manual chat testing against `/workspace/scratch/demo-app` proved the `.6` repo discovery tools work when the target app is inside the runtime workspace.
- Finding: recoverable tool failures such as `WRITE_FAILED` / `ENOENT` were being surfaced as global chat errors even when the agent recovered and completed the task.
- Finding: streamed `tool_result` events were appended into the assistant's final markdown answer, leaving large tool-call JSON blocks permanently visible.
- Started `.7` and changed the web chat stream parser so tool-call placeholders, tool results, and recoverable tool errors are tracked as tool activity instead of answer text.
- Added a compact tool activity block that is open while streaming and collapses by default after the assistant answer completes, while remaining expandable for auditability.

## Current state

### Git

- **Current branch:** `task/agent-platform-code-tools.7`
- **Current base:** `465273b Implement repo discovery tools`
- **Latest completed task:** `agent-platform-code-tools.6` repository map and code search
- **Current work:** `.7` coding tools visibility and E2E validation is in progress; first UI/tool-activity fix is ready for manual test.
- **Remote sync:** Beads/Dolt is synced after claiming `.7`; branch should be pushed after this session update commit.

### Beads

- `agent-platform-code-tools.2` is closed.
- `agent-platform-code-tools.3` is closed.
- `agent-platform-code-tools.4` is closed.
- `agent-platform-code-tools.5` is closed.
- `agent-platform-code-tools.6` is closed.
- `agent-platform-code-tools.7` is claimed and in progress.
- New follow-up task `agent-platform-runtime-backup-auto` is open as a P2 standalone platform task.
- New follow-up task `agent-platform-ide-rethink` is open as a P2 product/architecture task.

### Quality

- SonarQube MCP was unavailable in this session; terminal checks were used as the fallback gate.
- Structured edit checks passed:
  - `pnpm --filter @agent-platform/contracts build`
  - `pnpm --filter @agent-platform/agent-validation build`
  - `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
  - `pnpm --filter @agent-platform/agent-validation run test -- test/allowlists.test.ts`
  - `pnpm --filter @agent-platform/harness run test -- test/codingEditTool.test.ts test/toolAuditLog.test.ts test/mediumRiskTools.test.ts test/toolDispatch.test.ts`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/agent-validation run typecheck`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/contracts run lint`
  - `pnpm --filter @agent-platform/agent-validation run lint`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test` (first sandboxed run failed at API Supertest local port binding only; escalated rerun passed)
- Sonar duplicate-code follow-up checks passed:
  - `pnpm --filter @agent-platform/harness run test -- test/toolAuditLog.test.ts`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm exec prettier --check packages/harness/test/toolAuditLog.test.ts`
  - `git diff --check`
- Read-only git tool focused checks passed:
  - `pnpm --filter @agent-platform/contracts build`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
  - `pnpm --filter @agent-platform/harness run build`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/harness run test -- test/gitTools.test.ts test/lowRiskTools.test.ts test/mcpTrustGuard.test.ts test/toolDispatch.test.ts`
  - `pnpm --filter @agent-platform/contracts run lint`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm exec prettier --check packages/harness/src/tools/gitTools.ts packages/harness/test/gitTools.test.ts`
- Broad `.4` completion checks passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test` (first sandboxed run failed at API Supertest local port binding only; escalated rerun passed)
  - `pnpm docs:lint`
  - `pnpm exec prettier --check session.md`
  - `git diff --check`
- `.4` GitHub pipelines passed green after push.
- Governed test runner focused checks passed:
  - `pnpm --filter @agent-platform/contracts build`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
  - `pnpm --filter @agent-platform/contracts run lint`
  - `pnpm --filter @agent-platform/harness run build`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/harness run test -- test/qualityGateTool.test.ts test/mediumRiskTools.test.ts test/toolAuditLog.test.ts test/mcpTrustGuard.test.ts test/toolDispatch.test.ts`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm exec prettier --check packages/contracts/src/codingTool.ts packages/harness/src/tools/qualityGateTool.ts packages/harness/test/qualityGateTool.test.ts`
- Broad `.5` completion checks passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test` (first sandboxed run failed at API Supertest local port binding only; escalated rerun passed)
  - `pnpm docs:lint`
  - `pnpm exec prettier --check session.md`
  - `git diff --check`
- Chat runtime evaluator fix checks passed:
  - `pnpm --filter @agent-platform/api run typecheck`
  - `pnpm --filter @agent-platform/api run lint`
  - `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts` (run with escalation because Supertest binds local ports)
- Quality-gate package-path and CI follow-up checks passed:
  - `pnpm --filter @agent-platform/harness exec vitest run test/qualityGateTool.test.ts`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm test` (run with escalation because API Supertest binds local ports)
  - pre-push harness build/typecheck/test
- Repository discovery focused checks passed:
  - `pnpm --filter @agent-platform/contracts run build`
  - `pnpm --filter @agent-platform/contracts run typecheck`
  - `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm --filter @agent-platform/harness run build`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm --filter @agent-platform/harness exec vitest run test/repoDiscoveryTools.test.ts test/mcpTrustGuard.test.ts`
  - `pnpm --filter @agent-platform/harness run test -- test/repoDiscoveryTools.test.ts test/mcpTrustGuard.test.ts test/toolDispatch.test.ts test/lowRiskTools.test.ts`
  - `pnpm docs:lint`
  - `pnpm exec prettier --check docs/coding-tool-contracts.md packages/contracts/src/codingTool.ts packages/harness/src/tools/repoDiscoveryTools.ts packages/harness/test/repoDiscoveryTools.test.ts packages/contracts/test/roundtrip.test.ts`
  - `git diff --check`
- Broad `.6` completion checks passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test` (run with escalation because API Supertest binds local ports)
- `.7` tool-activity UI focused checks passed:
  - `pnpm --filter @agent-platform/web run typecheck`
  - `pnpm --filter @agent-platform/web run lint`
  - `pnpm --filter @agent-platform/web run test -- test/use-harness-chat.test.ts`
  - `pnpm docs:lint`
  - `pnpm exec prettier --check apps/web/hooks/use-harness-chat.ts apps/web/components/chat/chat.tsx apps/web/components/chat/message.tsx apps/web/components/chat/tool-trace-block.tsx apps/web/app/page.tsx apps/web/test/use-harness-chat.test.ts docs/tasks/agent-platform-code-tools.7.md`
  - `pnpm exec prettier --check session.md docs/tasks/agent-platform-code-tools.7.md`
  - `git diff --check`

---

## Next (priority order)

1. Push `task/agent-platform-code-tools.7` with the tool-activity chat UI fix.
2. Manual test the chat flow with `/workspace/scratch/demo-app`: create app, map repo, search symbol, find related tests.
3. Keep the IDE/file-tree integration as a separate follow-up under `agent-platform-ide-rethink`.

---

## Blockers / questions for owner

- No code blockers.

---

## Key references

| Document                                  | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `docs/architecture.md`                    | System design, package roles, data flow    |
| `docs/architecture/message-flow.md`       | Mermaid diagrams: chat → LLM → tools       |
| `docs/api-reference.md`                   | REST endpoints, error shapes, schemas      |
| `docs/configuration.md`                   | Env vars, model routing, limits, MCP setup |
| `docs/workspace-storage.md`               | Workspace setup, security, cleanup, tests  |
| `docs/planning/lazy-skill-loading.md`     | Lazy skill pattern (planning reference)    |
| `docs/architecture/lazy-skill-loading.md` | Lazy skill loading implementation guide    |
| `docs/planning/security.md`               | Threat model (8 categories)                |
| `docs/tasks/agent-platform-hitl.md`       | Completed HITL epic                        |
| `docs/tasks/agent-platform-hitl.5.md`     | Final completed HITL frontend task         |
| `docs/tasks/agent-platform-ws.md`         | Planned workspace storage epic             |
| `docs/planning/frontend-ui-phases.md`     | Frontend UI phased plan (unblocked)        |
| `docs/tasks/`                             | Task spec files                            |

---

## Quick commands

```bash
make up          # Docker build + start + seed
make restart     # Rebuild + restart (keeps DB)
make reset       # Wipe DB + rebuild + reseed
pnpm test        # Vitest unit tests
pnpm typecheck   # TypeScript across all packages
pnpm lint        # ESLint (max-warnings 0)
```

---

## UI/UX Ticket Specifications (manual beads reference)

### 1. Display a thinking block with model logic before streaming the answer -completed

**Requirements:**

- When a user sends a message, a "thinking" block should appear in the chat UI before the agent's answer begins streaming.
- The "thinking" block must clearly indicate the agent/model is processing, using a visual distinct from the final answer.
- The block should disappear as soon as the agent's answer starts streaming.
- The implementation must not block or delay the streaming of the actual answer.
- The design should be consistent with the rest of the chat UI (bright, clean, minimalistic).
  **Definition of Done:**
- Thinking block appears before agent response and disappears on stream start.
- Playwright test covers this interaction.
- SonarQube/Problems show no new issues in touched files.

### 2. Refactor sidebar: only show Chat/IDE, move other items to Settings, remove Sessions/Tools

Tracked in Beads: `agent-platform-ucg`

### 3. Remove sessions sidebar, move sessions under menu as collapsible agent dropdowns

Tracked in Beads: `agent-platform-7d1`

### 4. Update chat UI: show only feedback block for agent responses, remove agent bubble, keep user bubble

Tracked in Beads: `agent-platform-de4`

### 5. Refactor input bar controls into unified chat input

Tracked in Beads: `agent-platform-lt6`
