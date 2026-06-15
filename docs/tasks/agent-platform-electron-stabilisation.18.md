# Task: Owner manual QA sign-off after automation backfill

**Beads issue:** `agent-platform-electron-stabilisation.18`  
**Spec file:** `docs/tasks/agent-platform-electron-stabilisation.18.md`

## Summary

Run the reduced owner manual QA checklist after deterministic Electron stabilisation checks have
been automated.

## Requirements

- Use `docs/qa/electron-project-experience-manual-qa.md` as the source checklist.
- Use `docs/qa/electron-stabilisation-automation-matrix.md` to skip checks already covered by
  automation unless the owner wants to spot-check them.
- Focus manual testing on native picker behavior, visual polish, real local environment quirks, and
  subjective copy/flow quality.
- Classify every finding as blocker, follow-up, known limitation, or decision.
- Feed blocker/follow-up findings back into Beads.

## Sign-off Evidence

Owner manual testing passed on 2026-06-15 after the Electron stabilisation automation backfill and
the `jwill9999/electron-stabilisation-e2e-backfill` staging PR checks were green.

No new blocker findings were reported during this sign-off. Remaining known follow-ups stay tracked
in Beads, including the broader non-blocking workflow expectation matrix task
`agent-platform-electron-stabilisation.20` and the pre-production macOS VM signing/notarization gate
`agent-platform-macos-production-sandbox.6.3`.

## Implementation Plan

1. Run the automated Electron E2E gate from `.17`.
2. Run the reduced owner manual QA pass.
3. Record sign-off or findings in `.12` and this task.
4. Close `.12` only when findings are classified and owner sign-off is recorded.

## Tests And Verification

- Owner manual QA sign-off or findings list.
- Beads tasks created or updated for every blocker/follow-up.
- `.12` closeout recommendation updated.

## Definition Of Done

- Owner has rerun or explicitly signed off the reduced manual QA checklist.
- Any remaining findings are classified.
- `agent-platform-electron-stabilisation.12` is unblocked for closeout.
