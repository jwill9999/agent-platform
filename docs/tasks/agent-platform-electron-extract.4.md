# Task: Re-scope onboarding and experience specs

**Beads issue:** `agent-platform-electron-extract.4`  
**Spec file:** `docs/tasks/agent-platform-electron-extract.4.md`  
**Parent epic:** `agent-platform-electron-extract` — Park and extract current onboarding work

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-electron-extract.4.md`

## Task requirements

Update the existing Project onboarding and Project experience specifications so they depend on Electron-native Project access instead of browser-only Project opening.

This task is the closeout for the extraction epic. It should make the next Electron epics executable without ambiguity.

The updated specs must clearly state:

- `/init` requires a backend-bound Project context;
- Project chat and IDE handoff must share the same backend Project/session binding;
- browser File System Access and manual path entry are not the desktop Product acceptance path;
- Project onboarding is completed through a review/approval flow before agent writes are enabled;
- Playwright/E2E coverage should target production-like Electron behavior once the runtime exists.

## Dependency order

Execution order is enforced in Beads with `blocks` edges. Do not close this issue until every upstream task below is already closed.

### Upstream — must be complete before this task

| Issue                               | Spec                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `agent-platform-electron-extract.3` | [Park browser-only Project opening](./agent-platform-electron-extract.3.md) |

### Downstream — waiting on this task

| Issue                             | Spec                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `agent-platform-electron-extract` | [Parent epic closeout](./agent-platform-electron-extract.md) |

### Planning notes

This task should align Beads, specs, and documentation. Beads allows epics to block epics, so `agent-platform-electron-foundation` is blocked by the parent `agent-platform-electron-extract` epic rather than this child task directly. If this task discovers that existing Project onboarding/experience tasks should be closed, superseded, or replaced by Electron tasks, document that recommendation before closing.

### Superseded work recommendation

`agent-platform-project-onboarding.8` should not continue as originally written. Its reusable
slash-command framework was extracted under `agent-platform-electron-extract.2`, while full `/init`
onboarding now depends on Electron-native Project access and should be implemented under
`agent-platform-electron-onboarding` after `agent-platform-electron-project-access`. The older task
should be closed as superseded or replaced by Electron child tasks once the owner confirms Beads
cleanup policy.

## Implementation plan

1. Review existing Project onboarding and Project experience specs.
2. Update any wording that implies browser-only Project opening is sufficient.
3. Add explicit dependencies on Electron Project access where needed.
4. Update Definition of Done sections so `/init`, Project chat, IDE handoff, and Project reopen require backend-bound Project context.
5. Update test strategy sections to require production-like Electron E2E for desktop acceptance.
6. Check Beads dependencies and add or adjust dependency edges if needed.
7. Update session or planning docs with the final handoff state.

## Git workflow

Branch from `task/agent-platform-electron-extract.3` in the chained cleanup segment. This is expected to be the segment tip for the extract epic, so it should open the PR from `task/agent-platform-electron-extract.4` to the agreed feature branch when complete.

## Tests and verification

Required local gates before sign-off:

- `pnpm docs:lint`;
- `bd show` for updated issues;
- `bd dep tree agent-platform-electron-foundation`;
- executable tests only if code changed.

If code changed in earlier extraction tasks and this is the segment tip, run the full local gates for the segment before opening the PR:

- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm build`;
- relevant unit/component/E2E tests identified by tasks 2 and 3;
- `pnpm docs:lint`.

## Definition of done

- [x] Existing Project onboarding specs no longer depend on browser-only Project opening.
- [x] Existing Project experience specs no longer depend on browser-only Project opening.
- [x] `/init` acceptance clearly requires backend-bound Project context.
- [x] Project chat and IDE handoff acceptance clearly require shared Project/session context.
- [x] Testing strategy requires production-like Electron E2E once Electron runtime exists.
- [x] Beads issue description points to this spec.
- [x] Beads parent is `agent-platform-electron-extract`.
- [x] Beads dependencies match this spec.
- [x] Required docs and local gates pass.
- [ ] Segment PR checks and review comments are resolved before closure.
- [ ] Parent epic `agent-platform-electron-extract` is ready to close only after all child tasks are closed and the segment has passed its PR/check gate.

## Sign-off

- [x] Task branch created from the correct parent before implementation work.
- [x] `pnpm docs:lint` executed and passing.
- [x] Full segment gates executed and passing if this task is the segment tip.
- [ ] PR merged `task/agent-platform-electron-extract.4` to the agreed feature branch, or explicitly marked N/A with rationale.
- [ ] `bd close agent-platform-electron-extract.4 --reason "Onboarding and experience specs re-scoped"`
