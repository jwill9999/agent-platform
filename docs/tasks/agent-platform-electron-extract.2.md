# Task: Extract slash command infrastructure

**Beads issue:** `agent-platform-electron-extract.2`  
**Spec file:** `docs/tasks/agent-platform-electron-extract.2.md`  
**Parent epic:** `agent-platform-electron-extract` — Park and extract current onboarding work

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-extract.2.md`

## Task requirements

Extract the reusable slash command infrastructure from the paused onboarding work without depending on browser-only Project opening.

The extracted capability should include the architecture-neutral pieces only:

- slash command parsing;
- command registry or command-dispatch boundary;
- `/help` command behavior;
- `/init` command registration and response shape where it can safely report that Project binding is required;
- tests for command parsing, command listing/help, and no-Project `/init` behavior;
- documentation for how future commands plug into the registry.

This task must not make `/init` pretend to initialize a Project when no backend-bound Project exists. Full Project initialization belongs to `agent-platform-electron-onboarding` after Electron Project access exists.

## Dependency order

Execution order is enforced in Beads with `blocks` edges. Do not close this issue until every upstream task below is already closed.

### Upstream — must be complete before this task

| Issue                               | Spec                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `agent-platform-electron-extract.1` | [Audit current onboarding branch](./agent-platform-electron-extract.1.md) |

### Downstream — waiting on this task

| Issue                               | Spec                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `agent-platform-electron-extract.3` | [Park browser-only Project opening](./agent-platform-electron-extract.3.md) |

### Planning notes

If the audit shows the slash command code is too coupled to Project-opening code, split an additional preparatory refactor task before implementation and wire it in Beads.

## Implementation plan

1. Start from the audit outcome in `agent-platform-electron-extract.1`.
2. Move or retain only command infrastructure that is independent of browser folder handles and manual path entry.
3. Keep command handling agnostic enough for future chat, CLI, API, or desktop surfaces.
4. Ensure `/help` lists available commands through a shared command metadata source.
5. Ensure `/init` has a safe pre-Electron response when no backend-bound Project is present.
6. Add or update unit tests for parser/registry/help/init behavior.
7. Add focused UI tests only if command submission behavior changes.
8. Update docs/spec notes for command extension points.

## Git workflow

Branch from the previous task branch in this segment, normally `task/agent-platform-electron-extract.1`, unless the team decides to merge the audit task separately. Do not commit directly to `main`.

## Tests and verification

Required local gates before sign-off:

- focused unit tests for command parsing/registry/help/init behavior;
- any affected web/component tests;
- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm build`;
- `pnpm docs:lint`.

Playwright/E2E should be added only for behavior that can be tested without locking in browser-only Project opening. Do not add E2E coverage that treats manual path entry as the intended desktop Project opener.

## Definition of done

- [x] Slash command parser/registry/dispatch boundary is extracted or retained in an architecture-neutral form.
- [x] `/help` is backed by command metadata and can list available commands.
- [x] `/init` does not require browser-only Project-opening behavior.
- [x] `/init` clearly reports when a backend-bound Project is required.
- [x] Tests cover parser, help, unknown command, and no-Project `/init` behavior.
- [x] No browser-only/manual-path Project opening behavior is introduced or relied on.
- [x] Beads issue description points to this spec.
- [x] Beads parent is `agent-platform-electron-extract`.
- [x] Beads dependencies match this spec.
- [x] Required local gates pass.
- [x] PR checks and review comments are resolved before closure.

## Sign-off

- [x] Task branch created from the correct parent before implementation work.
- [x] Unit/component tests executed and passing.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm docs:lint` executed and passing.
- [x] PR/check/review requirements satisfied if this task is merged through a PR.
- [x] `bd close agent-platform-electron-extract.2 --reason "Slash command infrastructure extracted"`
