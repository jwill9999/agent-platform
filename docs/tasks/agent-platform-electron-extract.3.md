# Task: Park browser-only Project opening

**Beads issue:** `agent-platform-electron-extract.3`  
**Spec file:** `docs/tasks/agent-platform-electron-extract.3.md`  
**Parent epic:** `agent-platform-electron-extract` — Park and extract current onboarding work

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-extract.3.md`

## Task requirements

Remove, park, or disable the browser-only/manual-path Project-opening implementation so it is not merged as the desktop Product path.

The intended Product direction is Electron-native Project access. This task must prevent the paused browser implementation from leaving users with:

- manual absolute path entry as the normal Project-opening flow;
- browser folder handles that show a tree but do not bind Project context to the backend/harness;
- duplicated Open Folder/Open Project CTAs;
- UI states that imply Project setup is complete when the backend does not have a trusted Project path.

Any useful code may be preserved only if it is clearly marked as temporary/dev-only or is needed for tests that do not represent the desktop Product path.

## Dependency order

Execution order is enforced in Beads with `blocks` edges. Do not close this issue until every upstream task below is already closed.

### Upstream — must be complete before this task

| Issue                               | Spec                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `agent-platform-electron-extract.2` | [Extract slash command infrastructure](./agent-platform-electron-extract.2.md) |

### Downstream — waiting on this task

| Issue                               | Spec                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-platform-electron-extract.4` | [Re-scope onboarding and experience specs](./agent-platform-electron-extract.4.md) |

### Planning notes

If some browser File System Access code remains for development or tests, it must be explicitly documented as non-product behavior and must not be the only path in any spec Definition of Done.

## Implementation plan

1. Use the audit from `agent-platform-electron-extract.1` to locate Project-opening changes.
2. Remove or park manual path entry from the normal user-facing Project-opening flow.
3. Remove duplicate Project-opening CTAs where they create conflicting state.
4. Ensure UI copy does not expose internal implementation state or imply unsupported backend binding.
5. Update tests that currently assert rejected browser-only behavior.
6. Preserve only development-safe placeholders that point forward to Electron Project access.
7. Document any intentionally parked files or behavior.

## Git workflow

Branch from `task/agent-platform-electron-extract.2` in the chained cleanup segment. Do not commit directly to `main`.

## Tests and verification

Required local gates before sign-off:

- focused tests for any changed Project-opening UI state;
- updated or removed E2E tests that previously locked in rejected Project-opening behavior;
- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm build`;
- `pnpm docs:lint`.

Manual verification should confirm the web UI no longer presents manual path entry or duplicate Project open flows as the accepted Product path.

## Definition of done

- [x] Manual absolute path entry is not presented as the normal Project-opening flow.
- [x] Browser folder handles are not treated as sufficient backend Project binding.
- [x] Duplicate/conflicting Project-opening CTAs are removed or clearly disabled.
- [x] User-facing copy no longer exposes internal state such as `/workspace`, backend accessibility, hashes, or assessment internals.
- [x] Tests do not lock in the rejected browser-only Project-opening path.
- [x] Any parked code or temporary behavior is documented.
- [x] Beads issue description points to this spec.
- [x] Beads parent is `agent-platform-electron-extract`.
- [x] Beads dependencies match this spec.
- [x] Required local gates pass.
- [x] PR checks and review comments are resolved before closure.

## Sign-off

- [x] Task branch created from the correct parent before implementation work.
- [x] Relevant unit/component/E2E tests executed and passing or intentionally removed with rationale.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm docs:lint` executed and passing.
- [x] PR/check/review requirements satisfied if this task is merged through a PR.
- [x] `bd close agent-platform-electron-extract.3 --reason "Browser-only Project opening parked"`
