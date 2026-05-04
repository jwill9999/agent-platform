# Agent Platform Operator Experience

## Summary

Improve the end-user experience around agent actions, approvals, artifacts, and workbench surfaces so the product reads like a guided assistant rather than a system log. Technical detail should still be captured for engineers, but it should live in structured observability/debug views instead of the primary chat surface.

## Problem Statement

The current tool activity and human-in-the-loop approval UI exposes internal implementation detail too prominently:

- Internal tool ids such as `sys_browser_start`.
- Raw JSON payloads shown as the primary content.
- System phrasing that is useful for debugging but not clear to non-engineer users.
- Approval cards that look like logs instead of decisions.

The broader frontend is functional, but the design system needs a stronger product layer for artifacts and workbench workflows:

- Branch access and branch status.
- Reviewing and approving diffs.
- Viewing browser screenshots, snapshots, and other generated artifacts.
- IDE/code access and whether the built-in IDE should remain first-class.
- Whether users should be able to open local system applications or their own browser from a Docker-hosted runtime.

## Objectives

- Present tool activity in human-readable language by default.
- Keep raw tool payloads and system traces available in an explicit debug/observability view.
- Redesign approval requests around user decisions: action, target, risk, reason, and clear Approve/Deny choices.
- Establish a reusable design system for artifacts, branch state, diffs, IDE access, and agent-generated evidence.
- Document architecture constraints created by Docker/container execution when the UX needs access to host applications.

## Non-Goals

- Do not remove structured technical telemetry.
- Do not make every user-facing card expose raw JSON by default.
- Do not decide the final IDE architecture without a focused trade-off review.
- Do not bypass existing approval, URL, path, or tool-risk policies.

## Capability Map

| Capability             | User-facing behavior                                                                                               | Engineering/debug behavior                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Tool activity feed     | Shows clear action labels and states such as "Opening BBC iPlayer", "Waiting for approval", "Capturing screenshot" | Emits full structured tool lifecycle events with tool id, payload, policy decision, trace id, and output |
| Approval requests      | Shows action, target, risk, reason, and Approve/Deny                                                               | Links to raw payload, policy rule, audit details, and trace history                                      |
| Artifact viewing       | Provides first-class viewers for screenshots, snapshots, diffs, branches, and code evidence                        | Preserves artifact metadata, file paths, content hashes, truncation status, and source tool              |
| Branch and diff review | Lets users understand what changed and approve/reject proposed work                                                | Stores diff data, commit/branch metadata, CI/Sonar/CodeQL state, and review decisions                    |
| IDE/workbench          | Provides a maintainable code viewing/editing surface or an intentional external-app path                           | Records architecture constraints around container-to-host access and plugin extensibility                |

## Proposed Task Chain

| Order | Proposed task                                | Notes                                                                                                                                   |
| ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Define human-readable tool event model       | Map tool ids, arguments, risk tiers, and states to safe display labels and summaries.                                                   |
| 2     | Split activity feed from debug payloads      | Keep the primary chat feed simple; move JSON, trace ids, and raw tool output into "View details" or a side inspector.                   |
| 3     | Redesign HITL approval cards                 | Use action-oriented copy, risk badges, reason panels, and clear Approve/Deny controls.                                                  |
| 4     | Add toolchain observability trace view       | Capture all backend tool lifecycle events for engineer debugging without overwhelming end users.                                        |
| 5     | Establish artifact viewer design patterns    | Cover screenshots, browser snapshots, file artifacts, branch summaries, and generated evidence.                                         |
| 6     | Design branch/diff approval workflows        | Coordinate with `agent-platform-branch-feedback-status` so branch state and diffs become user-reviewable artifacts.                     |
| 7     | Reassess IDE/workbench architecture          | Coordinate with `agent-platform-ide-rethink`; decide whether to keep expanding the embedded IDE or support host/external-app workflows. |
| 8     | Document Docker/host integration constraints | Capture limitations for opening host browsers, IDEs, local files, plugins, and desktop applications from containerized services.        |

## Related Existing Work

- `agent-platform-branch-feedback-status` — branch-aware feedback status.
- `agent-platform-ide-rethink` — code viewing and IDE direction.
- `agent-platform-ui-quality-sensors` — UI quality and visual UX sensors.
- `agent-platform-capability-registry` — future capability/tool profiles.
- `agent-platform-feedback-sensors` — feedback loop and sensor evidence.
- `agent-platform-agent-profile-governance` — guided authoring for agent scopes, guardrails, and orchestration handoffs.

Additional cross-epic planning context is captured in [Agent-Governed Authoring](../planning/agent-governed-authoring.md).

## Design Notes

- Prefer a calm, product-level UI over log-style output.
- Use existing component conventions and shadcn-style primitives where appropriate.
- Keep raw JSON available, but collapsed under advanced/debug controls.
- Use friendly action names rather than internal ids:
  - `sys_browser_start` -> "Open browser page"
  - `sys_browser_screenshot` -> "Capture screenshot"
  - `sys_git_diff` -> "Read code changes"
- Approval copy should answer:
  - What does the agent want to do?
  - What target is affected?
  - Why is approval required?
  - What is the risk?
  - What happens if the user approves?

## Architecture Notes

- Tool execution should continue to emit structured lifecycle events for observability and audit.
- The chat UI should consume summarized display events rather than rendering raw tool envelopes directly.
- Docker-hosted execution complicates host app access. Any future "open my local browser/IDE" workflow needs an explicit bridge, desktop helper, or documented unsupported boundary.
- Skill-declared tool dependencies and agent tool permissions should remain distinct: skills can state required tools, but agents/policies decide which tools are actually executable.

## Definition of Done

- Epic has child task specs before implementation begins.
- User-facing activity and approval surfaces no longer expose internal ids or raw JSON by default.
- Engineers can still inspect raw tool payloads, policy decisions, trace ids, and backend state.
- Artifact viewer patterns cover browser screenshots, snapshots, branch state, diffs, and code evidence.
- IDE/workbench direction is documented with trade-offs and Docker/host integration implications.
- Relevant UI tests cover normal, approval-required, denied, failed, and completed tool states.
