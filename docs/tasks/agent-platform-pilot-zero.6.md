# Observe execution-bound specialist output candidates

Beads: `agent-platform-pilot-zero.6`

## Objective and scope

Add a read-only output-manifest validator as a prerequisite to PZ-03 trusted implementation import.
Capture the complete staged source tree before execution, then observe the same retained tree.
Derive changes from bytes and modes, never model-declared changed files. Return candidate data only;
do not import, commit, create receipts, start agents or remove the implementation-phase guard.

## Design

Use an opaque process-local baseline handle backed by private state. Copy, validate and freeze the
trusted expected execution binding and grants when capturing; caller mutation cannot change authority.
Bind workspace/run/task/execution/role, contract version, policy/input material digest and baseline
head. Validate every binding against independently supplied expectations on observation/reverification.
These expectations are caller authority, not authenticated runtime evidence by themselves.

Capture the whole staged tree, including directories and immutable context, under fixed entry,
total-byte, depth and path limits. Retain canonical root device/inode and reject replacement. Reject
symlinks, special files, hardlinked regular files, control/credential paths, invalid components and
case/Unicode-normalization aliases. Grants explicitly distinguish exact files from literal subtrees;
match path-component boundaries, and never allow a grant to override prohibited paths.

Record regular permission bits and reject special permission bits for files and directories. Include
byte lengths and SHA-256 of binary file contents. Reject file/directory type replacements as an
unsupported operation. Changes outside grants, including context deletions/modes or new entries,
fail closed. Produce deterministically sorted additions/modifications/deletions with before/after
entries, complete baseline/output-tree digests and immutable candidate identity.

Read through checked descriptors; bound reads and compare metadata before/after. Repeat complete
tree observation to detect changes during scanning. Reverification checks the entire candidate tree,
not only listed changes; later observations cannot silently alter older candidates. Do not mutate,
redact, delete or clean up caller files. This assumes a trusted quiescent host: it does not claim
atomic malicious-host protection, content secret detection or persistent import recovery.

## Implementation ownership and dependencies

Chain `task/pilot-zero-output-manifest` from the reviewed .5 segment tip. Module and focused tests
are separate from container lifecycle. The .5 dependency gates integrated use, not offline validator
development while its hosted checks run. Parent orchestrator owns Beads, specs and Git publication;
worker owns `specialistOutputManifest.ts`, its tests and the public export. Independent source review
must remain separate from authoring. No live journal is active; supervised work is not conformance.

## Tests and definition of done

Cover binary add/modify/delete, unchanged output, permitted modes, directory changes, immutable
context, component-prefix escapes, binding substitutions, mutable authority inputs, forged handles
and manifests, stale baselines, root replacement, post-observation full-tree tampering, forbidden
paths, aliases, symlinks, hardlinks, special files and traversal bounds. Exercise mutation during
observation and assert no input/output changes by the validator. Keep phase import guard tests green.
Run focused/full package, build/typecheck/lint/format, independent review and hosted gates before
delivery closeout. No credentials are needed for these offline tests.

## Review disposition and next boundary

Independent design review requested frozen authority, explicit grants/modes/handle lifecycle,
complete tree digests and root identity. Those corrections are included above. The next integration
must capture this baseline before the actual launcher runs, prove process/credential settlement,
and import through the journaled broker with exact-head recovery. This module alone does none of
those operations and cannot satisfy unattended-pilot acceptance.

## Local verification record

Fifty-nine validator tests and 23 unchanged phase-runtime tests pass. Build, typecheck, touched
lint and formatting pass. Independent source review returned no actionable findings within the
candidate-only, quiescent-host scope. Parent independently reproduced all 82 focused tests. The
combined full-package pre-push gate passed 652 tests with seven separately exercised opt-in Docker
skips. Hosted gates and segment integration remain required before delivery closeout.
