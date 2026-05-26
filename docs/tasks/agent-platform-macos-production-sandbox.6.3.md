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

## Current Implementation Notes

- Added `native:vm:verify-signing`, backed by `scripts/verify-macos-vm-signing.mjs`.
- The verifier resolves the packaged helper from either a VM runtime resources directory, an exact
  helper path, or a packaged `.app` path.
- The verifier fails closed when the helper is missing, not executable, quarantined, unsigned,
  signature-invalid, or missing `com.apple.security.virtualization`.
- The verifier uses fixed macOS system binaries (`/usr/bin/codesign` and `/usr/bin/xattr`) and emits
  a JSON report that CI stores as `helper-signing-report.json`.
- The staging packaged VM workflow now runs the verifier after packaging the signed helper and
  before attempting the VM E2E boot.
- Development signing now invokes `/usr/bin/codesign` explicitly.

## Tests And Verification

- Signing/notarization workflow job.
- Signed/notarized artifact smoke test.
- Entitlement inspection for the app and helper binaries.
- Helper execution log proving packaged helper runs after notarization.
- Runner health proving `macos-vm` ready state from the signed artifact.

Current local verification:

- `pnpm --filter @agent-platform/desktop test -- test/packageScripts.test.ts test/macosVmSigning.test.ts test/macosVmPackaging.test.ts`
- `pnpm --filter @agent-platform/desktop lint`
- `pnpm --filter @agent-platform/desktop typecheck`

Remaining sign-off evidence:

- A signed/notarized artifact smoke on the VM-capable Apple Silicon runner.
- A runner health report proving `macos-vm` ready state from that signed/notarized artifact.

## Definition Of Done

- Signing and notarization preserve VM helper execution.
- Release artifacts fail closed if signing/entitlement issues block the runner.
