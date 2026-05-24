# Task: Validate signing and notarization helper execution

**Beads issue:** `agent-platform-macos-production-sandbox.6.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.6`

## Summary

Prove the signed and notarized macOS artifact can start and use the VM helper.

## Requirements

- Include the native helper in signing and notarization configuration.
- Validate required entitlements for Apple Virtualization.framework, including
  `com.apple.security.virtualization`, and any hardened runtime/network entitlements required by
  the selected guest communication model.
- Run packaged smoke tests against the signed/notarized artifact.
- Fail release if helper execution is blocked by quarantine, signing, entitlements, or notarization.

## Tests And Verification

- Signing/notarization workflow job.
- Signed/notarized artifact smoke test.
- Entitlement inspection for the app and helper binaries.
- Helper execution log proving packaged helper runs after notarization.
- Runner health proving `macos-vm` ready state from the signed artifact.

## Definition Of Done

- Signing and notarization preserve VM helper execution.
- Release artifacts fail closed if signing/entitlement issues block the runner.
