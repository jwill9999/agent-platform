# Task: Trusted historical archive qualification

**Beads issue:** `agent-platform-native-staging-archive-policy`

**Parent:** `agent-platform-native-staging-integration`

**Plan version:** 1, 11 October 2026; owner approved the reviewed narrow policy option B.

## Objective and authority

Consolidate the retained native development baseline into protected staging without discarding
historical evidence or treating an uncompleted Promptfoo scan as successful analysis. The owner
approved a narrowly different security qualification for exact historical archive additions.
Ordinary authored/code changes still require actual completed Promptfoo analysis. This approval
does not authorize main promotion, protection bypass, paid model calls or paused orchestration.

PR286 rejected 1,409,530 tokens above the 1,000,000-token limit before analysis. PR288 failed with
provider context overflow. Earlier failures remain failures; no vulnerability result was produced.
Promptfoo 0.124.1 also omits patches above its built-in blob/patch limits. Filesystem access is
not evidence that omitted archives were analyzed. The approved route is deterministic archive
qualification, explicitly distinct from Promptfoo analysis.

## Requirements

| ID  | Required behavior                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP1 | Policy adoption itself receives ordinary actual full scanning, existing protections, independent review and an actual packaged macOS VM pass before protected merge. Missing protected-base policy must select full scanning. No self-exemption.                                                                                                                                               |
| AP2 | Pin exactly 220 original paths, modes, Git blobs, SHA256 values and sizes from `6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec`, total 3,958,506 bytes. Selection-manifest digest is `30788264b062ce9dec1060237b6b41fb78a6b8734a6fecc46861a375a9b49b11`.                                                                                                                                             |
| AP3 | Read classifier/allowlist from exact protected base, never candidate source. Complete NUL-delimited Git-object diff, rename detection off: only the complete 220 exact additions absent from base, mode 100644, qualify. Unknown, mixed, edited, deleted, renamed, executable, symlink, consumer/policy/workflow changes require full scanning. Malformed identity/objects/policy fail closed. |
| AP4 | Archive validation uses data-only objects; never execute, import or apply archives, patches or candidate scripts/dependencies/configuration. Validate 139 JSON files, independently review archive security/data and record secret/static coverage, including actual limits.                                                                                                                   |
| AP5 | Automatic required `security-scan` retains ordinary Promptfoo analysis for authored changes; only trusted-base exact archive classification selects deterministic archive qualification. Authored session/spec/formatting/manifest bookkeeping is not exempt.                                                                                                                                  |
| AP6 | Automatic status alone is insufficient provenance. Require a separate protected-staging `workflow_dispatch` from the existing default-registered workflow filename, running only protected code and positively qualifying the archive route. Unknown/nonarchive dispatch fails. Do not use staging-only `pull_request_target`, which executes default-main workflow.                           |
| AP7 | A mandatory trusted merge verifier binds actual automatic PR run, exact PR/head/base/merge workflow blob, protected dispatch source/ref/event, receipt downloaded from that run and independent digest/classification evidence. Never accept a candidate-controlled receipt or green context/app ID alone. Reject stale head/base, wrong repository, workflow source or forged provenance.     |
| AP8 | Preserve current protection rules, all other executed/required gates, actual VM success, resolved actionable security/code comments and independent review. Final remaining PR286 still requires a completed full Promptfoo scan; this policy is not proof it will fit provider context.                                                                                                       |

## Source, branch and responsibility

Policy segment starts at protected staging `a5a1641c3d2a5ef317c05fa45c6190e7189c1915`.
Use `task/native-staging-archive-policy` into `feature/native-staging-security-policy`, then a
separately qualified feature-to-staging PR. Preserve original native feature, primer histories,
all 220 artifact bytes and separate paused branches/worktrees. No artifact files are added in
the policy adoption PR.

Bounded code: `.github/security/historical-evidence-allowlist.v1.json`,
`scripts/classify-historical-evidence.mjs` and meaningful negative tests,
trusted archive qualification/merge verification helpers and
`.github/workflows/promptfoo-code-scan.yml`. Scoped planning/testing/review/task documents and
`session.md` carry delivery evidence. A one-line `.github/workflows/ci.yml` concurrency repair
preserves active staging/feature PR validations while main-targeted PRs retain cancellation;
this is fully scanned authored policy-adoption scope, not archive data or a VM gate reduction.
The discovered runner signing failure requires bounded authored desktop build-output resolver,
signing/packaging scripts and tests: query canonical Swift build output, validate executable
helper and package the exact signed binary. Independent plan review approved this refinement.
No product permission/runtime/dependency or global-skill changes.
Coordinator owns delivery, Beads, mirrors, host qualification and protected merges. Independent
plan critic and code reviewer use source/evidence read-only; this is a procedural assignment,
not a technical claim that inherited tools are unavailable.

## Implementation plan

1. Independently critique this plan and resolve every actionable finding under existing authority.
2. Implement protected-base classifier, immutable exact allowlist and data-only validation.
3. Add automatic archive routing after bootstrap; add distinct protected dispatch provenance and
   trusted merge verification. Preserve ordinary Promptfoo job permissions only for actual analysis;
   archive dispatch needs read permissions, not OIDC or arbitrary check-writing.
   Ordinary scanning uses the pinned vendor action base outside candidate npm configuration;
   an independently reviewed, source-anchored fail-closed response guard rejects raw skip/mock/
   no-files responses before SARIF conversion. Record original and guarded bundle digests, rather
   than labeling the guarded bundle unmodified. Prepare and verify the exact API-validated local main/staging base ref in
   the detached data-only scan checkout, preserving isolated package-installation cwd.
4. Test trust-boundary negatives and pinned real archive classification. Independently review code.
5. Publish full source-bound documentation mirrors with readback, commit/push through normal hooks,
   deliver task-to-feature, then small policy staging adoption through actual full scan and VM.
6. Separately fully scan authored primer bookkeeping, refresh PR288 to an archive-only diff,
   qualify automatic and protected-dispatch lanes, verify exact source/provenance and merge only
   with all current protections/reviews/VM clear. Preserve earlier failed scanner attempts.
7. Refresh/rehearse PR286 without losing source or either session history; require actual new-head
   full scan, VM and all protection/review gates before final baseline promotion.

## Dependency order

No upstream implementation issue. Parent `agent-platform-native-staging-integration` and archive
delivery child `agent-platform-native-staging-evidence` depend on this task in Beads.
`agent-platform-native-staging-runner` independently qualifies APFS host and actual VM execution;
successful protected adoption cannot complete before that environment actually works.

## Verification and definition of done

Unit/integration Git fixtures cover exact additions and more than 100 paths, unknown/additional/
partial/empty/mixed changes, edit/delete/rename, modes, wrong hash/blob/size, duplicate/malformed
allowlists, path traversal/control characters, missing objects and incomplete enumeration.
Provenance tests cover wrong repo/base/ref/event, stale head/base, forged automatic checks,
workflow modifications, mismatched/missing candidate receipts and protected run-source linkage.
Tests must assert effects/route, not mirror implementation. Real Git objects verify all 220 blobs.
CLI/version and built-in scanner coverage limits are recorded; no fictitious full-analysis result.
The trusted verifier's adoption SHA establishes ancestry and unchanged protected control blobs.
It does not itself prove adoption CI/review success. The coordinator must retain the actual
qualified adoption PR/head/run/check/review/VM evidence with that SHA before invoking it, then
independently require all merge protections. Verify the complete local dependency bundle before
executing imported helpers; recheck latest successful run attempts immediately before proof output.

Required local formatting/Markdown/lint/build/typecheck/affected tests and existing quality gates;
hosted Sonar/CodeQL/reviews remain mandatory. Actual connected journey is policy adoption full
analysis plus actual macOS VM, then real protected archive qualification and ordinary final full
scan. No browser product UI changed, so additional UI fixtures do not prove this boundary.

Beads closure requires reviewed/pushed implementation, protected policy adoption, actual archive
qualification evidence, preserved source and full mirrors/readbacks/Dolt sync. Parent/primer stay
in progress until their own actual staging delivery. Never close from a plan or green unit tests.
On a concrete external failure, retain evidence, diagnose and make meaningful scoped repairs;
do not endlessly rerun unchanged failing scanner input or silently waive remaining coverage.
