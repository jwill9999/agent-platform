# Native Workspace listing verification

Spec: [native workspace repair](../tasks/agent-platform-native-workspace-listing.md).
Results: [review and evidence](../reviews/native-workspace-listing.md).

## Navigation follow-up

NAV-T01 uses the actual Sidebar/HomePage selection logic with deferred external navigation/Project
lookup boundaries: Project→Personal→late Project must stay personal, including selected session,
agent and model context. NAV-T02 covers resumed personal work→pending Project→newer Personal→late
Project, while plain Personal reselect preserves resumed/pending work. NAV-T03 covers current Project
completion, latest intent, back/forward, Settings route navigation, missing listeners and modified links.
These component/application controls establish controlled ordering, not the old hosted trace ordering.

NAV-T04 retains the real Electron restart/scoping journey, BFF/API/SQLite and existing assertions/
deadlines. Explicitly trace each manually launched context, attach bounded route/status and scope
metadata, and retain disposable profile/logs on failure. This journey does not call a model. Existing
connected SDK/Stop/Git and Workspace/diagnostic/migration journeys remain required regressions;
their deterministic provider doubles do not establish live model readiness. Fresh full hosted gates
and actual rebuilt owner preflight qualify changed source; retry success does not clear a flaky case.

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
