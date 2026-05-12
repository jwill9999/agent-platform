# Task: Command Approval And Audit Integration

**Beads issue:** `agent-platform-electron-command-sandbox.4`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.4.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.4.md`

## Summary

Connect command runner decisions to the existing approval and tool audit feedback loop.

## Requirements

- Use existing HITL approval requests for approval-required commands.
- Audit allowed, denied, approval-required, approved, rejected, failed, and timed-out command attempts.
- Keep audit payloads bounded and redact or omit sensitive environment data.
- Surface denial and approval reasons clearly enough for agents and users to act.

## Implementation Plan

1. Map `CommandRunner` results to current tool dispatch approval flow.
2. Extend audit metadata for runner policy decisions.
3. Add tests for audit records and approval payloads.
4. Confirm UI-facing messages remain concise and user-safe.

## Implementation Notes

- Kept `sys_bash` command approval on the existing durable HITL approval lifecycle instead of
  adding a command-specific approval channel.
- Added bounded audit serialization for args/results, including recursive secret redaction,
  string/array/object truncation, and a final JSON length cap.
- Added explicit rejected-approval audit records so rejected command approvals are captured as
  denied audit outcomes with rejected evidence.
- Non-zero shell exit codes now complete audit records as errors rather than successful tool
  outputs.

## Tests And Verification

- Harness tool-dispatch tests for approval/audit paths.
- API approval resume tests where command execution is involved.
- Root gates before PR closeout.

## Definition Of Done

- [x] Command approvals use the existing HITL lifecycle.
- [x] Audit records capture allowed, denied, approval-required, approved, rejected, and failed command outcomes.
- [x] Audit payloads are bounded and avoid secrets.
- [x] Denied commands do not create misleading successful tool output.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
