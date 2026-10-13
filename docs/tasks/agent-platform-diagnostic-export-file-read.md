# Task: Wait for complete diagnostic JSON in the packaged VM test fixture

**Beads issue:** `agent-platform-diagnostic-export-file-read`  
**Spec file:** `docs/tasks/agent-platform-diagnostic-export-file-read.md`  
**Parent epic:** none; discovered during [disappearing replies](agent-platform-sizx.md).

## Requirements and evidence

This is an open follow-up, not implementation within the disappearing-reply repair. PR314's initial
`5f09ac45` desktop run38413511300 first failed the existing provider-HTTP transient-retry journey
with `Unexpected end of JSON input`, then passed its normal retry. The read at
`apps/desktop/e2e/packaged-vm-command.e2e.ts` waits for `waiting-diagnostics.json` to exist before
immediately parsing it. Existence does not establish complete asynchronous writing. That mechanism
is plausible, but the original incident's exact cause is not established.

Retained evidence: `/Users/letuscode/.codex/chat-reply-implementation-20261013/pr314-5f09-failed.log`.
Preserve the original failure and successful retry. Do not infer a provider-retry behavior failure,
change production export policy, remove diagnostic assertions or raise timeouts from this sample.

## Dependency and implementation plan

Beads records a `discovered-from` link to `agent-platform-sizx`, not a blocking dependency or new
parent. No upstream/downstream blocker is declared. Review the actual writer and reader, reproduce
created-but-incomplete JSON deterministically, then choose a bounded completion or parse-ready
handshake. Missing and permanently invalid data must still fail; a successful read must retain the
existing scope, waiting-event and privacy assertions. Keep this a fixture-reliability change unless
new evidence justifies a separately reviewed product defect.

## Git workflow

At scheduling time create the normal feature branch from current staging, then a task branch from
that feature or its previous task tip. No branch or implementation is created by recording this
follow-up. Open the segment-tip PR into its feature; merges and staging promotion require applicable
owner authority and actual current-head checks/reviews. Keep main and paused orchestration separate.

## Tests and definition of done

A controlled test must expose the previous incomplete-read behavior, then prove bounded successful
completion and failure on missing/permanently malformed JSON. Run affected build/typecheck/lint/format
and meaningful fixture tests. Exercise the actual Electron export-while-awaiting-approval journey,
including the existing provider HTTP transient-retry case, with unchanged timeout, report schema,
scope, privacy, waiting-state and effect assertions. Retain real report and backend evidence.

Independent source review, actual hosted checks and Sonar/Problems findings must clear. Publish and
read back the complete specification/results/session mirrors; synchronize Beads. Closure requires
verified implementation and authorized feature integration, not this recorded hypothesis or a single
successful retry. Record actual evidence and source/delivery revisions, then read back closed status
and confirm Dolt synchronization. Current status remains open; no tests have been added or run for
this follow-up.
