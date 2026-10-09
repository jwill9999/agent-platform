# Codex developer autonomy — execution plan

Status: detailed plan independently approved with zero remaining findings; implementation already authorized by owner on
9 October 2026. Native Codex is the chosen route; this document does not create runtime approval.

## Objective and authority

AUT-01–08 in [the canonical planning task](../../tasks/agent-platform-codex-autonomy-plan.md)
remain the requirements. Owner has authorized planning, implementation, tests, repairs, independent
review and exact-head CI to a final code-review request, with no additional routine phase approval.
Merge, deployment, global edits, paid external gateway calls and prototype/pilot resumption are excluded.
Codex platform permissions continue to apply; removing repository overrides grants no platform tools.

Upfront requirements/DoD/tests agreement authorizes normal file selection, task refinement, repairs,
retries and phase transitions. Clarify only a real change to owner intent, agreed behavior/delivery,
explicitly reserved actions, or required unavailable inputs. Final owner acceptance stays explicit.
Product Ask/Auto/Block, tool/path/network guards and secret encryption remain unchanged.

## Source and supporting manifest

Clean branch `task/codex-autonomy-plan` starts from existing integration branch
`feature/harness-backlog-review` at `f8112b142ecad7d8fa5963484a0ed28235b04c3b`.
Only the two initial autonomy documents were cherry-picked from `e1222b19`; no budget or adapter
implementation came across. The worktree initially created from staging was cleanly switched before
edits after ancestry inspection showed the integration branch contains the active instruction set.

[Supporting manifest](../../reviews/evidence/codex-autonomy/supporting-manifest.json) retains exact
paths/revisions/SHA-256 for the initial 163-line spec, 105-line R1 critique, uncommitted audit and
pause checkpoint. Full copies of the previously unpublished
[audit](../../reviews/evidence/codex-autonomy/supporting-audit.md) and
[checkpoint](../../reviews/evidence/codex-autonomy/paused-checkpoint.md) are retained without changing
original files. R1 APPROVED with zero findings is outline evidence only. Every reviewer receives
this manifest, current authorization, detailed plan, specs, tests and accessible source paths.

## Tasks, ownership and dependencies

Primary Codex owns all implementation; a distinct native critic owns read-only plan/code assessment.
Reviewers can inspect source with available native tools; read-only assignment is procedural, not
an assertion of tool isolation. No inherited-tool absence is claimed.

| Task                                       | Parent branch → branch                      | Requirement/scenario           | Deliverable                                                                |
| ------------------------------------------ | ------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `agent-platform-codex-autonomy-plan`       | feature → `task/codex-autonomy-plan`        | AUT-01–08; V-01–07 design      | Inventory, preservation, reviewed plan/spec/test map                       |
| `agent-platform-codex-autonomy-policy`     | plan → `task/codex-autonomy-policy`         | AUT-01–04; V-01/02             | Shared native policy; six inherited profiles/config                        |
| `agent-platform-codex-autonomy-guidance`   | policy → `task/codex-autonomy-guidance`     | AUT-02/03/05/07/08; V-01/04/07 | Skills, ADR and active entry points; global proposals                      |
| `agent-platform-codex-autonomy-acceptance` | guidance → `task/codex-autonomy-acceptance` | AUT-01–08; V-01–07             | Final validation/review, full mirrors, exact-head CI and owner code review |

Real Beads blocking edges are plan → policy → guidance → acceptance, with no pilot/runner prerequisite.
Canonical Beads root is `/Users/letuscode/projects/agent-platform`. Intermediate tasks close only when
their local review, preservation, publication and pushed handoff pass. Final acceptance stays open
for owner review/integration; do not merge. One cumulative tip PR targets `feature/harness-backlog-review`.

## File dispositions and implementation

[Complete disposition inventory](inventory.md) enumerates every candidate from the source audit,
with explicit rewrite/preserve/defer disposition and source category. Additions are bounded to this
plan folder, linked task/testing/review evidence, `docs/development/codex-development.md` and
`docs/adr/0005-native-codex-development.md`. No app/package/lockfile or prototype code edits.

1. Rewrite shared instruction broker exclusivity as prototype-only; add native developer default,
   agreed-task authority and reserved owner actions. Keep quality/task/Git/secret hygiene and runtime
   notification boundaries. Remove six profile `sandbox_mode` overrides and project concurrency cap;
   keep agents enabled/interrupt behavior and responsibility-oriented role prompts.
2. Rewrite planning/implementation/critique skills for native authorized delivery and meaningful source
   review. Exact-material machine contracts/approvals apply only to the explicit prototype. Planning
   by the coordinator can publish; distinct review remains independent. Remove mandatory no-tool review.
3. Scope orchestration skill to paused explicit prototype only. Reconcile documentation/publishing/
   Playwright skills and guides/tasks/template; keep connected product QA and full Notion readback.
4. Supersede ADR0004's default policy via ADR0005; retain historical body. Add prototype-only banners
   to all `docs/workflow-control*.md`, retain enforcement/API documentation. Reconcile decisions,
   skill index, AGENTS entry point and session guidance. Historical tasks/reviews/plans keep bytes.
5. Propose exact global guidance edits separately. Do not write global config/skills/memory/automations.
   Existing worktrees retain old rules until ordinary reviewed integration; no dirty checkout reset.

## Verification and completion

[Verification plan](../../testing/codex-developer-autonomy.md) maps V-01–07 to tasks and actual oracles.
No application behavior changes: connected product E2E is retained coverage, not newly required for
this documentation/profile change. Run existing approval/path/dispatch/API security regressions,
workspace build/typecheck/lint/format and required hosted workflows, including recursive prototype
tests in normal CI. No opt-in live managed pilot/paid gateway test. Terminal fallback is disclosed
if Sonar/IDE diagnostics are unavailable; hosted Sonar must still be inspected.

Record passed/failed/skipped/blocked/not-run against exact revisions. Fix actionable failures within
this scope, preserve evidence and re-review changed semantics. No repeated owner approval for repairs.
Missing external inputs/check infrastructure are reported concretely; do not bypass protections.

## Preservation, activation and rollback

External before manifest `/Users/letuscode/.codex/autonomy-cleanup-20261009/preservation-before.json`
binds 789 tracked app/package/lock/workspace files, 13 dirty source-worktree files, six global config/
skill files and four paused automation files. Compare after; expose only hashes/counts, not credentials.
Also verify all other registered worktree dirty files via a supplemental before/after manifest.
Canonical `.beads/interactions.jsonl` may append authorized task-operation audit entries; verify the
original prefix SHA-256 remains exact and report appended bytes separately, never overwrite history.
The supplemental baseline covers 109 dirty status entries across 11 other worktrees, recursively binding 110 regular files and all directory/symlink/absent entry types plus global `AGENTS.md`,
`MEMORY.md`, the identified review-gate memory skill and September13 note; hash-only preservation.
Prototype source/tests remain byte-identical at the chosen base; it remains in recursive workspace gates.
No source app imports were found; inspect CLI/MCP/scripts/hooks for unexpected default launch routes.

Fresh-session acceptance uses a distinct native review agent and, where feasible, a new native local
Codex session that reads current repository instructions and performs a bounded non-product edit/
validation journey in a disposable checkout. Observe actual tools/output and effective defaults;
do not infer adoption from TOML alone. A representative product ticket is specified for later owner
selection; this cleanup cannot claim paid upstream or full product delivery evidence.

Owner code review follows all required executed exact-head CI checks and independent implementation
review. After owner acceptance/merge, new sessions on the integrated branch inherit repository guidance;
already-running sessions may retain loaded instructions. Global obsolete guidance remains a separately
reported limitation, with latest owner policy taking precedence now. Old automation prompts stay paused.
Rollback is a reviewed revert of scoped commits before/after integration; do not reset dirty worktrees,
delete recovery evidence, restore global defaults or restart the pilot. No deployment occurs here.

## Document manifest

- [Planning task](../../tasks/agent-platform-codex-autonomy-plan.md)
- [Policy task](../../tasks/agent-platform-codex-autonomy-policy.md)
- [Guidance task](../../tasks/agent-platform-codex-autonomy-guidance.md)
- [Acceptance task](../../tasks/agent-platform-codex-autonomy-acceptance.md)
- [Verification](../../testing/codex-developer-autonomy.md)
- [Initial outline critique](../../reviews/codex-autonomy-removal-review-2026-10-09.md)
- [Detailed critique/results](../../reviews/codex-developer-autonomy.md)
- [Global proposals](global-follow-ups.md)
- [Inventory](inventory.md) and supporting evidence manifest above

Changed substantive documents/skills/session get full branch-specific Notion mirrors and readback.
Supporting raw artifacts get immutable source links in the owning report. No native execution-contract
schema or persisted workflow approval is required for this owner-authorized cleanup.
