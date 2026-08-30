# ADR-0004: Codex development orchestration uses a repository-local control plane

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Human owner and primary orchestration agent
- **Related:** `agent-platform-multi-agent`, `agent-platform-multi-agent-review`

## Context

The multi-agent design previously mixed two different systems: repository-development automation
performed by Codex agents and the Agent Platform product runtime. That ambiguity left the proposed
workflow-control service without a process owner, storage boundary, credential model, or enforceable
authorization plane. It also implied that prompts or the existing product-level MCP server allowlist
could provide operation-level least privilege, which they cannot.

The first increment must orchestrate development work in this repository. It is not an end-user
multi-agent product capability. Product runtime changes are in scope only when a repository task
explicitly modifies Agent Platform; they are not the workflow-control runtime.

## Decision

We adopt a repository-local Codex development control plane with these boundaries:

- `.codex/agents/` defines development roles and sandbox defaults. These files are usability
  configuration, not the authorization authority.
- `.agents/skills/` defines deterministic planning, orchestration, and closeout procedures.
- A new `packages/workflow-control/` TypeScript package provides a local library, CLI, and stdio MCP
  server. It is launched by the primary Codex session for one workspace and is not mounted into or
  served by `apps/api`.
- Workflow state is stored in SQLite beneath
  `${CODEX_HOME}/workflow-control/<workspace-id>/workflow.sqlite`, where `workspace-id` is a stable
  hash of the canonical repository path. Evidence blobs use the adjacent content-addressed artifact
  directory. Neither location is committed to Git.
- The OS user owns the process and storage. The primary session owns process start, restart, and
  deterministic closeout. On restart, the service acquires a fenced workspace lease and reconciles
  incomplete transitions before new work is scheduled.
- Official Beads MCP remains authoritative for issue CRUD. A single journaled Beads broker inside
  workflow control is its only write-capable client and always supplies explicit `workspace_root`.
  The primary orchestrator and specialists do not receive a separate write-capable Beads MCP
  connection. The `bd` CLI is restricted to brokered Dolt synchronization, diagnostics, and
  operations absent from MCP.
- Privileged GitHub and Beads mutations are removed from general specialist profiles. The write
  credential is available only to narrow orchestrator brokers. Read-only roles use read-only
  adapters or evidence supplied by the orchestrator.
- Every mutating broker request includes the workspace, run id, actor role, contract version, policy
  digest, transition id, and operation-specific preconditions. Brokers deny unknown roles,
  operations, repositories, destinations, or stale versions.
- The broker derives actor role from a process-bound session created by the trusted launcher, not from
  an agent-supplied request field. The launcher transfers a short-lived, single-run capability over a
  private inherited file descriptor or owner-only local socket; the capability is bound to the peer
  process, workspace, run, role, contract version, policy digest, operations, and expiry.
- An approval resumed after interruption is revalidated against the current agent identity, tool,
  normalized arguments, contract version, policy digest, and current authorization policy. A prior
  approval is never a bypass for a revoked capability.

The product's existing `allowedMcpServerIds` model is not treated as sufficient authorization for
this control plane. Any future end-user multi-agent capability requires a separate ADR and product
security design.

### Specialist launch boundary

Built-in Codex collaboration subagents may be used only during pre-approval planning before any
privileged broker capability is established, or after it is revoked, and only when no global
mutation-capable MCP/tool is exposed to the session. Once a broker capability exists, **every**
specialist role—including planners, critics, explorers, reviewers, workers, and test/QA agents—is
launched by the workflow-control launcher as a non-interactive `codex exec` child process with:

- a generated per-run `CODEX_HOME` containing only the role's minimal configuration and no global MCP
  servers, plugins, skills, or external credentials;
- an isolated task worktree supplied with `-C` and the narrowest supported Codex sandbox mode;
- an external container or macOS VM sandbox that mounts only declared source, artifact, and temporary
  paths and does not mount the repository `.git` directory, `.beads`, the primary `CODEX_HOME`, Docker
  socket, SSH agent, keychain, GitHub token, or host environment;
- an empty-by-default shell environment populated only with task-specific non-secret values;
- structured JSONL/stdout results returned to the trusted launcher instead of direct workflow-state
  mutation access.

The OpenAI model credential required by `codex exec` is injected by the launcher as a dedicated
read-only authentication mount or file descriptor and is not reusable for repository or external
system mutations. The autonomous pilot cannot start until a malicious-specialist feasibility test
proves it cannot read the primary `CODEX_HOME`, Beads database/write server, Git/GitHub credentials,
broker socket/capability, or impersonate the orchestrator. If the connected Codex host cannot provide
that isolation, the workflow remains planning/read-only and must not claim autonomous delivery.

### Alternatives considered

- **Run workflow control inside `apps/api`** — rejected because repository-development state and
  credentials would become part of the shipped product runtime without a product requirement.
- **Use only chat history, skills, and agent instructions** — rejected because they cannot provide
  durable recovery, fencing, or enforceable mutation boundaries.
- **Allow direct `gh`, Beads, and Docker MCP writes from every agent** — rejected because global
  credentials and server-level allowlists cannot enforce operation-level least privilege.
- **Replace Beads with workflow-control task state** — rejected because Beads remains the task
  scheduler and authoritative issue lifecycle.

## Consequences

### Positive

- Product runtime and development automation have explicit, separate trust boundaries.
- Workflow state can survive Codex and runner restarts without becoming a second issue tracker.
- Privileged operations can be tested as narrow capabilities instead of relying on prompts.
- Official Beads MCP remains the supported issue adapter.

### Negative / risks

- The pilot requires a new local package, storage schema, brokers, and recovery protocol before it
  can run autonomously.
- Existing globally credentialed MCP/CLI mutation paths must be removed from specialist execution
  environments or the least-privilege claim is false.
- SQLite and Beads cannot share an atomic transaction, so reconciliation and fault injection are
  mandatory.

### Follow-up actions

- [ ] Implement the execution contract, capability matrix, and normative state machine.
- [ ] Prove the external `codex exec` specialist-launch boundary prevents credential, broker, Beads,
      Git, and host-state access before enabling autonomous execution.
- [ ] Implement `packages/workflow-control/` with fenced leases, transition journal, artifacts, and
      reconciliation.
- [ ] Implement narrow Beads, Git/ref, and GitHub mutation brokers and negative authorization tests.
- [ ] Pilot one repository feature through the complete workflow before increasing authority.

## References

- Related epic: [Autonomous Multi-Agent Feature Delivery](../tasks/agent-platform-multi-agent.md)
- Review gate: [Critique multi-agent orchestration design](../tasks/agent-platform-multi-agent-review.md)
- Shared workflow rules: [Agent Instructions](../agent-instructions-shared.md)
