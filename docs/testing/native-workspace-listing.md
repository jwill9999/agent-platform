# Native Workspace listing verification

Spec: [native workspace repair](../tasks/agent-platform-native-workspace-listing.md).
Results: [review and evidence](../reviews/native-workspace-listing.md).

| Scenario                                        | Requirements | Real boundary / checks                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NW-T01 managed default and configured overrides | NW1,NW2      | Supervisor unit env plus actual managed Electron without injected workspace root; root under isolated data, Docker defaults unchanged                                                                                                                           |
| NW-T02 listing/download/restart                 | NW1,NW4      | Native UI + separate Chromium + BFF + real API + actual filesystem; empty state, generated report, exact downloaded bytes, restart persistence                                                                                                                  |
| NW-T03 denied outside/traversal/symlink         | NW2,NW4      | Existing PathJail plus connected requests; no outside listing/download/effect; real outside canary unchanged                                                                                                                                                    |
| NW-T04 safe failure and logging                 | NW3,NW4      | Real failed root initialization plus separately injected post-initialization readdir/stat failures and benign ENOENT control, safe error, bounded phase/category with request correlation; logger failure preserves response; policy/monitoring still available |
| NW-T05 adjacent prevention                      | NW2,NW4      | Existing diagnostic export and migration/native regression journeys; source-bound monitoring coverage and preserved data/key on actual app                                                                                                                      |

Disposable profiles/ports and deterministic files only; no provider, inference, VM execution or paid
calls needed for these listing journeys. Existing full packaged VM CI remains required for staging
qualification; local listing tests do not establish VM isolation. Capture retained failure traces,
backend logs and compact allowlisted request/file-effect receipts before disposable cleanup. Run local
single-worker gates and normal hooks; task PR must pass every executed/required current-head hosted
job and clear actual Sonar/review findings. No skips, auto-retry success or mocked listing substitutes.
