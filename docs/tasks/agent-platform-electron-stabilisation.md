# Epic: Electron stabilisation and manual QA triage

**Beads issue:** `agent-platform-electron-stabilisation`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.md`

## Objective

Stabilise the completed Electron Project experience before starting release or additional feature
epics.

This epic exists because manual testing identified regression risk around stacked PRs, Electron
development setup, Project chat, IDE handoff, and slash-command Project context. The goal is to
turn those findings into a controlled integration plan instead of merging uncertain work directly to
`main`.

## Requirements

- Document what counts as the standard development environment.
- Document when Electron is mandatory for testing.
- Create a repeatable manual QA checklist for the Electron Project experience.
- Triage owner/manual findings into Beads.
- Decide whether to use a staging branch for stacked PR integration and fix-forward work.
- Identify UI/E2E regression coverage gaps.
- Block Electron release work until the stabilisation decision is complete.

## Task Chain

1. `agent-platform-electron-stabilisation.1` - Document Electron development workflow.
2. `agent-platform-electron-stabilisation.2` - Create Electron manual QA checklist.
3. `agent-platform-electron-stabilisation.3` - Triage manual QA findings into Beads.
4. `agent-platform-electron-stabilisation.4` - Review PR stack and staging branch plan.
5. `agent-platform-electron-stabilisation.5` - Backfill UI regression E2E coverage plan.

## Dependencies

| Upstream                                  | Downstream                                |
| ----------------------------------------- | ----------------------------------------- |
| `agent-platform-electron-stabilisation.1` | `agent-platform-electron-stabilisation.2` |
| `agent-platform-electron-stabilisation.2` | `agent-platform-electron-stabilisation.3` |
| `agent-platform-electron-stabilisation.3` | `agent-platform-electron-stabilisation.4` |
| `agent-platform-electron-stabilisation.4` | `agent-platform-electron-stabilisation.5` |
| `agent-platform-electron-stabilisation`   | `agent-platform-electron-release`         |

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
- Electron release epic remains blocked until this stabilisation epic is complete.
