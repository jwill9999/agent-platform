<!-- Historical research snapshot. Read the bundle README for current scope and Beads authority. -->

# Beads outstanding-work audit

Read-only snapshot: 13 September 2026. Workspace: /Users/letuscode/projects/agent-platform. This is an audit report, not a replacement task tracker. No issues, dependencies, priorities or statuses were changed; no reset or remote synchronization was performed.

## Summary

304 total records: 272 closed and 32 outstanding (24 open, 7 in progress, 1 deferred). Outstanding records comprise 19 task, 12 epic, 1 bug. Epics overlap their child work; 32 is not an estimate of 32 independent implementation tasks.

Beads reports eight dependency-blocked records, overlapping the status totals. The ready endpoint returns 18 records while stats reports 16 ready. Treat readiness as a candidate list requiring issue-level inspection; neither an open epic nor an absence of dependency edges proves its work is ready. No remote freshness is claimed.

## Complete outstanding inventory

Blocking dependencies below show only explicit `blocks` edges whose target is not closed. Parent relationships are separate. Requirement text and notes may impose additional conditions absent from the dependency graph. Titles and statuses are taken from Beads; this audit does not independently certify implementation completion.

### In progress

| ID                                          | Priority / type | Title                                                | Parent                                    | Outstanding blocking dependencies           |
| ------------------------------------------- | --------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| agent-platform-pilot-zero                   | P1 / task       | Plan and assess pilot-zero orchestration integration | agent-platform-multi-agent                | None recorded                               |
| agent-platform-multi-agent.repair.4         | P1 / bug        | Add governed review resolution and continuation      | agent-platform-multi-agent.10             | None recorded                               |
| agent-platform-multi-agent.10               | P1 / task       | Run autonomous feature-delivery pilot                | agent-platform-multi-agent                | None recorded                               |
| agent-platform-macos-production-sandbox.6.4 | P1 / task       | Document future platform adapters and close epic     | agent-platform-macos-production-sandbox.6 | agent-platform-macos-production-sandbox.6.3 |
| agent-platform-macos-production-sandbox.6.3 | P1 / task       | Validate signing and notarization helper execution   | agent-platform-macos-production-sandbox.6 | None recorded                               |
| agent-platform-0ra                          | P1 / task       | Add push completion and PR creation flow             | —                                         | agent-platform-4hm                          |
| agent-platform-multi-agent                  | P2 / epic       | Multi-agent orchestration                            | —                                         | None recorded                               |

### Open

| ID                                           | Priority / type | Title                                                                          | Parent                                   | Outstanding blocking dependencies        |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------- |
| agent-platform-pre-production-automation     | P1 / epic       | Pre-production automation and release test gates                               | —                                        | None recorded                            |
| agent-platform-macos-production-sandbox.6    | P1 / task       | Release hardening and future platform adapter plan                             | agent-platform-macos-production-sandbox  | None recorded                            |
| agent-platform-macos-production-sandbox      | P1 / epic       | macOS production sandbox runner                                                | —                                        | None recorded                            |
| agent-platform-divergent-pull-merge-resolver | P1 / task       | Add divergent pull and merge conflict resolver                                 | agent-platform-ii1                       | None recorded                            |
| agent-platform-7vf                           | P1 / task       | Add Playwright journey coverage for Git workflow                               | —                                        | agent-platform-17h, agent-platform-e6g   |
| agent-platform-e6g                           | P1 / task       | Design in-app Web Explorer handoff                                             | —                                        | agent-platform-5zg                       |
| agent-platform-17h                           | P1 / task       | Refine checks as PR/head status                                                | —                                        | agent-platform-5zg                       |
| agent-platform-5zg                           | P1 / task       | Add focused PR review view                                                     | —                                        | agent-platform-0ra                       |
| agent-platform-4hm                           | P1 / task       | Improve commit step and generated commit messages                              | —                                        | None recorded                            |
| agent-platform-ii1                           | P1 / epic       | Git workflow UI and in-app web explorer                                        | —                                        | None recorded                            |
| agent-platform-electron-release              | P1 / epic       | macOS packaging, release, and update readiness                                 | —                                        | agent-platform-pre-production-automation |
| agent-platform-llm-observability-export      | P1 / task       | Add developer diagnostics and LLM observability export                         | —                                        | None recorded                            |
| agent-platform-context-optimisation          | P1 / task       | Add context window and token optimisation                                      | —                                        | None recorded                            |
| agent-platform-research-tools                | P1 / epic       | Web research tool pack                                                         | —                                        | None recorded                            |
| agent-platform-electron-stabilisation.20     | P2 / task       | Define E2E workflow expectation matrix                                         | agent-platform-pre-production-automation | None recorded                            |
| agent-platform-code-workbench                | P2 / epic       | Codex-style code workbench                                                     | —                                        | None recorded                            |
| agent-platform-agent-profile-governance      | P2 / epic       | Agent profile governance and orchestration scopes                              | —                                        | None recorded                            |
| agent-platform-skill-authoring               | P2 / epic       | Agent-guided skill authoring                                                   | —                                        | None recorded                            |
| agent-platform-ui-quality-sensors            | P2 / epic       | UI quality and visual UX sensors                                               | —                                        | None recorded                            |
| agent-platform-session-handoff-hygiene       | P2 / task       | Add session handoff hygiene and archive policy                                 | —                                        | None recorded                            |
| agent-platform-improvement-goals             | P2 / task       | Add observability-driven improvement goals                                     | —                                        | None recorded                            |
| agent-platform-runtime-backup-auto           | P2 / task       | Automate local runtime config backups                                          | —                                        | None recorded                            |
| agent-platform-capability-registry           | P2 / epic       | Capability registry and policy profiles                                        | —                                        | None recorded                            |
| agent-platform-orchestration-toolkit         | P3 / epic       | Investigate a reusable orchestration toolkit and guided project initialization | —                                        | agent-platform-multi-agent               |

### Deferred

| ID                              | Priority / type | Title                                      | Parent                        | Outstanding blocking dependencies |
| ------------------------------- | --------------- | ------------------------------------------ | ----------------------------- | --------------------------------- |
| agent-platform-code-workbench.7 | P2 / task       | Document code workbench verification guide | agent-platform-code-workbench | None recorded                     |

## Scope of each outstanding record

Descriptions below are condensed from current Beads records. Linked specifications have not all been independently revalidated against code.

### agent-platform-pilot-zero — Plan and assess pilot-zero orchestration integration

Owner-authorized iterative supervised integration and repair of the human-to-runtime orchestration path. Track reproducibility, manual interventions and unsupported transitions; implement bounded fixes with independent review and quality gates. No fabricated managed-run approval or model/network conformance; protected delivery and new external authority remain separate gates.

Specification: [docs/tasks/agent-platform-pilot-zero.md](../../../tasks/agent-platform-pilot-zero.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> pproval runner; implementation import, coordinator receipts, live credentials/egress, visible notification and desktop resumption remain gaps.
> Owner approved feature-only merge. PR259 MERGED at 68e7856c59fb35bb47bbb10b1b3c4e2d7dee34f8 into feature/pilot-zero-assessment; main and staging refs verified unchanged. Children .1-.4 closed after segment integration. Correction to prior count: 11 executed hosted checks passed, 1 staging-only VM check skipped. Parent remains in_progress for isolated critic runner, implementation import, coordinator completion and notification/recovery proof. CI monitor paused; no active subagent or live autonomous run.
> 2026-09-08 continued per owner: .5 lifecycle worker active; critic independently maps next implementation import and coordinator receipt gaps. Fallback heartbeat restored. Local offline image probe confirms agent-platform-api has no codex executable; only ordinary bridge networks found, no verified restricted model egress. These provisioning gaps are not substituted with fixtures.
> Current regression run: package582 passed7 opt-in skipped; lifecycle3 real probes passed initial revision, critic strengthening probes before acceptance. Desktop conformance rerun exits1 host_resume_unavailable as designed; no conformant desktop adapter installed. This remains a release blocker, not waived by green unit/CI checks. Continue standalone path first.

### agent-platform-multi-agent.repair.4 — Add governed review resolution and continuation

Add governed Beads-note and GitHub review-thread operations, durable approval notifications, reliable parent continuation after terminal subagent callbacks, and an exact two-run implementation-to-delivery handoff. Bootstrap stops at an attested implementation artifact; external dogfooding and delivery require a distinct freshly approved run.

Specification: [docs/tasks/agent-platform-multi-agent.repair.4.md](../../../tasks/agent-platform-multi-agent.repair.4.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Owner approved the exact bootstrap implementation plan after independent critic PASS with zero findings. Policy sha256:43eb20c66e865ec6b294faf17d16a4643390922a800b7221bb1fff2449f8786c; material sha256:b31e1e98834ecbabfd1cd62960ed85740d41fdcd4eb4968e500718955b230241; runtime execution sha256:1e2c585c5b27b51dba447529cfa92402749953d55dae7c02f7bb2ebaa4696d16. The predecessor recovery run is cancelled cleanly and PR 253 is closed without merge. This bootstrap does not authorize external notification, PR, review-thread, Beads-note, or merge dogfooding.
> 2026-09-07 implementation publication reconciled: PR254 merged repair foundation, PR256 merged bounded private-key scanner and review follow-up, PR255 delivered to staging491518811ab53d003a2d2f90ed79dd6fb9d07d0e. Independent critique passed; latest full package488passed/1intentional Docker-isolation skip; focused26passed; static gates and final staging CI/CodeQL/Sonar passed. Preserve old immutable approval/run evidence; manual GitHub delivery is not a brokered attestation. Remains in_progress pending exact bootstrap artifact/terminalization acceptance audit; do not infer those criteria from CI or merge success alone. Local hook inherited-Git-environment defect remains a separate follow-up.

### agent-platform-multi-agent.10 — Run autonomous feature-delivery pilot

Deliver one bounded repository feature through planning, critique, approval, isolated execution, repair, QA, CI, protected-staging delivery, and closeout.

Specification: [docs/tasks/agent-platform-multi-agent.10.md](../../../tasks/agent-platform-multi-agent.10.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> ugh feature/multi-agent-orchestration to protected staging, no admin bypass, and no main promotion.
>
> Hosted verification complete on PR #252 at approved task head 4e7e64d8cee2c5ccf4099a10596db2e7ba8d9cb8: SonarCloud Code Analysis PASS (Security and Reliability quality gate), GitGuardian Security Checks PASS, verify/e2e/desktop-e2e/docker/deps/docs checks PASS. Independent critic PASS. PR squash-merged without admin bypass into feature/multi-agent-orchestration as 6a653a939f518db8ff6f96598e3c62a5eccd45aa at 2026-08-31T15:35:22Z. Project-local Sonar hook/config files were intentionally excluded because they were outside this task's immutable allowed-path contract.
> 2026-09-07: staging delivery verified at491518811ab53d003a2d2f90ed79dd6fb9d07d0e via PR255 with all executed hosted checks passing, no unresolved review threads; Sourcery skipped on final staging run. PR256 feature merge had an explicitly documented owner exception only for dummy-key test false positives; no exception needed for final staging CodeQL. Local staging synchronized cleanly; historical local duplicates preserved in recovery stash/bundle. Pilot remains in_progress: no production is required, but autonomous progression, notification visibility, interruption recovery and authoritative closeout evidence still require supervised operational validation. Record snags as Beads issues, not a claim of pilot completion.

### agent-platform-pre-production-automation — Pre-production automation and release test gates

Collect automation and test-planning work that must be complete before promoting a production release, without blocking normal staging and feature development.

Specification: [docs/tasks/agent-platform-pre-production-automation.md](../../../tasks/agent-platform-pre-production-automation.md).

### agent-platform-macos-production-sandbox.6.4 — Document future platform adapters and close epic

Document Windows/Linux production adapter boundaries and close the macOS epic with complete evidence.

Specification: [docs/tasks/agent-platform-macos-production-sandbox.6.4.md](../../../tasks/agent-platform-macos-production-sandbox.6.4.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Documentation/audit portion is implemented. .5/.5.4, .6.1, and .6.2 are closed. Final .6.4 closure is now blocked only by .6.3 signed/notarized helper execution evidence, after which the final traceability audit can close .6 and the parent epic.

### agent-platform-macos-production-sandbox.6.3 — Validate signing and notarization helper execution

Prove the signed and notarized macOS artifact can start and use the VM helper.

Specification: [docs/tasks/agent-platform-macos-production-sandbox.6.3.md](../../../tasks/agent-platform-macos-production-sandbox.6.3.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Code-side signing verifier is implemented and signed packaged helper execution has been proven through .6.2 repair smoke. Current blocker: this environment has no Apple code-signing identity (security find-identity returned 0 valid identities) and no Apple/notary credential environment variables, so a real Developer ID signed/notarized artifact smoke cannot be produced here. Keep open until a VM-capable Apple Silicon runner with Developer ID signing identity and notary credentials records helper signing report, notarization result, and macos-vm ready health.
> Production release gate: keep this task open until a VM-capable Apple Silicon runner with Developer ID signing identity and notary credentials records notarization success, helper signing/entitlement/quarantine report, macos-vm ready health, and helper command smoke from the signed/notarized artifact. Do not ship production macOS releases before this closes.

### agent-platform-macos-production-sandbox.6 — Release hardening and future platform adapter plan

Harden the macOS VM runner for release and document how the same CommandRunner contract extends later to Windows and Linux.

Specification: [docs/tasks/agent-platform-macos-production-sandbox.6.md](../../../tasks/agent-platform-macos-production-sandbox.6.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Production release hold: .6 and the parent epic cannot be considered production-ready until .6.3 records real Developer ID signed and Apple-notarized artifact smoke evidence. Merge completed VM development work forward only as development/staging capability, not production release readiness.

### agent-platform-macos-production-sandbox — macOS production sandbox runner

Build the packaged macOS production command runner so staging tests the same local VM-backed command execution path that will ship to users.

Specification: [docs/tasks/agent-platform-macos-production-sandbox.md](../../../tasks/agent-platform-macos-production-sandbox.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Production release hold: do not ship or promote a production macOS release from this epic until agent-platform-macos-production-sandbox.6.3 is closed with real Developer ID signing, Apple notarization success, helper signing/entitlement/quarantine report, and macos-vm ready/helper smoke evidence from the signed/notarized artifact. Development/staging merge is acceptable after CI/CD passes; production release is not.

### agent-platform-divergent-pull-merge-resolver — Add divergent pull and merge conflict resolver

Implement guided divergent pull handling and a full-screen merge conflict resolver for the Git/GitHub workflow.

Specification: [docs/tasks/agent-platform-divergent-pull-merge-resolver.md](../../../tasks/agent-platform-divergent-pull-merge-resolver.md).

### agent-platform-7vf — Add Playwright journey coverage for Git workflow

Add Playwright/Electron coverage and screenshots for the guided Git workflow states: loading, changes, commit, publish/push, PR, checks, back navigation, and GitHub/Web Explorer fallback.

Specification: [docs/tasks/agent-platform-git-workflow-ui-8.md](../../../tasks/agent-platform-git-workflow-ui-8.md).

### agent-platform-e6g — Design in-app Web Explorer handoff

Design the in-app Web Explorer route for GitHub links, generated landing pages, chat links, and web data so users can stay inside AI Studio instead of leaving to a browser.

Specification: [docs/tasks/agent-platform-git-workflow-ui-7.md](../../../tasks/agent-platform-git-workflow-ui-7.md).

### agent-platform-17h — Refine checks as PR/head status

Show Checks only when a PR or head check context exists, summarize pass/fail/running clearly, and route failures to useful detail or GitHub fallback instead of broad workflow history.

Specification: [docs/tasks/agent-platform-git-workflow-ui-6.md](../../../tasks/agent-platform-git-workflow-ui-6.md).

### agent-platform-5zg — Add focused PR review view

Build an in-app pull request view that starts read-only: summary, changed files, checks, comments, and GitHub fallback links. Keep mutation actions out until permissions are explicit.

Specification: [docs/tasks/agent-platform-git-workflow-ui-5.md](../../../tasks/agent-platform-git-workflow-ui-5.md).

### agent-platform-0ra — Add push completion and PR creation flow

After a branch is published or pushed, advance the workflow to Create pull request, with clear success state, GitHub URL fallback, and no PR controls before they are useful.

Specification: [docs/tasks/agent-platform-git-workflow-ui-4.md](../../../tasks/agent-platform-git-workflow-ui-4.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Implementation committed in 3d31a71 with session handoff 355ca8c. Close is blocked until dependency agent-platform-4hm is closed in Beads; did not force-close.

### agent-platform-4hm — Improve commit step and generated commit messages

Make the commit step visible only when useful, show successful commit completion in place, advance to the push/publish step, and add a future-safe Generate commit message CTA.

Specification: [docs/tasks/agent-platform-git-workflow-ui-3.md](../../../tasks/agent-platform-git-workflow-ui-3.md).

### agent-platform-ii1 — Git workflow UI and in-app web explorer

Build the Git/GitHub side panel into a guided delivery workflow with progressive disclosure, clear next actions, reversible steps, and a future in-app web explorer path for GitHub and generated web previews.

Specification: [docs/tasks/agent-platform-git-workflow-ui.md](../../../tasks/agent-platform-git-workflow-ui.md).

### agent-platform-electron-release — macOS packaging, release, and update readiness

Make the macOS desktop app distributable for the owner/internal users first, then prepare for GitHub users.

Specification: [docs/tasks/agent-platform-electron-release.md](../../../tasks/agent-platform-electron-release.md).

### agent-platform-llm-observability-export — Add developer diagnostics and LLM observability export

Add a developer-readable diagnostics workflow for desktop/web/API failures and agent runs, then define and implement an OpenTelemetry/OpenInference-compatible export path to free/self-hostable LLM observability tooling such as Phoenix, Langfuse, or Helicone.

Specification: [docs/tasks/agent-platform-llm-observability-export.md](../../../tasks/agent-platform-llm-observability-export.md).

### agent-platform-context-optimisation — Add context window and token optimisation

Implement context window management and token-budget optimisation after the memory foundation exists, using structured short-term memory/session summaries rather than blind history truncation.

Specification: [docs/tasks/agent-platform-context-optimisation.md](../../../tasks/agent-platform-context-optimisation.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> 2026-06-18 evidence: manual Project Chat test asked a simple Beads question but reused stale Coding project session bad6e0a5-d8e0-4eee-b94d-a2dc4c8f65da with 87 messages and ~526k stored characters, including multiple ~100k-char tool outputs. OpenAI API returned TPM rate limit: limit 500000, used 365686, requested 148544. Current implementation has an 8k approximate context window, but this failure shows remaining gaps around durable session compaction/summarisation, oversized tool-result persistence/replay, stale-session auto-resume, explicit model output-token caps, and user-facing context/rate-limit diagnostics.
> 2026-06-20 planning: raised to immediate next implementation after closing agent-platform-project-experience.2. Removed stale dependency on agent-platform-session-handoff-hygiene because the observed Project Chat TPM failure requires direct context compaction/token-budget work before continuing deeper Project Experience tasks.
> 2026-06-20 planning update: parked after branch setup because self-hosted runner availability makes the immediate context-optimisation validation path awkward. Proceeding with agent-platform-project-experience.4 while keeping this as P1 follow-up; do not forget the long-session TPM evidence.

### agent-platform-research-tools — Web research tool pack

Add source-aware web search and fetch tools that produce citation-ready evidence bundles rather than relying on raw HTTP requests for research workflows.

Specification: [docs/tasks/agent-platform-research-tools.md](../../../tasks/agent-platform-research-tools.md).

### agent-platform-electron-stabilisation.20 — Define E2E workflow expectation matrix

Define expected E2E outcomes for each desktop workspace/workflow surface, with Coding/Project Chat as the highest-priority and deepest-tested path and generalized chat/user-case workflows expanding as later epics mature.

Specification: [docs/tasks/agent-platform-electron-stabilisation.20.md](../../../tasks/agent-platform-electron-stabilisation.20.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Moved out of Electron stabilisation into pre-production automation so Project Experience and staging work are not blocked; remains required before production release promotion.

### agent-platform-code-workbench.7 — Document code workbench verification guide

Document manual and automated verification flows for the code workbench after implementation.

Specification: [docs/tasks/agent-platform-code-workbench.7.md](../../../tasks/agent-platform-code-workbench.7.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Deliberately deferred after code workbench implementation. Project workspace binding is the next priority because create-file/folder behavior needs an architectural workspace fix before the verification guide is finalized.

### agent-platform-code-workbench — Codex-style code workbench

Deferred/re-scoped: do not continue building a full integrated IDE. Preserve only Project Chat file context and diff-first review direction after Project Experience delivers branch selection, terminal dock, previews, activity panel, and external/default IDE handoff.

Specification: [docs/tasks/agent-platform-code-workbench.md](../../../tasks/agent-platform-code-workbench.md).

### agent-platform-agent-profile-governance — Agent profile governance and orchestration scopes

Define governed agent profiles where humans describe agent intent in natural language and the platform turns that into role instructions, capability scopes, approval policy, sandbox limits, data boundaries, and orchestration handoff rules.

Specification: [docs/tasks/agent-platform-agent-profile-governance.md](../../../tasks/agent-platform-agent-profile-governance.md).

### agent-platform-skill-authoring — Agent-guided skill authoring

Create a governed skill authoring system where users describe desired agent capabilities in natural language and the agent designs, scaffolds, validates, and maintains skill packages within harness policy constraints.

Specification: [docs/tasks/agent-platform-skill-authoring.md](../../../tasks/agent-platform-skill-authoring.md).

### agent-platform-ui-quality-sensors — UI quality and visual UX sensors

Add UI quality sensors that use browser evidence, deterministic UI checks, and rubric-based UX/design review to help frontend agents improve usability, styling, theming, and interaction quality before human review.

Specification: [docs/tasks/agent-platform-ui-quality-sensors.md](../../../tasks/agent-platform-ui-quality-sensors.md).

### agent-platform-session-handoff-hygiene — Add session handoff hygiene and archive policy

Define and enforce a concise session.md handoff policy so current state stays visible, old session history is archived, and shared context files do not crowd out active instructions or task context.

Specification: [docs/tasks/agent-platform-session-handoff-hygiene.md](../../../tasks/agent-platform-session-handoff-hygiene.md).

### agent-platform-improvement-goals — Add observability-driven improvement goals

Define a limited self-learning loop that turns observability and memory signals into reviewed improvement candidates, starting with a small measurable objective before broader self-improvement.

Specification: [docs/tasks/agent-platform-improvement-goals.md](../../../tasks/agent-platform-improvement-goals.md).

### agent-platform-runtime-backup-auto — Automate local runtime config backups

Stage-two follow-up for the local runtime-config backup: automatically refresh the ignored backup after successful model, agent assignment, and MCP configuration writes so it does not become stale.

Specification: [docs/tasks/agent-platform-runtime-backup-auto.md](../../../tasks/agent-platform-runtime-backup-auto.md).

### agent-platform-capability-registry — Capability registry and policy profiles

Add capability discovery, install/enable workflows, compatibility checks, and policy profiles for tools, skills, MCP servers, and agent capability bundles.

Specification: [docs/tasks/agent-platform-capability-registry.md](../../../tasks/agent-platform-capability-registry.md).

### agent-platform-multi-agent — Multi-agent orchestration

Add sub-agent sessions, parallel work contracts, status collection, cancellation, and agent-to-agent review loops for bounded multi-agent execution.

Specification: [docs/tasks/agent-platform-multi-agent.md](../../../tasks/agent-platform-multi-agent.md).

Latest recorded note excerpt (historical evidence, not freshly verified):

> Independent design review completed 2026-08-31. Critic passes: BLOCKED (10 findings), BLOCKED (6), BLOCKED (4), then APPROVED WITH AMENDMENTS; final localized authority-table correction applied. ADR-0004 fixes the repository-local Codex control-plane boundary. Ten sequential implementation children agent-platform-multi-agent.1 through .10 and focused specs are created; no implementation child existed before review approval. Task .1 is the ready starting point.
> 2026-09-07 verified reconciliation: implementation and repairs delivered to staging via PR255, merge491518811ab53d003a2d2f90ed79dd6fb9d07d0e, after executed CI, CodeQL, Sonar, GitGuardian and packaged macOS checks passed. PR254 and PR256 are merged; original CodeQL redaction alert cleared. No main/production promotion. Delivery was owner-supervised manual fix-forward, not proof of uninterrupted autonomous operation. Epic remains open for supervised operational pilot and evidence-based closeout. Owner discussed one-to-two weeks of real-use learning; exit criteria/refinement remain to be formalized. Future reusable packaging/init research captured separately in P3 agent-platform-orchestration-toolkit; no implementation authorized.

### agent-platform-orchestration-toolkit — Investigate a reusable orchestration toolkit and guided project initialization

Future backlog research after product delivery and the supervised orchestration pilot. Investigate extracting reusable orchestration into a versioned package or separate project for multiple repositories and users. Scope: reusable core versus project adapters; distribution/versioning; guided init that detects configuration and asks for missing choices; readable configuration and Markdown playbooks; doctor validation; secure credentials and state isolation; upgrades and migration. No implementation or release is authorized now. Refine with the owner before creating implementation children.

Specification: [docs/tasks/agent-platform-orchestration-toolkit.md](../../../tasks/agent-platform-orchestration-toolkit.md).

## Findings for backlog refinement

1. **Preserve current orchestration acceptance work.** Multi-agent epic, pilot .10, repair .4 and pilot-zero remain in progress. Notes distinguish delivered code from autonomous runtime acceptance, notification/recovery proof and authoritative closeout. Pilot-zero children .1–.7 are now closed in the issue data, while parent notes still describe older intermediate work. Refresh parent summaries against current delivery evidence before deciding remaining scope; do not reopen closed children solely from stale notes.
2. **Preserve macOS release gates.** .6.3 records a need for Developer ID signing/notarization and real VM-capable Apple Silicon evidence. .6.4 is blocked by it. This is a recorded environment/evidence blocker, not a fresh check of credentials or hardware. Parent .6 and epic appear ready despite their recorded release hold. The broad Electron release criteria permit a signing decision to be deferred, while the sandbox epic explicitly forbids production release before real notarized evidence: reconcile scopes, retaining the stricter production gate.
3. **Review Git workflow carryover rather than rebuilding it.** .0ra notes implementation committed but closure blocked by .4hm. The explicit chain is .4hm → .0ra → .5zg → (.17h and .e6g) → .7vf. The conflict resolver can be evaluated independently of this recorded chain. Validate current code and acceptance before closing, superseding or implementing these older tickets.
4. **Reuse existing research-related tickets.** Observability export, context optimisation, research tools, agent governance, capability registry and improvement goals already cover portions of the new analysis. Refine or split these with explicit scope; avoid a duplicate fresh epic for each existing capability. Source ingestion/knowledge lifecycle is broader than the existing web research tool-pack description.
5. **Fix priority/readiness semantics during refinement.** Code-workbench epic is stored open and returned ready although its description says deferred/re-scoped and explicitly rejects a full integrated IDE. Its verification guide is deferred. Improvement goals have no blocker edge despite their scope relying on memory/observability signals. Recorded readiness is not sufficient authorization or architectural sequencing.
6. **Connector compatibility is a concrete issue.** MCP show fails for repair .4 because its schema rejects a supersedes relationship on a dependent. Read-only bd show works. Preserve this finding for the task-management assessment; it does not establish database corruption. Ready/stats disagreement (18 versus 16) also needs reconciliation before automated prioritization relies on it.

## Beads role and recommendation

Retain Beads as the preferred project work board for epics/features, priorities, acceptance criteria and dependency ordering. This follows the owner's intended project-orchestration role and existing repository integration. The audit does not establish that a competing tracker would reduce total delivery cost, and no tracker migration is recommended now.

Keep responsibilities explicit:

| Component                                | Authority                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Beads                                    | Planned project work, dependencies, assignment and accepted completion                        |
| Orchestration runtime / workflow journal | Execution attempts, child runs, approvals, recovery, command outcomes and evidence references |
| Git / PR systems                         | Code history, review and delivery evidence                                                    |
| Platform UI / Phoenix                    | Human control surface and read-only telemetry projections                                     |

A project-orchestration adapter should map stable Beads issue IDs to runtime runs and return verified outcomes through the existing governed broker. Multiple attempts may belong to one issue. A run completing does not itself prove all issue acceptance criteria passed. Keep generic agent conversations independent of Beads; project-based delivery can use it as the planning authority. The existing CLI/MCP is reusable; do not replace it with a bespoke task database solely for this research.

Before final selection, assess connector/version compatibility, consistent ready/dependency behavior, multi-agent writer coordination, recovery and synchronization, useful human board visibility, portability of issue history and maintenance cost. Assess these against the actual epic-delivery journey, not a general feature checklist. No externally named 'Visage Beads' product/version has been assumed or separately verified; this audit covers the configured bd/Beads system.

## Proposed fresh start: rebaseline instead of destructive reset

Wait until the active feature is finished and its owner reconciles acceptance and issue state. Then preserve a verified full backup/export of Beads history, relationships and notes, plus references to specs, run journals, approvals and Git evidence. This report is only an outstanding-work snapshot, not that full backup.

Review every outstanding issue as retain, refine, supersede, defer, or close with verified evidence. Keep the 272 closed records and stable IDs wherever possible. Map any replacement issue to its predecessor and preserve external references. Establish a small prioritized proof-of-concept backlog using the existing observability and context tickets before adding genuinely missing work. Reconcile dependencies and ready results, and apply changes through the governed broker when an autonomous run is active.

A clean planning view can be achieved without deleting history. A literal database reset would require a separate explicit decision with verified backup/restore and migration mapping; it is neither required nor performed here. Critic review should evaluate this proposed boundary and the carry-forward decisions before the board is reorganized.
