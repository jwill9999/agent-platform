# Task: Enforce `AGENTS.md` onboarding gate and instruction context

**Beads issue:** `agent-platform-project-workspaces.5`  
**Spec file:** `docs/tasks/agent-platform-project-workspaces.5.md`

## Summary

Enforce the minimum safe onboarding gate for code-agent Project work. Existing instructions are read
and included in context, read-only investigation remains allowed, and code writes are blocked until
the Project onboarding state is approved.

## Requirements

- On Project load, detect root `AGENTS.md`.
- If root `AGENTS.md` is missing, set onboarding state to `missing` or `in_progress`.
- If root `AGENTS.md` exists but approval metadata is absent or stale, set onboarding state to
  `needs_review` unless the user/project metadata has already approved it.
- Include root `AGENTS.md` in coding-agent prompt/context when present.
- Include nearest nested `AGENTS.md` when active file/task scope is under a nested instruction file.
- Missing, in-progress, or needs-review onboarding state must allow:
  - file reads.
  - tree inspection.
  - chat.
  - non-destructive explanation/planning.
- Missing, in-progress, or needs-review onboarding state must block:
  - code edits.
  - file creation.
  - file deletion.
  - dependency installation or mutation.
  - migrations.
  - commits.
  - destructive commands.
- Approved onboarding state unlocks code writes only if capability policy also allows them.
- The UI must explain that initial project instructions are required before code writes.

## Implementation Plan

1. Add root and nested `AGENTS.md` discovery for Project working trees.
2. Persist onboarding state on Project metadata.
3. Add instruction-context assembly for root and nearest nested files.
4. Add write/destructive-command gating before tools are sent to the model and before tool dispatch.
5. Surface onboarding state and blocked-write reasons in Project UI.
6. Keep full LLM-led gap analysis and collaborative drafting out of this task; those belong to
   `agent-platform-project-onboarding`.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-workspaces.4` | `agent-platform-project-workspaces.6` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Unit tests for `AGENTS.md` discovery and nested precedence.
- Prompt/context tests proving root and relevant nested instructions are included.
- Tool-policy tests proving read-only tools remain available while write/destructive tools are
  blocked until onboarding is approved.
- UI tests for onboarding missing/needs-review/approved states.
- Playwright flow: open Project without `AGENTS.md`, ask agent to inspect files, verify read-only
  output succeeds.
- Playwright flow: ask agent to edit/create a file before approval, verify write is blocked.
- Playwright flow: mark onboarding approved for a fixture Project, ask agent to create a file, verify
  the file lands in the Project root.

## Definition Of Done

- [ ] Root `AGENTS.md` detection sets Project onboarding state.
- [ ] Existing root and nearest nested `AGENTS.md` files are included in coding-agent context.
- [ ] Read-only investigation remains possible before onboarding approval.
- [ ] Writes, deletes, file creation, commits, dependency mutations, migrations, and destructive
      commands are blocked until onboarding is approved.
- [ ] UI explains the onboarding gate in user-facing language.
- [ ] The full onboarding lifecycle remains explicitly tracked in `agent-platform-project-onboarding`.
