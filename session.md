# Current handoff — bounded staging integration — 10 October 2026

PR285 merged into `feature/harness-backlog-review` at
`6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec` after all ten executed final-head checks passed,
review approval and resolved threads. The owner authorized promotion to staging once checks pass;
no main promotion or prototype resumption is authorized. The next product priority is still undecided.

PR286 is open, but its full security scan stopped before analysis because 1,400,512 tokens exceeds
Promptfoo's 1,000,000-token maximum. Split the same delivery without excluding files or weakening
checks. This first segment copies only reviewed inert evidence; application/package runtime and
security workflows remain unchanged. The final full feature promotion stays pending afterward.
Scoped archived-JSON Prettier ignores preserve original evidence bytes; security scanning is unchanged.
New manifest/documentation formatting and all original artifact hashes are explicitly verified.
Primer PR287 caught the same historical Agent Zero HTTP503 already repaired in PR285; carry that
one-line official raw-source URL correction so the older staging baseline passes link checking.

Current task: `agent-platform-native-staging-evidence`, a prerequisite of
`agent-platform-native-staging-integration`. See
[the evidence delivery specification](docs/tasks/agent-platform-native-staging-evidence.md).
Task branch `task/staging-evidence-primer` starts from `feature/staging-evidence-primer` at current
staging `a5a1641c`. Selected evidence source is the reviewed feature at `6ca3cd1b`; exact path/blob/hash
provenance is recorded in `docs/reviews/evidence/native-staging-evidence-selection.json`.

PR287 merged into the evidence feature at `d46668e76d70bacaed338dd9813ac8ec361c1509` after
all ten executed checks passed and review threads cleared. Its tree matches reviewed source `e51970a2`.
PR288 now targets staging. Next: verify the exact current feature head and complete protected staging
qualification; do not repeat the completed task-to-feature integration. Every required/executed gate, including the actual packaged macOS VM journey, must
pass before staging merge. The `dev` self-hosted runner is offline and its job is queued; the owner
has been asked to bring it online. Do not treat cancellation or a skipped VM test as success.

PR288 security scan failed on 10 October with an internal model context-window overflow
([run evidence](https://github.com/jwill9999/agent-platform/actions/runs/38064854986/job/114250324847)).
This is a scanner failure, not a vulnerability finding or a passed scan. Regular CI, CodeQL and
SonarCloud passed; staging remains blocked. Independently assess smaller complete-file batches and
the provider constraint before another promotion attempt; do not truncate evidence, exclude scan
coverage, change limits or claim byte estimates prove model compatibility.

The installed scanner `0.124.1` also omits patches for three oversized archived JSON artifacts under
its built-in limits; exact paths/reasons and versioned sources are recorded in the evidence task spec.
No successful scan or analysis of those artifacts is claimed. A supported provider remedy or explicit
owner policy disposition is needed; the macOS VM remains separately queued on the offline runner.
After the handoff repair passes feature checks and is delivered, pause the integration monitor at this
external blocker rather than keep rerunning unchanged scans or polling the same runner state.

Preserve PR283, `task/pilot-active-budget` at `ee3a160f` and `task/test-runner-offline-adapter` at
`e1222b19`, and all dirty primary/paused/unrelated worktrees. The paused checkout retains thirteen
changed paths; primary retains three. Before/after snapshots and scanner evidence are in
`/Users/letuscode/.codex/staging-integration-20261010`. No pilot, paid model call, deletion or old
orchestration automation resumption. The integration-only monitor follows this authorized delivery.

After the primer merges, refresh the full feature promotion against staging, preserve the entire
reviewed source plus integration bookkeeping, and rerun the smaller remaining diff through all gates.
Do not declare staging development-ready at the intermediate evidence checkpoint. After full delivery,
review the live product backlog with the owner to choose the next priority. Beads/remote refs remain
current authority; the older handoffs below are historical snapshots.

---

## Historical staging handoff

## Verified snapshot — 2026-09-13

Pilot-zero prerequisite, lifecycle, output-validation and active-settlement repairs are delivered to
`feature/pilot-zero-assessment` at `746073e5605faf3fe219b8bd78547d7ed7e6adfe`.
PRs [259](https://github.com/jwill9999/agent-platform/pull/259),
[260](https://github.com/jwill9999/agent-platform/pull/260),
[261](https://github.com/jwill9999/agent-platform/pull/261) and
[262](https://github.com/jwill9999/agent-platform/pull/262) are merged.

At this documentation snapshot, staging remains `67e3caefa69fae64f77b60e1ecc9517350c5e20e`;
local staging matches it. Main remains `0dc0d475faf535911a20fcabb9bfd0262b2bbad4`.
The owner approved documentation cleanup and feature-to-staging promotion conditional on required
checks and review clearance. Production/main promotion is not authorized. Read GitHub and Beads
for later promotion evidence; this snapshot is not a claim of staging delivery.

## Verification and task state

PR260 includes the SQLite writer reservation, immutable launch provenance, cancellation deadline
and local hook isolation repairs. PR261 adds output validation only, not repository import.
PR262 passed independent source review, 687 package tests, build, typecheck, lint and formatting.
Nine opt-in Docker tests were skipped by the default suite; both real offline settlement
success/cancellation probes passed separately. All nine executed hosted checks passed on its final
head `e5410d07e7712aa519ff7ef30764585e97d79a67`, including Sonar. The staging-only macOS VM job was
skipped on the feature-targeted PR.

Sourcery did not review PR262 because its weekly budget was exhausted. No Sourcery pass is claimed;
independent Astra reviews passed and no review threads remained. The limitation is
[documented on PR262](https://github.com/jwill9999/agent-platform/pull/262#issuecomment-5649550797).
Staging-specific CI and security checks must pass on the staging PR before promotion.

Beads children `agent-platform-pilot-zero.1` through `.7`, including `.5.1`–`.5.3`, and
`agent-platform-hook-isolation` are closed and synced. The parent pilot and multi-agent acceptance
remain open. Current delivery tracking is `agent-platform-pilot-zero-delivery-handoff`.
The reusable toolkit investigation remains a separate low-priority backlog epic.

## Remaining orchestration acceptance

Read [pilot-zero assessment](docs/tasks/agent-platform-pilot-zero.md) before resuming implementation.
The remaining path needs an execution-bound baseline and settled-output handle, immutable output
bytes, journaled import, a brokered commit and a typed H0-to-H1 receipt. Coordinator completion also
needs its own typed evidence. Demonstrate actual isolated execution advancing verification at the
new head, including replay, interruption and missed-wakeup recovery, without chat intervention.

Offline Docker probes do not establish live model authentication, restricted-egress provisioning or
unattended execution. Desktop host resumption remains unsupported. Supervised subagent coordination
and the ten-minute heartbeat are fallback mechanisms, not proof of the managed runtime.
Do not fabricate receipts, relabel old approvals or close the parent epic on staging delivery alone.

## Workspace and continuation

The primary checkout retains unrelated `.beads/interactions.jsonl` changes; preserve them.
Duplicate historical cancellation edits are retained in a named recovery stash. Older recovery
stashes and `/Users/letuscode/.codex/branch-cleanup-zlHuce/before-cleanup.bundle` require ownership
review before removal. Do not reset or overwrite dirty work to align staging.

The `pilot-zero-progress-and-ci` heartbeat follows approved documentation/staging delivery and
must stop monitoring that delivery after completion. The older `orchestration-repair-progress`
monitor is paused. Reconcile Beads and GitHub before acting; no active managed run was reported at
the last audit. This delivery uses supervised manual coordination, not broker receipts.

## 22 September: agent documentation access

Added project Codex LangChain documentation MCP and shared guidance for current AI SDK documentation:
official agent index, search and targeted Markdown pages, checked against installed package versions.
Live endpoints and TOML verified. No dependencies, application behavior or baseline-test priorities
changed. VS Code's existing MCP file and local Beads interaction changes are retained separately.

## 8 October: staging documentation link repair

PR281 link checking identified that the AI SDK search API now returns HTTP 404.
Shared instructions now use the official agent index to find topic URLs and fetch their Markdown
content. The reference index and installed-version safeguards remain. Fresh staging checks are
required on the corrected head; no staging merge or harness pilot is authorized by this repair.

## 8 October: documentation access across agent surfaces

PR281 review identified that shared LangChain guidance only named the Codex MCP connection.
Added official agent-index and TypeScript LangChain/LangGraph URLs, Markdown retrieval guidance,
and installed-version checks for Claude Code, Copilot and other agents without that connection.
