# Command Sandbox Regression Suite

This suite protects Project-scoped command execution while the desktop runtime is being introduced.

## Coverage Map

| Layer           | File                                              | Coverage                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Command policy  | `packages/harness/test/bashCommandPolicy.test.ts` | Read-only shell commands, approval-required write commands, redirects/chaining/package scripts, and denied destructive or host-level commands.                                                                                       |
| Command runner  | `packages/harness/test/commandRunner.test.ts`     | Swappable runner boundary, `/workspace` path rewriting, outside-root denial, write-command approval, destructive denial, approval resume, symlink escape denial, and output bounding.                                                |
| Tool dispatch   | `packages/harness/test/toolDispatch.test.ts`      | Project PathJail enforcement for native/system tools, onboarding write blocks, read-only shell execution, shell workspace escape denial, destructive denial before approval, approval prompts, rejected approvals, and audit events. |
| Tool audit      | `packages/harness/test/toolAuditLog.test.ts`      | Bounded audit arguments/results, redaction, non-zero command output, pending approval, denial, and rejected approval records.                                                                                                        |
| API integration | `apps/api/test/sessionChat.integration.test.ts`   | Project-bound `/workspace` file writes, desktop-registered Project command approval/resume, command execution inside the selected Project root, and user-facing output without host absolute path leakage.                           |
| Desktop E2E     | `apps/desktop/e2e/project-access.e2e.ts`          | Native Project opening, Project-bound session creation, initial UI without `/workspace` leakage, `/help`, and `/init`.                                                                                                               |

## Required Gates

Run the focused command-sandbox tests before using root gates:

```bash
pnpm --filter @agent-platform/harness run test -- test/bashCommandPolicy.test.ts test/commandRunner.test.ts test/toolDispatch.test.ts test/toolAuditLog.test.ts
pnpm --filter @agent-platform/api run test -- test/sessionChat.integration.test.ts
```

Then run the repo completion gates required by `docs/agent-instructions-shared.md`.

## Regression Expectations

- Read-only commands may run without approval only inside the selected Project root.
- Write-capable commands require human approval before execution.
- Destructive commands are denied before approval creation.
- Commands cannot read or write outside the Project root, including through symlinks.
- User-facing output should use canonical Project paths such as `/workspace/file.txt` and avoid host absolute paths.
- Audit logs may retain bounded operational details for observability, but secrets and excessive output must be redacted or truncated.
