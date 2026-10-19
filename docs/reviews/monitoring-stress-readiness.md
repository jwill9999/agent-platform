# Monitoring preparation results and critique

19 October baseline50f6/treefc553. This record distinguishes actual evidence from planned repairs.

## Already observed

PRE-T02 PASS for one explicitly owner-authorized paid native chat request: configured OpenAI
`gpt-6.1-sol`, visible `Connection OK.`. One model attempt1 succeeded in4671.698ms;
provider-reported5579input/7output tokens. No tool calls/retries/failures. This is not all-provider,
tool/Stop/load or cost qualification. No further agent-paid requests were made.

Actual native exports validate the compiled schemas:16 session events match the17 application-window
events except the sessionless ingress start. Five resource samples capture active run/admission/lock1
then0; ready/enabled7days, no current-window gaps/pending/drop/conflict, clean prior shutdown.
The601.883ms event-loop interval maximum is an observation, not an established defect or cause.

Frozen evidence: `~/.codex/native-workspace-listing-20261019/owner-openai-live-smoke-qualification.json`;
independent QA receipt `owner-openai-live-smoke-independent-review.json` SHA
`4fde245f47a445a80e81e76b2933c5714ea59d07087158b5c9bf478f6c584c21`.
Prior source-bound native recording/export/clean restart remains applicable; it was not repeated
solely for polling. No original monitoring failure is resolved by this clean window.

## Planning review

Initial source-aware critic identified OBS-P01: successful window reads return503 after storage
failure; only adding successful-report fields misses the failure. OBS-P02: status memory and stdout
alone do not prove retained evidence across restart because current supervisor truncates logs.
The critic approved the narrower dedicated snapshot contract: at most2048 encoded bytes per store,
two retained files total, fixed metadata only, best-effort asynchronous exclusive atomic publication,
cached historical status and no recovery/deadline/cross-store changes. Normal restart retention is
claimed only for a completed publication; immediate exit/crash/filesystem failure can prevent it.
The first contract was approved before runtime work. The implementation and its final test-only
review corrections now have frozen source receipts; see local outcomes below.

## Fixture isolation local results

LOG-T01/02 PASS: all18 actual Electron invocation sites resolve owned log roots. Seven explicit
overrides fix the missing ownership; removing only those lines reconstructs the four baseline
fixture files exactly, including every prior assertion/port/deadline. AST rejection controls cover
missing/inherited/overwritten roots and imported helpers. Real fake-backend success/failure/restart
and cancellation retain unrelated sentinel bytes and owned failure output before cleanup.

Independent source/evidence review approved all seven hashes and resolved LOG-S01: test cancellation
is now passed into the real child launcher and pending startup is joined through exit before
cleanup. No five-second test budget was increased. The final focused run passed50 cases across
five files in7.94s, with no failures/pending; earlier46-case and virtual-import failures are retained.
Direct strict TypeScript/ESLint/format/diff passed. Full initial workspace build passed from the
unchanged staged runtime source in the isolated checkout.

LOG-T03/04 PASS: four connected native cases passed in49.203s, each retry0, with no skips/flakes or
failures: all three Git journeys plus real diagnostic browser/BFF/API/SQLite/native-save export.
The adjacent export uses an explicit disposable Electron profile; older resource-export/profile
fixtures were not run locally against the retained owner profile. Full hosted coverage remains due.
Evidence: `monitoring-readiness/log-isolation/{owned-source-final,independent-source-review,native-qualified}.json`
under the same Codex evidence root. No product runtime, owner app/profile/key or live model call
changed during these tests.

Normal commit hook passed at local `7cfb0ea8`, with all seven source hashes unchanged afterward.
The offline install initially omitted generated Husky launchers; its unpublished draft was not
hook-qualified and was recreated after normal hook setup. Both receipts remain retained.
Per the owner's batching instruction, there is no intermediate push/PR: the accepted local tip
feeds `task/monitoring-failure-provenance`, then one combined push/review/qualification cycle directly into protected staging.

## Failure provenance local results

OBS-T01–05 have focused local coverage:70 distinct passing cases, including17 contracts,25 DB,
24 final artifact/process/status cases and four existing monitoring cases. The56 new cases exercise
strict privacy/schema bounds, first-failure latching, unchanged terminal/startup behavior, invalid
identity, independent private publication, stale claims, FIFO rejection, interruption, cached status,
unavailable windows and actual API failure-to-healthy-restart retention. Completed publication is
retained; an interrupted or failed publication remains explicitly best effort.

Scoped contracts/DB/API builds, strict types, lint and format pass. First source critique resolved
OBS-S01 using nonblocking regular-file reads; OBS-S02/03 led to test-only bounded cancellation/close
cleanup and literal child source with module URLs passed as argv data. The final affected24 API
cases pass in2.93s; production and previously compiled bytes remain unchanged. Final independent critique
approves the20 frozen source files, four compiled bindings and20 logs with no remaining findings;
OBS-S01/02/03 are resolved. Frozen source:
`monitoring-readiness/provenance/provenance-worker-final-source.json` SHA
`855e4ac6b2f613b618efb78ce40edf4d7fcc5e78559a88d39142f0011de680d5`.

## Affected native provenance check

The existing disposable diagnostic-export journey passed once in10.252s with one worker, retry0
and no flaky/skipped/error cases. Current compiled schemas validate13-event native/browser/restarted
reports, healthy capture, no new loss and exact native history retention. The backend-down report
correctly remains0events/unverified/nondurable; browser export returns200 in28.715ms. All three
canaries, host paths and credential patterns are absent. Both close promises complete before owned
fixture cleanup;19 observed child processes exit and the owner app PIDs remain unchanged.

Independent QA binds the20 frozen sources and16 runtime outputs, copies five safe attachments and
records its limits in `monitoring-readiness/provenance/native-export-first-independent-review.json`
SHA `2a94387ae1bceb27bd7d4730be7f2654516424ac64be5553065b2c31351cb34e`.
This healthy native journey does not claim a native terminal-fault reproduction; safe terminal-fault
publication/status/restart behavior is covered by the separately reviewed real API/DB controls.
Unchanged Git journeys were reused rather than repeated; the full hosted suite remains required.

## Delivery and pending outcomes

PR379 is delivered directly to protected staging at `dee20500`; its reviewed tree matches the actual
merge. The running owner app remains on source50f6. This monitoring batch will align with that actual
staging baseline before its one cumulative PR. The owner's19October direction replaces mandatory
task-to-feature and feature-to-staging merges for bounded MVP work: group related fixes/tests/docs,
review and test locally, then use one protected-staging PR. Keep subsequent repairs in that PR;
separate PRs are for urgent blockers. No current workflow/security gate is weakened.

Both source critiques and the combined20-document policy review pass; normal commit hooks pass.
Local alignment incorporates actual staging `dee20500` and preserves every reviewed source byte.
The cumulative normal push at `e9028562` passes all four affected packages' builds/types and
183 contracts,244 desktop,301 DB and634 ordinary API cases. The unchanged full benchmark passes all
nine vectors:900 measured requests/990 fixture calls, maximum positive request-p95 overhead3.30925ms
below20ms, maximum enqueue-p950.021334ms below2ms. Raw measurements and the normal hook log remain
under `monitoring-readiness/combined-push-benchmark.json` and `combined-normal-push.log`.
This subsequent prose-only outcome update preserves every tested source byte. All current protected
hosted checks/reviews still need qualification; no protected merge or task closure is claimed. Both P1s stay in progress;
the owner stress trial remains OPEN/blocked. The owner app/data/key, held dependency work, paused
orchestration, main and disabled Docker gateway remain preserved. No final delivery is claimed.
