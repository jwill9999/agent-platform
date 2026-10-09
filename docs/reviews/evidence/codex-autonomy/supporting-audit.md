## Codex development restriction inventory — 9 October 2026

Read-only audit; no policy removal or implementation authorised by this record. Main chat
Find current branch confirmed idle/stopped; both registered agents' checkpoints are recorded at
this file's start. No active Agent Platform development chat appeared in the retrieved app inventory.
Located development/merge heartbeats are PAUSED or DISABLED; the unrelated daily read-only personal
digest remains active. No owned test/qualification execution remains running per the stop checkpoint.

### Repository-scoped instructions and configuration

- `AGENTS.md` points to `docs/agent-instructions-shared.md`: project task/Git and managed-run broker rules.
- `.codex/config.toml`: native agents enabled, concurrency4, interrupt-message support. No generated
  blanket browser/MCP/plugin/network disable tables. Primary checkout also has project LangChain docs MCP.
- Six `.codex/agents/*.toml`: read-only planner/critic/reviewer/explorer; workspace-write worker/test
  runner; worker scope-change escalation. These are project profiles, not global profiles.
- `.agents/skills/feature-planning/SKILL.md` and `plan-critique/SKILL.md`: exact material approval,
  repeated critique/human approval when that material changes.
- `.agents/skills/feature-implementation/SKILL.md` and `orchestration/SKILL.md`: mandatory assessment
  of managed execution and an authorised direct-path exception, plus runtime readiness requirements.
- `docs/workflow-control-planning.md` lines23–26: requirements, tasks, file/action scopes, retries,
  destination and policy changes invalidate approval. This causes routine implementation friction.
- `docs/adr/0004-codex-development-orchestration-control-plane.md`: restrictive Codex developer
  control plane; mandatory isolated codex-exec specialist launch; no-tool procedural critic exception.
- Related workflow-control security/orchestrator/continuation/supervised-review guides and task/plan
  contracts encode or describe those rules. Historical evidence is not all active policy.

### Executable development controls

`packages/workflow-control` is the custom developer control plane. No direct imports were found
in inspected application source/package files. There are81 TypeScript source files, of which51
matched the authority/approval/capability/sandbox search below; matches identify an audit surface,
not51 independently deletable files.

Principal enforcement: `specialistRoleProfile.ts` generates disabled tools, delegation and network;
`specialistLauncher.ts` enforces isolated mounts/credentials/containers; `contracts.ts` and
`authorization.ts` enforce role/path/action scopes; `planning.ts`, `lifecycle.ts`, `documentApproval.ts`
and `planningDocuments.ts` enforce reviewed-material approval. Orchestrator, storage, bootstrap,
phase, broker, import and delivery modules consume those guards. Durability, evidence, scheduling
and recovery features need separate assessment from restrictive defaults.

### Configuration and guidance outside the repository

- `/Users/letuscode/.codex/config.toml`: sandbox `danger-full-access`; Agent Platform trusted. No
  explicit approval_policy, agent-profile table, blanket network denial, or developer-instruction
  field found. Existing global features `js_repl=false`, `memories=true` were unchanged in the backup
  comparison; original authorship is unproven. This is current-state evidence, not proof of all history.
- `config.toml.before-imessage-20260927-005024` comparison: no changes in audited approval/sandbox/
  feature/agent/permission/instruction fields. Global MCP entries GitKraken and imessage were added.
  Configuration has changed, but this comparison does not show worker restrictions installed globally.
- `/Users/letuscode/.codex/AGENTS.md` is empty. No global `.codex/agents` directory, `.codex/instructions.md`
  or `/Users/letuscode/.agents/AGENTS.md` found.
- `/Users/letuscode/.codex/skills/agent-platform-documentation/`: global location, explicitly project-only
  applicability; inherits project review/publication rules.
- `/Users/letuscode/.codex/skills/beads-workflow/SKILL.md`: global Beads guidance. Its exclusive active-run
  broker clause can influence other Beads projects when invoked; review/clarify that scope. Direct
  manual CLI/MCP is allowed outside managed runs. No skill was changed during this audit.
- `/Users/letuscode/.codex/memories/skills/agent-platform-beads-review-gate/SKILL.md` and
  `/Users/letuscode/.codex/memories/extensions/ad_hoc/notes/2026-09-13T012654Z-next-session-harness-review.md`
  preserve old project implementation-allocation/review gates. The memory registry repeats this
  project's earlier permission/approval decisions. These may reintroduce superseded project guidance;
  they are not global provider security configuration. No memory was edited.
- `/Users/letuscode/.codex/workflow-control/28d0df6dc7d1762064d7c275c3b1411f1dbc97ec01bd91beeb11c287afbca3b8/development/operator.json`
  is per-workspace runtime configuration under a global directory. Only key names inspected;
  credential/account values withheld. It does not configure every Codex project.
- `/Users/letuscode/.codex/runner-qualification-20261008/`: generated worker CODEX_HOME policy/probe
  TOML files and launch evidence; child/test-specific, not the global Codex configuration.
- `/Users/letuscode/.codex/automations/`: relevant development/merge monitors paused/disabled.
- Other registered Agent Platform worktrees carry older repository copies. Correct through normal
  reviewed integration; do not overwrite dirty checkouts or delete recovery/history.

### Correction candidates identified, not applied

Revise repeated human approval for routine refinements inside the agreed end-to-end objective;
remove custom managed-worker/isolation readiness as the default prerequisite for ordinary Codex
product development; review native worker sandbox overrides and generated blanket capability
restrictions. Retain joint upfront task agreement, tests/DoD, independent QA/review and final owner
acceptance. Preserve explicitly reserved releases/spend, credentials and unrelated work.
Product `packages/harness` PathJail, tool approval and permission enforcement remain product controls.
Do not delete workflow-control code, historical records or uncommitted repairs before dependency
and retained-value assessment. No global configuration, product security or code removed by this audit.

### Complete matched executable file inventory

- `packages/workflow-control/src/authorization.ts`
- `packages/workflow-control/src/bootstrap.ts`
- `packages/workflow-control/src/bootstrapAdapterRuntime.ts`
- `packages/workflow-control/src/bootstrapJournal.ts`
- `packages/workflow-control/src/bootstrapPolicy.ts`
- `packages/workflow-control/src/cancellation.ts`
- `packages/workflow-control/src/cli.ts`
- `packages/workflow-control/src/continuationJournal.ts`
- `packages/workflow-control/src/continuationNotifications.ts`
- `packages/workflow-control/src/continuationProcess.ts`
- `packages/workflow-control/src/continuationWorker.ts`
- `packages/workflow-control/src/contracts.ts`
- `packages/workflow-control/src/coordinatorProcess.ts`
- `packages/workflow-control/src/coordinatorTransport.ts`
- `packages/workflow-control/src/deliveryBrokers.ts`
- `packages/workflow-control/src/developmentHost.ts`
- `packages/workflow-control/src/documentApproval.ts`
- `packages/workflow-control/src/effectiveTaskAuthority.ts`
- `packages/workflow-control/src/featureDeliveryApproval.ts`
- `packages/workflow-control/src/featureDeliveryBroker.ts`
- `packages/workflow-control/src/featureDeliveryContracts.ts`
- `packages/workflow-control/src/featureEvaluation.ts`
- `packages/workflow-control/src/gitDeliveryPort.ts`
- `packages/workflow-control/src/githubDeliveryPort.ts`
- `packages/workflow-control/src/governedOperations.ts`
- `packages/workflow-control/src/governedPersistence.ts`
- `packages/workflow-control/src/implementationImport.ts`
- `packages/workflow-control/src/implementationOutput.ts`
- `packages/workflow-control/src/index.ts`
- `packages/workflow-control/src/integrationGate.ts`
- `packages/workflow-control/src/lifecycle.ts`
- `packages/workflow-control/src/offlineTestAdapter.ts`
- `packages/workflow-control/src/orchestrator.ts`
- `packages/workflow-control/src/phaseJobs.ts`
- `packages/workflow-control/src/phaseRuntime.ts`
- `packages/workflow-control/src/planning.ts`
- `packages/workflow-control/src/planningDocuments.ts`
- `packages/workflow-control/src/preapprovalMaterial.ts`
- `packages/workflow-control/src/reconciliation.ts`
- `packages/workflow-control/src/repairChildContract.ts`
- `packages/workflow-control/src/repairLoops.ts`
- `packages/workflow-control/src/repairPlanning.ts`
- `packages/workflow-control/src/runExecutionBudget.ts`
- `packages/workflow-control/src/secureEvidence.ts`
- `packages/workflow-control/src/specialistLauncher.ts`
- `packages/workflow-control/src/specialistRoleProfile.ts`
- `packages/workflow-control/src/standaloneCoordinators.ts`
- `packages/workflow-control/src/stateMachine.ts`
- `packages/workflow-control/src/storage.ts`
- `packages/workflow-control/src/supervisedReview.ts`
- `packages/workflow-control/src/workCancellation.ts`

### Related repository configuration, planning and evidence candidates

The complete filename-search inventory includes historical and product-verification records.
A match does not prove a current Codex restriction; classify before removal.

- `.agents/skills/README.md`
- `.agents/skills/agent-platform-documentation/SKILL.md`
- `.agents/skills/agent-platform-documentation/agents/openai.yaml`
- `.agents/skills/agent-platform-documentation/references/notion-publication.md`
- `.agents/skills/documentation/SKILL.md`
- `.agents/skills/feature-implementation/SKILL.md`
- `.agents/skills/feature-planning/SKILL.md`
- `.agents/skills/orchestration/SKILL.md`
- `.agents/skills/plan-critique/SKILL.md`
- `.agents/skills/playwright-quality-gate/SKILL.md`
- `.codex/agents/code-reviewer.toml`
- `.codex/agents/feature-planner.toml`
- `.codex/agents/implementation-worker.toml`
- `.codex/agents/plan-critic.toml`
- `.codex/agents/repo-explorer.toml`
- `.codex/agents/test-runner.toml`
- `docs/adr/0004-codex-development-orchestration-control-plane.md`
- `docs/planning/harness-modernization/orchestration-observation.md`
- `docs/planning/pilot-active-budget/execution-contract.v1.json`
- `docs/planning/pilot-active-budget/plan.md`
- `docs/planning/test-runner-offline-adapter/execution-contract.v1.json`
- `docs/planning/test-runner-offline-adapter/plan.md`
- `docs/reviews/2026-08-31-multi-agent-delivery-pilot.md`
- `docs/reviews/2026-08-31-multi-agent-delivery-task-contract.json`
- `docs/reviews/2026-08-31-multi-agent-recovery-contract.json`
- `docs/reviews/evidence/pilot-active-budget/code-review-r2.json`
- `docs/reviews/evidence/pilot-active-budget/plan-review-r2.json`
- `docs/reviews/evidence/pilot-active-budget/planning-validation.json`
- `docs/reviews/evidence/pilot-active-budget/qualification.json`
- `docs/reviews/evidence/supervised-review-capabilities.json`
- `docs/reviews/evidence/supervised-review-first.json`
- `docs/reviews/evidence/supervised-review-fourth.json`
- `docs/reviews/evidence/supervised-review-gateway.json`
- `docs/reviews/evidence/supervised-review-second.json`
- `docs/reviews/evidence/supervised-review-third.json`
- `docs/reviews/evidence/test-runner-offline-adapter/notion-publication-r3.json`
- `docs/reviews/evidence/test-runner-offline-adapter/plan-review-r1.json`
- `docs/reviews/evidence/test-runner-offline-adapter/plan-review-r2.json`
- `docs/reviews/evidence/test-runner-offline-adapter/plan-review-r3.json`
- `docs/reviews/evidence/test-runner-offline-adapter/planning-validation-r2.json`
- `docs/reviews/evidence/test-runner-offline-adapter/planning-validation-r3.json`
- `docs/reviews/evidence/test-runner-offline-adapter/planning-validation.json`
- `docs/reviews/evidence/test-runner-offline-adapter/qualification-intermediate.json`
- `docs/reviews/orchestration-field-evaluation.md`
- `docs/reviews/orchestration-handoff-gap-reference.md`
- `docs/reviews/orchestration-readiness-refresh-2026-09-26.md`
- `docs/reviews/orchestration-reusability-draft-reference.md`
- `docs/reviews/orchestration-skill-readiness.md`
- `docs/reviews/orchestration-staged-assessment.md`
- `docs/reviews/pilot-active-budget.md`
- `docs/reviews/test-runner-offline-adapter.md`
- `docs/tasks/agent-platform-multi-agent-review.md`
- `docs/tasks/agent-platform-multi-agent.1.md`
- `docs/tasks/agent-platform-multi-agent.10.md`
- `docs/tasks/agent-platform-multi-agent.2.md`
- `docs/tasks/agent-platform-multi-agent.3.md`
- `docs/tasks/agent-platform-multi-agent.4.md`
- `docs/tasks/agent-platform-multi-agent.5.md`
- `docs/tasks/agent-platform-multi-agent.6.md`
- `docs/tasks/agent-platform-multi-agent.7.md`
- `docs/tasks/agent-platform-multi-agent.8.md`
- `docs/tasks/agent-platform-multi-agent.9.md`
- `docs/tasks/agent-platform-multi-agent.md`
- `docs/tasks/agent-platform-multi-agent.repair.1.md`
- `docs/tasks/agent-platform-multi-agent.repair.3.md`
- `docs/tasks/agent-platform-multi-agent.repair.4.bootstrap-approval.md`
- `docs/tasks/agent-platform-multi-agent.repair.4.md`
- `docs/tasks/agent-platform-orchestration-toolkit.md`
- `docs/tasks/agent-platform-pilot-active-budget.md`
- `docs/tasks/agent-platform-pilot-zero-delivery-handoff.md`
- `docs/tasks/agent-platform-pilot-zero.1.md`
- `docs/tasks/agent-platform-pilot-zero.10.md`
- `docs/tasks/agent-platform-pilot-zero.11.md`
- `docs/tasks/agent-platform-pilot-zero.12.md`
- `docs/tasks/agent-platform-pilot-zero.13.md`
- `docs/tasks/agent-platform-pilot-zero.14.md`
- `docs/tasks/agent-platform-pilot-zero.15.md`
- `docs/tasks/agent-platform-pilot-zero.16.md`
- `docs/tasks/agent-platform-pilot-zero.17.md`
- `docs/tasks/agent-platform-pilot-zero.2.md`
- `docs/tasks/agent-platform-pilot-zero.3.md`
- `docs/tasks/agent-platform-pilot-zero.4.md`
- `docs/tasks/agent-platform-pilot-zero.5.1.md`
- `docs/tasks/agent-platform-pilot-zero.5.2.md`
- `docs/tasks/agent-platform-pilot-zero.5.3.md`
- `docs/tasks/agent-platform-pilot-zero.5.md`
- `docs/tasks/agent-platform-pilot-zero.6.md`
- `docs/tasks/agent-platform-pilot-zero.7.md`
- `docs/tasks/agent-platform-pilot-zero.8.md`
- `docs/tasks/agent-platform-pilot-zero.9.md`
- `docs/tasks/agent-platform-pilot-zero.md`
- `docs/tasks/agent-platform-pilot-zero.skills-gate.md`
- `docs/tasks/agent-platform-test-runner-loopback.md`
- `docs/testing/pilot-active-budget.md`
- `docs/testing/test-runner-offline-adapter.md`
- `docs/workflow-control-closeout-recovery.md`
- `docs/workflow-control-continuations.md`
- `docs/workflow-control-contracts.md`
- `docs/workflow-control-delivery-brokers.md`
- `docs/workflow-control-development.md`
- `docs/workflow-control-evidence-evaluation.md`
- `docs/workflow-control-orchestrator.md`
- `docs/workflow-control-persistence.md`
- `docs/workflow-control-planning.md`
- `docs/workflow-control-repair-loops.md`
- `docs/workflow-control-security.md`
- `docs/workflow-control-supervised-review.md`
