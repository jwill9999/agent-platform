# Task: Validate browser tools end to end

**Beads issue:** `agent-platform-browser-tools.5`  
**Spec file:** `docs/tasks/agent-platform-browser-tools.5.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools.5.md`

## Task requirements

Complete the browser-tools epic with end-to-end validation, security coverage, Docker/runtime documentation, and segment-tip PR preparation.

Required outcomes:

- Add representative E2E flows against a local web UI:
  - navigate
  - snapshot
  - screenshot
  - safe click/type/press
  - close session
- Add negative E2E/security coverage:
  - blocked external domain
  - risky submit/destructive action requires HITL
  - ambiguous locator failure
  - browser runtime unavailable or dependency missing
  - artifact output remains bounded
- Verify Docker image/runtime includes or documents browser dependencies.
- Ensure browser artifacts are available to users and agents but not leaked into chat by default.
- Update docs for usage, policies, limitations, and troubleshooting.
- Open the segment-tip PR from `task/agent-platform-browser-tools.5` to `feature/agent-platform-browser-tools`.

## Dependency order

### Upstream - must be complete before this task

| Issue                            | Spec                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.4` | [Expose browser observability and artifacts](./agent-platform-browser-tools.4.md) |

### Downstream - waiting on this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

## Implementation plan

1. Review the full task chain and close any doc/test gaps.
2. Add E2E fixtures and Playwright tests for successful browser automation.
3. Add security/negative tests for blocked or approval-required actions.
4. Run full local gates, including Docker/E2E where required.
5. Update the epic spec checklist and task docs.
6. Open one PR from the segment tip into `feature/agent-platform-browser-tools`.

## Git workflow

Branch `task/agent-platform-browser-tools.5` from `task/agent-platform-browser-tools.4`.

This is the segment tip. Open one PR from `task/agent-platform-browser-tools.5` to `feature/agent-platform-browser-tools`.

## Tests

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`
- `pnpm test:e2e`
- Additional browser-tool E2E/security tests added in this task.
- SonarQube/Problems completion gate per `docs/agent-instructions-shared.md`.

## Definition of done

- [x] Browser tools pass representative local UI E2E flows.
- [x] Risky actions are blocked or approval-gated in E2E/security coverage.
- [x] Docker/runtime setup and limitations are documented.
- [x] Browser artifacts are bounded and not dumped into chat by default.
- [ ] Segment-tip PR is opened from `task/agent-platform-browser-tools.5` to `feature/agent-platform-browser-tools`.
- [x] Browser-tools epic checklist is complete.

## Sign-off

- [x] Task branch created from `task/agent-platform-browser-tools.4`
- [x] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: PR opened `task/agent-platform-browser-tools.5 -> feature/agent-platform-browser-tools`
- [ ] `bd close agent-platform-browser-tools.5 --reason "Browser tools validated end to end"`
- [x] `decisions.md` updated only if architectural decision changed (not required)
- [x] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-04
