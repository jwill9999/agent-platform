# Acknowledged Stop for shared harness runs

**Beads:** `agent-platform-harness-r3.cancel`, P1 IN_PROGRESS; owner-approved implementation, not completed.
**Parent:** `agent-platform-harness-r3`, still deferred. **Plan:** [bounded Stop](../planning/project-chat-stop-mvp.md).

## Task requirements

Implement STOP-1–STOP-7 in the plan after owner approval: a durable, session/logical-run scoped shared
application capability and typed read/Stop API; Project Chat is the first client. Future voice/CLI
must not require a rendered button or access to React state. Stable identity is available before
async preparation; Stop bypasses the execution mutex and commits a fence before acknowledging.
Controlled acknowledgement <=2s does not mean the remote action is terminated. No new admission,
retry or resumed approval follows the fence; prior admitted effects remain honest and unrolled back.

Preserve current permissions and correlated diagnostics. Distinguish user_stop, timeout,
client_disconnect, confirmed cancellation and outcome_unknown. Retain partial replies and earlier
effects; old-process unfinished work is unknown and never automatically replayed. Handle native
operations whose underlying promise continues after timeout. Shared control records live in the app
DB, not the optional lossy diagnostic queue. Observe bounded reads/writes and retention without
erasing active/unknown fences. Broader recovery, status dashboard, voice/CLI clients and SDK upgrades
are not part of this task. MON-1/QA-1 are separately owned follow-ups, not hidden Stop work.

## Dependency order and authority

Hard upstream: `agent-platform-harness-v1` CLOSED. The owner approved this bounded native task
on 16 October; only its hard edge to `agent-platform-harness-review-gate` was removed. The global
review-gate remains OPEN and its other dependencies stay intact. Parent relationship is scope, not a prerequisite to finishing
this bounded task. Existing downstream `harness-r3.reconcile` and `harness-v4.local` stay open/gated.
New queued monitoring and owner stress tasks depend on this task; they do not block Stop completion.

## Implementation and paths

Implementation uses `feature/project-chat-stop` from qualified staging `cf5f0452`, with
`task/project-chat-stop` retaining the reviewed planning ancestry. The feature is not merged. Work packages within this one task: main DB
control/schema + contracts; shared control service/routes + dispatch/approval fencing; client state,
safe diagnostics and connected acceptance. A two-day feasibility checkpoint precedes UI expansion.

Expected paths: `packages/contracts/src` and tests; `packages/db/src/repositories`, schema and
`packages/db/drizzle` migrations/tests; API application run-control service, HTTP routes and tests;
harness llmReason/toolDispatch/native cancellation and tests; supported MCP adapter tests;
web Project Chat composer/hook/BFF and connected tests; desktop E2E; linked plan/test/review/session.
No workflow-control runtime, paused branch, general CLI/voice implementation, new provider, global
config, broad router refactor, unrelated dashboard or production architecture changes.

## Tests and Gherkin E2E Strategy

[Verification S01–S15](../testing/project-chat-stop-mvp.md) owns the exact requirement mapping,
fixtures, actions, expected UI/backend/effects, privacy and evidence. Unit/integration are necessary;
headless contract, connected browser/Electron and a real packaged VM representative are mandatory.
External providers are declared deterministic boundaries; no paid calls implied.

```gherkin
Feature: Stop is a shared harness capability
  Scenario: A client stops an active run without a renderer
    Given the API has published an active logical run before provider setup
    When a trusted client requests Stop for that session and run
    Then the backend durably acknowledges the fence within two seconds in the controlled fixture
    And no subsequent provider tool or retry is admitted for that run
  Scenario: The first UI client uses the same authority
    Given Project Chat has an active run with a pending approval
    When I select Stop and later try to approve its action
    Then I see the authoritative stopping or cancelled state
    And the pending action is not dispatched
  Scenario: In-flight work cannot confirm termination
    When Stop is acknowledged after that action was admitted
    Then I see that its effect remains uncertain until settlement is proven
    And completed effects are not described as rolled back
```

## Definition of done and sign-off

All STOP requirements/S scenarios pass on recorded exact source; privacy and existing Git/MCP/context/
reply/permission regressions pass; actual effects/control rows independently inspected. Normal
build/typecheck/lint/format/tests, Sonar/Problems fallback, hosted checks and resolved reviews pass.
Independent source/results review, full mirrors/readbacks, pushed task branch and guarded task-to-
feature PR merge/tree verification required before task close/readback/Dolt sync. Staging needs its
own current full scan/actual VM/protections and actual merge grant; main never implicit. Two repair
iterations per recurring finding trigger bounded replanning, not weaker tests.

Owner planning acceptance and implementation authority are recorded. Shared durable control,
headless/API, approval/retry/sensor fences, Project Chat and safe V1 diagnostic linkage are implemented.
Early dirty-tree test provenance remains in the results; final identity is the reviewed file-hash
receipt plus immutable pushed source/PR metadata in Beads and publication receipts.

Current reviewed application 9044859d includes the bounded DB scheduling repair; final fresh source
proofs must bind browser Current904 Docker browser16 passed Stop5/reply1/Git5/MCP5 with reviewed source/effect/artifact and recovered owned-cleanup evidence; no stress/load claim., Electron Fresh current904 Electron67 passed first attempt in655.337seconds with no skipped/flaky/retried cases; Stop effects, diagnostics,503retry and Project restoration independently reviewed;20controlled-helper cases are included, signed realVM is separate., actual signed VM
Fresh current904 signed realmacOSVM Stop representative passed1/1 in48.556seconds;5.047msack, actual guest start/lateeffect and honest unknown, safe43-event report, selected49runtime bindings, signature and trace integrity independently reviewed. and unchanged normal push/API Normal unchanged hooks passed cycles, six-package build/typecheck and 2206 tests, including full API525; exact atomic feature/task remote refs verified without bypass.. Prior f9 browser 14/67/VM 1 results
remain historical, not changed-source qualification. The 900-measurement benchmark after rebuilt DB
passes unchanged20 ms/2 ms bounds with 1540 healthy events/mode, zero drops and maxPending 56; 23
focused DB controls pass. Failed normal524/1, fresh-worker24 drops and22/1 timing-boundary attempts
are retained. Actual1000 ms close can return before one owned 32-event loss settles; eventual exact
accounting is tested without changing that boundary. Docker normal restoration completed; lifecycle
ownership remains a separate IN_PROGRESS operational investigation, not a new hard dependency. Feature
pipelines/reviews/tree, seven full mirrors/readbacks, final critique and task sync remain required;
protected staging has separate scan/VM/protection/comment/actual merge authority gates. No delivery
or stress-ready claim follows local proof.
See the [implementation record](../reviews/project-chat-stop-results.md). Older September managed
contract wording is historical and refined by this native scoped plan under ADR0005; broader scopes,
PR283 and paused orchestration stay untouched. Monitoring and owner stress testing remain blocked
by their declared dependencies; no completion or stress-ready claim is made.
