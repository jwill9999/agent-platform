# Plan autonomous Codex development and remove custom developer restrictions

**Beads issue:** `agent-platform-codex-autonomy-plan`

**Priority:** P1

**Status:** Open, unassigned planning task; removal implementation has not started.

**Parent epic:** None; standalone developer-workflow planning.

**Source:** `task/test-runner-offline-adapter`, base `4cbef34f6d1a90af0ffea3e352074337664780da`.

**Independent outline review:** [R1 review](../reviews/codex-autonomy-removal-review-2026-10-09.md).

## Task requirements

The owner wants to agree requirements, definition of done and tests up front, then let Codex
implement, test, repair, obtain independent review and evaluate pipelines autonomously before
returning for final owner acceptance. Plan removal of our custom developer restrictions without
weakening Agent Platform's runtime security or losing paused orchestration work.

The owner requested independent critique followed by creation of this planning task if the critic
agreed. R1 received `APPROVED` with zero findings. That review approves the proposal for planning;
it is not approval of a completed execution plan or removal implementation.

- **AUT-01 — Development authority:** Define a native Codex operating policy under which an agreed
  end-to-end task authorizes ordinary implementation choices, file/subtask refinements, tests,
  repairs, retries, source-aware independent review and CI evaluation. Remove repeated human
  approval triggered solely by those routine details. Retain final owner acceptance and distinguish
  a change to owner intent or an explicitly reserved action from routine implementation.
- **AUT-02 — Complete disposition inventory:** Enumerate active repository rules, profiles,
  configuration, skill/ADR links, generated worker controls, broker routing, workspace build/test
  participation, globally stored guidance and stale copies/automation prompts. Each item needs
  an evidence-backed remove, rewrite, preserve or defer disposition and the affected behavior.
- **AUT-03 — Native developer route:** Remove mandatory managed-run discovery, isolation,
  model-gateway/budget/admission qualification, machine-persisted exact-document approval and
  broker-only routing as prerequisites for ordinary Codex product tickets. Native tools should
  operate within the agreed task and the actual permissions supplied by Codex.
- **AUT-04 — Profiles and review:** Plan removal of repository sandbox overrides and the custom
  four-agent concurrency cap. Inherit available session settings rather than writing new global
  full-access settings. Retain useful role responsibilities and independent review while removing
  the custom no-tool reviewer procedure and routine scope-detail escalation.
- **AUT-05 — Preserve the prototype:** Keep `packages/workflow-control` paused, with its isolation,
  authorization, durability, recovery, evidence and tests intact. Disconnect it from default
  developer routing; do not make its worker launcher permissive or blanket-delete the package.
  It participates in recursive workspace gates, even though inspected application paths have no
  direct imports. Assess actual entry points and dependencies before any later code disposition.
- **AUT-06 — Preserve product security:** Keep harness security modules, their dispatch/reasoning
  wiring, API approval routes/contracts, secret encryption and user-configurable permissions
  unchanged. Existing approval, denial, path-escape and real side-effect assertions remain required.
- **AUT-07 — Global boundary:** Leave global Codex configuration, installed skills and memory
  unchanged. Document exact proposed follow-ups for owner discussion, including globally installed
  Beads/documentation guidance and older project-review memories that could restore obsolete gates.
- **AUT-08 — Preservation and activation:** Preserve every dirty worktree, pause checkpoint,
  recovery record and historical evidence. Identify how reviewed repository changes reach the
  intended development branch and a fresh Codex session without overwriting unrelated work or
  reactivating paused automations. Existing Codex platform rules remain applicable.

## Initial restriction inventory

Use the [9 October session inventory](../../session.md#codex-development-restriction-inventory--9-october-2026)
as a starting point; refresh the relevant evidence before proposing edits. Its matched paths are an
audit surface, not a list of independently deletable files.

- [Shared instructions](../agent-instructions-shared.md): managed-run Beads/Git exclusivity and
  notification boundaries; preserve ordinary quality, secret-handling and delivery hygiene.
- [Project configuration](../../.codex/config.toml) and [agent profiles](../../.codex/agents):
  sandbox overrides, concurrency cap and restrictive role wording.
- [Planning](../../.agents/skills/feature-planning/SKILL.md),
  [implementation](../../.agents/skills/feature-implementation/SKILL.md),
  [critique](../../.agents/skills/plan-critique/SKILL.md) and
  [orchestration](../../.agents/skills/orchestration/SKILL.md): mandatory managed routing,
  exact-material authority and restricted reviewer procedure; reconcile documentation cross-links.
- [ADR-0004](../adr/0004-codex-development-orchestration-control-plane.md) and
  [planning rules](../workflow-control-planning.md): supersede their default developer-policy status
  explicitly while retaining history and prototype-specific enforcement guidance.
- [Generated worker configuration](../../packages/workflow-control/src/specialistRoleProfile.ts),
  launcher, authorization, approval and broker consumers: preserve the paused implementation and
  identify how it stops governing native development.
- Global `~/.codex/config.toml`, installed project/Beads skills, project memories, per-workspace
  runtime state and qualification configurations: distinguish global settings from child/run state;
  propose global-guidance changes separately without applying them.

## Dependency order

There are no hard upstream dependencies for this planning task and no child tasks have been created.
Paused runner, pilot and admission qualification issues do not block preparation of this plan.

The planning outputs must propose bounded implementation tasks in this order: verified inventory
and preservation baseline; developer policy/profile changes; default-route and entry-point cleanup;
test and documentation reconciliation; fresh-session acceptance and final integration evidence.
Record real Beads IDs and dependency edges when those implementation tasks are subsequently
authorized and created. Do not present proposed task titles as existing tickets.

## Planning work and outputs

1. Refresh the inventory and map every active source of developer restrictions to its disposition.
2. Draft the replacement operating policy and explicit product/prototype/global exclusions.
3. Produce a file-by-file implementation breakdown with ownership, parent/source/destination,
   dependency order, preservation checks, verification and rollback. Do not inherit the currently
   checked-out prototype branch as the eventual implementation destination without assessing it.
4. Identify tests to retain, update or add; map each scenario to requirements and its future task.
5. Review the complete proposed material independently and retain findings/dispositions. R1 is an
   outline review and does not replace that future review of the detailed planning outputs.
6. Publish the planning documents and their Notion mirrors with readback; update Beads references
   and report the reviewable result to the owner. Keep this task open until those outputs exist.

Future plan, verification material and review belong in `docs/planning/`, `docs/testing/` and
`docs/reviews/`; future implementation task specs belong in `docs/tasks/<real-issue-id>.md`.
Historical documents retain their paths. Beads remains the task/dependency authority.

## Tests and verification to plan

- **V-01 / AUT-01–04:** TOML parsing, documentation/link validation and a semantic review of active
  instructions showing that ordinary development no longer requires the custom managed route,
  no-tool review or repeated approval for routine details. Avoid brittle tests that merely copy prose.
- **V-02 / AUT-05–08:** Record before/after checksums and diffs for product security, prototype source,
  dirty artifacts and global configuration. Explain expected documentation changes separately from
  files that must remain identical. Verify relevant automations remain paused.
- **V-03 / AUT-06:** Retain existing `packages/harness/test/approvalPolicy.test.ts`,
  `pathJail.test.ts`, relevant `toolDispatch.test.ts` denied-effect journeys and
  `apps/api/test/approvalRequestsRouter.test.ts`. Run appropriate security regressions during the
  authorized implementation; do not weaken their expectations to accommodate developer autonomy.
- **V-04 / AUT-03–05:** Inspect CLI/MCP registration, scripts, hooks and recursive workspace gates.
  Preserve prototype test expectations; verify routing changes do not silently launch its restricted
  workers or break application build/test participation.
- **V-05 / AUT-01,04,08:** Verify a fresh session adopts the reviewed repository guidance and inherits
  actual available capabilities. Tool availability must be observed, not inferred from prompt text.
- **V-06 / AUT-01,03,06:** Define a later separately authorized representative product ticket that
  reaches merge-ready state through implementation, appropriate tests/connected backend journeys,
  repair/retry, independent source-aware review and native CI inspection without intermediate owner
  approvals. Record actual interventions and limitations. This is not the paused orchestration pilot.
- **V-07 / AUT-02,08:** Validate proposed documentation, normal affected quality gates, exact tested
  revision and hosted results. Distinguish passed, failed, skipped, blocked and not-run checks.

Documentation/profile-only changes require artifact validation; they do not justify invented product
E2E or paid-model results. Product behavior changes retain applicable connected frontend/backend
coverage. This planning task does not execute the future verification scenarios.

## Definition of done and pre-close sign-off

The complete planning package has a file-by-file disposition inventory, replacement policy,
implementation task/dependency breakdown, requirement-to-test mapping, feasible environments,
preservation/rollback and activation strategy, global follow-up boundary, independent review and
linked verified publications. Beads and specifications agree. Planned tests are clearly distinguished
from executed evidence. The owner can review one concrete end-to-end proposal.

This task is not done merely because this initial specification or its outline review exists.
Keep it open and unassigned until planning work is explicitly started. No product or prototype
implementation, global edits, main/staging promotion, paid gateway call, pilot or automation
resumption is included in creating this issue.

## Git and handoff

The initial specification and review are documentation-only additions on the existing source branch;
preserve the uncommitted prototype and session checkpoint. Stage only these new documents if
publishing them. The detailed plan must specify a suitable isolated implementation branch and
integration destination; no source checkout switch or protected-branch promotion occurs here.

On planning closeout, record the accepted document revisions, quality/publication evidence and
actual Beads state. Do not close this issue or fabricate final owner acceptance in advance.
