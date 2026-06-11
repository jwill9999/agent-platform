# Task: Validate signing and notarization helper execution

**Beads issue:** `agent-platform-macos-production-sandbox.6.3`  
**Spec file:** `docs/tasks/agent-platform-macos-production-sandbox.6.3.md`  
**Parent task:** `agent-platform-macos-production-sandbox.6`

## Summary

Prove the signed and notarized macOS artifact can start and use the VM helper.

## Production Release Hold

This task is a production release gate. Do not ship or promote a production macOS release until this
task is closed with real Developer ID signed and Apple-notarized artifact evidence. Development
signing and packaged VM smoke tests are useful development/staging evidence, but they do not satisfy
this task's Definition of Done.

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

Current blocker, 2026-06-12:

- Local Apple signing/notarization prerequisites are not available in this environment:
  `security find-identity -v -p codesigning` returned `0 valid identities found`.
- `xcrun notarytool` is installed, but no `APPLE_*`, `DEVELOPER_*`, `NOTARY*`, `CODESIGN*`,
  `CSC*`, `TEAM*`, or `ASC*` environment variable names are present.
- Development signing and packaged VM helper execution have been proven by `.6.1` and `.6.2`, but
  this task still requires a real Developer ID signed and notarized artifact smoke before it can be
  closed.
- Next required action: run the packaged VM smoke on a VM-capable Apple Silicon runner with the
  Developer ID signing identity and notary credentials configured, then record the helper signing
  report, notarization result, and `macos-vm` ready health output here.

## Definition Of Done

- Signing and notarization preserve VM helper execution.
- Release artifacts fail closed if signing/entitlement issues block the runner.
