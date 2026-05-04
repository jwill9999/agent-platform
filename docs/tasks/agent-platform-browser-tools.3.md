# Task: Add governed navigation and input actions

**Beads issue:** `agent-platform-browser-tools.3`  
**Spec file:** `docs/tasks/agent-platform-browser-tools.3.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools.3.md`

## Task requirements

Add browser actions that can navigate and interact with pages while enforcing platform policy and existing HITL approval behavior for risky actions.

Required outcomes:

- Add tools for:
  - navigate
  - click
  - type/fill
  - press key
- Prefer Playwright locators based on user-facing attributes: role, label, text, placeholder, alt text, title, and test id.
- Avoid brittle CSS selectors unless explicitly provided and policy allows them.
- Enforce domain allow/deny policy before navigation and after redirects.
- Detect and classify risky interactions:
  - form submit
  - login/authentication
  - purchase/payment
  - destructive actions
  - sending messages/emails/posts
  - file upload/download initiation
- Route risky actions through existing HITL approval mechanisms.
- Capture before/after evidence for actions when policy permits.
- Return structured failures for ambiguous selectors, blocked actions, timeouts, navigation failures, and policy denials.

## Dependency order

### Upstream - must be complete before this task

| Issue                            | Spec                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.2` | [Implement browser lifecycle and read-only tools](./agent-platform-browser-tools.2.md) |

### Downstream - waiting on this task

| Issue                            | Spec                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.4` | [Expose browser observability and artifacts](./agent-platform-browser-tools.4.md) |

## Implementation plan

1. Read the HITL approval policy and tool risk-tier implementation.
2. Add browser action policy evaluation before each mutating command.
3. Implement navigation and input commands against the session manager from task `.2`.
4. Add before/after evidence capture hooks with bounded storage.
5. Add tests for safe local interactions, blocked external domains, and HITL-required risky actions.
6. Document selector strategy and action-risk behavior.

## Git workflow

Branch `task/agent-platform-browser-tools.3` from `task/agent-platform-browser-tools.2`.

## Tests

- `pnpm --filter @agent-platform/harness run test`
- `pnpm --filter @agent-platform/api run test` if API/HITL wiring is touched
- `pnpm typecheck`
- Add tests for:
  - allowed local navigation
  - denied external navigation
  - redirect policy enforcement
  - click/type/press success on safe local fixtures
  - ambiguous selector failures
  - submit/destructive actions requiring approval
  - approval denial returns tool-visible feedback

## Definition of done

- [ ] Navigation and input browser tools are implemented.
- [ ] Policy/HITL enforcement protects risky actions.
- [ ] Locator strategy favors user-facing selectors.
- [ ] Before/after action evidence is bounded and policy-aware.
- [ ] Quality gates pass for touched packages.

## Sign-off

- [ ] Task branch created from `task/agent-platform-browser-tools.2`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] PR: N/A - merge at segment end
- [ ] `bd close agent-platform-browser-tools.3 --reason "Governed navigation and input actions added"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-04
