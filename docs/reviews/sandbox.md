# Phase 1 — Immediate Hardening Plan

## Objective

Implement a practical and secure execution boundary for the agent harness without overengineering the platform.

The goal is to preserve:

- developer usability,
- flexible tooling,
- dynamic command execution,
- and HITL approval flows,

while materially reducing the risk of:

- arbitrary host compromise,
- credential leakage,
- supply-chain attacks,
- workspace destruction,
- and unbounded execution.

This phase intentionally avoids:

- Kubernetes orchestration,
- microVM infrastructure,
- distributed runners,
- or enterprise-grade policy engines.

The implementation should remain lightweight, maintainable, and aligned with the current Electron + Node.js architecture.

---

# Security Principles

## 1. The model is not the security boundary

The LLM proposes actions.

The harness authorises actions.

Security decisions must remain deterministic and external to the model.

---

## 2. Policy and execution remain separate

Maintain the architecture:

```text
Harness Policy Layer
    decides IF execution is allowed

Execution Layer
    decides HOW execution occurs
```

Do not merge these concerns.

---

## 3. Assume hostile or compromised code

All executed code should be treated as untrusted, including:

- generated scripts,
- npm lifecycle hooks,
- package manager installs,
- user repositories,
- shell commands,
- and agent-generated code.

---

## 4. Constrain execution instead of trying to “trust” prompts

Focus on:

- isolation,
- visibility,
- reversibility,
- and bounded permissions.

Do not attempt to solve security through prompting alone.

---

# Deliverables

The agent should implement:

1. Sandboxed Docker execution
2. Explicit environment projection
3. Network execution policies
4. Elevated approval for package management
5. Immutable audit logging

---

# Phase 1 Architecture

```text
LLM Tool Call
    ↓
Policy Engine
    ↓
Approval System (HITL)
    ↓
Command Classification
    ↓
Sandbox Command Runner
    ↓
Docker Execution Boundary
    ↓
Audit Logging
```

---

# 1. Sandboxed Docker Execution

## Objective

Replace direct host shell execution with isolated container execution.

Current risk:

- commands execute directly on the host,
- project scripts may access local resources,
- environment variables may leak,
- arbitrary code can escape intended workspace boundaries.

---

## Requirements

### Use Docker as the execution adapter

Implement a new command runner:

```ts
SandboxCommandRunner implements CommandRunner
```

The existing host runner should remain available for advanced/manual modes only.

---

## Container Security Requirements

### Must use

- non-root user
- read/write workspace mount only
- isolated temporary filesystem
- CPU limits
- memory limits
- PID limits
- execution timeout
- output truncation

---

## Must NOT use

- privileged mode
- host networking
- docker socket mounts
- host root mounts
- inherited user home mounts
- host PID namespace
- host IPC namespace

---

## Example Runtime Configuration

```bash
docker run \
  --rm \
  --user sandbox:sandbox \
  --memory=2g \
  --cpus=2 \
  --pids-limit=256 \
  --network=none \
  -v /workspace/project:/workspace \
  -w /workspace \
  sandbox-runner
```

---

## Tasks

### Task 1.1 — Create sandbox execution adapter

Create:

- `SandboxCommandRunner`
- execution configuration model
- runtime policy mapping

---

### Task 1.2 — Add execution mode configuration

Support:

```ts
executionMode:
  | 'host'
  | 'docker-sandbox'
```

Default:

- `docker-sandbox`

---

### Task 1.3 — Build sandbox image

Create minimal execution image:

- Node.js
- Git
- pnpm
- Python (optional)

Prefer:

- slim images
- minimal packages
- non-root user

---

### Task 1.4 — Add resource constraints

Add configurable:

- memory caps
- CPU caps
- execution timeout
- output size caps
- process count limits

---

### Task 1.5 — Add workspace mount restrictions

Mount:

- project workspace only

Do not expose:

- home directory
- SSH directories
- system paths
- Electron application data
- browser storage
- credential stores

---

# 2. Explicit Environment Projection

## Objective

Prevent accidental credential leakage.

Current risk:

- inherited environment variables expose secrets to generated code.

Examples:

- GitHub tokens
- OpenAI keys
- cloud credentials
- npm auth tokens
- SSH agent references

---

## Requirements

### Default behaviour

DO NOT inherit host environment.

---

## Allowed model

Use explicit allowlist projection.

Example:

```ts
allowedEnv = ['NODE_ENV', 'CI', 'TERM'];
```

---

## Tasks

### Task 2.1 — Create env projection system

Implement:

- allowlisted environment projection
- secure merge logic
- audit visibility

---

### Task 2.2 — Add environment policy config

Support:

```ts
envPolicy:
  | 'none'
  | 'minimal'
  | 'custom'
```

---

### Task 2.3 — Add secret filtering

Prevent exposure of:

- tokens
- credentials
- API keys
- SSH references

---

# 3. Network Policy

## Objective

Constrain outbound network access during execution.

Current risk:

- arbitrary code can exfiltrate data,
- access internal services,
- or abuse metadata endpoints.

---

# Required Modes

Support:

```ts
networkMode:
  | 'disabled'
  | 'public-only'
  | 'unrestricted'
```

---

# Mode Definitions

## disabled

No network access.

Use for:

- local builds
- tests
- formatting
- static analysis

---

## public-only

Allow public internet access only.

Block:

- localhost
- RFC1918 ranges
- metadata services
- internal domains

---

## unrestricted

Full network access.

Requires elevated approval.

---

# Tasks

### Task 3.1 — Add network policy model

Create:

- policy config
- runtime mapping
- approval integration

---

### Task 3.2 — Implement disabled mode

Use:

- Docker `--network=none`

---

### Task 3.3 — Implement public-only restrictions

Block:

- localhost
- 127.0.0.0/8
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16
- metadata endpoints

---

### Task 3.4 — Require elevated approval for unrestricted mode

Unrestricted access must:

- trigger HITL approval
- show explicit warnings

---

# 4. Elevated Approval for Package Management

## Objective

Treat package installation and build tooling as high-risk execution.

Current risk:

- lifecycle hooks execute arbitrary code,
- dependencies may download binaries,
- build tools may invoke compilers or scripts.

---

# High-Risk Commands

Examples:

- npm install
- pnpm install
- yarn install
- pip install
- cargo build
- go get

---

# Required Changes

## Add dedicated classification

Add category:

```ts
'package-management';
```

Separate from:

- workspace-write
- standard execution

---

## Approval Requirements

Package management should:

- always require approval
- display elevated warnings
- show network implications
- show dependency risk

---

# Tasks

### Task 4.1 — Extend command classifier

Detect:

- package managers
- installers
- build systems

---

### Task 4.2 — Add elevated HITL UX

Display:

- dependency risk
- network usage
- script execution warning

---

### Task 4.3 — Add optional safe-install mode

Future option:

- `--ignore-scripts`
- frozen lockfile mode
- offline install support

Not required for Phase 1.

---

# 5. Immutable Audit Logging

## Objective

Provide complete execution traceability.

This is essential for:

- debugging,
- security review,
- rollback analysis,
- incident investigation,
- and enterprise trust.

---

# Audit Requirements

Store:

- command
- timestamp
- approval ID
- user decision
- sandbox configuration
- environment projection
- network policy
- mount configuration
- execution duration
- exit code
- output hash
- modified file hashes

---

# Logging Principles

## Logs must be append-only

Avoid mutable audit history.

---

## Logs must survive crashes

Persist immediately after execution.

---

## Logs should support future replay

Structure logs consistently.

---

# Tasks

### Task 5.1 — Create execution audit schema

Add:

- structured JSON logs
- schema versioning

---

### Task 5.2 — Add file change hashing

Before execution:

- snapshot workspace hashes

After execution:

- compute modified file hashes

Store diff metadata.

---

### Task 5.3 — Add immutable log storage

Options:

- append-only JSONL
- SQLite append log
- signed execution records

Keep implementation simple initially.

---

# Recommended Defaults

## Default execution policy

```ts
{
  executionMode: 'docker-sandbox',
  envPolicy: 'minimal',
  networkMode: 'disabled',
  approvalRequired: true
}
```

---

# Recommended Approval Matrix

| Category             | Approval Required |
| -------------------- | ----------------- |
| Read-only            | No                |
| Workspace write      | Yes               |
| Package management   | Elevated          |
| Network unrestricted | Elevated          |
| Container execution  | Elevated          |
| Destructive          | Blocked           |

---

# Non-Goals (Phase 1)

Do NOT implement yet:

- Kubernetes
- Firecracker
- gVisor
- VM orchestration
- distributed workers
- enterprise policy DSLs
- SELinux policy engines
- multi-tenant execution

These introduce significant operational complexity prematurely.

---

# Success Criteria

The implementation is successful when:

- the LLM can still execute useful workflows,
- host compromise risk is materially reduced,
- secrets are not inherited,
- execution is observable,
- network access is constrained,
- package installs are elevated,
- and execution remains maintainable for a small engineering team.

---

# Final Recommendation

The correct long-term strategy is:

```text
Constrain execution,
not prompts.
```

The model should never be trusted as the security boundary.

The harness should assume:

- prompts can be compromised,
- tools can be abused,
- generated code may be hostile,
- and approvals may occasionally be mistaken.

Therefore:

- execution must remain isolated,
- observable,
- bounded,
- and reversible.
