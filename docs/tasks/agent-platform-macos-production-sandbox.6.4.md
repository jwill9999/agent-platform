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

## Current Implementation Notes

- Added [Command Runner Platform Adapters](../design/command-runner-platform-adapters.md).
- Linked the platform adapter boundary from [Desktop Runtime](../desktop-runtime.md).
- Windows is documented as a future adapter behind the existing `CommandRunner` contract, with WSL2,
  Hyper-V, or Windows Sandbox as candidate boundaries and host shell fallback explicitly forbidden.
- Linux is documented as a future adapter behind the existing `CommandRunner` contract, with user
  namespaces/Bubblewrap or a lightweight VM as candidate boundaries and host shell fallback
  explicitly forbidden.
- The final epic closure audit is prepared below but cannot pass until the remaining evidence tasks
  are closed.

## Current Beads Audit

The following VM work remains open and prevents `.6.4`, `.6`, and the parent epic from closing:

| Task   | Status      | Remaining sign-off                                                                                                            |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.6.1` | closed      | Live Apple Silicon VM evidence proves non-root, no-network, timeout/output, and filesystem behavior.                          |
| `.6.2` | closed      | Signed/packaged live repair smoke restored app-owned VM state and preserved Project data and diagnostics.                     |
| `.6.3` | in progress | Code-side signing verifier is implemented; signed/notarized artifact smoke must prove helper execution and `macos-vm` health. |
| `.6.4` | in progress | Platform adapter docs are implemented; final traceability closure is blocked by `.6.3`.                                       |

## Final Traceability Audit Draft

| Epic requirement                          | Owning task(s)           | Current evidence state                                                                                |
| ----------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Fail-closed production defaults           | `.1`                     | Complete in closed task evidence.                                                                     |
| Shared runner health/status contract      | `.2`, `.5.2`             | Complete in closed task evidence.                                                                     |
| Production runner architecture decision   | `.3`                     | Complete in ADR/task evidence.                                                                        |
| Native helper command surface             | `.3`, `.4.2`, `.4.3`     | Complete in closed task evidence.                                                                     |
| Bootable image source/build path          | `.4.2.1`                 | Complete with raw ARM64 `Image`/manifest evidence in closed task evidence.                            |
| Real VM boot and lifecycle                | `.4.2.2`, `.4.2.3`       | Complete in local evidence; staging/release evidence is still represented by `.5.4` and `.6.3`.       |
| Guest bootstrap and command service model | `.4.2.1`, `.4.3`         | Complete in closed task evidence.                                                                     |
| Command contract and workspace isolation  | `.4.3`, `.4.4`           | Complete in local evidence; staging/release evidence remains blocked by `.5.4`.                       |
| Staging asset availability                | `.4.2.1`, `.5.1`, `.5.4` | Complete; `.5.4` passed packaged macOS VM E2E on PR #227 with evidence upload.                        |
| Production packaging boundary             | `.5.1`, `.5.2`           | Complete in closed task evidence.                                                                     |
| User-visible packaged E2E behavior        | `.5.3`, `.5.4`           | Complete; packaged VM command execution and fail-closed behavior passed in staging on PR #227.        |
| Production resource and policy hardening  | `.6.1`                   | Complete; live VM evidence exists and `.6.1` is closed.                                               |
| Safe reset and repair                     | `.6.2`                   | Complete; signed/packaged repair smoke restored app-owned VM state and preserved Project data.        |
| Signing, notarization, and entitlements   | `.6.3`                   | Code-side verifier exists; signed/notarized artifact smoke remains open.                              |
| Future platform adapter boundaries        | `.6.4`                   | Documented in `docs/design/command-runner-platform-adapters.md`; docs lint passed for this increment. |

## Tests And Verification

- `pnpm docs:lint`
- Review of platform adapter documentation against the shared `CommandRunner` contract.
- Beads audit proving no open child tasks remain under the epic.
- Evidence audit proving every requirement in the epic requirements traceability table has a
  corresponding implementation/test artifact or a deliberately created follow-up outside the macOS
  production release scope.

Current local verification:

- `pnpm docs:lint`
- `pnpm format:check`
- `git diff --check`

## Definition Of Done

- Future platform work has explicit adapter boundaries and does not weaken macOS production safety.
- The epic has no unresolved implementation, packaging, staging, E2E, or release-hardening tasks.
- The final sign-off explains exactly what has been proven locally, in staging, and in the
  signed/notarized release artifact.

Current status: the first Definition of Done item is implemented. The remaining items are blocked
until `.6.3` is closed with required signed/notarized artifact evidence, then `.6.4` can perform the
final traceability audit and close `.6` plus the parent epic.
