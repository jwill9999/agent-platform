# Session handoff

**Purpose:** Human- and agent-readable summary so the next session can resume quickly.  
Update this file **at the end of each work session** (or when stopping mid-epic).

---

## Last updated

- **Date:** 2026-05-04
- **Session:** Claimed `agent-platform-feedback-sensors.6` and created `task/agent-platform-feedback-sensors.6` from the pushed `.5` branch tip. Next work: expose sensor configuration/results/provider/runtime states through API/UI and add end-to-end validation for self-correction and completion gates.
- **Date:** 2026-05-04
- **Session:** Completed and closed `agent-platform-feedback-sensors.5` on `task/agent-platform-feedback-sensors.5`: sensor runs now persist compact sanitized observability events, sensor findings/provider/runtime/MCP capability states are queryable through session-bound tools, repeated failures produce review-required feedforward candidates only, and local gates plus SonarQube Blocker/Critical query are green.
- **Date:** 2026-05-04
- **Session:** Fixed the GitHub Actions unit-test regression on `task/agent-platform-feedback-sensors.4`: the combined feedback sensor runner no longer spends an implicit inferential evaluator call unless an evaluator is explicitly supplied. Root typecheck, lint, and unit tests pass locally; SonarQube CLI found no open Blocker/Critical issues on the PR branch. A separate `.5` spec update for MCP feedback-provider discovery remains uncommitted.
- **Date:** 2026-05-03
- **Session:** Implemented and closed `agent-platform-feedback-sensors.4`: added inferential feedback sensors, wired them into the default sensor runner, verified gates, and prepared `task/agent-platform-feedback-sensors.4` for push.
- **Date:** 2026-05-03
- **Session:** Completed `.3` closeout after SonarCloud passed on PR #131, claimed `agent-platform-feedback-sensors.4`, synced Beads/Dolt, and pushed `task/agent-platform-feedback-sensors.4` from the `.3` chain tip.
- **Date:** 2026-05-03
- **Session:** Addressed the remaining SonarCloud PR #131 duplication source in `packages/harness/test/reactLoop.test.ts` by extracting shared ReAct test fixtures; local gates are green and the branch is ready for the final Sonar rerun before claiming `.4`.
- **Date:** 2026-05-03
- **Session:** Addressed the second SonarCloud PR #131 pass after duplication dropped to 3.6% but remained above the 3% gate: extracted ReAct graph assembly helpers from `buildHarnessGraph`, verified local gates, and prepared the branch for another analysis run.
- **Date:** 2026-05-03
- **Session:** Addressed SonarCloud PR #131 feedback on `task/agent-platform-feedback-sensors.3`: refactored duplicated ReAct graph construction, reduced reported complexity/style findings, verified focused gates, and prepared the branch for re-analysis.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.3` on `task/agent-platform-feedback-sensors.3`: wired sensor checks into ReAct routing, added bounded repair feedback/escalation behavior, enabled API graph support, and closed the bead after green gates.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.2` on `task/agent-platform-feedback-sensors.2`: added deterministic computational sensor runner, imported finding normalization, bounded terminal evidence handling, runtime limitation reporting, and focused/broad quality gates.
- **Date:** 2026-05-03
- **Session:** Implemented `agent-platform-feedback-sensors.1` on `task/agent-platform-feedback-sensors.1`: added shared sensor contracts, public exports, trace lifecycle event types, and contract/trace tests.
- **Date:** 2026-05-03
- **Session:** Created Beads epic `agent-platform-ui-quality-sensors` and spec for future UI/UX grading sensors that use browser evidence, deterministic UI checks, and rubric-based design review.
- **Date:** 2026-05-03
- **Session:** Added agent-scope/profile policy to feedback-sensors specs so coding sensors apply to coding agents by default, while personal-assistant/research/automation agents only use relevant sensors or explicit/manual selections.
- **Date:** 2026-05-03
- **Session:** Added Docker/container and future command-sandbox edge cases to feedback-sensors specs, including runtime discovery, missing mounts/tools/network, host/container path mapping, and distinct environment-limitation states.
- **Date:** 2026-05-03
- **Session:** Added IDE/plugin feedback-provider requirements to the feedback-sensors specs, including bounded terminal-output ingestion, diagnostics/problem providers, setup guidance, and provider availability states.
- **Date:** 2026-05-03
- **Session:** Refined `agent-platform-feedback-sensors` specs after owner review to make sensors source-aware, cadence-aware, provider-auth-aware, and focused on pre-push local validation plus post-push GitHub/SonarQube/CodeQL/review feedback import.
- **Date:** 2026-05-03
- **Session:** Added follow-up Beads task `agent-platform-session-handoff-hygiene` with a spec for capping/rotating `session.md`; linked it as a dependency of `agent-platform-context-optimisation`.
- **Date:** 2026-05-03
- **Session:** Planned the feedback sensors harness epic from the Böckeler/Thoughtworks harness-engineering discussion. Created Beads epic `agent-platform-feedback-sensors`, six chained child tasks, linked spec files under `docs/tasks/`, and committed the planning docs on `feature/feedback-sensors-harness`.
- **Date:** 2026-05-02
- **Session:** Memory epic closeout complete. The epic was manually tested, merged to `main`, local `main` was updated, old task/feature branches were pruned, and `agent-platform-memory` plus child tasks `.1` through `.7` are closed in Beads. Pause here; next session should start planning/refinement for the next epic from updated `main`.
- **Date:** 2026-05-02
- **Session:** Addressed follow-up memory review feedback on `task/agent-platform-memory.7`: prompt memory retrieval now queries only visible, approved, safe/redacted, unexpired, minimum-confidence scopes; tool error parsing is shared; memory tools return structured scope errors; working-memory overwrite semantics are documented; important-file extraction avoids obvious URLs; and the memory.2 spec typo is fixed.
- **Date:** 2026-05-02
- **Session:** Polished the Settings Memory dashboard after manual review: promoted pending/approved/rejected states into larger colored badges, added clearer action hover/active/busy feedback, and reduced visual noise in each memory record card.
- **Date:** 2026-05-02
- **Session:** Implemented and verified `agent-platform-memory.7` on `task/agent-platform-memory.7`: added dry-run-first expired memory cleanup, cleanup API contracts/routes, scoped export/clear safety coverage, retention docs, and focused/broader package quality gates.
- **Date:** 2026-05-02
- **Session:** Added the missing Memory entry to the main Settings sidebar dropdown after manual epic testing confirmed the page worked but was not discoverable from the sidebar.
- **Date:** 2026-05-02
- **Session:** Addressed SonarCloud maintainability/reliability feedback on the final memory branch: simplified self-learning evidence mapping, added explicit string sort comparators, reduced chat history sanitiser complexity, and removed voided promise handlers from the Memory dashboard.
- **Date:** 2026-05-02
- **Session:** Closed out `agent-platform-memory.6` and claimed the final memory epic task, `agent-platform-memory.7`, on new branch `task/agent-platform-memory.7`. Beads/Dolt claim sync succeeded.
- **Date:** 2026-05-02
- **Session:** Addressed SonarCloud reliability findings on `task/agent-platform-memory.6`: removed loop-index reassignment in chat history sanitisation, replaced `charCodeAt()` with `codePointAt()` in workspace path checks, and reduced overlapping maintainability findings in the touched chat/bash workspace policy code.
- **Date:** 2026-05-02
- **Session:** Addressed review feedback on `task/agent-platform-memory.6`: working-memory JSON array reads now tolerate malformed persisted data, memory export URL construction no longer relies on string replacement, retrieval omitted counts now exercise cross-scope memories, and memory secret redaction utilities are centralized.
- **Date:** 2026-05-02
- **Session:** Started `agent-platform-memory.5` on `task/agent-platform-memory.5`; added memory management APIs, scoped native memory tools, Settings Memory UI, and focused tests. Remaining before close: full quality gate, Beads close, commit, and push.
- **Date:** 2026-05-02
- **Session:** Addressed review feedback on `task/agent-platform-memory.5`: malformed persisted memory JSON now falls back safely during reads, with DB regression coverage.
- **Date:** 2026-05-02
- **Session:** Started `agent-platform-memory.6` on `task/agent-platform-memory.6`; added the first review-gated self-learning evaluator for repeated recoverable workspace/path errors with API and DB tests.
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
- **Date:** 2026-04-30
- **Session:** Closed `agent-platform-code-tools.7`; the structured coding tool pack epic auto-closed at 7/7 complete after green pipelines.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-context-optimisation` for context window/token-budget optimisation after memory foundations exist.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-llm-observability-export` for OpenTelemetry/OpenInference-compatible export strategy for LLM/context/memory observability.
- **Date:** 2026-04-30
- **Session:** Added backlog task `agent-platform-improvement-goals` for a limited observability-driven self-improvement loop with reviewed candidates.
- **Date:** 2026-04-30
- **Session:** Remembered future epic refinement workflow: review specs/tickets with owner before moving epics from refinement/planning to ready.
- **Date:** 2026-04-30
- **Session:** Started memory epic setup: created `feature/agent-platform-memory`, created `task/agent-platform-memory.1`, created seven memory child tasks/specs, and claimed `.1`.
- **Date:** 2026-04-30
- **Session:** Paused before implementing `agent-platform-memory.1`; remembered long-term memory v1 should use a relational store with optional links, not a graph database.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.1` memory contracts, SQLite schema/migration, repository CRUD/query APIs, metadata redaction, relationship links, tests, and docs on `task/agent-platform-memory.1`.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.2` short-term session working memory artifacts, prompt continuity hook, inspectable API endpoint, tests, and docs on `task/agent-platform-memory.2`.
- **Date:** 2026-05-01
- **Session:** Implemented `agent-platform-memory.3` pending memory candidate extraction from explicit remember instructions, corrections, repeated failures, and remediations on `task/agent-platform-memory.3`.
- **Date:** 2026-05-01
- **Session:** Addressed review feedback for `agent-platform-memory.3`: shared text compaction, safer credential regex flags, escaped source-metadata JSON paths, non-hardcoded candidate scoping, explicit working-memory list clearing, and docs/session typo fixes.
- **Date:** 2026-05-01
- **Session:** Reduced SonarCloud new-code duplication for `agent-platform-memory.3` by extracting shared memory contract shapes, working-memory persistence mapping, and DB test fixtures.
- **Date:** 2026-05-01
- **Session:** Closed out `agent-platform-memory.3` after green pipelines, claimed `agent-platform-memory.4`, and created `task/agent-platform-memory.4`. Implementation has not started.
- **Date:** 2026-05-02
- **Session:** Implemented `agent-platform-memory.4` approved long-term memory retrieval with conservative ranking, prompt bundle formatting, chat prompt integration, trace metadata, tests, and docs.

### Session-close guardrail (required)

- Local-only changes are not complete.
- Before ending a task/session, ensure work is committed and pushed to `origin`.
- Verify the remote branch/ref exists (for example `git ls-remote --heads origin <branch>` or `git status -sb` showing `origin/<branch>` tracking).
- `--no-verify` is high-risk: it skips Husky/local checks. If used, you must run the skipped build/typecheck/test checks manually and confirm they pass before closing work.

---

## What happened (this session)

### Inferential sensor checkpoints implemented

Branch state: `task/agent-platform-feedback-sensors.4` contains the fourth feedback-sensors task.

- Added `packages/harness/src/sensors/inferentialSensorRunner.ts`.
- Inferential checks now emit normal `SensorResult`/`SensorRunRecord` records with `inferential:*` IDs, shared sensor categories, evidence, severity, and repair instructions.
- Coding profiles run six bounded semantic checks at final/manual/external checkpoints: task satisfaction, diff intent, architecture boundary risk, test quality, unresolved findings, and readiness to commit/push/review.
- Personal-assistant profiles only run task satisfaction and readiness checks by default.
- The default `createSensorCheckNode` runner now calls `runFeedbackSensors`, which runs computational sensors first and then inferential sensors. This preserves required local gates; self-assessment cannot disable or replace typecheck/test/lint findings.
- Open findings from computational collectors and quality gates are passed into the inferential evaluator as evidence.
- Model-backed evaluator prompt requires JSON-only output with evidence-backed failed criteria. Malformed output fails closed as `inferential:self_assessment`.
- Missing model config is reported as an unavailable inferential self-assessment sensor.
- Added `packages/harness/test/inferentialSensorRunner.test.ts` covering pass, fail, unresolved findings, coding vs personal-assistant profile selection, malformed output, max-sensor cap behavior, and combined computational + inferential gate preservation.
- Updated `docs/tasks/agent-platform-feedback-sensors.4.md` checklist and closed Beads task `agent-platform-feedback-sensors.4`.

Quality gates passed:

- `pnpm --filter @agent-platform/harness run test -- test/inferentialSensorRunner.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/critic.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/dodCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test -- test/sensorCheck.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/plugin-sdk run test`
- `pnpm --filter @agent-platform/harness run typecheck`
- `pnpm typecheck`
- `pnpm --filter @agent-platform/harness run lint`
- `pnpm lint`

Completion gate:

- SonarQube MCP tools were not exposed through the currently callable MCP tool list.
- Authenticated SonarCloud CLI/API access works. `sonar auth status` is connected to `https://sonarcloud.io`, org `jwill9999`.
- Current PR `#131` quality gate read via SonarCloud API is `OK`, with `new_duplicated_lines_density` at `0.0` and security hotspot review at `100.0`.
- `bd close` succeeded locally; its Dolt auto-push failed because GitHub DNS/auth was unavailable from the sandbox. The normal git push still needs to be completed for the branch.

### Short-term working memory implemented

Branch state: `task/agent-platform-memory.2` contains the second memory epic task.

- Added shared working-memory contracts for session-scoped artifacts and bounded tool summaries.
- Added `working_memory_artifacts` SQLite table plus repository APIs for get/upsert/delete with merge/de-dupe behavior.
- Chat and resume flows now refresh session working memory after successful graph runs.
- Prompt building now appends a compact short-term working-memory summary to the system prompt when a session artifact exists.
- Added `GET /v1/sessions/:id/working-memory` so the artifact is inspectable through the API.
- Working memory captures current goal, active project/task, decisions, important files, tool names, bounded tool summaries, blockers, pending approval IDs, next action, and a compact summary.
- Tool payloads are summarized before persistence; raw tool output is not copied wholesale.
- Updated `docs/memory.md` and `docs/api-reference.md` for the working-memory layer and endpoint.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
- `pnpm --filter @agent-platform/db run test -- test/workingMemory.test.ts test/migrate.test.ts`
- `pnpm --filter @agent-platform/api exec vitest run test/sessionChat.integration.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm docs:lint`
- `pnpm test`
- `pnpm build`

### Memory foundation implemented

Branch state: `task/agent-platform-memory.1` contains the first memory epic task.

- Added shared memory contracts for scopes, kinds, status, review status, source metadata, confidence, expiry, and safety state.
- Added `memories` and `memory_links` SQLite tables plus repository APIs for create/read/update/delete/query/count and memory links.
- Repository queries support scope, kind, status, review status, confidence floor, source kind/id, source metadata, tags, and expiry filtering.
- Metadata redaction happens before persistence for common secret-bearing keys, including nested objects and arrays.
- Added `docs/memory.md` describing the v1 relational model, storage boundary, and explicit no-automatic-prompt-retrieval decision.
- Added focused contract and DB tests for round-trip validation, CRUD/query, expiry filtering, metadata redaction, migration, and link cascade behavior.

Quality gates passed:

- `pnpm --filter @agent-platform/contracts run test -- test/roundtrip.test.ts`
- `pnpm --filter @agent-platform/db run test -- test/memories.test.ts test/migrate.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test` (run with escalation because Supertest API tests bind local HTTP listeners)
- `pnpm docs:lint`

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
- Pipeline checks passed green on `task/agent-platform-code-tools.7`.
- Closed `.7` in Beads; `agent-platform-code-tools` auto-closed with all seven child tasks complete.
- Captured `agent-platform-active-project` as a follow-up for active project defaults so users do not need to type `/workspace/...` paths in normal coding workflows.
- Captured `agent-platform-context-optimisation` as a follow-up for context window management and token-budget optimisation. This should be picked up after the memory epic has short-term working memory and prompt memory bundle foundations.
- Captured `agent-platform-llm-observability-export` as a follow-up for vendor-neutral LLM observability export strategy. The intended direction is platform-native canonical events first, optional Phoenix/Langfuse/Helicone-style export adapters later.
- Captured `agent-platform-improvement-goals` as a follow-up for monitored goals and reviewed self-improvement candidates. First pass should start with one narrow objective and no autonomous changes.
- Added Beads memory `when-creating-new-epics-schedule-or-explicitly-run`: new epics should have a refinement session with the owner before implementation, including ticket/spec review, requirement changes, tradeoff discussion, and moving from refinement/planning to ready only after that review.

### Memory epic started

- Confirmed `agent-platform-code-tools` is closed with all seven child tasks complete.
- Created and pushed `feature/agent-platform-memory` from the updated `main`.
- Created `task/agent-platform-memory.1` from the memory feature branch.
- Created memory child specs:
  - `docs/tasks/agent-platform-memory.1.md`
  - `docs/tasks/agent-platform-memory.2.md`
  - `docs/tasks/agent-platform-memory.3.md`
  - `docs/tasks/agent-platform-memory.4.md`
  - `docs/tasks/agent-platform-memory.5.md`
  - `docs/tasks/agent-platform-memory.6.md`
  - `docs/tasks/agent-platform-memory.7.md`
- Created matching Beads child tasks, linked them under `agent-platform-memory`, chained dependencies from `.1` through `.7`, claimed `agent-platform-memory.1`, and synced Beads/Dolt.
- Long-term memory planning decision: v1 should use a relational SQLite/Postgres-compatible memory table with scope, kind, review status, confidence/source metadata, tags/metadata, expiry, and optional `memory_links` for graph-like relationships. Do not introduce a graph database initially; consider vector search or graph traversal later if retrieval needs prove it.
- Added Beads memory `memory-epic-planning-decision-start-long-term-memory` with this direction.

## Current state

### Git

- **Current branch:** `task/agent-platform-feedback-sensors.4`
- **Current base:** `feature/feedback-sensors-harness`
- **Latest task commit:** `9c0fe1c Add inferential feedback sensors` before the required `session.md` amend.
- **Current work:** `.4` implementation is complete and Beads is closed locally. `session.md` still needs to be amended into the latest commit, then the branch must be pushed.
- **Remote sync:** branch tracks `origin/task/agent-platform-feedback-sensors.4`; latest `.4` implementation commit has not been pushed yet at the time this handoff update was written.

### Beads

- `agent-platform-feedback-sensors` is in progress as a P2 epic.
- `agent-platform-feedback-sensors.1` is closed.
- `agent-platform-feedback-sensors.2` is closed.
- `agent-platform-feedback-sensors.3` is closed.
- `agent-platform-feedback-sensors.4` is closed locally.
- `agent-platform-feedback-sensors.5` through `.6` are open P2 child tasks.
- Dependencies are chained `.2 -> .1`, `.3 -> .2`, `.4 -> .3`, `.5 -> .4`, `.6 -> .5`.
- Specs exist under `docs/tasks/agent-platform-feedback-sensors*.md` and now cover capability discovery, agent-scope/profile policy, normalized findings, IDE/problem and IDE/plugin terminal feedback, SonarQube/CodeQL/GitHub feedback, Docker/container/sandbox limitations, provider auth states, pre-push validation, and post-push feedback import.
- `agent-platform-session-handoff-hygiene` is open as a P2 task and blocks `agent-platform-context-optimisation`.
- `agent-platform-ui-quality-sensors` is open as a P2 epic with parent spec only; child specs are pending refinement.
- Per stored memory, schedule or explicitly run owner refinement before moving this epic from planning/refinement to implementation-ready.

### Quality

- `.4` gates passed:
  - `pnpm --filter @agent-platform/harness run test -- test/inferentialSensorRunner.test.ts`
  - `pnpm --filter @agent-platform/harness run test -- test/critic.test.ts`
  - `pnpm --filter @agent-platform/harness run test -- test/dodCheck.test.ts`
  - `pnpm --filter @agent-platform/harness run test -- test/sensorCheck.test.ts`
  - `pnpm --filter @agent-platform/harness run test`
  - `pnpm --filter @agent-platform/plugin-sdk run test`
  - `pnpm --filter @agent-platform/harness run typecheck`
  - `pnpm typecheck`
  - `pnpm --filter @agent-platform/harness run lint`
  - `pnpm lint`
- SonarCloud PR `#131` API quality gate is currently `OK`, including `0.0%` duplication on new code.

---

## Next (priority order)

1. Amend `session.md` into the `.4` commit and push `task/agent-platform-feedback-sensors.4`.
2. Re-check PR `#131` after remote pipelines/SonarCloud analyze the pushed `.4` commit.
3. Claim `agent-platform-feedback-sensors.5` next: add sensor observability and feedback flywheel.

---

## Blockers / questions for owner

- SonarQube MCP tools are still not exposed in this session, but authenticated SonarCloud CLI/API reads work.
- `bd close` Dolt auto-push failed due GitHub DNS/auth from the sandbox; push the git branch normally and sync Beads/Dolt when network/auth is available.

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
