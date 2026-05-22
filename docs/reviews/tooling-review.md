# Agent Harness Capability System Improvement Plan

## Objective

Evolve the current tool execution and allowlist architecture into a capability-driven orchestration system that:

- preserves security and governance
- reduces brittle execution failures
- improves user experience
- supports dynamic tooling growth
- aligns with long-term agentic runtime goals
- enables adaptive execution rather than static command gating

The immediate goal is to remove the user experience problem where requests fail with:

```text
fail: not in allowlist
```

and replace it with:

- capability negotiation
- policy-aware execution
- adaptive recovery flows
- provider discovery
- approval escalation
- intent-based orchestration

---

# Current State Assessment

## Existing Strengths

The current codebase already contains strong foundations for a governed agent harness.

### Strong Architectural Areas

| Area                           | Assessment |
| ------------------------------ | ---------- |
| Structured contracts           | Strong     |
| Risk-tier modelling            | Strong     |
| Approval flows                 | Strong     |
| Tool event tracing             | Strong     |
| UI trace visibility            | Strong     |
| Threat modelling               | Strong     |
| Workspace isolation            | Strong     |
| Auditability direction         | Strong     |
| Provider abstraction potential | Strong     |

---

## Existing Relevant Components

### UI Tool Trace System

File:

```text
apps/web/lib/operator-tool-event-display.ts
```

Current states already include:

- blocked
- unavailable
- denied
- approval_required

This is an excellent foundation for capability negotiation.

---

### Structured Tool Contracts

File:

```text
docs/coding-tool-contracts.md
```

Current implementation already contains:

- risk tiers
- approval metadata
- structured tooling contracts
- deterministic governance

This is already aligned with a future capability model.

---

### Command Execution Threat Model

File:

```text
docs/design/command-execution-threat-model.md
```

This document demonstrates mature thinking around:

- trust boundaries
- command isolation
- execution governance
- auditability
- host protection

This should become the basis for a broader capability governance system.

---

### Workspace and Path Governance

File:

```text
apps/api/src/infrastructure/http/v1/browserRouter.ts
```

Strong evidence of:

- path jail enforcement
- workspace scoping
- bounded execution
- controlled artifact exposure

This is already consistent with secure capability execution.

---

# Core Problem

The current execution model appears to operate as:

```text
User Request
  ↓
LLM plans tool
  ↓
Tool dispatcher checks allowlist
  ↓
Hard failure
```

This creates several problems.

---

# Current Architectural Gaps

## 1. Tool-Centric Instead of Capability-Centric

The runtime appears tightly coupled to:

- specific tool names
- static command allowlists
- fixed execution paths

Instead of:

- intent resolution
- capability abstraction
- provider negotiation
- adaptive execution

---

## 2. Infrastructure Errors Leak Into UX

The user currently sees orchestration failures.

Examples:

```text
fail: not in allowlist
```

This exposes internal governance mechanics directly to the user.

The user should instead experience:

- adaptive workflows
- escalation flows
- approval negotiation
- alternative suggestions

---

## 3. No Capability Resolution Layer

The current system appears to map:

```text
intent → tool
```

rather than:

```text
intent → capability → provider → policy → execution
```

This is one of the biggest architectural limitations.

---

## 4. Static Tool Knowledge

The runtime appears to assume tooling is:

- predefined
- statically registered
- explicitly allowlisted

This does not scale well for:

- MCP ecosystems
- dynamic plugins
- provider switching
- external tooling
- user-installed integrations

---

## 5. Binary Trust Model

The system appears to operate as:

```text
allowed / denied
```

Instead of:

- low trust
- medium trust
- session approved
- sandboxed
- human approved
- audited
- autonomous

---

# Recommended Target Architecture

## High-Level Flow

```text
User Intent
   ↓
Planner Runtime
   ↓
Capability Resolver
   ↓
Policy Engine
   ↓
Risk Engine
   ↓
Provider Selection
   ↓
Execution Adapter
   ↓
Tool / MCP / API / CLI
```

---

# Recommended Implementation Plan

# Phase 1 — UX Recovery Layer

## Objective

Remove raw allowlist failures from the user experience.

## Priority

CRITICAL

## Target Duration

1–2 weeks

---

## Goals

### Replace Hard Failures

Replace:

```text
fail: not in allowlist
```

With:

```text
I don't currently have an approved capability for that action.

Available options:
• Request approval
• Connect a provider
• Use an alternative tool
• Run in sandboxed mode
• Explain how to do this manually
```

---

## Recommended Changes

### Add New Tool Event Statuses

File:

```text
apps/web/lib/operator-tool-event-display.ts
```

Add:

```ts
| 'capability_missing'
| 'provider_required'
| 'approval_escalation'
| 'sandbox_available'
```

---

### Add User-Friendly Resolution Payloads

Current system appears heavily execution-oriented.

Add:

```ts
export type CapabilityRecoveryOption = {
  id: string;
  label: string;
  action: 'approve' | 'connect' | 'sandbox' | 'manual' | 'cancel';
};
```

---

### Introduce Recovery UI Components

Suggested location:

```text
apps/web/components/agent/capability-recovery-card.tsx
```

This becomes the replacement for raw execution failure messaging.

---

## Deliverables

| Deliverable                     | Status   |
| ------------------------------- | -------- |
| Replace raw allowlist messages  | Required |
| Add recovery event types        | Required |
| Add capability recovery cards   | Required |
| Add fallback messaging          | Required |
| Add structured recovery actions | Required |

---

# Phase 2 — Capability Abstraction Layer

## Objective

Separate user intent from concrete tool implementation.

## Priority

CRITICAL

## Target Duration

2–4 weeks

---

# Introduce Capability Registry

Suggested package:

```text
packages/capabilities
```

---

## Example Capability Model

```ts
export type CapabilityDefinition = {
  id: string;
  description: string;
  riskTier: RiskTier;
  requiresApproval: boolean;
  providers: string[];
};
```

---

## Example Capabilities

```text
source_control.read
source_control.write
repository.create
filesystem.read
filesystem.modify
browser.navigate
container.manage
quality.run
package.install
```

---

## Introduce Capability Resolver

Suggested location:

```text
packages/harness/src/runtime/capabilities/
```

Example:

```ts
resolveCapability(intent, context): CapabilityResolution
```

Responsibilities:

- discover providers
- evaluate policies
- check trust level
- determine approval requirements
- return execution options

---

## Replace Tool-Centric Invocation

Current likely pattern:

```json
{
  "tool": "gh_repo_create"
}
```

Recommended:

```json
{
  "intent": "repository.create",
  "target": "github"
}
```

---

## Deliverables

| Deliverable              | Status   |
| ------------------------ | -------- |
| Capability registry      | Required |
| Capability resolver      | Required |
| Intent abstraction       | Required |
| Provider mapping         | Required |
| Runtime capability graph | Required |

---

# Phase 3 — Provider Architecture

## Objective

Enable dynamic tooling and provider negotiation.

## Priority

HIGH

## Target Duration

3–5 weeks

---

# Introduce Provider System

Suggested model:

```ts
export type CapabilityProvider = {
  id: string;
  capabilities: string[];
  trustLevel: 'trusted' | 'sandboxed' | 'external';
  execute(): Promise<ExecutionResult>;
};
```

---

## Provider Types

| Provider  | Example                |
| --------- | ---------------------- |
| Native    | Internal harness tools |
| MCP       | Docker MCP, GitHub MCP |
| CLI       | git, gh, pnpm          |
| API       | GitHub REST            |
| Browser   | Playwright             |
| Sandboxed | isolated execution     |

---

## Dynamic Discovery

Add:

```text
ProviderRegistry
ProviderDiscoveryService
```

Potential future integrations:

- MCP registries
- plugin manifests
- local CLI discovery
- workspace tool manifests
- AGENTS.md capability hints

---

## Deliverables

| Deliverable               | Status   |
| ------------------------- | -------- |
| Provider abstraction      | Required |
| Dynamic provider registry | Required |
| MCP provider support      | Required |
| CLI provider adapter      | Required |
| Browser provider adapter  | Required |

---

# Phase 4 — Progressive Trust System

## Objective

Replace binary allowlists with adaptive trust.

## Priority

HIGH

## Target Duration

2–3 weeks

---

# Introduce Trust Levels

## Example

```ts
export type TrustLevel =
  | 'trusted'
  | 'approved_session'
  | 'sandboxed'
  | 'approval_required'
  | 'blocked';
```

---

# Suggested Policy Model

| Risk     | Behaviour          |
| -------- | ------------------ |
| Low      | Auto execute       |
| Medium   | Execute with audit |
| High     | HITL approval      |
| Unknown  | Sandbox            |
| Critical | Refuse             |

---

## Add Temporary Permissions

Inspired by browser permissions.

### Example UX

```text
Allow Docker access:
○ Once
○ This session
○ This workspace
○ Always
```

---

## Deliverables

| Deliverable           | Status   |
| --------------------- | -------- |
| Trust levels          | Required |
| Session permissions   | Required |
| Workspace permissions | Required |
| Temporary approvals   | Required |
| Persistent governance | Required |

---

# Phase 5 — Execution Modes

## Objective

Allow users to control autonomy level.

## Priority

MEDIUM

## Target Duration

1–2 weeks

---

# Suggested Modes

| Mode       | Behaviour               |
| ---------- | ----------------------- |
| Chat       | No execution            |
| Assist     | Suggest only            |
| Guided     | Ask before actions      |
| Agent      | Auto low-risk execution |
| Autonomous | Broad execution         |

---

## Suggested Location

```text
apps/web/components/ide/execution-mode-selector.tsx
```

---

# Phase 6 — Sandbox Execution

## Objective

Allow controlled execution of unknown tooling.

## Priority

MEDIUM

## Future Direction

Potential options:

- Docker isolation
- Firecracker
- restricted shell
- VM-based runners
- WASI sandboxing

---

# Recommended Immediate Refactors

# 1. Introduce Capability Types Package

Suggested:

```text
packages/contracts/src/capabilities/
```

Add:

- capability schemas
- provider schemas
- recovery schemas
- trust schemas
- approval schemas

---

# 2. Refactor Tool Dispatcher

Current likely architecture:

```text
dispatcher → tool
```

Recommended:

```text
dispatcher → capability resolver → provider
```

---

# 3. Add Capability Recovery UI

Suggested components:

```text
CapabilityRecoveryCard
ProviderConnectDialog
PermissionEscalationDialog
SandboxExecutionDialog
```

---

# 4. Extend Audit Trail

Add:

- capability requested
- provider selected
- trust level
- escalation path
- approval source
- fallback options shown

---

# 5. Add Observability Around Capability Failures

Track:

- missing capability frequency
- denied capability patterns
- provider gaps
- repeated escalation flows
- user override behaviour

This becomes critical product intelligence.

---

# Suggested Agent Tasks

## Task 1 — Remove Raw Allowlist Errors

Priority: CRITICAL

### Deliverables

- add recovery messaging
- add recovery actions
- remove direct infrastructure failures from UI

---

## Task 2 — Create Capability Registry

Priority: CRITICAL

### Deliverables

- capability schema
- registry implementation
- capability definitions
- provider mappings

---

## Task 3 — Introduce Capability Resolver

Priority: CRITICAL

### Deliverables

- runtime resolver
- policy evaluation
- provider selection
- approval integration

---

## Task 4 — Add Progressive Trust

Priority: HIGH

### Deliverables

- trust levels
- temporary approvals
- session permissions
- sandbox policy hooks

---

## Task 5 — Build Recovery UX

Priority: HIGH

### Deliverables

- recovery cards
- escalation dialogs
- provider onboarding
- adaptive execution feedback

---

# Architectural Outcome

After these improvements, the harness evolves from:

```text
Tool Execution System
```

into:

```text
Policy-Driven Agent Runtime
```

That is a major architectural transition.

---

# Expected UX Improvement

## Before

```text
User: Create a repository
System: fail: not in allowlist
```

## After

```text
User: Create a repository

System:
Repository creation requires a provider.

Available options:
• Connect GitHub
• Use local Git only
• Request approval
• Run via sandboxed provider
```

This dramatically improves:

- perceived intelligence
- user trust
- orchestration flexibility
- scalability of tooling
- future provider extensibility

while preserving:

- security
- governance
- auditability
- HITL controls
- policy enforcement

---

# Final Recommendation

The existing architecture is already significantly more mature than most early-stage agent harnesses.

The biggest opportunity now is not adding more tools.

It is introducing:

```text
capability-oriented orchestration
```

That shift will allow the harness to:

- scale tooling safely
- reduce brittle execution paths
- support dynamic ecosystems
- integrate MCP providers cleanly
- improve UX dramatically
- preserve strong governance boundaries

without becoming an uncontrolled autonomous system.
