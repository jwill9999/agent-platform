# PR gate repair assessment — 24 September 2026

Owner authorized assessment and repair of SonarCloud grading and desktop-E2E failures on the existing
permission-category task branch, targeting the harness-backlog feature branch. No merge or staging
permission is implied. This is the supervised direct path; the managed pilot remains blocked by its
separate document-binding and approved-plan prerequisites. Existing tasks `.15` and baseline `x5`
retain ownership of the respective repairs; no duplicate backlog was created.

## Desktop failure

The hosted run `35942411521` failed the node-double rejection journey at the APPROVAL_REJECTED event
assertion. Its retained journey evaluation contains that exact event, a durable rejected approval,
a denied tool audit and unchanged file contents. Trace network entries confirm the rejection request.
The UI renders Denied before the resume response is captured. Promise.all over the existing capture
array does not wait for a response callback that has not yet happened.

The repaired test polls current captured events for the terminal result before reading final backend
records. It retains the approval-required event, durable status/resume timestamp, audit, unchanged-file
and paired lifecycle assertions. No application behaviour or permission semantics changed. Three
repetitions each of deterministic, provider-HTTP and reload rejection journeys exercise the fix.
These are real Electron/API/SQLite journeys with declared provider and command-runner doubles, not
live model quality or real packaged VM isolation evidence.

## Sonar findings and repairs

| Finding                                | Assessment and correction                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API traversal in reviewer gateway      | Prior route regex constrained path segments but retained arbitrary query input. Now choose fixed upstream path constants, allow only bounded client_version and encode its value. Add negative query/traversal tests. |
| CLI config path from arguments         | Intended caller was a trusted coordinator, but a raw file-path argument was unnecessary. CLI now accepts bounded JSON on stdin; it never opens a supplied config pathname. Documentation and input tests updated.     |
| Fixture PATH lookup                    | Use the image's absolute Codex executable path.                                                                                                                                                                       |
| Root image default                     | Set USER node; generated launches still enforce their non-root UID and mount restrictions.                                                                                                                            |
| Package installation lifecycle scripts | Install pinned Codex with --ignore-scripts; actual image version smoke test and runtime probes confirm it remains functional.                                                                                         |

## Verification and evidence

- [Independent repair review](evidence/pr271-repair-critique.json): no confirmed regressions in the supplied fixes. Requested runtime evidence is supplied separately below. Its snapshot precedes moving the same terminal wait ahead of backend assertions; no claim of reviewing that later ordering.
- [New-image runtime evidence](evidence/pr271-capability-hardening.json): captured inventories, prohibited-call rejection, read-only/excluded-grant boundaries, fixed gateway and actual failure cleanup, with source and executed-artifact hashes.
- Hardened image smoke test reports Codex 0.156.1; default image user is non-root.
- Final local verification: 721 Linux package tests pass, 13 optional tests skipped; all nine repeated Electron rejection journeys pass. Four actual runtime/config probes pass separately. Build, desktop typecheck and lint pass. Forwarding success and redirect refusal have additional gateway regression coverage.
- The native pre-push hook depends on unavailable licensed Apple Git. Push uses the documented hook bypass after the equivalent Linux package suite; no licence or host settings were changed.
- Hosted SonarCloud and full desktop checks must pass on the pushed revision before recommending integration. Earlier passing unit tests alone are insufficient.

The earlier project-access failure passed on retry; it was not treated as proof of another product
defect. The full hosted desktop suite will exercise it again. Staging-only packaged VM testing remains
separate. Apple Git's licence restriction still affects native package tests; Linux package verification
and the existing permitted Git wrapper provide the documented fallback without accepting that licence.
