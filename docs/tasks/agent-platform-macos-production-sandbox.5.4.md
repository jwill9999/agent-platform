# Task: Gate staging on packaged macOS VM E2E

**Beads issue:** `agent-platform-macos-production-sandbox.5.4`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.5.4.md`  
**Parent task:** `agent-platform-macos-production-sandbox.5`

## Summary

Make staging require the packaged macOS VM E2E evidence before changes can be promoted toward
`main`.

## Requirements

- Add a staging GitHub Actions job for packaged macOS VM E2E.
- Ensure the job uses production-like runner defaults and environment variable names.
- Fail the staging gate when command execution runs on host or Docker.
- Publish artifacts/logs needed to inspect runner health and E2E results.
- Record the passing staging evidence in the task before `.5` is closed.

## Tests And Verification

- GitHub Actions staging packaged macOS E2E job.
- Full repository quality gate.
- Manual review of workflow logs proving `macos-vm` was selected.
- `pnpm docs:lint`

## Definition Of Done

- Staging cannot pass with only host or Docker command execution.
- The packaged E2E job proves successful VM execution and fail-closed unavailable behavior.
- `.5` is closed only after staging evidence is linked in Beads or the task spec.
