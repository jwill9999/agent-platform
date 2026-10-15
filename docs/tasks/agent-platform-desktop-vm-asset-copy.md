# Task: Copy private packaged VM assets efficiently

**Beads issue:** `agent-platform-desktop-vm-asset-copy`  
**Parent:** `agent-platform-local-mvp-promotion`  
**Status:** in progress; local source and VM evidence approved, publication and hosted qualification pending.

## Requirements and evidence

PR324 at `c6a00dad3f80e772f4c1206c6e3a13adf16b6de3` has successful GitHub checks
but its actual packaged VM suite contains three first-attempt failures. Retried success does not
qualify staging. The retained startup receipts measure synchronous packaged asset copies of
15.094 seconds (approve), 20.720 seconds (reject), and 19.178 seconds (direct-write Block).
The two latter copies consume the 20-second fixture startup allowance; approve completes its
semantic assertions but exceeds its 60-second total during verified VM cleanup. The underlying
filesystem cause is not established. All failed attempts retain shutdown/release and diagnostic
proof in the external promotion evidence directory; no source artifacts are deleted.

R1: Prefer copy-on-write for the existing private per-runtime asset copy, retaining ordinary copy
fallback where unsupported. R2: Preserve exact initial bytes and independent mutations across
packaged source and runtimes, stale-file replacement, repair behavior and copy-error propagation.
R3: Preserve path validation, signatures, manifests, startup/report/test/teardown deadlines,
benchmark limits, retries and release assertions. No shared writable cache or hardlinks.

## Dependency order

Upstream: [diagnostic fixture readiness](agent-platform-diagnostics-fixture-readiness.md), closed
following qualified PR326 feature delivery. Parent promotion depends on this repair. These edges
are recorded in Beads; no new relationship to the paused orchestration or active Git MVP is implied.

## Implementation and Git delivery

1. Branch `task/desktop-vm-asset-copy` from the current `feature/github-read-responsiveness` c6a tip.
2. Use fixed `/bin/cp -cR` on Darwin and retain existing Node copy behavior elsewhere, with focused
   isolation/replacement/error tests and destination-directory symlink rejection.
3. Verify source and tests independently, then run the three failed real VM cases before full 19.
4. Publish full task/session mirrors, open the task-to-existing-feature PR, and inspect exact-head
   checks and comments. Merge only after all declared gates clear under the existing owner grant.
5. Require entirely fresh PR324 staging scan, VM, browser/Electron, diagnostic benchmark and review
   evidence. Feature delivery does not qualify staging or authorize paused-work integration.

The independent promotion critic approved this bounded plan on 15 October. Cleanup-budget changes
are deferred unless the actual corrected journeys still demonstrate a separate defect.
Node 24 documents [copy-on-write with normal-copy fallback](https://nodejs.org/docs/latest-v24.x/api/fs.html#fscopyfilesyncsrc-dest-mode)
and its [cpSync mode option](https://nodejs.org/docs/latest-v24.x/api/fs.html#fscpsyncsrc-dest-options).

## Tests and completion

- Unit: source/runtime1/runtime2 byte equality and mutation independence; stale replacement and repair;
  copy failure propagates. Existing missing-assets/helper, path/symlink and lifecycle controls remain.
- Quality: desktop build/typecheck, scoped lint/format, direct Markdown, normal hooks and fresh hosted
  Sonar/CodeQL. IDE Problems/Sonar MCP are unavailable; terminal and hosted gates apply.
- Connected: packaged Electron with actual signed VM/helper and real API/persistence/UI; deterministic
  model provider only. Run approve/reject provider-HTTP and direct-write Block without retries, then
  full 19. Capture startup phase timings, file/audit outcomes, complete diagnostics, shutdown and image
  release receipts. Compare actual first attempts; do not infer performance from unit tests.
- Diagnostic review: approve permits only expected file change; rejection and Block leave it unchanged;
  reports are correlated, durable, untruncated and disclose loss. Retain any failure and scope findings.
- Feature DoD: all preceding local gates, independent source/evidence review, full mirrors/readback,
  exact-head hosted checks/comments and guarded feature merge. Close/readback/sync this task then;
  parent stays in progress until actual protected staging delivery and preservation/cleanup succeed.

## Gherkin E2E strategy

```gherkin
Feature: Private packaged VM startup
  Scenario: Approve a provider-requested command
    Given the packaged app uses an isolated real VM and deterministic provider
    When the user approves the requested Project change
    Then the expected file change and durable audit exist within the existing test deadline
    And the VM exits and releases its images

  Scenario: Reject a command or block a direct write
    Given the packaged app starts within the existing startup allowance
    When the user rejects the command or the direct write is blocked
    Then the Project file remains unchanged and denial is recorded
    And diagnostics and verified shutdown evidence are retained
```

## Results and sign-off

Initial Node-only preference passed 23 unit tests but an actual force-clone probe returned `ENOSYS`
on this macOS host: the non-forced flag silently copied normally. The corrected Darwin route invokes
fixed `/bin/cp` with literal flags and resolved absolute source/destination arguments, without a shell.
The installed macOS `cp(1)` documents `-c` clonefile and ordinary-copy fallback across unsupported
filesystems. A disposable 4 GB native copy took 0.00415 seconds; this probe does not qualify app startup.
The destination images directory is explicitly rejected if symlinked before either copy route.

The first local three-case run of the Node-only preference passed approve 17.7 s and reject 32.9 s.
Block failed while the host entered Maintenance Sleep 00:13:22 and woke 00:18:29, matching the trace's
roughly 299-second scheduling gap. Failure evidence and its incomplete disposable fixture are retained;
this is not a valid pass or evidence of a product deadline defect. Subsequent verification uses a
process-lifetime `caffeinate` assertion only, without changing global power settings or test deadlines.
The corrected native route passes 24 supervisor unit tests, desktop build/typecheck and scoped
lint/format/Markdown checks. The three originally flaky real-VM cases pass without retries:
approve 17.713 s, reject 27.794 s and direct-write Block 29.578 s, with asset phases 6–24 ms.
The complete local suite then passes all 19 cases in 386.141 s, with zero retries, failures, flakes
or skips. Its asset phases are 3–75 ms. These are measured runs, not a performance guarantee.

Independent evidence review verifies all 19 shutdown confirmations and Electron exit codes, all
18 applicable VM releases, and all ten waiting/finished diagnostic reports as durable, verified,
untruncated and free of pending, dropped, conflicting or pruned events. Approvals change only the
expected file; reject/Block journeys preserve the file and record denial. Deterministic provider
fixtures are disclosed. The final source restores the unchanged non-Darwin copy options; the Darwin
branch exercised by the complete suite is unchanged. No cleanup-budget change is needed.

Evidence is retained under `/Users/letuscode/.codex/local-mvp-promotion-20261014`: native focused/full
reports and results, `asset-copy-critic-full-results.json`, `asset-copy-critic-full-diagnostics.json`,
source/hash review and signature/build logs. The full report SHA-256 is
`8401d89b0a8802bfcf407ea595ab4c6df631e24c400be5cdb0a8e846484f007a`.
Full branch-specific publication/readback and fresh feature checks remain pending. Guarded feature
delivery must precede entirely new protected staging qualification; PR324 remains unmerged.
