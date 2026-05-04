# Agent-Governed Authoring

This note captures the refinement direction for skills, agent profiles, capability scopes, observability, artifacts, and orchestration guardrails.

## Core Principle

Move beyond humans filling out Markdown or JSON configuration by hand. The platform should support collaborative authoring:

1. Human describes the desired outcome in natural language.
2. Agent asks targeted questions when intent, risk, or scope is unclear.
3. Agent proposes the skill, agent profile, capability policy, artifacts, and validation plan.
4. Human explores and reviews the proposed artifacts and decisions.
5. Agent validates safety, consistency, policy, and quality.
6. Human approves activation.
7. Platform enforces the approved result at runtime.

Working principle:

```text
Agent-governed authoring, human-approved activation, platform-enforced policy.
```

## Roles In The Authoring Process

| Role     | Responsibility                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Human    | Explains goals, brings domain judgment, explores proposed behavior, approves activation.                  |
| Agent    | Guides questions, designs the skill/profile, identifies risk, proposes guardrails, validates consistency. |
| Platform | Enforces capability scopes, approvals, sandboxing, audit, artifact retention, and runtime policy.         |

The agent acts as the gatekeeper during authoring. The human acts as the explorer. The platform remains the runtime authority.

## Skill Authoring Direction

Skills should not be limited to database prompt records. Use both repository-discovered and platform-managed sources:

| Source             | Purpose                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Repository skills  | Project-specific workflows, architecture rules, release commands, conventions, and domain knowledge.                                |
| Harness built-ins  | Platform-owned workflows for browser tools, feedback sensors, SonarQube, CodeQL, review, artifacts, approvals, and skill authoring. |
| User/global skills | Reusable cross-project preferences and workflows.                                                                                   |
| Database registry  | Runtime index, enablement, assignment, trust state, version metadata, policy, and audit history.                                    |

The DB should be the control plane, not the only source of skill content.

Discovered repo skills should be indexed, previewed, validated, and activated under policy. Script-backed skills need explicit sandboxing, review, provenance, and approval.

## Agent Profile Governance

Agent profiles should also be authored collaboratively. The user describes the agent role; the system helps translate it into:

- role instructions
- capability groups
- restricted capability groups
- approval rules
- sandbox limits
- data-access boundaries
- default tools and skills
- escalation behavior
- verification requirements
- orchestration handoff rules

Capability assignment should default to broad availability for common platform tools, governed by policy at runtime. Agents should be differentiated mainly by role instructions, profile policy, and task context rather than by hiding all common tools.

Restrictions still matter for:

- file writes and destructive actions
- shell commands and script execution
- external network access
- credentials and private connectors
- expensive or long-running operations
- sensitive data movement
- delegation to more powerful agents

## Orchestration Guardrails

As handoffs become common, delegation needs explicit policy:

- which agent can delegate to which other agents
- what context can be passed
- whether files, artifacts, secrets, traces, or memory can be shared
- whether the receiving agent inherits restrictions or uses its own profile
- whether delegation to a more powerful profile requires approval
- how completion is verified before control returns

A coordinator agent must not bypass its own restrictions by handing work to a more privileged agent without policy review.

## Artifact Model Direction

Browser artifacts should become the first implementation of a general artifact model, but observability and artifacts should remain separate.

Observability explains what happened. Artifacts preserve evidence.

Candidate artifact types:

- screenshot
- snapshot
- diff
- log excerpt
- report
- generated file
- trace export
- review evidence
- approval evidence

Each artifact should include type, source tool, session/run/message references, storage reference, MIME type, size, redaction/truncation state, provenance, retention policy, and type-specific metadata.

The UI should render artifacts with type-specific viewers: image viewer, diff viewer, searchable log viewer, report summary, snapshot viewer, and trace timeline.

## Observability Phasing

Use a phased approach. Start with the highest learning value.

### Phase 1: Structured tool activity

Capture and display:

- session, run, request, agent, and model
- tools called
- skill loads
- approvals requested
- artifacts created
- command duration
- success/failure state
- error category
- retry/repair attempts
- final outcome

Goal: answer "what did the agent do, where did it fail, and what evidence did it produce?"

### Phase 2: Debug details drawer

Add engineer-facing details:

- raw/redacted tool arguments and results
- trace ids
- policy decisions
- approval decisions
- token, latency, and cost where available
- normalized failure details

Default user view stays clean. Technical details are explicit and inspectable.

### Phase 3: Feedback loop analytics

Use structured events to identify:

- tools that fail frequently
- approvals that block progress
- missing capabilities
- repeated repair loops
- slow steps
- failing sensors
- agents that stop before completion
- common sandbox or Docker limitations

### Phase 4: Audit and compliance

Add deeper audit views:

- who approved what
- what data was exposed
- what external domains were visited
- what files were touched
- what commands ran
- what artifacts were retained or deleted

## Refinement Questions

Use these during future planning:

- What is the minimum viable skill package format?
- Which repository paths should be scanned for skills?
- How should discovered skill trust and activation work?
- What should a profile authoring interview ask for each agent type?
- Which capability groups are common to all agents?
- Which capabilities require explicit human approval to enable?
- How do profile restrictions interact with orchestration delegation?
- What artifact types are needed for the first operator-experience implementation?
- Which structured tool activity events should be captured first?
- What is the simplest UI that provides confidence without exposing raw system noise?

## Related Work

- `agent-platform-operator-experience`
- `agent-platform-capability-registry`
- `agent-platform-skill-authoring`
- `agent-platform-agent-profile-governance`
- `agent-platform-feedback-sensors`
- `agent-platform-ui-quality-sensors`
