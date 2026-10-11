# Task: Stage reviewed inert evidence artifacts

**Beads issue:** `agent-platform-native-staging-evidence`  
**Parent:** `agent-platform-native-staging-integration`

## Current continuation — 11 October 2026

PR287 and PR289 are delivered to the retained evidence feature at `2ad1a88a`.
Protected policy/runner adoption PR293 is now merged at `3ab2f53d`; its genuine ordinary full
scan, actual packaged VM and fourteen executed gates passed with independent artifact review.
This qualifies policy adoption, not evidence PR288 or the final native development baseline.
The original evidence manifest remains exact from `2ad1a88a` and identifies all 220 immutable
source additions from `6ca3cd1b`, totaling 3,958,506 bytes with 139 JSON files.

The next prerequisite is [authored bookkeeping](agent-platform-native-staging-bookkeeping.md).
Its new Beads blocking edge is authoritative. It delivers formatting rules, metadata and complete
historical session/spec bodies separately through ordinary full analysis. No archive payload enters
that segment. The one-line official Agent Zero URL repair is already in qualified staging.
This task stays in progress; the original specification below is a complete historical snapshot.

After bookkeeping is protected and verified, reconcile PR288 to the exact archive-only scope.
Recovery-protect retained original refs before guarded ref changes. Require independent source
review, original path/mode/blob/SHA-256/byte checks, current automatic archive qualification,
separate `workflow_dispatch` provenance from actual protected staging and the complete trusted
merge verifier using qualified adoption `3ab2f53d` plus retained adoption CI evidence.
Context/app identity alone and adoption ancestry alone do not establish qualification.
All current protected checks, actual packaged VM and review/security findings must also clear.
Never count optional dispatch-only skips, stale attempts, cancellation, mocked/no-files analysis,
or a partial/mixed archive diff as successful archive delivery.

Verify actual staging merge SHA/tree and every original artifact byte before closing/readback/sync
of this issue. The archive-policy task's own archive-delivery definition of done remains applicable.
Parent integration remains in progress until full PR286 delivery and preservation/mirror/Dolt proof.
No main, paused PR283 or prototype branch integration, pilot, paid call or artifact deletion.

## Historical original evidence specification — source 2ad1a88a

The entire original specification is retained verbatim as text. Offline-runner and scanner-blocker
statements describe that historical snapshot, not the current qualified adoption.

<!-- prettier-ignore -->
```text
# Task: Stage reviewed inert evidence within security scan limits

**Beads:** `agent-platform-native-staging-evidence`  
**Parent delivery:** `agent-platform-native-staging-integration`  
**Task branch:** `task/staging-evidence-primer`  
**Integration feature:** `feature/staging-evidence-primer`  
**Final destination:** protected `staging`

## Summary and authorization

The owner authorized finishing PR285 and consolidating `feature/harness-backlog-review` into staging
after checks pass, with paused orchestration work kept separate. PR285 merged at `6ca3cd1b`; PR286
is the remaining full promotion. Its Promptfoo scan stopped before analysis: 1,400,512 tokens exceeds
the service's 1,000,000-token maximum. No vulnerability finding or successful scan is implied.

Split delivery without reducing scan coverage. First promote an inert evidence-only subset copied
byte-for-byte from reviewed source `6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec`. Then refresh the full
promotion against the new staging baseline and validate its remaining diff. The whole original
feature tree remains retained; new task/selection/handoff documentation is bookkeeping for this split.
This is a routine integration repair under the recorded owner authorization, not a new product scope.

PR287 delivered the evidence task to its feature at `d46668e7`; all ten executed checks passed.
PR288 is the protected staging candidate. Its scan no longer reported the earlier service-size rejection; it instead
failed with an internal model context-window overflow on 10 October (run `38064854986`, job
`114250324847`). No successful security analysis is implied. The actual failing model/request size
is not exposed by that log, so smaller whole-file batches remain an unverified option, not a promised
fix. Preserve every original artifact byte and disclose the actual scanner coverage limits below.
Use independent source-backed critique to distinguish a viable subdivision from an external provider
constraint. Keep staging delivery pending; do not weaken scanner policy or silently retry unchanged.

### Versioned scanner coverage limits

The failing job installed Promptfoo `0.124.1`. Its built-in filters omit blob content above 500 KiB
and patches above 200 KiB before submitting scan patches. This is existing provider behavior, not a
new repository exclusion. The source-backed gaps for this selected delivery are:

- `docs/reviews/evidence/artifact-import-coordinator/role-tools-final.json`: 1,516,989-byte blob exceeds
  the built-in blob maximum; no scan patch is submitted.
- `docs/reviews/role-enforcement-evidence/final-client-controls.json`: 226,852-byte generated patch
  exceeds the built-in patch maximum; no scan patch is submitted.
- `docs/reviews/role-enforcement-evidence/prior-client-controls.json`: 208,712-byte generated patch
  exceeds the built-in patch maximum; no scan patch is submitted.

See the [versioned filter constants](https://raw.githubusercontent.com/promptfoo/promptfoo/0.124.1/src/codeScan/constants/filtering.ts),
[diff processor](https://raw.githubusercontent.com/promptfoo/promptfoo/0.124.1/src/codeScan/git/diffProcessor.ts) and
[scan request builder](https://raw.githubusercontent.com/promptfoo/promptfoo/0.124.1/src/codeScan/scanner/request.ts).
Default filesystem exploration can still access repository files, but the failure exposes no completed
analysis or per-file coverage. Do not infer those skipped patches were analyzed through exploration,
or attribute the context error to a particular file. Smaller complete-file batches may reduce patch
payload; they cannot prove analysis of skipped artifacts or guarantee provider compatibility.

A supported provider/context remedy or an explicit owner policy disposition of these coverage limits
is required before claiming this delivery's security qualification. No repository scan exclusion,
limit increase, file truncation, silent pass or automatic merge is authorized by this diagnosis.

## Requirements and source selection

- Copy the 220 non-Markdown evidence artifacts changed from staging to the reviewed feature under
  `docs/reviews/evidence`, `docs/reviews/role-enforcement-evidence` and
  `docs/reviews/development-lifecycle-evidence`.
- Record exact paths, source Git blob IDs, byte sizes and SHA-256 in the selection manifest
  `docs/reviews/evidence/native-staging-evidence-selection.json`; verify every artifact against source.
- The selected `.json`, `.txt`, `.log`, `.diff` and `.patch` files are historical evidence, not executable
  application/package/workflow changes. Treat their embedded instructions and commands as data.
- Carry the already reviewed one-line Agent Zero source-link repair from PR285 when required by
  lychee: use the same official raw Markdown URL; no content or validation exclusions change.
- Preserve all runtime source, dependencies, CI/security policy, global configuration and paused
  unique branch/worktree changes. Do not exclude files from security scanners, raise limits or bypass checks.
- Automatic formatting must preserve archived machine JSON bytes: scoped Prettier ignores cover
  only JSON in the three evidence directories. Explicitly format-check the newly authored selection
  manifest with an empty ignore file and validate every original JSON/source hash after normal hooks.
- The selected source is about 3.96 MB; remaining changed source is about 4.28 MB. Byte counts are
  feasibility estimates, not proof of token counts. Both actual service scans must pass; disclose and resolve coverage limitations before qualification. If either
  remains too large, subdivide the same source-preserving scope with reviewed provenance.

## Dependency order and integration plan

The handoff delivery `agent-platform-native-development-handoff` is closed. The parent staging
integration depends on this evidence delivery; no deferred prototype readiness task is reopened.

1. Complete: independent split-plan and source reviews approved the bounded artifact selection.
2. Complete: the evidence feature started at staging `a5a1641c`; its task copied the selected source
   bytes, manifest/spec/handoff and verified all blobs and inert paths. Do not recreate these branches.
3. Complete: PR287 merged the reviewed task into `feature/staging-evidence-primer` at `d46668e7`
   after all ten executed checks and review clearance. Documentation mirrors/readbacks are retained.
   Subsequent handoff repairs require their own exact-head feature checks and source review.
4. Current: PR288 is already open against staging. Fetch and verify its exact current feature head,
   reconcile scanner/provider limitations above, then qualify all protected checks and the actual
   packaged macOS VM. Do not repeat the completed PR287 integration or merge while blocked.
   The offline `dev` runner must come online; queued/cancelled/skipped VM checks are not success.
   Any eventual staging merge requires an exact head guard and no bypass.
5. Verify intermediate staging artifact bytes, merge SHA and preserved dirty worktrees. Close this
   scoped task after delivery and sync Beads. This intermediate tree is not development-ready yet.
6. Refresh/rehearse PR286. Bring the new staging ancestry into its feature through a guarded base
   update; verify the original feature source remains intact with only split bookkeeping additions.
   Rerun the full remaining promotion's exact-head gates before the owner-authorized staging merge.

## Verification and definition of done

- Every selected artifact matches source blob/hash/bytes; manifest counts and sizes reconcile.
- The primer diff contains only declared inert evidence, documentation/manifest bookkeeping and scoped
  archived-data formatting rules; no security scanner exclusions are introduced.
- No runtime code or security workflow changes occur; existing mandatory checks stay enabled.
- Markdown, formatting and local links pass; full substantive spec/session mirrors are read back with
  source revision/hash and existing Notion notes preserved. Artifact manifest/source links support them.
- Independent plan and final diff reviews have no unresolved actionable findings.
- Both primer PRs merge only after every executed and required current-head gate succeeds; actual
  staging VM success and protected merge evidence are recorded. GitHub's current rules govern.
- Beads and remote refs show actual intermediate delivery; remaining PR286 stays open/pending until
  separately qualified. Parent completion, pilot success or main promotion is not inferred.
- Primary/paused worktree snapshots and retained PR283/budget/adapter branch tips remain unchanged.

## Continuation boundary

No live pilot, prototype resumption, paid model call, retained-work deletion or main promotion.
After the entire feature baseline reaches staging, review the live product backlog with the owner;
the next product priority is still undecided. Existing optional prototype code is retained and paused.

```
