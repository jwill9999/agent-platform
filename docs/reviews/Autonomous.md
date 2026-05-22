# Agent Implementation Plan — Autonomous Execution & Dynamic Trust System

## Objective

Transform the current static HITL/allowlist execution model into a:

```text
policy-driven autonomous capability system
```

that supports:

- guided autonomy
- execution modes
- dynamic approvals
- capability-based governance
- progressive trust
- bounded autonomous execution
- adaptive tool orchestration

while preserving:

- auditability
- security
- observability
- workspace isolation
- policy enforcement

---

# High-Level Target Architecture

```text
User Intent
   ↓
Planner Runtime
   ↓
Capability Resolver
   ↓
Policy Engine
   ↓
Execution Mode Evaluator
   ↓
Approval / Sandbox Decision
   ↓
Provider Selection
   ↓
Execution Adapter
   ↓
Tool / MCP / CLI / API
```

---

# Core Design Goals

## Replace

```text
allowlist-based execution blocking
```

## With

```text
capability-aware adaptive execution
```

---

# Existing Architectural Strengths

The current codebase already contains strong foundations:

| Existing Area        | Reuse Strategy                    |
| -------------------- | --------------------------------- |
| Tool contracts       | Extend with capability metadata   |
| Risk tiers           | Integrate into execution policies |
| HITL system          | Convert into escalation layer     |
| Audit trails         | Extend for trust decisions        |
| Threat modelling     | Expand into autonomy governance   |
| Tool traces          | Add capability lifecycle states   |
| Workspace isolation  | Preserve as hard boundary         |
| Browser/tool routing | Integrate into provider system    |

---

# Target Execution Model

## Current

```text
tool → allowlist → approve/deny
```

## Target

```text
intent
  ↓
capability
  ↓
policy evaluation
  ↓
execution mode
  ↓
trust evaluation
  ↓
provider selection
  ↓
execute / sandbox / escalate
```

---

# Phase 1 — Execution Mode Foundation

## Objective

Introduce runtime execution modes.

## Priority

CRITICAL

## Estimated Duration

2–4 days

---

# Tasks

## 1. Add Execution Mode Contracts

### Suggested Location

```text
packages/contracts/src/runtime/
```

### Add

```ts
export type ExecutionMode = 'chat' | 'assist' | 'guided' | 'agent' | 'autonomous';
```

---

## 2. Add Runtime Context Support

Extend:

- session state
- runtime context
- operator state
- websocket state
- persistence model

### Add

```ts
executionMode: ExecutionMode;
```

---

## 3. Add Execution Mode Persistence

Store:

- workspace default
- session override
- temporary escalation

Suggested:

```text
.trust/runtime-policy.json
```

---

## Deliverables

| Deliverable          | Required |
| -------------------- | -------- |
| Execution mode types | Yes      |
| Runtime propagation  | Yes      |
| Persistence support  | Yes      |
| Session integration  | Yes      |

---

# Phase 2 — Capability Abstraction

## Objective

Decouple tools from user intent.

## Priority

CRITICAL

## Estimated Duration

1–2 weeks

---

# Tasks

## 1. Create Capability Registry

### Suggested Package

```text
packages/capabilities/
```

---

## 2. Define Capability Schema

```ts
export type CapabilityDefinition = {
  id: string;
  description: string;
  riskTier: RiskTier;
  minimumExecutionMode: ExecutionMode;
  requiresApproval: boolean;
  providers: string[];
};
```

---

## 3. Define Initial Capability Set

### Suggested Capabilities

```text
filesystem.read
filesystem.modify
source_control.read
source_control.write
repository.create
package.install
container.manage
browser.navigate
browser.automate
quality.run
shell.execute
network.request
```

---

## 4. Create Capability Resolver

### Suggested Location

```text
packages/runtime/src/capabilities/
```

### Responsibilities

- map intent → capability
- discover providers
- evaluate policies
- determine approval path
- select execution route

---

## Deliverables

| Deliverable            | Required |
| ---------------------- | -------- |
| Capability registry    | Yes      |
| Capability definitions | Yes      |
| Capability resolver    | Yes      |
| Intent abstraction     | Yes      |

---

# Phase 3 — Policy Engine Refactor

## Objective

Replace binary approvals with adaptive policy evaluation.

## Priority

CRITICAL

## Estimated Duration

1 week

---

# Tasks

## 1. Refactor Approval Logic

## Current

```text
tool → approve/deny
```

## Target

```text
capability
  ↓
risk tier
  ↓
execution mode
  ↓
trust level
  ↓
policy decision
```

---

## 2. Add Policy Evaluator

### Suggested Location

```text
packages/runtime/src/policy/
```

### Example

```ts
evaluateExecutionPolicy({
  capability,
  riskTier,
  executionMode,
  workspaceTrust,
  providerTrust,
});
```

---

## 3. Add Decision Outcomes

```ts
type PolicyDecision = 'allow' | 'approval_required' | 'sandbox' | 'deny';
```

---

## Deliverables

| Deliverable          | Required |
| -------------------- | -------- |
| Policy engine        | Yes      |
| Adaptive approvals   | Yes      |
| Risk-aware execution | Yes      |
| Decision contracts   | Yes      |

---

# Phase 4 — Progressive Trust System

## Objective

Introduce bounded autonomy.

## Priority

HIGH

## Estimated Duration

1 week

---

# Tasks

## 1. Add Trust Levels

```ts
export type TrustLevel = 'trusted' | 'workspace' | 'session' | 'sandboxed' | 'restricted';
```

---

## 2. Add Temporary Escalations

### UX Examples

```text
Allow:
○ Once
○ This task
○ This session
○ This workspace
```

---

## 3. Add Workspace Trust Profiles

### Suggested File

```text
.trust/workspace-policy.json
```

### Example

```json
{
  "executionMode": "agent",
  "allowedCapabilities": ["filesystem.modify", "source_control.write"]
}
```

---

## Deliverables

| Deliverable         | Required |
| ------------------- | -------- |
| Trust levels        | Yes      |
| Temporary approvals | Yes      |
| Workspace policies  | Yes      |
| Persistent trust    | Yes      |

---

# Phase 5 — Provider Architecture

## Objective

Support dynamic tooling and provider negotiation.

## Priority

HIGH

## Estimated Duration

2 weeks

---

# Tasks

## 1. Create Provider Interface

```ts
export type CapabilityProvider = {
  id: string;
  capabilities: string[];
  trustLevel: TrustLevel;
  execute(): Promise<ExecutionResult>;
};
```

---

## 2. Add Provider Registry

### Suggested Location

```text
packages/providers/
```

---

## 3. Create Provider Types

| Provider Type | Examples           |
| ------------- | ------------------ |
| Native        | internal tools     |
| CLI           | git, gh, pnpm      |
| MCP           | Docker MCP         |
| API           | GitHub API         |
| Browser       | Playwright         |
| Sandboxed     | isolated execution |

---

## 4. Add Dynamic Discovery

Support:

- MCP manifests
- plugin discovery
- local CLI probing
- AGENTS.md provider hints

---

## Deliverables

| Deliverable        | Required |
| ------------------ | -------- |
| Provider contracts | Yes      |
| Provider registry  | Yes      |
| Dynamic discovery  | Yes      |
| CLI providers      | Yes      |
| MCP providers      | Yes      |

---

# Phase 6 — Recovery UX

## Objective

Remove infrastructure-level failures from the UI.

## Priority

HIGH

## Estimated Duration

1 week

---

# Tasks

## 1. Replace

```text
fail: not in allowlist
```

## With

```text
This capability requires approval or a provider connection.
```

---

## 2. Add Capability Recovery Components

### Suggested Components

```text
CapabilityRecoveryCard
PermissionEscalationDialog
ProviderConnectDialog
SandboxExecutionDialog
```

---

## 3. Add Structured Recovery Actions

```ts
type RecoveryAction = 'approve' | 'sandbox' | 'connect_provider' | 'manual' | 'cancel';
```

---

## Deliverables

| Deliverable         | Required |
| ------------------- | -------- |
| Recovery UI         | Yes      |
| Escalation dialogs  | Yes      |
| Provider onboarding | Yes      |
| Friendly failures   | Yes      |

---

# Phase 7 — Autonomous Boundaries

## Objective

Prevent unsafe unrestricted autonomy.

## Priority

CRITICAL

## Estimated Duration

1 week

---

# Hard Boundaries

Even in autonomous mode:

NEVER bypass:

- workspace isolation
- path jail
- credential policies
- audit logging
- sandbox restrictions
- execution budgets

---

# Add Safety Controls

## Limits

```ts
maxToolDepth;
maxExecutionTime;
maxFilesModified;
maxCommands;
maxNetworkCalls;
maxCost;
```

---

## Abort Conditions

- recursive loops
- repeated failures
- policy drift
- suspicious shell patterns
- excessive file deletion
- repeated escalation attempts

---

## Deliverables

| Deliverable           | Required |
| --------------------- | -------- |
| Circuit breakers      | Yes      |
| Budget controls       | Yes      |
| Recursive protection  | Yes      |
| Autonomous safeguards | Yes      |

---

# Phase 8 — Observability & Governance

## Objective

Track autonomy and policy decisions.

## Priority

MEDIUM

## Estimated Duration

4–5 days

---

# Tasks

## Extend Audit Events

Track:

- requested capability
- selected provider
- execution mode
- trust level
- approval source
- escalation path
- sandbox usage

---

## Add Metrics

Track:

- approval frequency
- blocked capabilities
- provider failures
- autonomy success rate
- sandbox fallbacks
- policy overrides

---

## Deliverables

| Deliverable          | Required |
| -------------------- | -------- |
| Extended audit logs  | Yes      |
| Autonomy metrics     | Yes      |
| Capability analytics | Yes      |
| Policy telemetry     | Yes      |

---

# Suggested UI Enhancements

# Execution Mode Selector

### Suggested Location

```text
Top toolbar
Workspace settings
Session controls
```

---

# Example UX

| Mode       | Description                      |
| ---------- | -------------------------------- |
| Guided     | Ask before sensitive actions     |
| Agent      | Autonomous development workflows |
| Autonomous | Full governed autonomy           |

---

# Advanced Controls

```text
☑ Allow filesystem modification
☑ Allow git operations
☑ Allow package installation
☐ Allow unrestricted shell
☐ Allow external network
```

---

# Recommended Agent Execution Order

| Order | Task                            |
| ----- | ------------------------------- |
| 1     | Add execution modes             |
| 2     | Create capability registry      |
| 3     | Build capability resolver       |
| 4     | Refactor policy engine          |
| 5     | Add trust system                |
| 6     | Introduce provider architecture |
| 7     | Replace HITL UX                 |
| 8     | Add autonomous safeguards       |
| 9     | Extend observability            |

---

# Final Architectural Outcome

## Before

```text
LLM + allowlisted tools
```

## After

```text
Policy-driven autonomous capability runtime
```

---

# Long-Term Benefits

This architecture enables:

- scalable tooling
- safer autonomy
- dynamic provider ecosystems
- reduced approval fatigue
- enterprise governance
- MCP extensibility
- adaptive execution
- safer autonomous workflows
- better UX
- future marketplace support

while preserving:

- security
- auditability
- human control
- bounded execution
- operational trust

This is the correct long-term direction for a modern extensible agent harness.
