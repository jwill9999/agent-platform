# Multi-agent delivery pilot

## Two-boundary authority

The pilot uses two immutable approvals because the first squash merge creates the exact feature head
that the second contract must authorize. Authority is never inferred across that boundary.

### Task tip to feature

- **Machine contract:**
  `docs/reviews/2026-08-31-multi-agent-delivery-task-contract.json`
- **Execution contract version:** `1`
- **Material digest:**
  `sha256:affc3fadf66acc056898c59e190e22c413699684e154ae00c90e54643911e83d`
- **Policy digest:**
  `sha256:c3c1823525b41bdf812e89186cedb3c4f693d2a64c3426db01144381a366ff46`
- **Head/base:** `task/agent-platform-multi-agent.10` to
  `feature/multi-agent-orchestration`
- **Required checks:** `verify`, `docker`, `e2e`, `desktop-e2e`, `markdownlint`, `lychee`, and
  `deps:check-cycles`
- **Merge authority:** squash only; administrative bypass prohibited
- **Historical approval:** the owner approved the exact task material and PR #252 merged as
  `6a653a939f518db8ff6f96598e3c62a5eccd45aa`, but production recovery subsequently proved that
  the recorded workspace digest included a trailing newline. The contract is preserved as invalid
  historical evidence and cannot authorize further delivery.

### Workspace-binding recovery

- **Machine contract:**
  `docs/reviews/2026-08-31-multi-agent-recovery-contract.json`
- **Execution contract version:** `1`
- **Material digest:**
  `sha256:52f25c4af6d461927e63397e7c7172210f55f5a4506116bbd9ea3768484f74aa`
- **Execution digest:**
  `sha256:e64b9698603e6d5e431383249295f612d465dd75aa21b6c12adccfb4b46c79bb`
- **Canonical workspace digest:**
  `sha256:28d0df6dc7d1762064d7c275c3b1411f1dbc97ec01bd91beeb11c287afbca3b8`
- **Recovery task/base:** `task/agent-platform-multi-agent.repair.3` to
  `feature/multi-agent-orchestration`
- **Authority:** `.beads` and `docs` only; the same seven feature-boundary checks; squash only;
  administrative bypass prohibited
- **Approval:** independently reviewed with zero findings and explicitly owner-approved before
  implementation

The unusable workspace digest
`sha256:47138a2c85a3e5becf742f6a2aac432295dec34a5a198471606d305c802bcedc`
is the SHA-256 of the canonical repository path plus a newline. Production brokers hash the raw
`realpathSync` value and correctly rejected it before any Git or GitHub mutation. The resulting
workflow journal contains zero delivery operations and is quarantined in place. It must not be
rewritten, replayed, copied into the corrected run, or deleted without a separate retention decision.
PR #252 remains immutable predecessor evidence and is not eligible for historical adoption.

### Feature to protected staging

After the exact task commit is known, but before the run enters `delivery` or `finalizing`, the
orchestrator must derive and present a domain-separated `FeatureDeliveryRequiredIntent` material
digest. That immutable intent binds the run, task and task-head SHA, execution contract, feature and
workspace, repository, feature ref, `staging` destination, exact staging checks, protection digest,
squash-only merge method, `adminBypass: false`, decision time, and evidence. An authenticated owner
must approve that exact intent digest before the task-to-feature merge may proceed. Intent creation
after delivery begins is rejected.

After the recovery-task merge, the orchestrator must persist a `FeatureDeliveryContract` containing
that new committed origin operation and attestation, pull-request number, exact post-squash integrated
feature head, `feature/multi-agent-orchestration` source, `staging` base, exact required checks, active
ruleset digest, squash-only merge method, and `adminBypass: false`. PR #252 cannot supply this origin.
The contract and domain-separated material digests cannot be derived until GitHub returns the new
committed merge attestation.

Before any staging PR operation, the instantiated contract must receive a fresh independent critic
review and an immutable active human approval bound to its run, contract digest, material digest,
policy digest, execution-contract digest, approver identity, and evidence. Missing, stale, invalidated,
or caller-forged approval fails closed. The report will record the exact contract and digests after
the feature merge and before the staging PR is created.

The active GitHub ruleset `16801768` protects only `refs/heads/staging`. It requires pull requests,
strict status checks, linear history, resolved review threads, code scanning, and code quality; it
forbids deletion and non-fast-forward updates, has no bypass actors, and reports
`current_user_can_bypass: never`. Its current canonical security snapshot digest is
`sha256:cc29b8546fab17bde5a476a6d2ba17b102ce3a254deee43c916db13bf547d712`.

## Seeded omission and correction

The pre-approval pilot draft intentionally omitted the authorized merge method. The independent plan
critic found that omission and also required an exact hosted-check set and a fresh binding between the
corrected material and owner approval. Contract v1 corrects all three points: both merge boundaries
are squash-only, administrative bypass is prohibited, the applicable checks are enumerated above,
and a fresh owner decision is required against the corrected digest.

## Executed workflow

| Phase                        | Evidence                                                               | Result   |
| ---------------------------- | ---------------------------------------------------------------------- | -------- |
| Planning and refinement      | Versioned task specs `.1`-`.10` and ADR-0004                           | Complete |
| Independent plan critique    | `docs/tasks/agent-platform-multi-agent-review.md`                      | Complete |
| Human approval               | Original exact approval plus separately approved recovery contract     | Complete |
| Isolated implementation      | Linear pushed task branches `.1`-`.9`                                  | Complete |
| Repair loop                  | Independent `.9` critic failures followed by bounded fixes and reruns  | Complete |
| Review, test, QA, evaluation | Final critics `PASS`; package and monorepo gates                       | Complete |
| Hosted CI                    | PR #252 green; recovery and feature-delivery pull requests outstanding | Active   |
| Protected delivery           | `feature/multi-agent-orchestration` then `staging`                     | Pending  |
| Authoritative closeout       | Beads task/epic closure and `bd dolt push`                             | Pending  |

## Repair-loop evidence

The closeout/recovery implementation deliberately remained unapproved until an independent critic
could no longer reproduce a boundary failure. Successive review rounds found and drove repairs for:

- final evidence being persisted after external closeout;
- merge races with cancellation and recovery;
- stale recovery predecessors and unbound recovery evidence;
- hanging cleanup and fence acquisition;
- cross-store and post-construction mutation-broker replacement; and
- missing multi-reference evidence preservation.

The final targeted reviews returned `PASS`. The repaired exact head passed 271 workflow-control tests
with one intentional Docker-isolation skip, plus monorepo build, typecheck, lint, formatting,
documentation, dependency-cycle, and full test gates. The real Docker isolation proof was completed
earlier in the same linear feature chain.

## Security and quality gate

- SonarQube hotspot `AZ4YM2i11EaT2bQAPFS4` is `REVIEWED / FIXED`; no hotspots remain.
- SonarQube Cloud authentication was corrected. PR #252 then passed the hosted SonarCloud quality
  gate with Security and Reliability restored to passing ratings.
- GitGuardian also passed the rebuilt exact task tip after credential-shaped test fixtures were
  reconstructed without embedding scanner signatures.
- No Blocker/Critical reviewer finding or local Problems/typecheck/lint error remains.

## Operational measurements

| Measure                                            | Observed value                          |
| -------------------------------------------------- | --------------------------------------- |
| Mutating branch concurrency                        | 1                                       |
| Independent review cycles for `.9`                 | 7                                       |
| Independent review cycles for `.10` repair         | 7                                       |
| Workflow-control tests at pilot head               | 271 passed, 1 skipped                   |
| Duplicate external closeout effects in fault tests | 0                                       |
| Unresolved critic findings                         | 0                                       |
| Merge conflicts in `.1`-`.9` chain                 | 0                                       |
| Model/API cost                                     | Not exposed by the current local runner |
| End-to-end wall time                               | To be recorded after protected delivery |

## Residual risks and policy tuning

- Keep production mutation adapters registered, sealed, exact-store-bound, and unavailable to
  specialist roles.
- Retain per-row timeouts for cleanup, wait recovery, and fence acquisition so one failed operation
  cannot suppress later recovery work.
- Preserve exact-head and accepted-evidence checks at evaluation and finalization; never accept
  caller-supplied completion booleans.
- Add first-class run cost/latency counters before expanding beyond one serialized write worker.
- Treat SonarQube Cloud identity-policy failures as an infrastructure finding and retain the strict
  local fallback gate until organization access is corrected.

## Final acceptance trace

| Acceptance criterion                                          | Implementation/evidence                            | Status  |
| ------------------------------------------------------------- | -------------------------------------------------- | ------- |
| Seeded plan omission is corrected before approval             | This report plus independent critic result         | Passed  |
| A failed verification enters a bounded successful repair loop | `.9` critic/fix/retest history and recovery tests  | Passed  |
| Local review, QA, and security gates pass at the exact head   | Final critic `PASS`; full gate results             | Passed  |
| Hosted checks pass on the segment tip                         | PR #252 GitHub, SonarCloud, and GitGuardian checks | Passed  |
| Delivery stops at protected `staging`                         | Integration and staging pull requests              | Pending |
| Beads/Dolt and workflow closeout are authoritative            | Beads issue state, Dolt push, final report         | Pending |
