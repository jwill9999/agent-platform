# Task: Enforce operation authorization and specialist isolation

**Beads issue:** `agent-platform-multi-agent.2`  
**Parent epic:** `agent-platform-multi-agent` — Multi-agent orchestration

## Summary

Implement and prove the external specialist-launch boundary and deny-by-default operation policy.

## Requirements

- Launch every active-run specialist through isolated `codex exec` container/VM profiles.
- Bind broker identity to a launcher-created process session and short-lived capability.
- Deny unlisted built-in, MCP, filesystem, shell, browser, Beads, Git, and GitHub operations.
- Revalidate resumed approvals against current identity, arguments, contract, policy, and expiry.
- Keep built-in collaboration agents pre-capability/read-only only.

## Dependency order

- **Upstream:** `agent-platform-multi-agent.1`.
- **Downstream:** `agent-platform-multi-agent.3`.
- **Branch parent:** `task/agent-platform-multi-agent.1`.

## Implementation plan

1. Build the minimal-profile and external-sandbox launcher.
2. Implement process-session capability issuance and server-derived role identity.
3. Add operation-level policy evaluation and approval revalidation.
4. Add malicious-specialist feasibility fixtures and audit evidence.

## Tests and verification

- Prove a malicious specialist cannot reach primary Codex, `.git`, `.beads`, broker channels,
  GitHub/SSH credentials, Docker socket, keychain, or host environment.
- Negative matrix tests for every prohibited role/operation pair and impersonation attempt.
- Run build, typecheck, lint, format, focused integration tests, and Sonar analysis.

## Definition of done

- [ ] Isolation feasibility gate passes on the pilot host; otherwise autonomous delivery remains disabled.
- [ ] Authorization denials are deterministic and audited.
- [ ] Intermediate exact-head integration gate and brokered Beads close pass.

## Sign-off

**Owner:** Security-focused implementation worker  
**Reviewer:** Independent security reviewer
