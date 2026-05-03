# Task: Implement computational sensor runner

**Beads issue:** `agent-platform-feedback-sensors.2`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.2.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.2.md`

## Task requirements

Build a deterministic sensor runner and finding collector that select approved checks at appropriate checkpoints and turn failures or imported findings into compact repair instructions.

Required outcomes:

- Add a harness module that can run computational sensors using the existing `sys_run_quality_gate` backend.
- Collect locally available findings from configured feedback surfaces where possible, including IDE/problem diagnostics, SonarQube plugins or CLI output, CodeQL output, and agent-generated code comments.
- Select a minimal sensor set from trigger/cadence context:
  - TypeScript/package changes: package `typecheck`
  - source/test changes: package or root `test`
  - code style changes: `lint`
  - docs changes: `docs` or `format`
- Treat pre-push validation as the primary required local checkpoint; during-work checks must be targeted and cheap by default.
- Convert raw quality gate failures into LLM-optimized repair instructions with file, line, failing command, and next action.
- Normalize imported findings into the shared finding model and deduplicate by source/rule/file/line/message where possible.
- Preserve raw stdout/stderr as bounded evidence artifacts.
- Enforce workspace/path limits, timeout limits, output caps, and no arbitrary shell command construction.

## Dependency order

### Upstream - must be complete before this task

| Issue                               | Spec                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.1` | [Define sensor contracts and policy model](./agent-platform-feedback-sensors.1.md) |

### Downstream - waiting on this task

| Issue                               | Spec                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.3` | [Wire sensors into the ReAct loop](./agent-platform-feedback-sensors.3.md) |

## Implementation plan

1. Read `packages/harness/src/tools/qualityGateTool.ts`, `packages/harness/src/tools/gitTools.ts`, and `packages/harness/src/tools/repoDiscoveryTools.ts`.
2. Create `packages/harness/src/sensors/computationalSensorRunner.ts`.
3. Define a runner API that accepts changed files, repo path, available sensor definitions, and execution limits.
4. Reuse `executeQualityGateTool` instead of invoking shell commands directly.
5. Add provider/finding collector interfaces that can return `available`, `auth_required`, `not_configured`, or normalized findings without failing the whole run.
6. Add deterministic failure normalization helpers:
   - TypeScript errors become "fix the type mismatch" repair instructions.
   - ESLint errors become "apply this lint rule" repair instructions.
   - test failures include expected/actual snippets when available.
   - SonarQube and CodeQL findings include severity, rule ID, hotspot/security metadata when present, and evidence links.
   - IDE problems and agent code comments become findings with local source metadata.
   - unknown failures include the failing command and the smallest useful log tail.
7. Add unit tests in `packages/harness/test/computationalSensorRunner.test.ts`.
8. Ensure all result payloads satisfy the contracts from task `.1`.

## Tests (required before sign-off)

- `pnpm --filter @agent-platform/harness run test -- test/computationalSensorRunner.test.ts`
- `pnpm --filter @agent-platform/harness run test`
- `pnpm typecheck`
- Add tests for:
  - selecting typecheck/lint/test from changed files
  - output truncation metadata
  - failing quality gate converted to repair instruction
  - imported IDE/SonarQube/CodeQL/review finding converted to repair instruction
  - auth-required provider returns unavailable result without blocking optional sensors
  - passing quality gate converted to passed sensor result
  - denial when repo path is outside workspace

## Definition of done

- [ ] Computational sensor runner exists and uses approved quality gate execution.
- [ ] Local/problem/provider findings can be normalized and deduplicated.
- [ ] Results are compact and suitable to feed into an LLM turn.
- [ ] Raw logs remain evidence, not primary feedback.
- [ ] Tests cover selection, success, failure, truncation, and denial paths.
- [ ] `bd close agent-platform-feedback-sensors.2 --reason "Computational sensor runner implemented"`

## Sign-off

- [ ] Task branch created from `task/agent-platform-feedback-sensors.1`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: N/A - merge at segment end
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
