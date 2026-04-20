# Agent Harness Optimisation Guide

**Derived from: Agent-first engineering practices (Codex-based system design)**

---

## 1. Core Mindset Shift

### From:

- Writing code

### To:

- Designing systems that enable agents to write, validate, and evolve code

**Key Principle:**

> Humans steer. Agents execute.

Your harness is no longer a tool wrapper — it is a **control system for autonomous software production**.

---

## 2. Harness as the Control Plane (Reinforced)

Your existing architecture is already aligned, but this document sharpens it:

### Harness Responsibilities

- Task decomposition & orchestration
- Tool + skill routing
- Guardrails enforcement
- Feedback loop execution
- Context assembly
- Observability exposure
- Policy + constraint injection

### Critical Insight

> The bottleneck is no longer compute — it is **human attention**

So your harness must:

- Reduce human intervention
- Increase agent autonomy safely
- Encode decisions once → enforce everywhere

---

## 3. Legibility > Intelligence

### Problem

Agents fail not because they are weak — but because:

- The environment is underspecified
- Context is fragmented
- Systems are not machine-readable

### Solution

Make everything **agent-legible**:

#### Required Harness Capabilities

- Structured repo knowledge (not ad-hoc prompts)
- Explicit architecture boundaries
- Machine-readable documentation
- Deterministic workflows

---

## 4. Repository = Source of Truth

### Anti-pattern

- Large `AGENTS.md`
- External docs (Slack, Google Docs)
- Tribal knowledge

### Correct Pattern

```
AGENTS.md → Table of contents
/docs → System of record
```

### Structure to Adopt

```
/docs
  /architecture
  /design
  /plans
  /product
  /references
  /quality
  /reliability
  /security
```

### Harness Optimisation

- Always inject **minimal entrypoint context**
- Let agent discover deeper context dynamically
- Validate docs via CI (freshness, links, coverage)

---

## 5. Feedback Loops Are the System

### The Winning Pattern

Agents operate in loops:

```
Plan → Implement → Test → Observe → Fix → Repeat
```

### Harness Must Provide:

- Self-review capability
- Multi-agent review (agent-to-agent)
- Observability access
- Automated validation

### Upgrade Your Harness With:

- PR feedback loops (agent-driven)
- Auto-review agents
- CI signal ingestion (SonarQube, CodeQL, etc.)
- Retry loops instead of blocking failures

---

## 6. Observability is Not Optional

### Key Insight

Agents need to **see the system like a human would**

### Provide:

- Logs (queryable)
- Metrics (queryable)
- Traces
- UI state (DOM/snapshots)
- Screenshots

### Implementation Direction

You’re already thinking correctly with MCP:

- Playwright MCP → UI validation
- Observability MCP → logs + metrics
- Custom tools → domain validation

### Outcome

Agents can:

- Reproduce bugs
- Validate fixes
- Measure performance
- Close the loop autonomously

---

## 7. Strict Architecture Enables Speed

### Counterintuitive Truth

> More constraints = more speed (for agents)

### Required Patterns

- Layered architecture (enforced)
- Strict dependency rules
- Limited allowed edges
- Strong typing at boundaries

### Harness Role

- Enforce via:
  - Linters
  - Structural tests
  - Validation tools

### Example Constraint Model

```
Types → Config → Repo → Service → Runtime → UI
```

---

## 8. Encode Taste into the System

### Problem

Agents replicate bad patterns quickly

### Solution

Create **mechanical taste rules**:

- Naming conventions
- File size limits
- Logging standards
- Data validation rules

### Harness Upgrade

Turn:

- Human feedback → documentation → enforcement → tooling

---

## 9. Throughput Changes Everything

### Old Model

- Block on correctness

### New Model

- Ship fast → fix continuously

### Harness Strategy

- Minimise blocking gates
- Allow:
  - Fast PR cycles
  - Follow-up fixes
  - Iterative improvement

---

## 10. Autonomy Requires Full Lifecycle Encoding

### Mature Agent Capability

A fully enabled agent can:

- Understand system state
- Reproduce issues
- Implement fixes
- Validate behaviour
- Open PRs
- Respond to feedback
- Merge changes

### Harness Implication

You must encode:

- Testing
- Validation
- Review
- Recovery

---

## 11. Garbage Collection is Mandatory

### Problem

Agent-generated systems drift

### Solution

Continuous cleanup loops

### Implement in Your Harness:

- Scheduled refactor agents
- Quality scoring system
- Pattern detection
- Auto-fix PRs

### Concept

> Treat technical debt like memory leaks → continuously collect

---

## 12. Context Management Strategy

### Key Insight

Context is scarce — structure beats volume

### Avoid

- Dumping all skills/tools/context

### Use

- Progressive disclosure
- Skill allowlisting
- Context assembly pipeline

### Your Existing Direction (Correct)

- Skill registry
- Tool allowlisting
- Runtime composition

### Optimisation

Add:

- Context scoring
- Relevance filtering
- Dynamic injection

---

## 13. Skills vs Tools vs Knowledge

### Clarified Model

| Type   | Purpose                      |
| ------ | ---------------------------- |
| Skills | Reusable capability patterns |
| Tools  | Execution interfaces         |
| Docs   | Reasoning context            |

### Harness Rule

- Never flood context
- Only inject what is required per task

---

## 14. Human Role Evolution

### Engineers Now:

- Define intent
- Build systems
- Encode constraints
- Improve feedback loops

### Not:

- Writing code directly

---

## 15. Direct Improvements for Your Harness

### High-Impact Upgrades

#### 1. Add Feedback Loop Engine

- Agent self-review
- Multi-agent validation
- CI integration

#### 2. Introduce Observability Layer

- Logs + metrics via tools
- UI validation via Playwright MCP

#### 3. Formalise Repo Knowledge System

- `/docs` as source of truth
- Structured indexing

#### 4. Enforce Architecture Mechanically

- Dependency rules
- Layer validation

#### 5. Add Continuous Refactor Agents

- Weekly/daily cleanup jobs
- Pattern enforcement

#### 6. Implement Context Assembly Pipeline

- Skill selection logic
- Context prioritisation
- Token optimisation

#### 7. Encode Guardrails into Code (not prompts)

- Linters
- Runtime validation
- Tool contracts

---

## 16. Final Principle

> The quality of an agent system is not determined by the model —
> but by the **environment you build around it**

---

## TL;DR

To optimise your harness:

- Build systems, not prompts
- Encode knowledge in the repo
- Add observability everywhere
- Enforce strict architecture
- Enable continuous feedback loops
- Treat cleanup as a first-class process
- Optimise for agent legibility, not human preference

---

## Next Step (Recommended)

Convert this into:

- Architecture decision record
- Epics in your Beads system
- Plugin roadmap for your runtime

---
