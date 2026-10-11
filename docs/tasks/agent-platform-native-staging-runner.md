# Task: Qualify APFS staging runner

**Beads issue:** `agent-platform-native-staging-runner`

**Parent:** `agent-platform-native-staging-integration`

**Authority:** owner approved the independently reviewed APFS setup on 11 October 2026.

## Requirements and implementation boundary

Preserve the old `/Volumes/external/actions-runner` installation, caches, diagnostics and every
Git checkout. Use a fresh official checksum-verified macOS ARM64 runner on native APFS, fresh
short-lived repository registration and the same interactive startup style. No credential copy,
service installation, volume reformat/repair or unrelated process termination is authorized.
Verify idle state and exact old listener identity immediately before graceful stop. If a stuck
worker needs cancellation, first map exact job to run and verify no other active job is affected.

Required labels: self-hosted, macOS, ARM64 and agent-platform-vm. Installation, work, action cache
and temporary directories must actually resolve to APFS. Keep the repository's Node24 and
Virtualization.framework helper/asset/signing workflow, not an invented Tart prerequisite.

## Diagnostic evidence and causality

Old Worker logs report checkout HTTP200 and tar exit0, followed by no completed-action watermark.
The old volume is ExFAT; a sampled worker thread remained in native unlink, with source and
destination AppleDouble metadata files open. This establishes a post-download local action
preparation stall. ExFAT is a plausible contributor; managed frames were unsymbolized, so the
exact copy/delete/cleanup operation and sole root cause were not proven.

The existing CI concurrency setting can cancel older runs for the same PR. Compare actual
replacement/cancellation timestamps with the earlier stalled preparation interval; do not infer
that every cancellation caused a preceding filesystem stall. New exact-head qualification after
the host change is a meaningful retry. Older cancelled attempts remain cancelled.

## Actual setup — 11 October

Verified dev runner 23 online/idle and no old Worker before mutation. Old Listener 89004 stopped
gracefully. Fresh dedicated installation is
`/Users/letuscode/.local/share/agent-platform-actions-runner`, private directory on native APFS.
Official runner 2.337.0 ARM64 package SHA256:
`5a2cd92908a93d7276a194e1de6008099f3e7946f3f8e14aa7a1a7b4a31fdec2`.
Fresh supported registration replaced dev 23; credentials were never copied or published.
Interactive listener started from the APFS installation, all four expected labels verified.
No service installed. Old installation retained. APFS free space at setup: 57,434,963,968 bytes.

For an offline runner after a host restart, open a terminal and run:

```bash
cd /Users/letuscode/.local/share/agent-platform-actions-runner
./run.sh
```

Keep that terminal open. Do not start a second listener while the current one is already online.
The old external installation's deleted-registration messages begin23:22UTC after the approved
23:19 replacement; restarting its retired credentials fails. The new installation has no such
session errors and completed actual work. No service/autostart installation was authorized here.

PR286 current head `542e082e3569934b4dcd86ab58b0ea3ce9edbbb3`: rerun only the cancelled packaged
VM job from CI run 38081623129. Attempt2 job 114337873032 completed setup in four seconds
(23:19:32–36UTC10October), checkout in three seconds, Node/pnpm and dependency installation.
Swift compiled successfully, then signing failed because the hardcoded triple-directory
did not match actual `.build/out/Products/Debug`. Independent plan review approved a shared
canonical Swift `--show-bin-path` resolver, explicit helper overrides with executable validation,
and CI packaging the exact signed helper. Entitlement/signature/actual VM checks remain required.
Actual packaged VM steps have not run on this failed attempt. Earlier PR288 and PR286 workers waited approximately
60 minutes before receiving cancellation; its source (timeout/concurrency/manual) is unconfirmed.
Thus cancellation terminated a preceding stall, rather than explaining it. The APFS run clears
that operational stall under the unchanged concurrency setting, without proving sole causality.

The owner raised supersession cancellation as a separate concern. The scoped CI repair uses
`cancel-in-progress: ${{ github.base_ref == 'main' }}` because this workflow runs only on PR
events and `github.ref` is a pull-request ref. Staging/feature active validations are preserved;
main-targeted PRs retain cancellation. Pending runs may still be superseded, and stale-head
results never qualify a newer head. This authored workflow change requires ordinary full scan.
Root evidence outside Git:
`/Users/letuscode/.codex/staging-integration-20261010/apfs-runner-setup.json` and package receipt.
Private redacted configuration log contains no published registration token.

## Verification and definition of done

Read-only independent source/diagnostic review; verify old installation retained, process identity,
APFS work/action/temp directories, online labels and actual action preparation completion.
Require real current-head packaged VM success and uploaded evidence through the existing workflow.
No skip, cancellation or runner-online status substitutes for that journey. Inspect any next
preflight/assets/signing/VM failure and repair within scope using concrete source evidence.

Local repair qualification now passes 12 resolver tests, 8 packaging/script tests, actual Swift
build/sign/package/pinned hashes/signature verification and 2 existing packaged Electron tests.
The healthy journey uses a real VM/helper/assets; model output is a deterministic external double,
and the unhealthy denial journey is the existing failure fixture. Hosted actual final-head VM
qualification remains mandatory. See [actual results](../reviews/native-staging-remedies.md).

### Gherkin E2E strategy

Reuse `apps/desktop/e2e/packaged-vm-command.e2e.ts` with isolated projects/database/ports,
the actual signed packaged helper and checksum-pinned Linux guest. Model output is a deterministic
external double. Healthy command execution uses the real VM; unhealthy denial uses a failure
fixture. Retain package/signing/asset hashes, real runner readiness and visible command outcome.

```gherkin
Feature: Packaged Project command execution
  Background:
    Given Electron uses isolated Project data and the signed packaged VM resources
    And model tool requests are a deterministic external test double
  Scenario: Approved command runs in the real VM
    When the user approves the Project terminal command
    Then tool activity shows completion and the VM working directory
    And the real runner is ready with the pinned package and asset hashes
    And host Project paths and host-only secret canaries are not displayed
  Scenario: Unhealthy runtime fails closed
    Given the packaged VM runtime failure fixture
    When the user approves the Project terminal command
    Then command activity shows unavailable and failed
    And no host fallback output or host-only secret canary appears
```

Parent integration depends on this issue in canonical Beads. Closure requires actual required VM
qualification, reviewed complete evidence, full documentation mirror/readback and Dolt sync.
Policy adoption and final staging promotion have their own new-head VM gates. Primary and paused
worktrees remain separate and preserved. Next product priority remains owner backlog review.
