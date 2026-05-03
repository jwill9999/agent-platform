# Task: Add session handoff hygiene and archive policy

**Beads issue:** `agent-platform-session-handoff-hygiene`  
**Spec file:** `docs/tasks/agent-platform-session-handoff-hygiene.md` (this file)  
**Related task:** `agent-platform-context-optimisation`

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-session-handoff-hygiene.md`

## Summary

Define and enforce a concise `session.md` handoff policy so current state stays visible, old session history is archived, and shared context files do not crowd out active instructions or task context.

## Background

`session.md` has grown into a long append-only history. That is risky for agent context because older material can crowd out current branch state, active Beads work, blockers, and next steps. Runtime context-window optimisation is tracked by `agent-platform-context-optimisation`; this task is narrower and covers repository handoff-file hygiene.

## Requirements

- Define a maximum target length for `session.md`, initially 150-250 lines.
- Keep `session.md` focused on the current handoff:
  - current branch and commit
  - active Beads issue or epic
  - what changed this session
  - verification run
  - blockers
  - next 3-5 steps
- Add an archive location for older handoff history, for example `docs/session-archive/YYYY-MM.md`.
- Add a script or lint check that warns or fails when `session.md` exceeds the configured limit.
- Update agent instructions so future agents rotate/archive handoff content instead of appending indefinitely.
- Ensure the archive flow preserves useful historical references without requiring agents to load them by default.

## Non-Goals

- Runtime prompt compaction for chat history.
- Token budgeting for model calls.
- Automatic semantic compression of arbitrary repository documentation.
- Deleting historical session content without an archive.

## Dependency order

Execution order is enforced in **Beads** with **`blocks`** edges. `agent-platform-context-optimisation` depends on this task because handoff hygiene should be settled before broader context optimisation work.

### Upstream - must be complete before this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

### Downstream - waiting on this task

| Issue                                 | Spec                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `agent-platform-context-optimisation` | [Add context window and token optimisation](./agent-platform-context-optimisation.md) |

## Implementation plan

1. Decide the exact `session.md` line or byte limit.
2. Move historical material out of `session.md` into an archive file under `docs/session-archive/`.
3. Rewrite `session.md` as a concise current-state handoff.
4. Add a check script, for example `scripts/check-session-handoff.mjs`, that validates:
   - `session.md` exists
   - required headings exist
   - line count is within the configured limit
   - archive references are relative links
5. Wire the check into an existing docs or pre-commit quality path.
6. Update `docs/agent-instructions-shared.md` with the session handoff rotation rule.
7. Add tests or script smoke checks for pass/fail cases.

## Tests and verification

- `node scripts/check-session-handoff.mjs`
- `pnpm docs:lint`
- `pnpm format:check`
- Add script tests or fixtures if the check does more than simple file inspection.

## Definition of done

- [ ] `session.md` is concise and current-state focused.
- [ ] Older session history is archived under a documented path.
- [ ] Automated validation prevents unbounded `session.md` growth.
- [ ] Agent instructions explain when and how to archive handoff content.
- [ ] `agent-platform-context-optimisation` dependency relationship remains valid in Beads.
- [ ] `bd close agent-platform-session-handoff-hygiene --reason "Session handoff hygiene policy implemented"`

## Sign-off

- [ ] Task branch created before implementation work
- [ ] Required checks executed and passing
- [ ] Checklists in this document are complete
- [ ] `session.md` updated using the new concise policy
- [ ] `decisions.md` updated only if architectural decision changed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
