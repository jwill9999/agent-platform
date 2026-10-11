# Current runtime recovery and retry baseline

September 22, 2026. Continuation of the [provider journey baseline](current-runtime-provider-journey.md).
Beads: `agent-platform-harness-baseline-x5`, `agent-platform-harness-baseline-x3`.

## Results and boundaries

Three additional Electron scenarios exercise the real frontend, managed API, SQLite, approval service,
harness, provider adapter and SDK stream parser. External provider responses and the fixed-command VM
runner are deterministic fixtures. No paid model calls or dependency changes. This is composed
application evidence, not real VM isolation or live model quality evidence.

| Scenario                                                               | Independent checks                                                                                                     | Result       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| Reload while approval is pending, then approve                         | Same approval/session; unchanged file before decision; exactly one appended line, success audit and saved final answer | Pass locally |
| Reload while approval is pending, then deny                            | Same approval/session; rejection audit; no appended line or successful tool execution; saved final answer              | Pass locally |
| One provider HTTP 503 before the first tool call, then normal approval | Attempt statuses 503/200/200; one approval, one file effect, one success audit and one final answer                    | Pass locally |

Both reload scenarios also send two concurrent repeats of the **completed** resume request. Both
responses identify the original resumed approval; provider calls, messages, audits and file contents
remain unchanged. This does not prove protection for simultaneous first resumes still in flight.
The first reload test run failed because the new test called the Fetch `status` property as a function;
the screenshot showed successful recovery. Correcting that test typo yielded both passing scenarios.
No production defect was repaired or behavior changed.

## Logging and login assessment

Each edit journey now requires two distinct run identifiers (original request and approval resume),
each with one matching `task_start`/`task_end`, a shared per-run correlation identifier and valid ordered
timestamps. Session and approval identities link both phases. Evidence includes streamed events,
durable approval/audits/messages, provider HTTP attempt statuses and before/after file content. These
checks establish useful diagnostic evidence for these journeys; they do not establish complete
monitoring, durable trace export, stall detection or a third-party dashboard. The provider attempt
ledger is test evidence, not newly added production telemetry.

Actual login is absent by design: `decisions.md` and the shared agent rules specify a single-user MVP
without authentication; `apps/api/src/infrastructure/http/v1/v1Router.ts` identifies the local stub.
There is no application sign-in route to test. The isolated API accepts these requests without a
user login. That is consistent with the MVP, but cannot satisfy a requirement for authenticated or
multi-user access. Provider API credentials and GitHub CLI authentication are separate capabilities.
The owner was asked whether “login” meant sign-in or logging; no auth system was introduced.

## Outstanding baseline gaps

- **Cancellation (X2):** Project Chat's composer exposes no Stop control; its send path has no user
  cancellation signal. Existing backend deadline/abort tests do not prove a frontend cancellation
  journey. UI cancellation cannot be marked passed without a defined user-facing capability.
- **Retries (X3):** ambiguous tool results after effects, exhausted budgets and composed execution
  limits still need dedicated evidence. A model HTTP retry before effects does not prove safe tool
  retries after effects.
- **Recovery (X5):** simultaneous initial resumes and backend process restart remain unproven. A
  renderer reload is not a backend restart.
- **Permissions (P2):** Ask/Automatic/Block settings permutations remain queued; these journeys reuse
  the existing explicit shell-write approval requirement.
- **Monitoring:** complete durable span history, waiting-state visibility and external visualization
  remain separate foundation work. Existing lifecycle events alone cannot locate every bottleneck.

Recommendation: retain the current stack while finishing these remaining scenarios. The new evidence
supports targeted reliability and visibility work; it supplies no reason for a broad framework change.

## Reproduction and artifacts

Build with Node 24 and the repository's installed pnpm, then:

```bash
pnpm exec playwright test -c apps/desktop/e2e/playwright.electron.config.ts \
  packaged-vm-command.e2e.ts --output=.agent-platform/recovery-full-results --reporter=list,html
pnpm --filter @agent-platform/api exec vitest run \
  test/sessionChat.integration.test.ts test/approvalRequestsRouter.test.ts test/sessionLock.test.ts
pnpm --filter @agent-platform/harness exec vitest run \
  test/retry.test.ts test/deadline.test.ts test/backpressure.test.ts test/toolDispatch.test.ts
```

On this machine set `AGENT_PLATFORM_E2E_GIT_BINARY` to the available bundled Git binary because
Apple's Git is blocked by its unaccepted Xcode license. This affects only disposable test Git setup.
The repository product retains its original Git behavior.

Local artifacts are under `.agent-platform/recovery-full-results`: each edit scenario attaches
`journey-evaluation.json` and `journey-trace.zip`. The evaluation records source HEAD; an uncommitted
local run identifies its base revision, so hosted artifacts from the committed PR are authoritative
for exact-source validation. `recovery-results` retains the initial test failure; `recovery-pass-results`
and `retry-results` retain the focused passing runs. Artifacts contain only disposable fixture data.

The focused backend checks passed: 53 API tests and 93 harness tests. All nine Electron scenarios passed locally. Hosted quality checks are recorded in the PR; do not
infer their status from these local counts.
