# Native staging remedies — verification plan

Linked [execution manifest](../planning/native-staging-remedies.md) and task specifications
define owner authority and source scope. These scenarios are planned unless the results document
records an actual tested revision and outcome. Beads remains authoritative for scheduling.

| Scenario                          | Requirements / task | Assertions and evidence                                                                                                                                                                                                                                        |
| --------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — safe runner replacement      | Runner spec         | GitHub idle state and exact Listener identity; official package checksum; graceful stop; no old installation/credential copy/service edits; APFS installation/work/action/temp directories and required labels                                                 |
| R2 — real preparation and VM      | Runner spec         | Actual current-head GitHub job completes action preparation, build/sign/package/signature verification and real packaged Electron/VM command; evidence artifacts, backend effect and denied-mode assertions from existing test; skips/cancellations never pass |
| R3 — build-output discovery       | Runner spec         | Swift's actual output layout is resolved, quoted paths handled, missing/invalid output fails; explicit helper override remains; signing and asset hashes are retained                                                                                          |
| A1 — exact archive classification | AP2/AP3             | Real original220 Git objects, exact modes/blobs/SHA256/sizes/count/bytes,139 JSON; dependency-free tests with more than100 changes and complete NUL enumeration                                                                                                |
| A2 — negative data boundary       | AP3/AP4             | Unknown/mixed/partial/empty/edit/delete/rename/mode/symlink/extra workflow or consumer changes cannot choose archive route; malformed policy, duplicates/path controls and missing objects fail closed                                                         |
| A3 — provenance                   | AP5/AP6/AP7         | Protected-base policy, positive archive-only protected staging dispatch, actual event/ref/source/workflow and receipt linkage; reject stale/mismatched/wrong repo/ref/forged status/receipt/head/base and candidate policy self-exemption                      |
| A4 — bootstrap                    | AP1/AP5             | Real small policy staging PR executes complete ordinary Promptfoo analysis plus all required protections/actual VM/reviews before trust adoption; no dispatch on unmerged policy authorizes it                                                                 |
| A5 — delivered archive            | AP2/AP4/AP7/AP8     | Authored primer bookkeeping first fully scanned; actual archive-only PR288 automatic qualification plus independent protected dispatch and merge-time verification; preserve earlier failed analyses and all 220 bytes                                         |
| A6 — full baseline                | AP8 / parent        | Rehearsed PR286 preserves original source plus necessary bookkeeping, both histories, actual new-head full analysis/VM/reviews/protections, actual merge tree/source preservation and guarded branch cleanup                                                   |

Local script/Git fixture tests exercise trust boundaries and effects without executing candidates.
The archive independent security/data review checks all source blobs/JSON and known secret/static
patterns, while disclosing retained metadata, dynamic-consumer uncertainty and non-exhaustive rules.
Actual GitGuardian/CodeQL checks supplement this evidence; they do not imply Promptfoo coverage.

Use normal build/typecheck/lint/format/Markdown/cycles/affected tests and push hooks. Hosted Sonar
and security findings are inspected alongside CI even when another job fails. No product UI change;
the connected boundary is GitHub Actions/protected source/data qualification plus the existing
real packaged desktop VM journey. Provider services and host prerequisites remain actual external
dependencies, never fixtures presented as connected proof.
