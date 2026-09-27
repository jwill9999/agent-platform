# Run discovery and guarded admission qualification

Beads: `agent-platform-pilot-zero.17`, requirement R1 and scenarios SP-01–SP-03.
Source baseline: PR276 merge `87c5cc469736de6d1508ec52309b64da62c3d740`.
Branch: `task/run-discovery-admission`; destination: `feature/harness-backlog-review`.
Status: locally qualified at source `d4580fe`; final hosted checks pending on [PR277](https://github.com/jwill9999/agent-platform/pull/277). No live pilot or merge.

## Behavior and authority boundary

Canonical discovery resolves the workspace path, derives its expected journal location, and opens
only an existing database read-only. It requires an explicitly provisioned durable workspace binding,
validates required schema and contract/index identity, and reports absent, terminal-only, matching,
conflicting or unknown state. Missing, corrupt, unbound and inconsistent journals cannot imply absence.
The lookup includes contract tasks and journaled repair-child reservations, material and policy
identities, terminal history and scoped lease owners/epochs/expiry. Expired leases do not erase an
unfinished run; recovering, cancelling and escalated states continue to reserve ownership.

Production run creation repeats conflict checks in an immediate SQLite transaction. Repeating the
same run ID and contract returns the existing record without restarting or changing it. Another run
or changed material cannot acquire an already-owned task. Repair-child reservation uses the same
atomic conflict check so reversing the order cannot bypass exclusivity. Historical conflicting-run
fixtures use the existing test-only creation seam to exercise downstream defenses.

The CLI and read-only MCP expose discovery, not unrestricted launch. An admitted journal record is
not execution authority: document approval, role policy, leases and existing execution gates still
apply. R2 implementation import and R3 coordinator completion remain outstanding. This component
neither passes the single-task pilot nor changes worker MCP access or messaging authority.

## Operator setup

Provision or upgrade a chosen journal explicitly with the existing migration command plus the
canonical workspace root. This is a trusted operator mutation and must not be invoked by discovery:

```sh
node packages/workflow-control/dist/cli.js migrate <database-path> <canonical-workspace-root>
node packages/workflow-control/dist/cli.js discover <codex-home> <workspace-root> <task-id> [material-digest] [policy-digest]
```

The database must occupy `<codex-home>/workflow-control/<canonical-path-sha256>/workflow.sqlite`
for canonical discovery. Binding rejects existing foreign-workspace contracts or a different durable
binding. An empty journal gets its identity only through explicit provisioning. Read-only discovery
does not automatically bind or initialize older journals. The actual owner journal was inspected
read-only before implementation; four cancelled runs and zero live leases were observed. It was not
migrated or bound as part of these tests.

For MCP, configure `WORKFLOW_CONTROL_DB` for existing known-ID status/preview and set `CODEX_HOME`
and `WORKFLOW_WORKSPACE_ROOT` for canonical task discovery. The latter computes its own canonical
journal path; a known-ID database is not evidence that it is the canonical inventory. Missing discovery
scope returns unknown. MCP startup opens its status store read-only and requires an existing database.

## Review and verification evidence

[Review one](run-discovery-evidence/review-1.json) identified workspace index divergence, incomplete
schema handling, missing durable workspace binding and incomplete race/state evidence. All were
addressed. [Review two](run-discovery-evidence/review-2.json) found the repair-child reverse-order race
and lease schema validation gap; both now have enforcement and regression tests.

[Review three](run-discovery-evidence/review-3.json) found repair reservation state/fencing outside the
transaction and omitted closeout leases. Both are corrected; separate-process cancellation and each
lease takeover are covered before transaction acquisition, along with active/expired closeout scope.
[Final review](run-discovery-evidence/review-4.json) reports no actionable findings; it saw focused
evidence, while the complete Linux result below finished separately.

[Focused execution](run-discovery-evidence/focused.txt): 26 tests passed, including two independent
process races synchronized after both callers observed absence. Tests check actual SQLite records,
read-only database bytes, MCP tool responses, malformed journals and rejected ownership. Disposable
journals are used; no production run is started. The [final Linux suite](run-discovery-evidence/linux-regression.txt) passed 996 tests with
63 optional checks skipped after all corrections.
Native full-suite failures included macOS path/timing limitations and earlier fixture conflicts;
Linux is the full-suite qualification environment. Optional Docker/model suites are not claimed run.
The application frontend is unchanged; these tests establish infrastructure behavior, not UI coverage.

Build and package lint passed after the quality refactor; monorepo typechecking passed after the
functional corrections. Hosted verification remains a separate gate. Earlier native failures are not
presented as a passing native full suite.

Sonar initially reported five findings despite its overall passing gate. The
[quality refactor](run-discovery-evidence/quality-refactor.diff) extracts validation, status selection
and CLI discovery without changing behavior, and consolidates the filesystem import.
[Review five](run-discovery-evidence/review-5.json) requested the diff and updated evidence;
[review six](run-discovery-evidence/review-6.json) checked both and found no actionable findings.
The 26 focused checks and full Linux suite (996 passed, 63 optional skipped) passed again.
Hosted Sonar on `d4580fe` reports zero open issues. Final publication-head hosted checks remain pending.
