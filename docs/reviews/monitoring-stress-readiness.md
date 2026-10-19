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
The revised documents and eventual implementation require frozen review. Runtime implementation
has not begun. Fixture isolation implementation is underway after its scope/test-direction approval.

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

## Pending outcomes

OBS-T01–05 remain planned, not run. Fixture isolation still needs normal hooks/push and final hosted
segment integration; both P1s remain in progress and the owner stress trial remains OPEN/blocked.
Current app data/key, running checkout,
held dependency work, paused orchestration, main and disabled Docker gateway remain preserved.
Full normal-hook/hosted qualification and actual delivery are not claimed.
