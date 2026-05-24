# Task: Document future platform adapters and close epic

**Beads issue:** `agent-platform-macos-production-sandbox.6.4`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.4.md`  
**Parent task:** `agent-platform-macos-production-sandbox.6`

## Summary

Document how Windows and Linux production runners will extend the same `CommandRunner` contract,
then close the macOS epic with complete evidence.

## Requirements

- Document the Windows runner target and likely virtualization boundary.
- Document the Linux runner target and likely sandbox boundary.
- Keep host execution development-only in future platform docs.
- Record all macOS release evidence: packaged E2E, staging gate, signed artifact smoke, and
  quality gates.
- Add a final traceability audit that maps every epic requirement to a closed Beads task and its
  evidence.
- Confirm no child task was closed by deferring required implementation to an undocumented future
  task.
- Close `.6` and the parent epic only when all child tasks are closed.

## Tests And Verification

- `pnpm docs:lint`
- Review of platform adapter documentation against the shared `CommandRunner` contract.
- Beads audit proving no open child tasks remain under the epic.
- Evidence audit proving every requirement in the epic requirements traceability table has a
  corresponding implementation/test artifact or a deliberately created follow-up outside the macOS
  production release scope.

## Definition Of Done

- Future platform work has explicit adapter boundaries and does not weaken macOS production safety.
- The epic has no unresolved implementation, packaging, staging, E2E, or release-hardening tasks.
- The final sign-off explains exactly what has been proven locally, in staging, and in the
  signed/notarized release artifact.
