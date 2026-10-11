# MVP reliability and basic visibility proposal

Status: proposed implementation plan, not approved for execution. September 23, 2026.
Owner approved the planning boundary and smaller in-app status panel, then separately authorized
baseline tests and the bounded permission repairs now merged in PR270. The owner has authorized
this plan reconciliation and independent review. Broader implementation remains unapproved.
Beads remains the scheduling authority; no new runtime implementation agents are assigned.

## Recommended decision

Keep the installed stack. Finish the remaining baseline evidence, establish a small durable local
run/operation record, add acknowledged Stop and conservative interrupted-action handling, then show
that state in the existing chat UI. Verify the composed journey before considering staging.

The goal is trustworthy connected-local operation: users can tell what is happening, stop further
work, and inspect an uncertain result without the app accidentally repeating a side effect.
The prior recovery baseline established reload approve/deny, completed-resume replay and a single
pre-effect provider failure. The integrated permission repair adds representative Ask/Auto/Block
shell-write journeys and truthful reload/denied/unavailable displays; all ten executed hosted checks
passed at its final source, including 22 Electron tests. These results do not prove all policy
categories, direct file tools, first-resume races, backend restart, ambiguous tool outcomes or Stop.
External model HTTP and command-runner boundaries are fixtures; packaged macOS VM testing was skipped.

## Existing tasks and proposed sequence

| Order | Beads scope                     | Work and completion boundary                                                                                                                                                                                                                                                             |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | harness-review-gate             | Owner approves this bounded current-stack tranche and its relationship to the older broad plan. No other task is implicitly activated.                                                                                                                                                   |
| 1     | harness-baseline-p2, x2, x3, x5 | Reuse four existing test specs. Characterize Ask/Automatic/Block precedence, cancellation/disconnect, ambiguous retry, concurrent first resume and backend restart. Record known missing capability as a finding linked to the children below; assessment closure is not a runtime pass. |
| 2     | harness-v1                      | Refine the existing event-contract task with a minimal durable local run/operation record and safe read interface; details below.                                                                                                                                                        |
| 3     | harness-r3.cancel               | New bounded child: acknowledged Stop, no further dispatch, truthful in-flight limitations.                                                                                                                                                                                               |
| 4     | harness-r3.reconcile            | New bounded child: persist effect intent, prevent blind replay and classify interruption.                                                                                                                                                                                                |
| 5     | harness-v4.local                | New bounded child: simple local status/diagnostics panel, independent of external dashboards.                                                                                                                                                                                            |
| 6     | harness-v5.mvp                  | New bounded child: complete frontend/backend acceptance and retained evidence.                                                                                                                                                                                                           |

All abbreviated IDs above have prefix `agent-platform-`. The four new children refine subsets of
existing parents; none replaces, closes or weakens the parents. Parent-child relationships express
scope, not parent completion as a prerequisite. Existing V4/V5 blockers on broader tracing and
Phoenix remain unchanged. Their local children carry their own explicit review/V1/behavior blockers.
The old modernization, persistent-saver and broader recovery tasks remain deferred or review-gated.

The review gate must record approval for these specific children to run before their broader parents,
and the proposed V1 refinement, without treating that as approval for the old modernization program.
If closure of the global gate would activate unrelated work, leave it open: record a scoped approval
and replace only this tranche's gate edges with a new scoped decision at that time. No such edge
removal or activation is performed by this planning change. Refresh and reconcile this condition
before converting the draft into a runnable managed plan.

The contract gives a sequential Git order to bound simultaneous work; additional ordering between
otherwise independent baseline rows is scheduling preference, not a new Beads blocker. Existing
baseline specs retain their own broader completion criteria. Do not duplicate already-passing tests.

## Reconciled baseline and authorization checkpoint

The permission UI repair (`agent-platform-permission-ui-consistency`, PR270) is merged and closed.
Saved policy now survives listing errors, denied shell actions have terminal visible output, and
failed listings show unavailable rather than empty/zero files. Enforcement and approval precedence
are unchanged. The sampled high-risk append requires one approval for both Ask and Auto, while
Block has zero approvals and no file effect. This is not a claim about every Auto category.

P2 remains in progress for broader categories/direct file tools. X2 cancellation remains open;
X3 retry and X5 recovery remain partial. Reuse passing journeys rather than duplicate them.
The completed repair is evidence, not a new unfinished contract task or permission to reopen product
scope. The proposed sequence above applies to the remaining work.

The owner's earlier planning-boundary approval is historical evidence of intent, not execution
approval for this refreshed material digest. The global review gate stays open, existing blockers
remain, and no task activation or broader runtime authorization results from reconciliation.
Independent review validates consistency; a later owner decision still governs execution and merge.
Prior exact review artifacts are retained in `review-pre-reconciliation/`; the current manifest and
final review bind the revised proposal. The unchanged policy digest remains separately validated.

## Minimal state and event foundation: proposed V1 refinement

- Keep existing correlation/session/run/approval identifiers; add stable operation and attempt identity
  where absent. An approval resume may create a new run linked to the original operation. No IDs are
  reconstructed from timing alone. Include schema version, monotonic per-run sequence, parent link,
  safe action category, current state, timestamps and last heartbeat. Child IDs are optional until used.
- Persist mandatory run/control state and effect intent in SQLite; retain event metadata sufficient to
  reconstruct the local timeline. V1 defines the schema/read model; reconciliation implements effect
  claims and restart transitions. Use additive transactional migrations and backup/restore tests.
- Canonical states: running, waiting_for_approval, stop_requested, cancelled, completed, failed,
  interrupted, outcome_unknown. A connection freshness flag is orthogonal. No live heartbeat after
  backend restart means interrupted/unknown until reconciled, not automatically completed or rerun.
- A plain bounded read API returns status and paginated events by run/session, including schema version
  and correlation metadata. Document that API for third-party local tooling; no vendor SDK required.
  Preserve current local access boundaries and never expose it publicly as an unauthenticated service.
- Metadata only by default. Exclude credentials, prompt bodies, tool arguments/outputs, full paths,
  environment dumps and full serialized state from diagnostics. Synthetic canary tests cover the UI,
  API, logs, export and exception paths. Existing secured execution payload remains separate.
- Proposed retention: seven days of completed diagnostic events, bounded by 10,000 diagnostic events;
  preserve active runs and unresolved operation/approval control records until explicitly reconciled.
  Pruning diagnostics must never delete data needed to prevent duplicate effects. Disk-full tests:
  failure to commit mandatory intent prevents dispatch; optional trace/export loss cannot change policy
  or trigger retries. Show diagnostics-unavailable explicitly.
- Record original and resumed run lifecycle plus attempt counts and duration. Pre-run validation and
  provider failures get safe correlation and outcome evidence. Telemetry is not execution authority.

These are planning defaults for review, not implemented behavior. Broader historical analytics,
OpenTelemetry exporters, collector/dashboard installation and multi-agent oversight stay in their
existing tasks. The durable schema and read API preserve an integration path from the first increment.

## MVP requirements and non-goals

MVP acceptance requires the numbered requirements in the four child specs and V1 refinement above.
Two seconds for cancellation acknowledgement/UI update are controlled-fixture acceptance thresholds,
not live-provider termination promises. Last-contact health uses a proposed 15-second heartbeat and
30-second stale threshold. Slow, healthy work is not declared stalled merely because it takes time.

No stack upgrade, framework replacement, external paid experiments, automatic background execution
while closed, arbitrary shell exactly-once guarantee, automatic replay of uncertain work, new login
system or staging/main promotion is included. Authentication is a separate requirement before widening
access beyond the approved local single-user model. External dashboards remain later scope; basic
state and readable diagnostics do not wait for them.

## Evidence, delivery and estimated effort

Source baseline: feature/harness-backlog-review at `cb373f348a9bdaadf5193ee6d9e641c84eed7116`.
The documentation feature merged separately; combining either feature with staging is outside this
plan. Production paths are permitted only by a later approved implementation contract. This planning
PR contains documentation and proposed JSON only, on `task/mvp-reliability-plan` to the existing
`feature/harness-backlog-review` branch. No new feature branch or staging changes are needed here.

Future implementation uses one sequential segment from the feature branch, with named task branches
in the contract; its final acceptance task opens a PR to that same feature branch. Intermediate tasks
need exact-head tests, review and pushed branches; tip completion additionally needs merge and hosted
checks. Baseline assessments can be complete with linked known gaps; final MVP acceptance cannot.
Required gates: build, format, lint, typecheck, unit/integration, real browser/Electron, SonarCloud or
Problems fallback, dependency/docs/secret checks, and saved evidence. VM isolation must use actual VM
infrastructure when claimed; fixture runs do not satisfy that claim. Main promotion is never implied.

Planning estimate, not a commitment: baseline remainder 2–4 developer-days; V1 2–3; Stop 2–3;
reconciliation 3–5; local panel 2–3; composed acceptance 1–2. Total 12–20 developer-days before
contingency. Re-estimate after the baseline because storage/recovery findings may change scope.
Work sequentially; no paid calls. Escalate after two unsuccessful repair attempts per finding or two
infrastructure retries; never weaken assertions to meet a budget or silently expand security policy.

## Source anchors and current findings

- [Integrated permission baseline](../../reviews/current-runtime-permission-baseline.md): repaired regressions, final checks and remaining P2 scope.
- [Merged recovery baseline](../../reviews/current-runtime-recovery-baseline.md): precise fixture boundaries and gaps.
- `apps/web/components/chat/chat-input.tsx`: no current user Stop control.
- `apps/web/hooks/use-harness-chat.ts`: current send/resume UI and pending-approval reload.
- `apps/api/src/infrastructure/http/v1/chatRouter.ts`: request-scoped abort/timeout, session lock and approval resume.
- `packages/db/src/repositories/approvalRequests.ts`: persisted approval/resume claims.
- `packages/plugin-observability/src/index.ts`: existing lifecycle observability entry point.
- `apps/desktop/e2e/packaged-vm-command.e2e.ts`: composed provider/approval/reload/retry evidence.

The content-addressed evidence manifest binds these sources and the plan to the independent critique.
Schema validation and critique approve document consistency only; human execution approval remains
pending. Material revisions invalidate the critique digest and require a new review.

## Normative document binding and review controls

The contract binds this plan and every normative task specification by SHA256. Before execution,
the orchestrator must recompute all listed document digests and require exact equality, in addition
to normal schema/material/policy validation. A mismatch blocks execution, requires a revised contract
and renewed independent critique plus owner approval. Implementation workers may add evidence to
separate review files but may not alter normative specs without invalidating approval. This is a
preflight obligation in the proposed scope, not a claim of a new workflow-engine feature.

The Project Chat integration owner is `apps/web/app/page.tsx`; it is permitted for Stop, recovery UI
and the local panel. The separate IDE chat surface remains outside the tranche. No implementation
state-sharing workaround is required to avoid the actual page host.
