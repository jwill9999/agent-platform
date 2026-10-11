# Approved-document binding verification plan

Owner/task: `agent-platform-pilot-zero.16`. Status: planned, not executed.
Requirements and scope: [plan](../planning/approved-document-binding/plan.md).

## Environment and evidence

Use Linux Docker, built workflow-control, a temporary real Git repository, real SQLite journal and
real content-addressed artifact directory. Create synthetic specs/test plans without user data or
credentials. Verify actual rows, snapshot bytes and effect-call counts; a returned status is not enough.
Use fake owner/critic identities and review evidence only in isolated test databases, never the live
journal. External GitHub/Beads effects use counting/failing adapters; no remote mutation is permitted.
Remove fixtures/containers in finally blocks; retain sanitized results before cleanup.

The UI layer is not applicable: this task changes developer orchestration, with no product browser
or Electron path for these approvals. E2E is the connected coordinator/publication/SQLite/artifact/
packet/launcher path. Existing hosted browser/desktop suites remain regression gates, not proof of
this new backend behavior. No live model is needed; a deterministic isolated consumer suffices.

| ID     | Requirements | Scenario and assertions                                                                                                                                                                                                                                                           | Level                       |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| DB-T01 | DB-1,3,7     | Same manifest/order canonicalizes identically; raw-byte/path/kind/task/set changes alter digest; absent legacy field preserves old digest fixtures. Invalid version, duplicate/case alias, unknown task and missing spec/test coverage rejected.                                  | Unit                        |
| DB-T02 | DB-2         | Missing/unreadable/symlink/parent-symlink/traversal/absolute/credential paths and size/count limits fail publication; no receipt or approval. Reuse staging tests, add manifest composition cases.                                                                                | Unit + filesystem           |
| DB-T03 | DB-2,3,6     | Publish complete set, approve matching reviewed contract, read real persisted binding. Alter spec or test with same length and path before approval; approval rejected. Stale critic cannot approve new set.                                                                      | Integration                 |
| DB-T04 | DB-3,4,5     | Modify/delete/tamper one document after approval before each mapped authority entry: packet, queue, claim/start, effect, import, delivery. Assert zero unauthorized effects, invalidation/audit reason and no stale result adoption. Map covers every discovered direct consumer. | Integration                 |
| DB-T05 | DB-5         | Worker receives exactly approved read-only snapshot and bound packet. Substitute snapshot bytes or another task/run/approval/source root; reject before launch/effect. Source mutation after snapshot creation never changes consumed bytes; next boundary detects it.            | Integration + real Docker   |
| DB-T06 | DB-4,6       | Close/reopen SQLite and recreate coordinator, resume unchanged workflow successfully. Change/miss artifact or normative source before resume; durable refusal, no automatic reapproval. Exercise duplicate resume and queued replay.                                              | Connected E2E               |
| DB-T07 | DB-6         | Inject failures after object put, before receipt, after receipt and during invalidation; retries are idempotent, partial publication cannot authorize. Existing approval never survives a known mismatch as usable authority if persistence fails; process fails closed.          | Integration                 |
| DB-T08 | DB-7         | Open legacy database containing historical contracts/approvals; reads/status/cancel/cleanup still work. New execution/resume rejected with manifest-required reason. Replan into linked new immutable contract/run and approve independently. Old approval remains unusable.      | Migration/compatibility     |
| DB-T09 | DB-3,4,6     | Bootstrap, inherited child/repair approvals and durable notification resume cannot drop/substitute the manifest or bypass verification. Old capability denied after invalidation; restored bytes do not reactivate it. Fresh legitimate contract/approval works.                  | Integration                 |
| DB-T10 | DB-1..8      | Complete publish → critique fixture → explicit owner fixture → packet/isolated consumer → persisted evidence → restart → resume. Repeat with tampered spec and with test plan; independently inspect journal, snapshot digests and mutation counter.                              | Final connected feature E2E |
| DB-T11 | DB-8         | Errors/logs contain safe reason and identifiers but no bodies, synthetic secret markers or sensitive host paths. Review results list passed/failed/skipped/not-run by scenario and revision.                                                                                      | Unit + report gate          |

Task `.16` owns DB-T10 and final cross-module acceptance. Tests must actually traverse public
coordinator/CLI paths and production guards, not invoke a stand-alone verifier as a substitute.
For DB-T05 use an offline command consumer in a disposable container; record image digest and mount
configuration. Launcher stubs may support unit coverage but cannot replace the required real mount test.

## Completion gates

All DB-T01–11 scenarios are required. Relevant existing package regressions, build/typecheck/lint,
Markdown/links, independent code critique and hosted PR checks must pass at the tested revision.
Record exact commands/environment, source and compiled artifact hashes, retained sanitized output,
fixture boundaries, skips and remaining risks under `docs/reviews/`. A required scenario that cannot
run is blocked, not passed. Unexpected feasible test requirements return to the plan for review.

Local feasibility: Docker and Node24/pnpm9 were available during planning; workflow-control's Linux
suite and restricted reviewer ran on the preceding merged change. Recheck before implementation.
Apple Git requires an unaccepted licence; use the existing Git wrapper and Linux test environment,
without changing host licence/settings. Staging-only packaged VM testing remains separate.

## Required compound recovery and concurrency cases

DB-T07 must also detect changed bytes, force invalidation persistence to fail, terminate the process,
restore the original bytes, reopen the real journal and attempt reuse of the old approval/capability.
The precommitted verification-attempt record must force quarantine and zero effects. Recovery cannot
clear it on a matching hash; explicit invalidation and fresh independently reviewed authority are
required. Also fail the initial intent write (no read/effect), crash before successful settlement,
race two attempt owners, and expire/replace the lease before settlement. Only the fenced current
owner may settle; no cached success survives a new boundary. DB-T08 tests additive attempt-ledger
migration, transactional rollback on migration failure and idempotent reopen without historical edits.
