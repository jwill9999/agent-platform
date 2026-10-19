# Native Workspace listing repair — review and results

Spec: [requirements](../tasks/agent-platform-native-workspace-listing.md).
Tests: [verification map](../testing/native-workspace-listing.md).

## Follow-up qualification checkpoint

PR376 opened at `a843f5df`. Independent source/document review approved; normal serial hooks then
passed3,956 ordinary tests with77 existing optional skips, builds/types and cycles. The earlier Git
disconnect timeout remains retained and unproven; the complete serial API suite passed610 cases.
A separate fresh raw benchmark records900 measured/990 fixture calls, maximum positive p95 overhead
2.825458ms below the unchanged20ms gate, enqueue0.018625ms below2ms, and no healthy capture loss.
The installed Vitest4 uses `VITEST_MAX_WORKERS=1`; legacy fork variables did not bound its workers.
The first push's unchanged paused-suite timing failures are retained; no paused code, assertions or
budgets changed. The actual unchanged normal serial push passed all1,141 workflow cases.

The actual owner app first launched the repair using its existing profile and original key. Native
Workspace lists five empty areas without the warning; actual API listing returns200. Monitoring
native SaveAs export retains six samples (five positive intervals), ready storage, seven-day retention
and zero pending/drop/conflict/resource gaps. Idle diagnostic events are zero and overall coverage is
explicitly incomplete. All30 original application tables preserve their rows, migration journal stays23
rows, and the original key is internally byte-equal to the private stopped-profile backup. The app quit
normally with both service ports released. No model request or owner stress trial occurred.

Hosted Sonar at `a843f5df` identified S3776: nested listing walk complexity17 exceeds15. A reviewed
extraction moves the existing stat/ENOENT-only handling to a helper, preserving validation order,
benign disappearance, other-error503 and safe logging semantics. An initial inferred stat return type
included bigint; the explicit default `Stats` type corrects that compile-only issue. Fresh affected
API/connected validation, normal hooks, hosted qualification and final rebuilt-owner restart/export
must qualify the corrected source; earlier head checks cannot qualify this follow-up. Integration and
merge authority remain separate. The sections below retain earlier local checkpoints as history;
their pending statements describe those checkpoints, not the latest delivery state.

### Connected permission-contract correction

The completed A843 hosted Electron job failed74passed/1failed: its existing "shell-write block with
unavailable file listing" journey expected the old generic500 but received the intentional503.
Both attempts failed identically before CI cancellation, so this is a contract expectation gap,
not a cancellation result or a transient flake. The original job/log/report are retained. The minimal
test-only correction now asserts503 and the exact safe `WORKSPACE_FILES_UNAVAILABLE` code/message;
all existing policy persistence, denied audit, no-approval and unchanged-file checks remain intact.
That complete existing native journey passes retry0 in11.8seconds with deterministic provider and
fixed-command runner fixtures; it does not establish actual VM isolation or live model readiness.

The corrected runtime at `28259b33` passed normal hooks (610 API cases) and a fresh raw900/990
benchmark: maximum positive p95 overhead7.454959ms<20ms, enqueue0.0245ms<2ms, independently approved.
Its actual owner preflight passed: both earlier samples retained exactly across normal restart,
2→5 samples/two process identities/new positive interval, no pending/drop/conflict/resource gaps,
ready seven-day recording, all30 original tables/journal23/key preserved and31.84GiB free.
Native Workspace lists normally; saved model settings remain. Reports have zero idle V1 events and
explicitly incomplete overall coverage. No provider request or owner stress trial occurred. This
follow-up changes only the permission test and documentation; the running owner candidate's compiled
runtime remains identical. Its preflight evidence stays bound to28259, not relabeled as a later launch.
Fresh hosted tests/security/Sonar must qualify the new test revision before acceptance.

### Serial metadata extraction checkpoint

Hosted analysis at `1a09555f` resolved S3776 but reported S9382 on the newly extracted async stat
call inside the loop. The final refactor restores the original inline awaited stat/ENOENT-only catch
and extracts only pure file metadata construction. Traversal remains serial, preserving validation,
entry ordering, limits, benign disappearance and other-error rejection. No parallelization, timeout,
assertion waiver or rule suppression is introduced. The existing exact503 permission correction remains.

All10 affected API controls, API types/lint/format/build and rebuilt connected Workspace, permission
and diagnostic-export journeys qualify this source locally; exact results/evidence accompany Beads
and the PR. The actual28259 owner receipts remain historical source-bound evidence. Because runtime
source changed again, the final rebuilt candidate needs its own compiled binding and owner recording/
export/restart qualification; no old report is relabeled as a new launch. Normal hooks, fresh current-head
hosted gates and independent final evidence review remain mandatory. Merge authority is separate.

## Earlier local checkpoints (historical)

19October baseline: actual owner app at staged `a17bc1db` shows generic error and unavailable file
listing while Models/monitoring work. Prior safe receipt `owner-sdk-a17-workspace-warning-triage.json`
and S12 review retain the observation. Source defaults to `/workspace`; exact original errno was not
captured. Existing API and VM tests injected writable roots, missing default native launch coverage.

Plan critique NW-P01 identified missing read-phase policy/tests. Contract now requires unavailable area readdir and non-ENOENT stat failures to return safe503, while disappearing ENOENT entries and denied symlink entries remain benign omissions. Separate initialization/read/benign-disappearance and logger-throw controls are required. This paragraph records the historical initial-plan checkpoint. Implementation and local regression outcomes are recorded below; clean serial hooks, hosted qualification and owner repaired-app preflight remain pending. No merge or final stress readiness is claimed.

## Local qualification checkpoint

Plan critic approved after NW-P01 explicitly covered read failures and benign ENOENT disappearance.
Source review NW-S01/NW-S02 required truthful teardown/evidence failure handling and API mock cache
ownership under isolate:false; both source corrections and controlled-order evidence are independently approved. Final source/doc review remains pending.

- Before repair, the two new supervisor root regressions failed (24 existing tests passed). After
  repair all26 supervisor tests pass. Initial API fault-injection attempts failed because native ESM
  exports cannot be spied upon; a narrow real-filesystem wrapper boundary fixes that test mechanism.
  All10 workspace API cases then pass, including safe correlated initialization/read failures,
  logger failure, benign disappearance, input validation and outside symlink denial.
- Real connected native and separate-browser listing/download/restart/negative cases both passed
  without retries. After teardown tightening they pass again in17.0seconds; safe persisted receipts
  show all owned processes/ports released and evidence writes/attachments successful.
- Adjacent actual native diagnostic export and three migration startup/restart cases pass retry0;
  the combined six journeys completed in37.0seconds. Providers are not used, no paid call occurs,
  and normal managed backend/BFF/SQLite/filesystem are real. These tests do not establish VM isolation.
- Backend, renderer and desktop builds, affected API/desktop types and scoped lint pass. Both controlled isolate:false orders (actual createApp preload→Workspace and reverse) pass14/14. Full API reports610passed/1existing Git timeout; normal serial hooks, final source review and hosted checks remain pending.
  The initial full API run overlaps connected tests; any measured benchmark in that run is not the
  separately required fresh serial performance qualification. One existing Git disconnect case has
  reported a timeout; its exact failure is retained for diagnosis, not waived or attributed to load.

Actual owner app remains running the previous qualifiedA17 build with its profile/key unchanged.
Repair installation and its real native listing/monitoring/export/restart preflight remain pending.
Evidence root: `/Users/letuscode/.codex/native-workspace-listing-20261019` (outside tracked source).

The unchanged Git disconnect case passes in isolation (2.45seconds;14siblings filtered, not qualified
by that focused command). Its historical full-run timeout remains retained and causally unproven;
only an actual clean serial suite may clear the gate. Early private sequencer CLI attempts loaded no
tests because the option expects a constructor; corrected private configs pass the actual class.
These operator setup failures are not application failures. No deadline/assertion changes were made.

Final Workspace E2E helper captures receipt/attachment failures, preserves the primary journey error,
fails successful journeys with cleanup/evidence failure and retains disposable profiles on such failure.
Both actual final receipts confirm all four launch ports released, successful tracing/cleanup and no
evidence write/attachment failure. File/data/credential profile migration logic is unchanged.
