# Session handoff

## Current native staging consolidation — 11 October 2026

Current owner direction supersedes historical prototype handoffs below. The orchestration
prototype remains paused/retained, with PR283 and budget/offline-adapter branches outside this
integration. Native development does not require its pilot/discovery/broker approvals. The owner
approved reviewed APFS runner setup and narrow archive scanner policy B, routine blocker repairs,
and protected staging merges only after actual current-head checks and actionable reviews clear.
No main promotion, paid model calls, pilot, decommissioning or next priority selection.

Staging remains `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`; full feature PR286 head is
`542e082e3569934b4dcd86ab58b0ea3ce9edbbb3`. PR290 coordinator and PR291 BashGuard repairs are
merged into the feature; current PR286 CodeQL analyses have zero results and their scoped findings
are fixed on this PR ref. PR288 primer head `2ad1a88a7bcf3978e9c02884e36c0cfae8ab11d0` remains
unmerged. Neither staging delivery nor complete native development readiness is claimed.

Work is now on `task/native-staging-archive-policy` from staging-derived
`feature/native-staging-security-policy` in the clean codex-developer-autonomy worktree. New child
Beads runner/archive-policy issues and dependencies are read back; parent/primer remain in progress.
Beads synced after this initial resumed checkpoint. Subsequent changes need their own readback/sync.

Fresh official runner 2.337.0 on native APFS is online as dev 23 with the four required labels;
old ExFAT installation is preserved, old idle Listener stopped gracefully, fresh credentials used
without copying/publishing tokens, and no service installed. PR286 CI 38081623129 attempt 2,
job 114337873032, completed preparation4 seconds, checkout3 seconds, install/preflight/assets/Swift
build. Signing failed because hardcoded build output differed from actual Swift output. A reviewed
shared `--show-bin-path` signing/packaging resolver is being implemented; actual VM remains required.
Both old attempts stalled approximately 60 minutes before cancellation. Exact cancellation origin is
unconfirmed; cancellation does not explain the preceding filesystem stall. The owner-raised CI
concurrency refinement preserves active staging/feature validations using `github.base_ref == main`
for cancellation on this PR-only workflow; stale-head success never qualifies a new head.

Packaging fix local qualification: 12 resolver tests, 8 desktop fixture/script tests, actual
Swift build/development signing/asset hashes/package/signature verification and 2 packaged
Electron journeys pass. Healthy path uses real VM/assets/helper; provider output and unhealthy
runtime are documented doubles. Full build/typecheck/format/final lint pass. Independent PACK-01
toolchain selection finding is corrected with canonical `/usr/bin/swift` for build/discovery;
CI resolves once, signs/packages exact helper. Packaging re-review approved the correction.
Final frozen archive implementation passes 23 tests, with zero failures or skips. Independent re-review approved the
verifier dependency/attempt guards and scanner response/base-ref fixes. The further vendor-bundle
output-buffer correction passes the actual large-bundle regression and is independently approved. Hosted new-head full scan and VM remain
required before policy adoption.
Local success is not staging readiness.

PR286 full Promptfoo scan failed before analysis at 1,409,530 tokens > 1,000,000. PR288 provider
context overflow remains distinct. Owner approved narrow deterministic exact historical archive
qualification, not a blanket authored-code skip. Small policy adoption must itself receive actual
full scan and actual VM before protected trust. Existing PR288 includes authored bookkeeping, so
that must be delivered through full scanning before archive-only qualification. Archive route
requires exact 220 inert additions, protected-base immutable allowlist, independent data/security
review, automatic check plus separate protected staging dispatch and trusted merge verification.
Independent plan critique approved this boundary; implementation/connected qualification pending.

All 220 artifact bytes remain retained:3,958,506 bytes from original6ca3cd1b; all 139 JSON parse.
Independent data review found no confirmed credentials, disclosed local path/email metadata and
historical instructions as inert data, and documented non-exhaustive secret/consumer coverage.
Primary dirty3paths, paused dirty13paths and separate branch tips remain preserved.

Read [execution manifest](docs/planning/native-staging-remedies.md),
[policy spec](docs/tasks/agent-platform-native-staging-archive-policy.md),
[runner spec](docs/tasks/agent-platform-native-staging-runner.md),
[verification plan](docs/testing/native-staging-remedies.md) and
[actual results](docs/reviews/native-staging-remedies.md).
Next sequence: fully qualified small policy/runner segment to staging; fully scanned authored
primer bookkeeping; exact archive-only PR288 qualification/promotion; refreshed/rehearsed PR286
actual full scan/VM/protected promotion; verify complete source/preservation and clean only proven
delivered temporary refs with recovery protection. Then owner reviews the live Beads backlog to
choose next feature. Automation stays active within that authorization and quiet on unchanged jobs.

---

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
