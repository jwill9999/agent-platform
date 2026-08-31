# Workflow-control specialist security boundary

Active workflow-control runs launch every specialist as an external `codex exec` process in a
dedicated container or VM. Built-in collaboration agents are permitted only while no privileged
capability is active and the primary session exposes no mutation-capable tools.

## Specialist workspace

The launcher copies approved source into a private staging directory. It does not copy `.git`,
`.beads`, `.ssh`, `.env`, `node_modules`, or symbolic links. The container receives only the staged
workspace, generated Codex home, read-only minimal configuration, read-only model authentication,
and task prompt. It does not receive the host repository, primary `CODEX_HOME`, Docker socket, broker
socket, SSH agent, keychain, GitHub credentials, or host environment.

The container is read-only except for the staged workspace, generated Codex runtime home, and bounded
temporary filesystem. It runs non-root, drops all Linux capabilities, enables `no-new-privileges`,
and enforces process, memory, CPU, and network bounds. An active model run requires a dedicated
policy-controlled egress network; host, default, and bridge networking are rejected.

## Process-bound authorization

The trusted launcher issues an opaque, short-lived capability bound to the observed process id,
process start time, executable digest, workspace, run, server-derived role, contract version, policy
digest, operation set, and expiry. The role-policy ceiling prevents the issuer from granting an
operation unavailable to that role. Every allow and denial produces an audit event. A request cannot
supply or override its role.

Resumed approvals are rebound to the current capability, agent, normalized arguments, operation,
workspace, run, contract, policy, and expiry. Any changed or expired binding fails closed.

## Feasibility gate

Run the host isolation proof with:

```bash
pnpm --filter @agent-platform/workflow-control test:isolation
```

The test launches a real non-root Docker probe with no network or inherited environment and verifies
that approved source is visible while repository control data, Beads, SSH, Docker, broker, keychain,
host Codex, and credential surfaces are absent. This development-host proof does not replace the
packaged macOS VM release gate; it is the required boundary for the repository-local pilot.
