# Resize Project terminal with Git panel

## Summary

Fix the Project Chat layout so the human terminal dock resizes cleanly when the Git & GitHub side panel is expanded.

## Requirements

- The terminal dock must remain bounded to the main chat column when the Git panel is open.
- The xterm instance must refit and notify the desktop terminal backend after the dock width changes.
- The terminal toolbar and terminal canvas must not be hidden underneath the Git panel.
- Keep the existing Git panel and terminal behavior otherwise unchanged.

## Verification

- Run focused web typecheck/lint/tests.
- Run formatting and diff checks.
- Push the task branch after the bead is closed.
