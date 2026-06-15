# Task: Polish and verify external/default IDE handoff with session continuity

**Beads issue:** `agent-platform-project-experience.4`  
**Spec file:** `docs/tasks/agent-platform-project-experience.4.md`

## Summary

Polish and verify the external/default IDE handoff from Project Chat. The staging baseline already
has desktop IDE launch plumbing; this task should close remaining configuration, unavailable-state,
copy, and regression-test gaps rather than rebuilding the feature.

## Desktop Re-scope Note

For desktop Product acceptance, IDE handoff consumes the same backend-bound Project/session created
by Electron native Project access. It must not create a separate renderer-only folder context.

The built-in IDE is secondary/transitional during stabilisation. This task should implement
external/default IDE handoff for manual editing and treat any built-in file view as optional
read-only inspection, not as the primary Project workflow or an investment area.

## Requirements

- Project Chat exposes a clear but secondary "Open in local IDE" or equivalent handoff action.
- The handoff uses the active Project selected by the Electron native Project picker; users do not
  type or memorize absolute paths.
- The macOS implementation opens the active Project folder in a detected/configured editor, with
  safe fallback copy when no supported editor is available.
- Settings or environment override behavior is documented clearly enough for development and manual
  QA.
- The design leaves room for file-and-line handoff when editor support exists.
- Returning to Agent Platform preserves the active Project, session, agent, and conversation context.
- If the built-in file view remains available, it is secondary, preferably read-only, and uses the
  same backend Project id/root as Project Chat.
- Handoff labels must use Project/folder terminology and hide runtime implementation details by
  default.

## Implementation Plan

1. Audit the existing desktop IDE launcher, preload bridge, settings/override behavior, and UI copy.
2. Fill remaining unavailable/fallback states and documentation gaps.
3. Preserve Project/session context in Agent Platform after the external handoff.
4. Keep any built-in file route secondary and context-bound if it remains visible.
5. Add or tighten regression tests for handoff state, unavailable states, and context preservation.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-experience.3` | `agent-platform-project-experience.5` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
- Focused UI tests for external IDE handoff actions, unavailable states, and return/context labels.
- Electron E2E: open Project Chat from a native Project, send/verify context, trigger IDE handoff,
  verify Agent Platform keeps the same Project/session context, and verify the UI does not require
  manual absolute path entry.
- Open the task PR, monitor GitHub checks/SonarCloud/GitGuardian/Sourcery/comments until green.

## Definition Of Done

- [ ] External/default IDE handoff is polished and opens only after explicit user action from
      Project context.
- [ ] Handoff uses the Electron-selected Project without asking the user to type a path.
- [ ] Agent Platform preserves Project/session/conversation context after handoff.
- [ ] Any remaining built-in file view is secondary and uses the same backend Project id/root as
      Project Chat.
- [ ] Handoff and file-view labels use Project/folder terminology.
