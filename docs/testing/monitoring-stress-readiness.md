# Monitoring preparation verification

Planning at staging50f6; actual outcomes belong in [results](../reviews/monitoring-stress-readiness.md).
Requirements/tasks: [manifest](../planning/monitoring-stress-readiness.md). No paid fixtures.

| Scenario | Requirement / boundary                                     | Assertion and retained evidence                                                                                                                           |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOG-T01  | LOG01, all actual launch configuration sites               | Audit/guard rejects missing or inherited log root, includes shared helpers and managed launch paths                                                       |
| LOG-T02  | LOG02, real production path resolution/backend log opening | Disposable fake backend success/failure/restart/cleanup preserves unrelated stdout/stderr sentinel bytes; own outputs retained                            |
| LOG-T03  | LOG01/02, actual Electron Git journeys                     | Existing three connected Git UI journeys pass retry0; real app/API/SQLite/Git, external GitHub/model fixtures; own logs and owned-process cleanup         |
| LOG-T04  | LOG01/02, adjacent native export                           | Existing native resource/export or Project journey passes with isolated logs; failure artifacts retained before cleanup                                   |
| OBS-T01  | OBS01, controlled worker clocks                            | Both stores distinguish exact append1000/read200/startup3000/existing-close timeouts without changing state/loss accounting                               |
| OBS-T02  | OBS01, controlled worker lifecycle                         | First failure survives termination exit and late ACK; no health revival, duplicate flood or false failure after existing busy retry                       |
| OBS-T03  | OBS01/03, privacy/observer boundary                        | Fixed schema rejects hostile extra/code/error/payload values; throwing observer does not alter execution, original safe failure or deadlines              |
| OBS-T04  | OBS02, real private API/status                             | After controlled storage failure, status exposes safe first failure without successful DB RPC; ordinary unavailable reads remain honest                   |
| OBS-T05  | OBS02/03, retained evidence/restart                        | Execute the finalized retained-evidence contract with real owned processes, verify causal safe fields survive the selected restart; no guessed durability |
| PRE-T01  | PRE01, actual retained staged app                          | Recording ready, bounded local export, original history/preferences after clean restart, staged source/build binding, free disk>=20GiB                    |
| PRE-T02  | PRE01, explicitly authorized live provider                 | One actual OpenAI UI response and saved matching diagnostics; no other provider/load/Stop inference from this test                                        |

LOG-T01/02 precede any native fixture. Focused unit/integration tests map directly to these assertions;
broader affected desktop/DB/API/contracts checks, build/types/lint/format and normal hooks remain.
If capture hot-path behavior is touched, retain the unchanged full nine-vector900-measured/990-call
benchmark and raw limits; instrumentation is not a waiver. No redundant live provider calls in CI.
All required/executed exact-head hosted checks, current actual Sonar/CodeQL findings, resolved review
comments and protected scan/VM evidence remain delivery gates. Scope-safe diagnostic review checks
record coverage/loss and fixtures; neither tool name nor an E2E filename establishes full coverage.

The existing [owner trial](../tasks/agent-platform-local-mvp-stress-review.md) remains30minutes,
max2sessions/20requests/disposableProject, one active run per session, agreed spend and stop criteria.
Only invite it after both P1 repairs' actual declared delivery and fresh applicable preflight.
