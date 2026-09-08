# Exact source material for preapproval critique

Beads: `agent-platform-pilot-zero.3`  
Parent: `agent-platform-pilot-zero`

## Requirements

A preapproval reviewer must inspect an explicit immutable material set, not an arbitrary repository
directory or a model-echoed HEAD. Stage only enumerated regular files, produce a deterministic
path/content manifest digest, and verify source and staged material against it. Reject absolute,
traversal, duplicate, symbolic-link, credential and repository-control paths. Bound file count and
total bytes; do not expose file contents in errors. Clean owned temporary staging on failure.

## Implementation plan

Add a standalone staging helper and temporary-fixture tests. The helper has no model, credential,
Docker, broker, database or external-service access. It returns exact-material evidence for a future
trusted runner and an explicit cleanup operation. Document filesystem trust/race limitations rather
than describing path checks as a sandbox against a malicious host administrator.

## Dependency order

This helper can be implemented independently of live authentication and the role mount fix.
The Git chain continues from `task/pilot-zero-readonly-review` on `task/pilot-zero-material`.
Cumulative segment-tip PR targets `feature/pilot-zero-assessment`; no main/staging promotion is
authorized here. Beads task remains open until segment-tip checks and integration complete.

## Tests and definition of done

Tests cover deterministic ordering/digest, exact content and file set, digest mismatch, source/stage
tampering, unsafe paths and symlinks, size/count limits and cleanup. Run focused tests, full package
tests, typecheck, lint, formatting, documentation links, and Sonar or the documented fallback.
Independent supervised critique must review the final implementation and limitations.
No UI behavior is changed. Passing fixtures do not prove a live isolated model review.

## Sign-off

Owner: Jason Williams. Implementation: preapproval_material (Astra), two new files only.
Independent review remains separate; no complete runner or runtime approval is claimed.
