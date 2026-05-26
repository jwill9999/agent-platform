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
- Ensure the job obtains the VM image/assets through the same pinned `.4.2.1` source or release
  artifact path used by packaging.
- Fail the staging gate when command execution runs on host or Docker.
- Publish artifacts/logs needed to inspect runner health and E2E results.
- Record the passing staging evidence in the task before `.5` is closed.

## Implementation Plan

1. Add a staging-only GitHub Actions job that runs on an Apple Silicon macOS runner.
2. Require the staging job to download the pinned prepared VM asset archive using:
   - `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_URL`
   - `AGENT_PLATFORM_MACOS_VM_ASSET_ARCHIVE_SHA256`
3. Verify the archive checksum before packaging.
4. Build/sign the native `macos-vm-runner`, package it with the downloaded assets, and run the
   packaged Electron E2E against `AGENT_PLATFORM_E2E_PACKAGED_VM_RESOURCES_DIR`.
5. Upload package manifest, asset manifest, E2E evidence, Playwright traces, and failure logs.

## Current Implementation Notes

- The staging job uses a self-hosted Apple Silicon macOS runner with labels `self-hosted`,
  `macOS`, `ARM64`, and `agent-platform-vm`.
- GitHub-hosted `macos-15-arm64` is not acceptable for this gate. On 2026-05-26 it downloaded
  and verified the pinned VM asset archive, then failed real VM startup with `VZErrorDomain` code
  `2`: `Virtualization is not available on this hardware`.
- The workflow intentionally fails if either required asset variable is missing. Staging must not
  silently fall back to host, Docker, or a synthetic VM asset.
- The `.5.3` packaged E2E keeps the synthetic failed VM fixture for fail-closed UI coverage, but
  uses real packaged resources when `AGENT_PLATFORM_E2E_PACKAGED_VM_RESOURCES_DIR` is provided.
- This task should remain open until a staging PR run publishes passing `staging-packaged-macos-vm-evidence`.

## Tests And Verification

- GitHub Actions staging packaged macOS E2E job.
- Full repository quality gate.
- Manual review of workflow logs proving a self-hosted VM-capable Apple Silicon runner was used and
  `macos-vm` was selected.
- Workflow log/artifact proving the expected image manifest/checksum was used.
- `pnpm docs:lint`

## Definition Of Done

- Staging cannot pass with only host or Docker command execution.
- The packaged E2E job proves successful VM execution and fail-closed unavailable behavior.
- `.5` is closed only after staging evidence is linked in Beads or the task spec.
