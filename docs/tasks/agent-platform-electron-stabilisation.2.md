# Task: Create Electron manual QA checklist

**Beads issue:** `agent-platform-electron-stabilisation.2`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.2.md`

## Summary

Create a repeatable manual QA checklist for owner testing of the Electron Project experience.

## Requirements

- Cover app launch.
- Cover native Open Project.
- Cover Project chat as default surface.
- Cover `/help`, `/help init`, and `/init`.
- Cover IDE handoff and return navigation.
- Cover file explorer/editor behavior.
- Cover Recent Projects reopen and active Project switching.
- Cover model/API key setup path at a smoke-test level.
- Cover user-facing copy checks so backend paths, `/workspace`, hashes, and internal states are not
  exposed as normal UI.
- Include a finding capture template.

## Implementation Plan

1. Create or update a manual QA checklist document under `docs/qa/` or `docs/demo/`.
2. Include step-by-step actions, expected outcomes, and failure recording fields.
3. Link the checklist from the Electron demo document if useful.
4. Run docs lint.

## Dependencies

| Upstream                                  | Downstream                                |
| ----------------------------------------- | ----------------------------------------- |
| `agent-platform-electron-stabilisation.1` | `agent-platform-electron-stabilisation.3` |

## Tests And Verification

- `pnpm docs:lint`
- `git diff --check`

## Definition Of Done

- Manual QA checklist exists.
- Checklist is specific enough that another person can reproduce the same pass.
- Checklist records expected and actual results.
- Checklist provides a severity/classification field for Beads triage.
- Docs lint and whitespace checks pass.
