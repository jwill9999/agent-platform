# Current-runtime provider-to-tool journey

19 September 2026. Beads owner: `agent-platform-harness-baseline-x6`; shared evidence for T1/P1.
The owner requested current-functionality verification before a stack change. No production code,
SDK versions, approval policy or evaluator activation changed.

## Result

**PASS for the approved/denied file-edit family.** All six scenarios in the shared Electron command
file passed locally: two pre-existing command scenarios, two reasoning-double edit scenarios and
two new provider-HTTP edit scenarios. Build, scoped lint, explicit E2E TypeScript checking and
112 desktop unit tests passed. Sonar/IDE diagnostics are unavailable locally; these checks are the
repository fallback. Hosted checks remain a separate gate.

| Observation                 | Approve                                   | Deny                                        |
| --------------------------- | ----------------------------------------- | ------------------------------------------- |
| File while approval pending | Original contents                         | Original contents                           |
| File after settled response | Exactly one appended line                 | Original contents                           |
| Durable approval            | Approved and resumed                      | Rejected and resumed                        |
| Successful tool audit rows  | Exactly one                               | Zero; denial recorded                       |
| Provider requests           | Two                                       | Two                                         |
| Tool result identity        | Original tool-call ID retained            | Original tool-call ID retained              |
| Provider result             | Successful command result and output      | Explicit APPROVAL_REJECTED result           |
| Frontend                    | Approved action complete and final answer | Denied card and rejection plus final answer |
| Persisted final answer      | Exactly once                              | Exactly once                                |

The model request includes the actual exposed tool definition. The provider fixture splits tool
arguments across stream frames; real SDK parsing reconstructs the call. No provider result exists
before the owner decision. Request count and model/path validation fail unexpected fixture use.

## Evidence boundaries

Real layers: Electron UI, renderer/BFF, application API, saved model selection, provider factory,
SDK stream parsing, reasoning, graph, permission/approval handling, SQLite approval/message/audit
records and the disposable file postcondition.

Controlled boundaries: the external model's HTTP responses and the fixed VM command runner. The
runner recognizes only the existing fixed test command and appends to the disposable fixture file.
This is not real-model quality, live Ollama/OpenAI/Anthropic compatibility or VM isolation evidence.
Ordinary chat's existing omission of critic/DoD evaluators is preserved.

The HTTP fixture binds loopback. Provider-mode subprocesses preload a fetch guard rejecting remote
hosts; this guards SDK fetches, not every possible network API. Stored model credentials are synthetic.
The tests use separate projects/databases/ports and close the provider and application after use.
No paid model calls are made.

Each edit scenario preserves `journey-evaluation.json`, readable summary and an explicit Electron
trace. JSON contains provider requests, application streams, backend events, refreshed durable
records, file contents, milestones and source revision. All data is disposable fixture content;
temporary root paths are replaced. Approval/session identity correlates a resumed run even when its
run ID changes. A full durable graph span tree is still unavailable.

## Reproduce

Use Node24 and the locked dependencies. Build first, then run from the repository root:

```sh
pnpm build
PLAYWRIGHT_HTML_OUTPUT_DIR=.agent-platform/provider-journey-report pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts packaged-vm-command.e2e.ts --output=.agent-platform/provider-journey-results --reporter=list,html
```

Use `--grep provider-http` to select the new pair. On hosts where `/usr/bin/git` is unavailable,
set `AGENT_PLATFORM_E2E_GIT_BINARY` to an existing trusted Git executable; this affects test fixture
setup only. The local run used the bundled Git because the system Git requires Xcode licence
acceptance. No machine licence settings were changed.

## Failures investigated

The first new run attempted model configuration before managed backend readiness. The fixture now
waits on the readiness endpoint. The next denial assertion required an exact standalone final-answer
text node, but the trace/screenshot showed rejection and final answer together. The assertion now
checks visible contained text and independently requires exactly one persisted final answer. These
were test setup/locator defects; no product repair was needed for this family.

## Remaining baseline

X6 remains open: negative provider/error/interruption and usage permutations and other provider
protocols are not completed by this pair. T1/P1 gain composed evidence but their broader coverage
must be reconciled before closure. Ask/Auto/Block, replay/concurrency, context, cancellation,
retry/duplicate effects, persistence/recovery, planning and evaluator scenarios remain separately
tracked. Keep stack comparison queued while reviewing this baseline and selecting the next family.
