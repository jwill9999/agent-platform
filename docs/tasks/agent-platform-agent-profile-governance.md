# Epic: Agent profile governance and orchestration scopes

**Beads issue:** `agent-platform-agent-profile-governance`  
**Spec file:** `docs/tasks/agent-platform-agent-profile-governance.md` (this file)  
**Type:** Epic

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-agent-profile-governance.md`

## Problem

Agents need role-specific behavior and safe capability scopes, but most users should not be expected to manually understand every harness security feature or write policy configuration by hand.

As the platform moves toward orchestration, profile governance becomes more important. A coordinator agent must not be able to bypass restrictions by handing work to a more privileged agent without policy review. Work handoffs need explicit rules for context sharing, capability inheritance, escalation, and completion verification.

## Product direction

Build a guided agent-profile authoring flow where the human describes what an agent is for and the system helps translate that intent into:

- role instructions
- allowed capability groups
- restricted capability groups
- approval rules
- sandbox limits
- data-access boundaries
- default tools and skills
- escalation behavior
- verification requirements
- orchestration handoff rules

The agent may recommend guardrails and scaffold policy, but humans must approve any profile change that increases power, reduces approval requirements, enables external access, allows mutation, or expands delegation.

## Relationship to other epics

| Related epic                         | Relationship                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `agent-platform-capability-registry` | Profiles consume capability definitions, policy metadata, and enablement state.              |
| `agent-platform-skill-authoring`     | Profiles determine which skills are available and under what constraints.                    |
| `agent-platform-operator-experience` | Profile authoring and policy review need human-readable artifacts, diffs, and decision logs. |
| `agent-platform-feedback-sensors`    | Profiles may define completion gates and feedback loops for each agent type.                 |
| `agent-platform-ui-quality-sensors`  | Verification/reviewer profiles may use UI evidence and grading sensors.                      |

## Initial task breakdown

Child tasks should be created after a refinement discussion with the owner. Likely tasks:

1. Define an agent profile schema for role, capabilities, restrictions, approvals, data scopes, and handoff rules.
2. Define standard capability groups for common agents and specialist agents.
3. Design guided profile authoring from natural-language intent.
4. Add profile preview artifacts: summary, policy map, capability map, decision log, and validation results.
5. Enforce profile scopes in skill loading, tool dispatch, artifact access, and external connectors.
6. Add orchestration handoff policy and context-sharing rules.
7. Add audit/observability events for profile changes, capability use, approvals, and delegation.

## Open questions

- What common capability set should most agents inherit?
- Which capabilities should require explicit profile-level opt-in?
- How should profile policy interact with task-specific approvals?
- Should receiving agents inherit delegator restrictions during handoff?
- What profile changes require human approval versus agent-only recommendation?
- How should profiles be versioned, tested, rolled back, and compared?

## Definition of done

- Users can define agent intent in natural language and receive a profile policy proposal.
- The proposal includes role instructions, capability scope, restrictions, approvals, and handoff rules.
- Users can review generated profile artifacts and approve activation.
- Runtime enforcement prevents profile bypass through tools, skills, artifacts, connectors, or delegation.
- Profile decisions and changes are observable and auditable.
