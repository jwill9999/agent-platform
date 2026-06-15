# Epic: Electron stabilisation and manual QA triage

**Beads issue:** `agent-platform-electron-stabilisation`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.md`

## Objective

Stabilise the completed Electron Project experience before starting release or additional feature
epics.

This epic exists because manual testing identified regression risk around stacked PRs, Electron
development setup, Project chat, IDE handoff, Recent Projects, native Project binding, slash-command
Project context, and user-facing navigation. The goal is to turn those findings into a controlled
integration plan instead of merging uncertain work directly to `main`.

The manual QA session also refined the product direction: Project work is chat-first. Opening a
Project should land in Project Chat, slash commands belong to Project Chat, generated output should
be previewable from chat/activity surfaces, and the built-in IDE should no longer be treated as the
primary Project workflow.

## Requirements

- Document what counts as the standard development environment.
- Document when Electron is mandatory for testing.
- Create a repeatable manual QA checklist for the Electron Project experience.
- Triage owner/manual findings into Beads.
- Decide whether to use a staging branch for stacked PR integration and fix-forward work.
- Identify UI/E2E regression coverage gaps.
- Stabilise the chat-first Project flow before returning to release work.
- Remove or de-prioritise built-in IDE assumptions where they distract from Project Chat.
- Plan parallel worktree execution for independent follow-up fixes.
- Block Electron release work until the stabilisation decision is complete.

## Task Chain

1. `agent-platform-electron-stabilisation.1` - Document Electron development workflow.
2. `agent-platform-electron-stabilisation.2` - Create Electron manual QA checklist.
3. `agent-platform-electron-stabilisation.3` - Triage manual QA findings into Beads.
4. `agent-platform-electron-stabilisation.4` - Review PR stack and staging branch plan.
5. `agent-platform-electron-stabilisation.5` - Backfill UI regression E2E coverage plan.
6. `agent-platform-electron-stabilisation.6` - Define chat-first Project navigation.
7. `agent-platform-electron-stabilisation.7` - Fix native Project folder binding.
8. `agent-platform-electron-stabilisation.8` - Restore Project Chat submission and slash commands.
9. `agent-platform-electron-stabilisation.9` - Stabilise Recent Projects.
10. `agent-platform-electron-stabilisation.10` - Clean up user-facing Project copy and diagnostics.
11. `agent-platform-electron-stabilisation.11` - Define IDE handoff and generated Project side panel.
12. `agent-platform-electron-stabilisation.12` - Stabilisation closeout and next-epic gate.

## Closeout Status

As of 2026-06-15, the Electron stabilisation implementation work and automation backfill have merged
to `staging` through `jwill9999/electron-stabilisation-e2e-backfill`. Owner manual testing passed,
and the staging request CI/CD checks were green.

The stabilisation closeout gate is satisfied for staging/integration. Follow-on Project Experience
work can use the documented chat-first direction from the staging baseline.

Production macOS release promotion remains blocked by the separate pre-production VM signing and
notarization gate `agent-platform-macos-production-sandbox.6.3`. The broader workflow expectation
matrix `agent-platform-electron-stabilisation.20` remains a non-blocking automation follow-up.

## Parallel Worktree Strategy

The stabilisation work should not be treated as a single long chain. Use independent worktrees where
the write sets are cleanly separated:

- Sequential core path: `.6` -> `.7` -> `.8`, because Project Chat navigation, Project binding, and
  Project Chat/slash-command submission build on each other.
- Parallel after `.6`: `.9`, because Recent Projects depends on the destination route but can avoid
  message-pipeline changes.
- Parallel after `.3`: `.10`, because user-facing copy can be cleaned up independently.
- Parallel after `.3`: `.11`, because IDE handoff and generated preview design can be specified
  without blocking the core Project-open fixes.
- Parallel after `.4`: `.5`, because E2E coverage planning can run alongside implementation and feed
  the required regression checks back into each fix task.
- Final gate: `.12` waits for the fix/design paths and records whether follow-on Project Experience
  or release work can start.

## Dependencies

| Upstream                                   | Downstream                                 |
| ------------------------------------------ | ------------------------------------------ |
| `agent-platform-electron-stabilisation.1`  | `agent-platform-electron-stabilisation.2`  |
| `agent-platform-electron-stabilisation.2`  | `agent-platform-electron-stabilisation.3`  |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.4`  |
| `agent-platform-electron-stabilisation.4`  | `agent-platform-electron-stabilisation.5`  |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.6`  |
| `agent-platform-electron-stabilisation.6`  | `agent-platform-electron-stabilisation.7`  |
| `agent-platform-electron-stabilisation.7`  | `agent-platform-electron-stabilisation.8`  |
| `agent-platform-electron-stabilisation.6`  | `agent-platform-electron-stabilisation.9`  |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.10` |
| `agent-platform-electron-stabilisation.3`  | `agent-platform-electron-stabilisation.11` |
| `agent-platform-electron-stabilisation.5`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.8`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.9`  | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.10` | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation.11` | `agent-platform-electron-stabilisation.12` |
| `agent-platform-electron-stabilisation`    | `agent-platform-electron-release`          |

## Testing Strategy

- Documentation lint: `pnpm docs:lint`.
- For any code changes introduced by follow-up bug tasks: run the affected package tests plus
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant browser/Electron E2E.
- Manual QA findings must include reproducible steps and expected/actual outcomes.
- Staging branch decision must identify which checks need to pass before any feature branch merges
  into `main`.

## Definition Of Done

- Development workflow documentation exists and distinguishes developer runtime from desktop
  runtime.
- Manual QA checklist exists and is ready for owner execution.
- Findings are mapped to existing or new Beads issues.
- Merge blockers are identified.
- Staging branch decision is recorded.
- UI/E2E regression gaps are assigned to Beads tasks or explicitly deferred.
- Chat-first Project flow blockers are fixed or explicitly parked.
- Built-in IDE assumptions are removed from the primary Project workflow or explicitly deferred.
- Stabilisation closeout records whether Project Experience/release work can resume.
- Electron release epic remains blocked until this stabilisation epic is complete.
