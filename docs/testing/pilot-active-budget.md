# Pilot active-budget verification

Owner task: `agent-platform-pilot-active-budget`; requirement IDs B1–B4 in its canonical spec.
Status: planned checks, not results. [Repair plan](../planning/pilot-active-budget/plan.md).

## Scenarios

B-T01 / B1+B2: Validate limits and authority narrowing; reserve through two independent SQLite
connections under concurrent/serialized writer contention. Sum allowances stays within the aggregate.
Reject overflow, missing identities, mismatched policy, role/run/deadline and unsupported integers.
Exhaustion persists and prevents fresh admission; failed transaction never permits dispatch.

B-T02 / B2+B3: Close/reopen the journal, retain crash-before-launch charges and immutable deadlines;
replay cannot replenish; stale fence or changed contract rejects. Recovery adopting previously started
execution cannot renew its deadline. Backward/forward clock change is conservative, with blocked or
expired authority and independently preserved accounting.

B-T03 / B3: Real child process under the phase-runtime fixture exceeds its work allowance; record
interruption, revoke the fixture credential, verify owned process/container settlement through the
existing launcher seam, deny acceptance after timeout. Coordinator transport cancellation must also
settle its ordinary descendants. Include reservation commit failure, interruption failure, startup
delay, cancellation and cleanup deadline overrun. This fixture uses simulated Docker/provider replies;
it proves composed supervisor control but does not claim real Codex/container or hostile-agent isolation.

B-T04 / B2+B3: Retries and repair children consume the same run total; idle waits do not replenish it;
simultaneous exhaustion/completion/recovery cannot dispatch after the durable fence. Cleanup remains
permitted for containment only. No returned result or coordinator transition after expiration.

B-T05 / B4: Existing connected phase fixtures return typed evidence from a real child process through
the journaled scheduling/result path. Assert persisted reservations and worker deadlines independently
of reported text. Report charged allowance, measured elapsed duration, failed/cancelled/uncertain
execution identities and cleanup outcome. Broader real-client/application qualification remains an
explicit .17 gate; do not close readiness or launch from fixture-only evidence.

## Gates and evidence

Commands: pnpm --filter @agent-platform/workflow-control build, typecheck, lint, and test; use the
focused budget/contracts/lifecycle/phase-runtime/coordinator-transport tests first, then one full
package regression. Validate formatting and touched-file diagnostics. Preserve command logs, exact
source/contract/manifest hashes and independent review findings/dispositions in the result report.
Hosted required checks apply to the final cumulative segment head, including verify, desktop-e2e,
e2e, docker, dependency cycles, docs lint/link checks, GitGuardian and SonarCloud. Feature-targeted
staging-only packaged macOS skip is expected and is not a pilot application pass.

No user-facing application code or behavior changes are planned by this budget task. Existing
connected Electron assertions are retained and remain required for overall pilot readiness under
the separate runner task; this is a reasoned layer boundary, not an omitted readiness gate.

Required failures, uncertain cleanup or unexecuted required scenarios block task sign-off. Publish
actual results and remaining gaps; do not present planned scenarios as passing evidence.
