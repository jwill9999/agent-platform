# Task: Expose sensor controls and validate end to end

**Beads issue:** `agent-platform-feedback-sensors.6`  
**Spec file:** `docs/tasks/agent-platform-feedback-sensors.6.md` (this file)  
**Parent epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-feedback-sensors.6.md`

## Task requirements

Expose sensor configuration, provider availability, findings, and outcomes to users, then validate the full self-correction loop.

Required outcomes:

- API surfaces expose configured sensors and recent sensor outcomes for a session/run.
- API surfaces expose discovered capabilities, provider availability, normalized findings, and retry/connect actions.
- UI surfaces show sensor pass/fail status without flooding the chat transcript.
- Users can distinguish:
  - deterministic checks
  - inferential checks
  - local/IDE findings
  - IDE/plugin terminal-output findings
  - remote GitHub/SonarQube/CodeQL/review feedback
  - unavailable/auth-required providers
  - Docker/container/sandbox limitations
  - repeated-failure escalation
  - reviewed improvement candidates
- UI can prompt for provider connection/authentication when a required remote or IDE/plugin source is unavailable, then retry discovery/import.
- UI should encourage users to install or enable supported IDE plugins/adapters when that would expose useful diagnostics, terminal output, SonarQube/CodeQL feedback, or review-agent comments to the harness.
- Integration tests prove failed sensors trigger another agent pass.
- E2E tests prove visible sensor status and successful completion after correction.
- Documentation explains how to configure and trust sensors.

## Dependency order

### Upstream - must be complete before this task

| Issue                               | Spec                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `agent-platform-feedback-sensors.5` | [Add sensor observability and feedback flywheel](./agent-platform-feedback-sensors.5.md) |

### Downstream - waiting on this task

| Issue | Spec |
| ----- | ---- |
| None  | N/A  |

## Implementation plan

1. Read `apps/api/src/infrastructure/http/v1/toolsRouter.ts`, `apps/api/src/infrastructure/http/v1/chatRouter.ts`, and relevant web chat/output components.
2. Add API response fields or routes for sensor definitions/results using contracts from task `.1`.
3. Add UI rendering for compact sensor status:
   - passed
   - failed and repaired
   - failed and escalated
   - skipped with reason
   - unavailable/auth required with connect/retry action
4. Add UI/API affordances to inspect open findings grouped by source, severity, file, and repair state.
5. Add UI/API affordances to inspect environment limitations such as stopped containers, missing mounts, sandbox-denied access, or host/container path mapping gaps.
6. Keep raw logs behind expandable evidence/details.
7. Add integration tests for chat runs where a mocked sensor fails once, feeds repair guidance, and then passes.
8. Add tests for provider auth-required and retry flows.
9. Add tests for required sensor blocked by Docker/sandbox limitation.
10. Add setup guidance for IDE/plugin feedback providers, including what data is exposed and how output is bounded/redacted.
11. Add Playwright coverage if UI surfaces are touched.
12. Update `docs/api-reference.md`, `docs/architecture.md`, and `docs/development.md` as needed.

## Tests (required before sign-off)

- `pnpm --filter apps/api run test`
- `pnpm --filter apps/web run test` if web tests exist for touched components
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:e2e` when the UI flow is implemented and Docker compose stack is available
- Add tests for:
  - API exposes sensor result metadata
  - API exposes discovered capability and provider availability metadata
  - auth-required provider can be surfaced and retried
  - IDE/plugin provider not configured can be surfaced with setup guidance
  - Docker/sandbox limitation can be surfaced with repair guidance
  - failed sensor loops back into model context
  - passing sensor permits completion
  - UI renders pass/fail/escalated states
  - evidence is bounded and expandable

## Definition of done

- [ ] Sensor controls/results are visible through API and UI surfaces.
- [ ] Provider auth/connect/retry flows are visible and test-covered where implemented.
- [ ] IDE/plugin setup guidance is available when local feedback providers are not configured.
- [ ] Docker/container/sandbox limitations are visible and test-covered where implemented.
- [ ] Full failure-to-correction loop is covered by tests.
- [ ] Documentation explains sensor execution types, trigger timing, and review-gated flywheel behavior.
- [ ] Quality gates pass for touched packages.
- [ ] Segment tip PR is opened from `task/agent-platform-feedback-sensors.6` to `feature/feedback-sensors-harness`.
- [ ] `bd close agent-platform-feedback-sensors.6 --reason "Sensor controls exposed and E2E validation complete"`

## Sign-off

- [ ] Task branch created from `task/agent-platform-feedback-sensors.5`
- [ ] Required tests executed and passing
- [ ] Checklists in this document are complete
- [ ] If segment tip: PR merged `task/agent-platform-feedback-sensors.6 -> feature/feedback-sensors-harness`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** Jason Williams **Date:** 2026-05-03
