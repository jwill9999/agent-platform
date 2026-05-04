# Task: Define browser contracts and policy model

**Beads issue:** `agent-platform-browser-tools.1`  
**Spec file:** `docs/tasks/agent-platform-browser-tools.1.md` (this file)  
**Parent epic:** `agent-platform-browser-tools` - Browser automation tool pack

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-browser-tools.1.md`

## Task requirements

Define the shared contract and policy foundation for first-class browser automation. The platform-owned browser tool pack should use Playwright internally, while keeping MCP/browser providers as optional adapters rather than the core runtime dependency.

Required outcomes:

- Add shared contracts for browser sessions, pages, actions, action results, evidence artifacts, policy profiles, and policy decisions.
- Model actions for `start`, `navigate`, `snapshot`, `screenshot`, `click`, `type`, `press`, and `close`.
- Classify action risk:
  - read-only: snapshot, screenshot
  - medium: start, navigate, close
  - high: click, type, press when they can mutate state, submit, authenticate, purchase, delete, or send messages
- Define domain policy inputs for local/dev URLs, external domains, deny lists, and redirect handling.
- Define evidence metadata for screenshots, ARIA snapshots, DOM summaries, console summaries, network summaries, traces, viewport, page URL, and capture timestamp.
- Define redaction and bounding rules for text evidence, URLs, screenshots, and trace metadata.
- Document that UI/UX grading remains in `agent-platform-ui-quality-sensors`; this epic captures browser evidence and enforces policy only.

## Dependency order

### Upstream - must be complete before this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

### Downstream - waiting on this task

| Issue                            | Spec                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `agent-platform-browser-tools.2` | [Implement browser lifecycle and read-only tools](./agent-platform-browser-tools.2.md) |

## Implementation plan

1. Review existing contracts in `packages/contracts/src`, especially sensor/evidence-like schemas.
2. Add browser automation schemas and exported inferred types in `packages/contracts`.
3. Keep contracts runtime-agnostic but document Playwright as the internal implementation choice.
4. Add contract tests for valid/invalid sessions, actions, policies, evidence artifacts, and redaction/bounding metadata.
5. Update `docs/tasks/agent-platform-browser-tools.md`, `docs/api-reference.md`, and architecture docs with the contract and policy model.

## Git workflow

Branch `task/agent-platform-browser-tools.1` from `feature/agent-platform-browser-tools`.

This is the first task in the chained browser-tools segment.

## Tests

- `pnpm --filter @agent-platform/contracts run build`
- `pnpm --filter @agent-platform/contracts run test`
- `pnpm typecheck`
- Add contract tests for:
  - action risk classification
  - local/dev domain policy defaults
  - external-domain deny/approval-required states
  - evidence artifact bounds and redaction flags
  - unsupported/deprecated browser evidence types

## Definition of done

- [ ] Browser session/action/policy/evidence contracts are defined and exported.
- [ ] Risk tiers and policy decision states are test-covered.
- [ ] Evidence artifact metadata supports future UI-quality sensor consumption.
- [ ] Docs explain Playwright as the internal runtime and MCP/browser providers as optional adapters.
- [ ] Quality gates pass for touched packages.

## Sign-off

- [ ] Task branch created from `feature/agent-platform-browser-tools`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] PR: N/A - merge at segment end
- [ ] `bd close agent-platform-browser-tools.1 --reason "Browser contracts and policy model defined"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-04
