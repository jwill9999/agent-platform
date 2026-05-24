# Task: Prove macOS VM runner locally and close task 4

**Beads issue:** `agent-platform-macos-production-sandbox.4.4`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.4.4.md`  
**Parent task:** `agent-platform-macos-production-sandbox.4`

## Summary

Run the local proof suite required to close `agent-platform-macos-production-sandbox.4`.

## Requirements

- Add or document the local VM runner proof command set.
- Prove helper `status`, `prepare`, `start`, `exec`, and `stop` work with the real VM.
- Prove harness `CommandRunner` maps VM execution to tool output correctly.
- Prove runner health reports `macos-vm` and not host or Docker.
- Record the evidence needed before `.5` packaging and staging work can start.
- Record the exact image manifest/checksum, macOS version/architecture, helper version, command
  runner mode, and proof commands used.
- Close `.4` only after the acceptance criteria are met.

## Tests And Verification

- Full repository gate:
  `pnpm lint && pnpm typecheck && pnpm format:check && pnpm docs:lint && pnpm test && pnpm build && pnpm --filter @agent-platform/desktop native:vm:build && pnpm --filter @agent-platform/desktop native:vm:test && git diff --check`
- Manual/local VM proof:
  - `macos-vm-runner prepare --runtime-dir <dir>`
  - `macos-vm-runner start --runtime-dir <dir>`
  - `macos-vm-runner status --runtime-dir <dir>`
  - `macos-vm-runner exec --runtime-dir <dir> --workspace <project> --cwd <project> -- pwd`
  - host-path isolation command proving no host home/credential paths are visible.
- Harness proof with `AGENT_PLATFORM_COMMAND_RUNNER=macos-vm` showing a project command result is
  surfaced to the chat/tool layer without host fallback.
- Beads note or task-spec evidence block with command summaries and relevant artifact paths.

## Definition Of Done

- `.4` acceptance criteria are demonstrably satisfied.
- Beads task `.4` is closed with verification evidence.
- `.5` can start packaging/staging work from a real, locally proven VM runner.
