# Task: Implement governed test runner

**Beads id:** `agent-platform-code-tools.5`  
**Parent epic:** `agent-platform-code-tools` - Structured coding tool pack

## Summary

Implement a governed test/build runner that lets agents run approved project checks and receive structured pass/fail evidence without falling back to arbitrary shell execution.

## Requirements

- Define an allowlist of test/build commands or command profiles.
- Support timeout, output truncation, exit code capture, and failure summary.
- Capture structured evidence for critic/DoD.
- Deny dependency-changing or deployment commands unless explicitly approved by policy.
- Support repo-specific commands without making the tool arbitrary shell.

## Tool Shape

```json
{
  "name": "run_quality_gate",
  "riskTier": "medium",
  "input": {
    "profile": "test|typecheck|lint|format|e2e|custom-approved",
    "timeoutMs": 120000
  },
  "output": {
    "ok": true,
    "exitCode": 0,
    "summary": "",
    "stdoutTail": "",
    "stderrTail": "",
    "failures": []
  }
}
```

## Implementation Plan

1. Define command profile config.
2. Implement non-interactive command execution with timeout and cancellation.
3. Parse common failure output patterns into summaries.
4. Store or emit structured evidence.
5. Add security tests for denied commands.
6. Add integration tests against representative package scripts.

## Dependency Order

| Upstream                      | Downstream                    |
| ----------------------------- | ----------------------------- |
| `agent-platform-code-tools.4` | `agent-platform-code-tools.6` |

Beads dependency: this task depends on `agent-platform-code-tools.4`; `agent-platform-code-tools.6` depends on this task.

## Tests And Verification

- Unit tests for allowed profiles, denied commands, timeout, non-zero exit, and truncation.
- Integration tests for at least one passing and one failing command.
- Full repo quality gate passes.

## Definition Of Done

- Agents can run approved checks through typed tools.
- Failures are summarized in human-readable and machine-readable forms.
- Unsafe command classes remain blocked or approval-gated.
- Evidence is available to critic/DoD.
