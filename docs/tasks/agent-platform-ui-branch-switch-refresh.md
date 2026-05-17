# Refresh Git panel after UI branch switch

## Summary

Ensure changing branches from the Project Chat branch selector immediately refreshes the Git & GitHub side panel and related Project Git state.

## Requirements

- After a successful UI branch checkout, update the active Project record.
- Bump the shared Project Git refresh key so the Git side panel reloads branch/status data.
- Schedule the normal Project Git refresh to reconcile any delayed filesystem or Git metadata changes.
- Keep terminal-driven Git refresh behavior unchanged.

## Verification

- Run focused web typecheck, lint, and tests.
- Run formatting and diff checks.
