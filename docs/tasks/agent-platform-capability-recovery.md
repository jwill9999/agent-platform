# Capability Recovery UX

## Summary

Replace raw tool allowlist failures with structured capability recovery metadata and user-facing recovery options.

## Requirements

- `TOOL_NOT_ALLOWED` outputs include capability recovery metadata.
- The web stream parser preserves recovery metadata on tool trace errors.
- The operator tool trace renders capability-oriented statuses and recovery options.
- Raw allowlist language does not appear as the primary user-facing summary.

## Verification

- Focused contracts tests for `OutputSchema`.
- Focused web tests for stream parsing and operator display mapping.
- Harness tests or typecheck verify the runtime output shape.
