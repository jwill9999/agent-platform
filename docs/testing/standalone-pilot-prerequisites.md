# Standalone prerequisite verification plan

Owner: `agent-platform-pilot-zero.17`. Planned coverage only; no result in this file implies a pass.
Source and scope: [repair plan](../planning/standalone-pilot/plan.md).

| ID | Requirement / layer | Setup and assertion |
| --- | --- | --- |
| SP-01 | R1 unit/integration | Disposable journal: no match, same task/material, conflicting material, terminal run and multiple conflicts; inspect exact returned identities and preserve terminal history |
| SP-02 | R1 negative | Missing/unreadable/corrupt journal and failed query return unknown/error; no file/database creation and no false empty-success result |
| SP-03 | R1 concurrency | Two independent start requests race after empty inventory; journal admits one owner, loser gets conflict; restart/retry cannot duplicate ownership |
| SP-04 | R2 integration | Isolated worker returns a valid bounded artifact; inspect actual task-workspace bytes, approved base/head, journaled import identity and subsequent callback |
| SP-05 | R2 negative | Alter digest/material/base, inject traversal/symlink/special file/out-of-scope path and exceed 16 MiB total, 1 MiB per file or 256 files; assert no unauthorized filesystem effect or progression |
| SP-06 | R2 recovery | Crash before apply, during partial apply and after apply before receipt; restart reconciles the original intent or explicitly blocks; replay successful imports, race workspace drift and stale fences; no duplicate mutation, stale-owner mutation, altered accepted result or false acceptance |
| SP-07 | R2 roles | Implementer changes permitted; reviewer/test-runner modifications rejected; successful terminal text without verified import does not advance |
| SP-08 | R3 integration | Read older contracts successfully; absent new phase roles, mismatched roles and prohibited operations fail before launch; explicitly authorized feature evaluation and repair planning succeed. Exercise every enabled specialist/coordinator phase with typed receipt; forged identity/head/material/fence/operation ID rejected; duplicate receipt is idempotent |
| SP-09 | R3 recovery | Crash after committed coordinator effect before completion, stale lease takeover, failed verification and repair-limit exhaustion; recover once or block dependents, never skip acceptance |
| SP-10 | R4 host | Real Docker isolation and actual production Git paths on chosen macOS host; invalid/missing/replaced executable fails before effects; logs contain no credentials |
| SP-11 | R1–R4 connected | Disposable repository and journal, production startup/config and StandalonePhaseRuntime.create, real supervisor/launcher/broker/import/coordinators, controlled model transport: implement → verify → review → acceptance/integration/evaluation → pipeline/delivery/finalize; no human restart; compare filesystem, journal, callback and phase events |
| SP-13 | R3 connected repair | Inject verifier/reviewer repair through repair → implementing and feature-evaluation repair through repair_planning → implementing; both succeed through verification/review/acceptance with correct roles, attempt count and new head bindings |
| SP-12 | R1–R4 failure | Repeat connected journey with cancellation, altered approved docs, lost callback notification and supervisor restart; assert no unauthorized effects, duplicate transitions or silent stall |

Test runners retain command, source SHA, config/image hashes, scenario outcome, timestamps, logs and
sanitized artifact digests. Clean only test-owned files/containers/journals. Record each injected crash
boundary and observed persistent outcome. Use independent processes for race/restart cases, not only
in-memory stubs. Measure handoff latency but do not impose an unmeasured arbitrary performance target.

SP-11 uses controlled model responses and fixture external delivery ports; disclose those boundaries
in the result report. It does not prove paid model quality, live GitHub delivery or desktop resumption.
Those belong to later exact pilot authority and its verification plan. No existing live workflow or
production data is used. Missing Docker/host feasibility makes affected checks blocked, not skipped-pass.

No product UI changes are proposed, so Playwright application journeys are not acceptance evidence
for this infrastructure-only repair. The later permission pilot must add its connected frontend journey
and independently verify real backend policy effects. All applicable unit/integration/connected
scenarios above must pass before .17 qualification; retain independent review and feature merge evidence.

For SP-11 through SP-13, prohibit createForTest, injected source-verification success, fake phase dispatch,
fake imports and fabricated coordinator receipts. Fixtures are restricted to the explicitly named model
transport and external delivery services. Fixture contracts declare callback/coordinator operations and
phase roles; they are not the supervised repair proposal's authority. Retain startup/config observations.
SP-10 remains unproven until the coordinator records the actual broker protocol, image and host commands;
the qualified evidence-only reviewer is not a substitute. This is an execution-feasibility gate.
