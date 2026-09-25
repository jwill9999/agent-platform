# Approved-document binding implementation review

Status: **repairs verified locally; independent recheck and hosted gates pending; draft, unmerged**.
Task authority: Beads `agent-platform-pilot-zero.16`. The owner explicitly authorized completing the
six unresolved findings. The [owner approval](approved-document-binding-owner-approval.json) binds
the frozen planning material, which remains unchanged. Delivery is supervised direct implementation,
not managed orchestration. No staging or pilot was launched.

## Repair dispositions

| Original finding | Implemented repair | Evidence |
| --- | --- | --- |
| Trusted publication and current accepted workspace | Real Git common directory, canonical workspace hash, approved remote and commit ancestry; accepted delivery/repair/imported task refs resolve registered worktrees; run-wide checks cover all accepted task sources | Foreign repository, unknown revision, task/run/import workspace tests |
| Snapshot mismatch must invalidate durably | Snapshot staging and verification execute inside durable attempts; settlement failure leaves quarantine | Tamper, restoration, failed settlement, source/snapshot/packet substitution tests |
| Supplied packet must match persisted scheduler input | Clone input, then compare the complete packet/envelope and reservation identity before credentials or workspace creation | Substitution denial with zero issue/create/start; actual launcher success/cancel |
| Same-status terminal replay must reject conflicting results | Compare existing and supplied terminal result before replay adoption | Scheduler completion-contention suite |
| Cleanup after approval loss | Cleanup-only bootstrap constructor verifies historical exact identity, disables execution, retains evidence and respects current leases | Reopen after invalidation, denied execution/live takeover, successful fenced cancellation |
| Complete negative/runtime/crash coverage | Expanded admission matrix, actual Docker lifecycle, public coordinator/restart, process death and competing owners, publication faults and legacy cleanup | Verification matrix below; independent completeness assessment remains pending |

The [third independent review](evidence/approved-document-binding-code-review-round3.json) found
additional gaps in taskless/imported-source resolution, credential dispatch, safe Git error reporting
and the launcher fixture schema. These are repaired with regressions. The [fourth review](evidence/approved-document-binding-code-review-round4.json) then found that
initial import needed to verify the incoming ref before ledger insertion, and repair effects needed
fresh checks after asynchronous observations. Import now adds that exact ref to the durable check;
the official repair adapter invokes a guarded dispatch for each Beads/Git write. Suspended-read tests
withdraw approval or replace the lease and assert no later unauthorized effects. A full public
coordinator-to-actual-launcher/result/restart journey now runs separately for both normative documents.
Dependency cycles are eliminated; Sonar-requested complexity refactors and explicit file-hash record
formatting are included without changing authority semantics.
The [sixth review](evidence/approved-document-binding-code-review-round6.json) identified ordinary
delivery dispatch, source/tree divergence and durable launch cancellation gaps. Delivery now reserves
the writer at dispatch, uses the verified task worktree and verifies normative Git blobs; credential
and container dispatch check durable cancellation. The [seventh review](evidence/approved-document-binding-code-review-round7.json)
confirmed the source and cancellation repairs, then found time-based Git lease expiry and the
Beads/Dolt transition effect boundary. Git now invokes the active reservation's fresh fence check
before each real effect. Transition execute/recovery verifies documents and reserves the writer at
effect initiation. Official adapter tests suspend claim/close/push observations and change documents,
approval, cancellation or ownership, asserting zero subsequent writes. Real Git tests cover distinct
canonical/task worktrees, changed/adopted document blobs and lease expiry during Git observations.
Bootstrap shares the existing writer reservation, avoiding competing SQLite writers.
Final independent follow-up is running against these changes.

No earlier finding is treated as waived merely because the regression suite passed.

## Retained verification

- Previous full Linux checkpoint: **868 passed, 17 optional skipped**, 46 test files passed, 5 skipped.
- Enabled document/container and actual launcher suites: **110 passed**, no skips. These separately
  execute the two document Docker cases and four launcher/coordinator cases skipped by default.
  Native path tests separately pass the unreadable-file case skipped by a root Linux runner.
- Production TypeScript build/typecheck, separate launcher-test typecheck and zero-warning lint pass.
- Latest focused delivery/transition suites: **60 passed**, including suspended Beads/Dolt effect
  cases; four real coordinator/launcher scenarios rerun and pass after the final dispatch repair.
- Independent rounds four, six and seven are retained with their repair dispositions. Final full
  regression and independent follow-up remain pending.
- Monorepo typecheck and dependency-cycle checks pass locally. New-head hosted checks await publication. No merge recommendation yet.

[Machine-readable evidence](evidence/approved-document-binding-repair-verification.json) records
commands, environment, source/test/compiled hashes and fixture limits. Retained output:
[Linux](evidence/approved-document-binding-linux.log),
[connected containers](evidence/approved-document-binding-connected.log),
[lint](evidence/approved-document-binding-lint.log).
Earlier [checkpoint evidence](evidence/approved-document-binding-checkpoint.json) and
[round one](evidence/approved-document-binding-code-review-round1.json) /
[round two](evidence/approved-document-binding-code-review-round2.json) remain historical records.

## Requirement-to-evidence matrix

| Planned scenario | Executed evidence and limits |
| --- | --- |
| DB-T01 canonical bytes/manifest/legacy digest | `planningDocuments.test.ts`: ordering, aliases/version/task mappings, task coverage and byte-sensitive digest; immutable legacy fixture digest |
| DB-T02 publication paths/limits | Planning-document publication and existing `preapprovalMaterial.test.ts` staging guards; missing/symlink paths and prohibited/oversized input fail closed |
| DB-T03 publication/review/approval | Real Git/SQLite/artifacts, fixture critic/owner records; spec and verification edits after publication deny owner approval |
| DB-T04 authority consumers | Public packet; queue/claim/start; store admission matrix for transitions, scheduler, notifications/callbacks, import, repair, delivery, evaluation/finalization; real broker two-connection tests and credential/repair dispatch counters |
| DB-T05 immutable worker snapshot | Production staging and validation; supplied packet/root/task/approval substitution denial; actual launcher lifecycle and read-only mount writes denied |
| DB-T06 restart/replay | Reopened real store and recreated public coordinator issue unchanged bound packet; changed material denied; persisted scheduler replay result conflict rejected |
| DB-T07 partial writes/crash/concurrency | Object/receipt retry, no approval from partial publication; failed intent/settlement; SIGKILL after persisted intent; mismatch plus failed invalidation plus SIGKILL plus restored bytes; two processes with SIGSTOP/lease takeover, stale settlement denied |
| DB-T08 compatibility | Legacy digest/readability, manifest-required denial, cancellation without current document authority, separate current critic/owner approval; additive migration rollback/idempotent reopen |
| DB-T09 bootstrap/repair/notification | Bootstrap cleanup after lost approval; child-effect/commit/dispatch and notification accepted/resume admission; credential issue after invalidation/quarantine denied |
| DB-T10 connected feature check | Publication → explicit fixture review/owner approval → public packet and launchTask → actual launcher/offline consumer → durable result and artifact → store/coordinator restart; old packet blocked after spec or test-plan tamper |
| DB-T11 safe diagnostics/evidence | Operator safe reason, publication Git failures and remote-credential marker denial; retained command results and material hashes |

The admission matrix uses explicitly seeded pending rows where necessary to isolate document guards;
those cases prove refusal before authority/effects, not successful business transactions. Existing
positive module suites supply the ordinary transaction coverage. Docker launcher tests use a real
container and deterministic executable with a fixture credential protocol. Owner/critic identities
are synthetic in disposable test journals. No external GitHub/Beads mutations or live agent-model
execution were part of these probes. This is not acceptance of an autonomous pilot or a complete
proof against a hostile host.

## Delivery boundary

The cumulative [implementation request](https://github.com/jwill9999/agent-platform/pull/273) targets
`feature/harness-backlog-review`. Keep it draft until independent findings and required hosted gates
are resolved. Owner review/integration remains separate; Beads stays in progress until that boundary.
Staging-only packaged macOS VM testing and the future managed single-task pilot remain separate.
