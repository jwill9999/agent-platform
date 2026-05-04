# Epic: Branch-aware feedback status

**Beads issue:** `agent-platform-branch-feedback-status`  
**Spec file:** `docs/tasks/agent-platform-branch-feedback-status.md` (this file)  
**Related epic:** `agent-platform-feedback-sensors` - Feedback sensors harness

The Beads issue **description** must begin with: `Spec: docs/tasks/agent-platform-branch-feedback-status.md`

## Objective

Give coding agents and users a branch-aware feedback loop that connects local Git state, pull request status, GitHub Actions, CodeQL, SonarQube, MCP capability discovery, and review comments to the sensor reflection process.

This epic follows the sensor drawer work. The drawer can show session-level sensor state now, but branch and PR-aware status needs separate Git context, provider authentication handling, and remote check-run mapping.

## Capability Map

| Capability               | Outcome                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Current branch discovery | Chat and IDE surfaces show the active repository branch and changed files.                                                |
| Branch/PR mapping        | The platform can identify the pull request associated with the current branch when one exists.                            |
| GitHub check import      | GitHub Actions, CodeQL, annotations, and review comments can be imported into normalized sensor findings.                 |
| Provider auth state      | GitHub CLI/MCP auth-required, permission-denied, and not-configured states are visible with retry actions.                |
| MCP capability discovery | Running MCP servers are discovered, classified, and selected for sensor reflection when relevant.                         |
| Right drawer integration | Branch, PR, checks, SonarQube, CodeQL, MCP, and review feedback appear in the same right-side feedback drawer.            |
| Agent reflection         | Imported branch feedback is available to the harness through session-bound observability tools and sensor repair prompts. |

## Proposed Task Chain

1. `agent-platform-branch-feedback-status.1` - Detect repository branch context for chat and IDE sessions.
2. `agent-platform-branch-feedback-status.2` - Map current branch to GitHub pull request and remote check runs.
3. `agent-platform-branch-feedback-status.3` - Normalize GitHub Actions, CodeQL, annotations, and review comments into sensor findings.
4. `agent-platform-branch-feedback-status.4` - Discover relevant MCP servers and provider capabilities for branch feedback reflection.
5. `agent-platform-branch-feedback-status.5` - Add branch/PR/check status sections to the right feedback drawer.
6. `agent-platform-branch-feedback-status.6` - Feed branch feedback into sensor repair and repeated-failure escalation.

## Edge Cases

- GitHub CLI is not installed or not authenticated.
- GitHub MCP is unavailable, permission-denied, or connected to a different repository.
- No upstream remote, no PR for branch, detached HEAD, or multiple matching PRs.
- CodeQL is enabled in GitHub but not defined in Actions YAML.
- SonarQube feedback comes from MCP, CLI, IDE plugin, remote API, or PR decoration.
- Docker container paths do not match host paths reported by GitHub/SonarQube annotations.
- Sandbox policy blocks local Git, GitHub CLI, MCP sockets, network, or IDE terminal output.
- Provider polling must be user-triggered or cadence-limited to avoid noisy feedback loops.

## Definition of Done

- Users can inspect the active branch and associated PR/check status from the feedback drawer.
- Agents can import branch-specific GitHub, CodeQL, SonarQube, MCP, and review-agent feedback into sensor findings.
- Auth-required, unavailable, permission-denied, and no-PR states are visible with repair/retry actions.
- Branch feedback is bounded, redacted, session-scoped, and available to the sensor reflection process.
- Tests cover local-only branch state, PR-mapped branch state, auth-required provider state, and no-PR fallback.
