# Isolated supervised review entry point

The trusted coordinator can prepare a standalone review without exposing the host repository or
orchestration grants. The implementation is in `packages/workflow-control/src/supervisedReview.ts`.
It stages approved evidence, hashes its contents and uses the existing plan_critic container launcher.
No workflow database, Git, Beads, host Codex configuration or external connector is mounted.
Review events are untrusted output, never executed or interpreted as authorization.

After building workflow-control, the coordinator may invoke:

```sh
node packages/workflow-control/dist/supervisedReviewCli.js /absolute/path/to/trusted-config.json
```

The coordinator-owned config supplies sourceRoot, evidencePaths, immutable image digest,
modelAuthFile (dedicated model-only credential), egressNetwork (already provisioned model-only egress),
question, timeoutMs and maxOutputBytes. Do not place credential contents in config or committed files.
The CLI validates bounds; snapshot preparation rejects repository-control/configuration paths.
The caller must approve evidence contents and provision/verify network policy and credential scope;
a network's name or a regular auth file does not establish those properties.

Evidence is mounted read-only; Codex receives a fresh read-only configuration without MCP servers.
The host provides only the private snapshot, generated runtime directory, model authentication and
prompt. Container completion/timeout triggers named-container removal; if stopping fails, the
coordinator receives an error and private staging is retained for controlled cleanup. Do not claim
successful review after that failure. Abrupt host termination still requires manual orphan cleanup.

## Current evidence and limits

Focused snapshot and input validation tests pass. Four existing real Docker isolation probes passed,
including write denial for critic source and absence of host control/credential surfaces. These are
offline probes, not a live model review. The dedicated image, authentication and egress policy are not
yet configured here. Full end-to-end review, cleanup under live model failure and formal evidence
acceptance remain unverified. This entry point is implementation in progress, not pilot approval.

The instruction-only exception remains unsuitable where enforced isolation is required. Use this
entry point only after verifying its prerequisites; retain exact material digest, execution identity,
review findings and validation evidence. Contract acceptance still requires schema validation,
independence and the owner's bound approval under the existing planning rules.

## Implementation validation on 24 September

Typecheck, build, lint and circular-dependency checks passed. Native package tests were blocked by
Apple Git's unaccepted Xcode licence (including tests that explicitly invoke /usr/bin/git). A temporary
Linux copy ran 687 passing tests with nine deliberately skipped; its four hook tests initially lacked
the repository hook in the copy and all four passed after that fixture was supplied. Four real Docker
isolation probes also passed separately. This gives 691 passing package tests across those Linux
runs, not a claim that a single full invocation was green. No SonarQube or IDE Problems connector was
available; terminal checks are the available fallback. Hosted checks and live model qualification
remain pending. Existing native pre-push tests share the Git limitation; equivalent Linux verification
was performed before publishing rather than accepting the system licence on the owner's behalf.
