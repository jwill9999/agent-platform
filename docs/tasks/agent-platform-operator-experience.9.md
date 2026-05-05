# Task: Document Docker host integration constraints

**Beads issue:** `agent-platform-operator-experience.9`  
**Spec file:** `docs/tasks/agent-platform-operator-experience.9.md` (this file)  
**Parent epic:** `agent-platform-operator-experience` — Human-readable operator experience

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-operator-experience.9.md`

## Task requirements

Document constraints and user-facing expectations for Docker-hosted execution when workflows need host browser, host IDE, local files, plugins, terminal output, or desktop application integration. This should distinguish supported behavior, unsupported behavior, and future bridge/helper possibilities.

## Stack constraints

Use Next.js App Router, shadcn/ui, Tailwind CSS, and TypeScript for any frontend prototypes. Do not introduce new UI libraries, change data contracts, or add backend logic in this task.

## Dependency order

### Upstream — must be complete before this task

| Issue                                  | Spec                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `agent-platform-operator-experience.8` | [Reassess IDE and workbench architecture](./agent-platform-operator-experience.8.md) |

### Downstream — waiting on this task

| Issue | Spec |
| ----- | ---- |
| N/A   | N/A  |

## Implementation plan

1. Document current Docker runtime boundaries: API container, web container, workspace mount, data mount, browser runtime, and host filesystem visibility.
2. Document host integration cases:
   - opening host browser
   - opening host IDE
   - reading host IDE diagnostics or terminal output
   - using desktop plugins
   - interacting with local applications
3. Mark each case as supported, unsupported, or future bridge/helper.
4. Identify security considerations for any future host bridge.
5. Add user-facing copy guidance for unsupported or approval-required host interactions.

## Git workflow

Branch `task/agent-platform-operator-experience.9` from `task/agent-platform-operator-experience.8`.

This is the current segment tip. If the full chain is implemented linearly, open one PR from `task/agent-platform-operator-experience.9` to `feature/agent-platform-operator-experience`.

## Tests

- Documentation/spec checks for design-only work.
- If frontend copy/prototypes are added: web unit tests and targeted manual checks.

## Definition of done

- [ ] Docker/host boundaries are documented.
- [ ] Supported, unsupported, and future host integration paths are clear.
- [ ] Security concerns for host bridges are documented.
- [ ] User-facing unsupported-state guidance exists.
- [ ] No backend contracts or new UI libraries are introduced.

## Sign-off

- [ ] Required checks pass.
- [ ] If segment tip: PR merged `task/agent-platform-operator-experience.9 -> feature/agent-platform-operator-experience`; otherwise write “N/A — merge at segment end”.
- [ ] `bd close agent-platform-operator-experience.9 --reason "Docker host integration constraints documented"`
- [ ] `session.md` updated if handoff needed.

**Reviewer / owner:** Jason Williams **Date:** 2026-05-05
