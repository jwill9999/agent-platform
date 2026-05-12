# Task: Future Sandbox Runner Research

**Beads issue:** `agent-platform-electron-command-sandbox.7`  
**Spec file:** `docs/tasks/agent-platform-electron-command-sandbox.7.md`  
**Parent epic:** `agent-platform-electron-command-sandbox` — Command runner and sandbox policy

The Beads issue description must begin with:
`Spec: docs/tasks/agent-platform-electron-command-sandbox.7.md`

## Summary

Research stronger command runner options and document the migration path beyond the first host runner.

## Requirements

- Compare Docker, macOS platform sandboxing, lightweight VM, and remote sandbox options.
- Evaluate macOS-first feasibility, packaging complexity, security boundary, filesystem behavior, network policy, performance, and user setup burden.
- Confirm how the `CommandRunner` interface can swap implementations.
- Recommend the next runner direction and research questions for Windows/Linux.

## Implementation Plan

1. Research official docs and current project constraints.
2. Add a decision/research note under `docs/design/` or `docs/planning/`.
3. Update parent epic/spec docs with the recommended next runner.
4. Create follow-up Beads tasks if the recommendation changes roadmap scope.

## Tests And Verification

- `pnpm docs:lint`
- `git diff --check`
- Source links are stable and relevant.

## Definition Of Done

- [ ] Research compares at least four runner strategies.
- [ ] Recommendation is explicit for macOS-first release and future cross-platform support.
- [ ] Migration path from host runner to stronger runner is documented.
- [ ] Follow-up tasks are created if needed.
- [ ] PR checks, Sonar/Problems gate, and review comments are resolved before closure.
