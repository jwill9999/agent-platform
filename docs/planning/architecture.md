# Agent Harness & Runtime Architecture (Production AI)

## Core Principle

A production AI system is not a prompting problem. It is a systems design problem.

> Treat the model as an untrusted, non-deterministic dependency inside a controlled system.

The architecture must:

- Constrain behaviour
- Validate outputs
- Provide observability
- Enforce governance

---

## Layered Architecture Overview

```
[ Harness (Control Plane) ]
        ↓
[ Runtime (Execution Engine) ]
        ↓
[ Tooling Layer (Capability Boundary) ]
        ↓
[ Services (Business Logic) ]
        ↓
[ Data (Source of Truth) ]
```

Cross-cutting across all layers:

```
[ Security | Cost | Observability | Performance ]
```

---

## Clean Architecture Mapping

| Layer    | Role                     | Responsibility          |
| -------- | ------------------------ | ----------------------- |
| Harness  | Interface / Policy Layer | Governance & control    |
| Runtime  | Application Layer        | Execution orchestration |
| Tooling  | Ports / Interfaces       | Controlled capabilities |
| Services | Domain Layer             | Business logic          |
| Data     | Infrastructure Layer     | Persistence             |

**Rule:** Dependencies point inward. Control flows outward.

---

## Harness (Control Plane)

### Purpose

Govern system access and behaviour.

### Responsibilities

- Authentication & identity
- RBAC / permissions
- Policy enforcement
- Rate limiting
- Audit logging
- Approval workflows (HITL)
- Request lifecycle control

### Key Rule

> The harness decides _if_ something is allowed — not _how_ it is done.

### Constraint

- Runtime must NOT own policy decisions

---

## Runtime (Execution Engine)

### Purpose

Orchestrate execution flow.

### Responsibilities

- Context assembly
- Model invocation
- Tool selection
- Response shaping
- State management

### Required Capabilities

#### Structured Output Validation

- Schema validation
- Reject malformed outputs
- Enforce tool allowlists

#### Failure Handling

- Bounded retries
- Loop limits
- Safe termination

#### Deterministic Control

- Treat model output as a proposal, not authority

#### Workflow Support

- Sync execution
- Async/durable workflows

#### HITL Support

- Persist state
- Suspend/resume execution

### Key Rule

> The runtime manages flow, not truth.

---

## Tooling Layer (Capability Boundary)

### Purpose

Define what actions are allowed.

### Responsibilities

- Explicit contracts
- Input validation
- Output normalisation
- Capability enforcement

### Rules

- No direct DB access from runtime
- No domain logic in tools
- No long-lived workflows

### Key Insight

> Tools define the system’s capabilities.

---

## Services Layer (Domain Authority)

### Purpose

Own business correctness.

### Responsibilities

- Business rules
- Validation
- Domain invariants

### Rule

> Correctness must NOT depend on the model.

### Anti-pattern

- Business logic in prompts ❌
- Business logic in runtime ❌

---

## Data Layer (Source of Truth)

### Purpose

- Persistent state
- System of record

### Rule

> Data defines what is true.

---

## Canonical Execution Flow

```
User Request
   ↓
Harness (auth, policy, audit)
   ↓
Runtime (orchestration)
   ↓
Model decision
   ↓
Tool (contract boundary)
   ↓
Service (business logic)
   ↓
Data (truth)
   ↓
Response
```

### Constraints

- Runtime MUST NOT access DB directly
- Runtime MUST go through tools
- Tools MUST call services

---

## Cross-Cutting Concerns

### Security

- Prompt injection = boundary failure
- Enforce least privilege
- Tool allowlisting required

### Cost Control

- Context discipline
- Limit loops and retries
- Cache selectively

### Observability

- Operational (latency, errors)
- Semantic (quality, correctness)

### Performance

- Reduce model hops
- Prefer direct tool responses where possible

---

## Layer Responsibility Model

- Harness → Are you allowed?
- Runtime → What happens next?
- Tool → What action can be taken?
- Service → What is correct?
- Data → What is true?

If these responsibilities blur, the architecture is broken.

---

## Evolution Path

### Prototype

- Model + inline logic
- No separation

### Structured MVP

- Introduce runtime
- Separate tools
- Keep services clean

### Transitional

- Add harness
- Introduce policy, logging, auth

### Production

- Harden all layers
- Add:
  - HITL workflows
  - observability
  - cost controls
  - memory/retrieval

---

## Reusability Model

### Reusable (Platform)

- Harness
- Runtime
- Tool framework
- Plugin system

### Configurable

- Model providers
- Retrieval systems
- Policies

### Domain-Specific

- Tools
- Services
- Data models

---

## Common Failure Modes

1. Runtime becomes business layer
2. No harness (no governance)
3. Direct DB access from runtime
4. Weak tool contracts
5. Over-engineering too early

---

## Final Principle

> Intelligence is not trusted. Control is.

You are not building an intelligent system.

You are building a controlled execution system that uses intelligence.
