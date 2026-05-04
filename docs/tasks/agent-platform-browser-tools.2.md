# Task: Implement browser lifecycle and read-only tools

**Beads issue:** `agent-platform-browser-tools.2`  
**Spec file:** `docs/tasks/agent-platform-browser-tools.2.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools.2.md`

## Task requirements

Implement the Playwright-backed browser session manager and read-only browser tools. This task should let agents create bounded browser sessions and capture evidence without mutating page state.

Required outcomes:

- Add a browser session manager that can start, reuse, timeout, and close Playwright browser contexts.
- Support headless Chromium first, with contracts allowing Firefox/WebKit later.
- Add read-only tools for:
  - start session/context
  - capture page snapshot
  - capture screenshot
  - capture ARIA snapshot or equivalent accessibility-structure evidence
  - close session/context
- Store evidence artifacts in bounded session/run workspace locations rather than dumping raw payloads into chat.
- Include viewport, URL, title, timestamp, console summary, and capture metadata in results.
- Enforce timeout, maximum page count, maximum artifact size, and secret/text redaction boundaries.
- Surface runtime limitations clearly when browser binaries, Docker dependencies, sandbox permissions, or network access are unavailable.

## Dependency order

### Upstream - must be complete before this task

| Issue                            | Spec                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.1` | [Define browser contracts and policy model](./agent-platform-browser-tools.1.md) |

### Downstream - waiting on this task

| Issue                            | Spec                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.3` | [Add governed navigation and input actions](./agent-platform-browser-tools.3.md) |

## Implementation plan

1. Read the contracts from task `.1` and the existing native tool registration patterns in `packages/harness`.
2. Add a browser runtime/session manager module with explicit lifecycle and cleanup.
3. Register read-only browser tools through the harness tool surface with bounded outputs.
4. Persist or reference evidence artifacts using the workspace/artifact conventions already present in the repo.
5. Add tests with mocked Playwright where possible and focused integration tests where browser runtime is required.
6. Document Docker/runtime prerequisites and fallback states.

## Git workflow

Branch `task/agent-platform-browser-tools.2` from `task/agent-platform-browser-tools.1`.

## Tests

- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/contracts run test`
- `pnpm typecheck`
- Add tests for:
  - session start/reuse/timeout/close
  - snapshot/screenshot success
  - artifact size bounding
  - browser runtime unavailable
  - denied external URL under default policy
  - local/dev URL allowed under default policy

## Definition of done

- [x] Playwright-backed session lifecycle exists with cleanup and timeout.
- [x] Read-only browser tools are registered and policy-checked.
- [x] Screenshot/snapshot evidence is bounded and stored as artifacts.
- [x] Runtime limitation states are explicit and test-covered.
- [x] Quality gates pass for touched packages.

## Sign-off

- [x] Task branch created from `task/agent-platform-browser-tools.1`
- [x] Required tests executed and passing
- [x] Checklists in this document are complete
- [ ] PR: N/A - merge at segment end
- [x] `bd close agent-platform-browser-tools.2 --reason "Browser lifecycle and read-only tools implemented"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-04
