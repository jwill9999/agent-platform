# LangGraph Implementation Plan for a Contract-Driven, Evaluator-Led Agent Harness

## Purpose

This document translates the previously identified harness gaps into a practical implementation plan using a LangGraph-style orchestration model aligned to the current architecture.

It is intended for an implementation agent that needs to:

- understand the problem being solved
- understand the target runtime behaviour
- map responsibilities to harness, runtime, plugins, skills, and tools
- plan the implementation in a structured way

---

# 1. Problem We Are Solving

The current architecture has strong structural separation, but its execution model is still too close to a single-agent workflow.

This creates several quality risks:

- the agent can under-scope work
- the agent can drift during long-running execution
- the agent can mark work complete prematurely
- validation can be too shallow or too close to the generator
- quality criteria are not always explicit before implementation begins
- handoff between planning, execution, and evaluation is not yet formalised enough

The target improvement is to move from:

`analyse -> plan -> execute -> validate`

to:

`analyse -> plan -> contract -> execute -> evaluate -> remediate -> repeat until pass`

The key principle is that quality improves when implementation and evaluation are separated and when both operate against an explicit contract.

---

# 2. Architectural Goal

Build a graph-driven orchestration layer that introduces:

- a **Planner** role
- a **Generator** role
- an **Evaluator** role
- a **contract artifact** between planning and implementation
- an explicit **evaluation/remediation loop**
- typed artifacts that persist state and drive deterministic handoff
- bounded retries, budget enforcement, and escalation paths

This must align with the existing architectural stance:

- **Harness** = control plane and orchestration
- **Runtime** = execution engine and context assembly
- **Tools** = capability boundaries only
- **Plugins** = lifecycle enrichment and cross-cutting behaviour
- **Skills** = scoped instructional capability, not orchestration logic
- **Business logic** remains outside the harness

---

# 3. Recommended Graph Shape

## High-level graph

```text
User Request
  ->
Intent Analysis
  ->
Planning
  ->
Contract Proposal
  ->
Contract Review
  ->
Decision: Contract Approved?
    -> No  -> Contract Revision -> Contract Review
    -> Yes -> Execution
             ->
Evaluation
             ->
Decision: Passed?
               -> No  -> Remediation Plan -> Execution
               -> Yes -> Final Acceptance
```

## Optional control nodes

These can wrap or influence the main path:

- Risk Classification
- Tool Allowlist Resolution
- Skill Resolution
- Budget Enforcement
- Human Approval
- Artifact Persistence
- Session Continuity / Handoff
- Compression / Context Management

---

# 4. Core Runtime Roles

## 4.1 Planner

### Responsibility

Translate user intent into an implementation-ready specification without over-constraining low-level details.

### Inputs

- user request
- agent template
- allowed skills
- relevant experience/memory
- optional repository/project context

### Outputs

- `ProductSpec`

### Notes

The planner should define:

- objective
- scope
- constraints
- assumptions
- success outcomes
- major features
- technical direction at a high level only

The planner should not lock the generator into overly detailed technical implementation unless such constraints are explicitly required.

---

## 4.2 Generator

### Responsibility

Implement work against an approved contract using allowed tools, skills, and runtime context.

### Inputs

- `ProductSpec`
- approved `WorkContract`
- active task context
- selected skills
- tool allowlist
- evaluator feedback from previous rounds, if any

### Outputs

- code changes
- generated files/artifacts
- `ExecutionSummary`
- optional `EvidenceBundle`

### Notes

The generator should not be treated as the final authority on whether the work is good enough.

---

## 4.3 Evaluator

### Responsibility

Assess the implementation independently against the approved contract and the relevant quality criteria.

### Inputs

- approved `WorkContract`
- generator outputs
- app/runtime/test environment
- evaluator criteria pack
- QA tools such as Playwright, test runner, API probes, static analysis summaries

### Outputs

- `EvaluationReport`
- optional `RemediationPlan`

### Notes

The evaluator should be sceptical by design. Its purpose is not to praise the generator. Its purpose is to establish whether the implementation satisfies the contract.

---

# 5. Node-by-Node LangGraph Plan

## 5.1 `intentAnalysisNode`

### Purpose

Normalise the incoming task and decide the orchestration shape required.

### Inputs

- raw user request
- current agent definition
- runtime metadata
- risk metadata if available

### Outputs

- `IntentAnalysis`

### Responsibilities

- classify task type
- estimate complexity
- identify whether planner is required
- identify whether evaluator is required
- identify whether human approval is required
- select criteria pack family
- determine likely tool classes needed

### Why it matters

Not every request needs the full graph. This node makes orchestration adaptive.

---

## 5.2 `skillResolutionNode`

### Purpose

Resolve which skills and instruction assets should be loaded.

### Inputs

- `IntentAnalysis`
- allowed skill IDs
- skill metadata
- current template defaults

### Outputs

- `ResolvedSkillSet`

### Responsibilities

- select only relevant skills
- avoid flooding context with all available skills
- provide runtime with selected skill artifacts

### Why it matters

This keeps skill loading targeted and bounded.

---

## 5.3 `plannerNode`

### Purpose

Produce a structured spec from user intent.

### Inputs

- raw user request
- `IntentAnalysis`
- selected skills
- prior memory/context
- template/system instructions

### Outputs

- `ProductSpec`

### Responsibilities

- define scope
- identify key features
- capture assumptions
- define high-level technical direction
- list success outcomes

### Exit criteria

A usable spec exists that the generator and evaluator can reason over.

---

## 5.4 `contractProposalNode`

### Purpose

Translate the broader spec into a concrete unit-of-work contract.

### Inputs

- `ProductSpec`
- current execution context
- selected criteria pack
- any open remediation items

### Outputs

- proposed `WorkContract`

### Responsibilities

- define current unit of work
- define in-scope and out-of-scope
- define deliverables
- define verification steps
- attach acceptance criteria
- define required evidence

### Why it matters

This is the bridge between broad intent and testable implementation.

---

## 5.5 `contractReviewNode`

### Purpose

Have the evaluator review the proposed contract before implementation begins.

### Inputs

- proposed `WorkContract`
- `ProductSpec`
- criteria pack
- prior known issues if present

### Outputs

- reviewed `WorkContract`
- `ContractReviewResult`

### Responsibilities

- ensure the contract aligns to the actual objective
- ensure criteria are testable
- ensure scope is not evasive or incomplete
- reject weak or ambiguous definitions of done

### Decision

- approve
- reject with revision notes

### Why it matters

It prevents the generator from defining an easy version of success.

---

## 5.6 `executionNode`

### Purpose

Perform implementation against the approved contract.

### Inputs

- approved `WorkContract`
- resolved skills
- allowed tools
- runtime context
- prior remediation input if retrying

### Outputs

- implementation changes
- `ExecutionSummary`
- optional evidence pointers

### Responsibilities

- implement only the approved contract scope
- use tools through normalised interfaces
- produce evidence of work completed
- avoid silent expansion outside scope unless formally escalated

### Notes

This node may internally run a ReAct-style tool loop, but from the orchestration layer it is still one bounded graph step.

---

## 5.7 `evaluationNode`

### Purpose

Run independent evaluation of the implementation.

### Inputs

- approved `WorkContract`
- implementation outputs
- evaluation criteria pack
- QA tools and verification environment

### Outputs

- `EvaluationReport`

### Responsibilities

- run behavioural checks
- inspect acceptance criteria one by one
- record pass/fail/partial results
- produce evidence-backed findings
- assign severity and remediation guidance

### Notes

This node should own QA tooling such as:

- Playwright MCP
- test runner integration
- API probes
- schema checks
- static analysis summaries
- coverage and lint evidence where relevant

---

## 5.8 `passFailDecisionNode`

### Purpose

Decide whether the current unit of work is accepted.

### Inputs

- `EvaluationReport`
- iteration budget
- policy thresholds
- risk level

### Outputs

- decision state

### Decision outcomes

- `pass`
- `retry`
- `escalate`
- `fail_terminal`

### Responsibilities

- accept if must-pass criteria are satisfied
- retry if issues are remediable and budget remains
- escalate if approval or human intervention is required
- terminate if risk, budget, or policy constraints are exceeded

---

## 5.9 `remediationNode`

### Purpose

Translate evaluation findings into a generator-ready correction plan.

### Inputs

- `EvaluationReport`
- current contract
- remaining retry budget

### Outputs

- `RemediationPlan`

### Responsibilities

- summarise issues to fix
- prioritise by severity
- define expected evidence for closure
- reduce ambiguity before the next execution pass

### Why it matters

This prevents the generator from receiving vague criticism and guessing what to do next.

---

## 5.10 `finalAcceptanceNode`

### Purpose

Persist final outcome and emit a completion artifact.

### Inputs

- accepted `EvaluationReport`
- current contract
- execution summary

### Outputs

- `FinalAcceptanceReport`

### Responsibilities

- record accepted deliverables
- summarise verification evidence
- mark task/contract complete
- emit audit/logging hooks
- pass learning candidates to experience systems if enabled

---

# 6. Suggested Graph Edges

## Main success path

```text
intentAnalysisNode
  -> skillResolutionNode
  -> plannerNode
  -> contractProposalNode
  -> contractReviewNode
  -> executionNode
  -> evaluationNode
  -> passFailDecisionNode
  -> finalAcceptanceNode
```

## Contract rejection loop

```text
contractReviewNode
  -> if rejected
  -> contractProposalNode
```

## Remediation loop

```text
passFailDecisionNode
  -> if retry
  -> remediationNode
  -> executionNode
```

## Escalation path

```text
passFailDecisionNode
  -> if escalate
  -> humanApprovalNode or supervisoryDecisionNode
```

---

# 7. State Model for LangGraph

The graph needs a well-defined shared state.

## Recommended state shape

```ts
export interface HarnessGraphState {
  request: UserRequest;
  intentAnalysis?: IntentAnalysis;
  resolvedSkills?: ResolvedSkillSet;
  productSpec?: ProductSpec;
  activeContract?: WorkContract;
  contractReview?: ContractReviewResult;
  executionSummary?: ExecutionSummary;
  evaluationReport?: EvaluationReport;
  remediationPlan?: RemediationPlan;
  finalAcceptance?: FinalAcceptanceReport;
  iteration: number;
  maxIterations: number;
  budget: BudgetState;
  risk: RiskState;
  artifacts: ArtifactReference[];
  toolContext: ToolContextState;
  memoryContext: MemoryContextState;
}
```

## State design principles

- state must be explicit, not inferred from conversation text
- artifacts should be referenced by ID and version
- node outputs should be append-only where practical
- mutable current fields can point to the latest accepted artifact

---

# 8. Artifact Model

## 8.1 ProductSpec

Purpose:

- broad structured plan for the overall objective

Key fields:

- objective
- scope
- constraints
- assumptions
- success outcomes
- major features
- high-level technical notes

## 8.2 WorkContract

Purpose:

- unit-of-work agreement between generator and evaluator

Key fields:

- objective
- inScope
- outOfScope
- deliverables
- verificationSteps
- acceptanceCriteria
- status

## 8.3 ExecutionSummary

Purpose:

- concise summary of implementation completed in the latest pass

Key fields:

- files changed
- tools used
- deliverables attempted
- known limitations
- evidence references

## 8.4 EvaluationReport

Purpose:

- evidence-backed pass/fail report against the contract

Key fields:

- result
- findings
- scores
- failed criteria
- evidence
- recommended next action

## 8.5 RemediationPlan

Purpose:

- actionable repair plan for next execution pass

Key fields:

- issuesToFix
- priority
- expected proof of fix
- remaining retry budget

## 8.6 FinalAcceptanceReport

Purpose:

- formal record of accepted completion

Key fields:

- accepted deliverables
- verification evidence
- final status
- audit summary

---

# 9. Mapping to Existing Architecture

## 9.1 Harness responsibilities

The harness should own:

- graph orchestration
- role assignment
- policy enforcement
- iteration control
- budget enforcement
- artifact persistence decisions
- escalation and approval routing

The harness should not own domain business logic.

---

## 9.2 Runtime responsibilities

The runtime should own:

- prompt context construction
- selected skill injection
- plugin hook execution
- tool dispatch
- structured output parsing
- bounded agent execution for a node
- context assembly from artifacts and memory

The runtime should be node-agnostic where possible. The graph determines the role and the runtime executes that role.

---

## 9.3 Plugin responsibilities

Plugins should enrich runtime behaviour, not replace graph orchestration.

Examples:

### Session plugin

- load session continuity at graph start
- write updated continuity at graph end

### Mulch/experience plugin

- provide relevant lessons during planning or execution
- stage candidate lessons after final acceptance

### Beads/task plugin

- sync task metadata
- attach task descriptions/spec references
- update task status after acceptance

### Compression plugin

- compress conversational history used inside node execution
- should not replace artifact-based handoff

### Guardrails plugin

- enforce policy checks around tool usage and output constraints

---

## 9.4 Skills responsibilities

Skills should provide domain-specific guidance such as:

- frontend design principles
- API implementation conventions
- testing guidance
- repository standards

Skills should not decide graph shape or node transitions.

That belongs to the harness.

---

## 9.5 Tool responsibilities

Tools should remain capability boundaries only.

Examples:

- filesystem writes
- git operations
- Playwright execution
- test runner invocation
- API calls
- repo inspection

Tools should not contain orchestration logic or implicit quality policy.

---

# 10. Criteria Packs

The evaluator needs reusable criteria packs that can be attached by task type.

## 10.1 UI feature criteria pack

Must-pass examples:

- primary user flow works end to end
- UI actions produce expected visible results
- no blocking functional defects
- layout remains usable at supported viewport sizes

Should-pass examples:

- interaction flow is intuitive
- visual hierarchy is consistent
- error messages are understandable

## 10.2 API criteria pack

Must-pass examples:

- endpoints respond with expected schema
- validation rules are enforced
- critical error cases are handled
- auth and boundary rules are respected

## 10.3 Architecture criteria pack

Must-pass examples:

- layering boundaries are preserved
- tool logic is not embedded in business services
- contracts are explicit
- tests cover the changed path where required

## 10.4 Agent feature criteria pack

Must-pass examples:

- agent tool usage follows allowlist
- structured outputs validate
- approval-required actions are gated
- memory usage follows policy

These packs can be selected in `intentAnalysisNode` and attached during `contractProposalNode`.

---

# 11. Retry and Stop Policy

The graph should not loop indefinitely.

## Retry inputs

- max iterations
- severity of findings
- risk tier
- remaining token/cost budget
- whether the issues are remediable automatically

## Example policy

- retry for remediable high-value issues while budget remains
- escalate if approval is needed or uncertainty remains high
- fail terminally if repeated attempts do not reduce critical defects

## Practical rule

The evaluator should never repeatedly return the same failure without either:

- forcing a more constrained remediation plan
- escalating
- terminating

---

# 12. Human-in-the-Loop Integration

Not every failure should be auto-remediated.

Introduce escalation when:

- the evaluator and generator disagree repeatedly
- implementation requires policy override
- the work touches high-risk or destructive operations
- ambiguity remains around user intent or desired trade-offs
- a human must choose between competing acceptable directions

This can map to a `humanApprovalNode` or external approval workflow.

---

# 13. Suggested Package/Module Alignment

This is a possible mapping to your existing style of package separation.

## `@conscius/agent-types`

Add:

- graph state types
- artifact interfaces
- review/evaluation types
- contract/criteria types

## `@conscius/agent-core`

Add:

- graph runner wiring
- node execution adapters
- state reducers
- decision policies
- artifact persistence interfaces

## `@conscius/agent-plugin-beads`

Add:

- work item sync for accepted contracts
- task status update integration
- optional linkage from contract to task identifiers

## `@conscius/agent-plugin-mulch`

Add:

- planner/execution/evaluator context enrichment
- candidate lesson output after final acceptance

## `@conscius/agent-plugin-session`

Add:

- graph-level continuity loading and closure summary writing

## `@conscius/agent-plugin-guardrails`

Add:

- policy enforcement hooks around evaluation, remediation, and escalation paths

## future evaluator-related package or module

Potentially add:

- criteria pack registry
- evaluation policy engine
- evidence normalisation utilities

---

# 14. Implementation Phases

## Phase 1 - Foundations

Deliver:

- artifact types
- graph state type
- intent analysis node
- planner node
- contract proposal node
- contract review node
- basic execution node
- evaluation report type

Goal:
Establish the contract-driven loop skeleton.

## Phase 2 - Evaluation Loop

Deliver:

- evaluation node
- pass/fail decision node
- remediation node
- bounded retry policy
- final acceptance node

Goal:
Make evaluator-led iteration operational.

## Phase 3 - Criteria and QA Tooling

Deliver:

- criteria pack registry
- Playwright-backed evaluator flow
- API/test/static-analysis evidence adapters
- evidence capture in reports

Goal:
Move from generic evaluation to evidence-based validation.

## Phase 4 - Adaptive Orchestration

Deliver:

- complexity/risk-based graph selection
- optional planner bypass for trivial tasks
- optional evaluator bypass for low-risk simple tasks
- escalation paths

Goal:
Avoid over-orchestrating simple work while preserving strong controls for complex work.

## Phase 5 - Plugin and Persistence Integration

Deliver:

- Beads integration
- session continuity integration
- experience lesson integration
- audit/event emission

Goal:
Fully align the graph to the wider runtime ecosystem.

---

# 15. Success Criteria for the New Graph

The implementation is successful when the harness can:

- translate broad requests into structured intent
- define explicit completion criteria before code is written
- separate implementation from judgment
- reject incomplete work reliably
- produce structured remediation plans
- converge through bounded retries
- preserve clean architecture boundaries
- adapt orchestration depth to task complexity and risk

Operationally, you should see:

- fewer silently stubbed features
- fewer false positive completions
- stronger behavioural correctness
- clearer auditability of what was built and why it was accepted
- better handoff between sessions and agents

---

# 16. Final Position

The key architectural shift is this:

The harness must stop treating validation as a lightweight post-step and instead treat evaluation as a peer control mechanism with the authority to reject work.

That means the next implementation step is not “make the main agent smarter”.

It is:

- make intent explicit
- make contracts explicit
- make evaluation independent
- make remediation structured
- make acceptance evidence-based

That is the most direct path from the current architecture to a more capable, production-ready agent harness.
