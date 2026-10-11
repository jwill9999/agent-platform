# Verify checkout-free diagnostic export in the released desktop artifact

Beads: `agent-platform-electron-release.diagnostics-export`.
Parent: `agent-platform-electron-release`. Status: open release follow-up, not current MVP work.

## Requirements and transfer authority

On 11 October 2026 the owner accepted P1 option A in the
[diagnostics plan](../planning/agent-observability-mvp.md): implement the local MVP now and keep
checkout-free export verification with release work. This task owns the strict artifact variants
of T10/T12 and related cancellation/privacy/denial/partial-export coverage in the
[verification plan](../testing/agent-observability-mvp.md). The MVP retains connected standalone
Electron/browser acceptance; this record does not block `agent-platform-harness-v1` closure.

## Dependencies and responsibility

Hard predecessor: `agent-platform-harness-v1` diagnostic functionality. Parent release work owns
application artifact creation, bundled runtime/native SQLite selection and its existing release
gates. Do not create a child→parent completion dependency cycle. This task additionally requires
an actual release-produced artifact as an acceptance input; no artifact currently established.
Release owner chooses the task branch from the then-current release integration/segment tip at
allocation; no release branch is created or activated by this metadata-only transfer.

## Verification and definition of done

Launch the actual app executable from a temporary directory without repository checkout, development
Node, developer PATH or source/resource overrides. Record artifact checksum and bundled runtime,
renderer, backend and native-module paths/ABI. Use synthetic sessions and deterministic model
fixture, real API/SQLite, real main/preload and save to real files. The native dialog may be driven
by the established test hook; report generation, fetch and writes are real.

Verify successful and failed run reports, save cancellation/no file, write denial, API-down safe
partial report with honest labels, invalid IPC/scope denial, safe metadata and no automatic upload.
A reviewer must locate a fixture's slow/failed step using only the report after application restart.
Inspect exported bytes for secret/prompt/tool-output/path canaries. Keep normal signing/sandbox
and release gates; repository-launched Electron or VM-resource tests alone do not satisfy this task.

Close only after actual source/artifact/evidence, independent review, applicable release quality
and hosted checks, complete documentation mirrors, Beads readback and Dolt sync. No tests have run
for this follow-up and no release has been authorized here.
