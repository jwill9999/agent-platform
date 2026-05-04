# Epic: Agent-guided skill authoring

**Beads issue:** `agent-platform-skill-authoring`  
**Spec file:** `docs/tasks/agent-platform-skill-authoring.md` (this file)  
**Type:** Epic

The Beads issue description must begin with: `Spec: docs/tasks/agent-platform-skill-authoring.md`

## Problem

Skills are becoming a core way to give agents procedural knowledge they do not already have: project workflows, preferred patterns, domain rules, tool usage conventions, and repeatable quality gates. The current platform treats skills mostly as structured database records that expose prompt guidance and allowed tool identifiers. That is useful for lazy loading, but it is narrower than a full skill package.

Richer skill systems can include:

- concise trigger metadata
- model-facing workflow instructions
- deterministic scripts for repeated or fragile operations
- references that are loaded only when needed
- assets and templates used during output generation
- tests, examples, and validation criteria
- permission, sandbox, and risk metadata

Asking humans to manually decide all of those elements is brittle. A better product direction is for the user to describe the outcome they want in natural language, then let an agent collaborate with them to design, scaffold, validate, and maintain the skill within the platform's harness, security, and policy constraints.

## Product direction

Build an agent-guided skill authoring flow. The user should explain the capability they want, and the system should help decide:

- whether the request should become a skill at all
- whether the skill needs instructions only, or also scripts, references, assets, examples, or tests
- which agents should be allowed to use it
- which tools, MCP servers, browser tools, or system functions it depends on
- which permissions and approval policies apply
- how the skill should be validated before activation
- how future changes to the skill should be reviewed and audited

The agent should take more responsibility for skill quality, security, and policy alignment, while keeping the human in the loop for intent confirmation, risk acceptance, and final activation.

## Current platform model

The current implementation is DB-backed. Skills are represented by `packages/contracts/src/skill.ts` with fields such as `name`, `description`, `hint`, `goal`, `constraints`, `tools`, and optional `outputSchema`.

At runtime:

1. Skills assigned to an agent are summarized into lightweight stubs.
2. The stubs are injected into the system prompt.
3. The model decides whether a skill appears relevant based on the stub description and hint.
4. The model calls `sys_get_skill_detail` to load the full skill details.
5. Tool dispatch verifies that the skill is assigned to the agent before returning detail.

This is a useful lazy-loading mechanism, but it does not yet support packaged skill resources such as scripts, references, assets, examples, or validation suites.

## Target capability

Skill authoring should become a governed workflow, not a raw editor.

### Authoring flow

1. User describes the desired capability in natural language.
2. Agent asks focused clarification questions only when needed.
3. Agent proposes a skill plan:
   - trigger description
   - instructions
   - required tools
   - optional resources
   - permissions and risk profile
   - validation plan
4. User reviews and approves the proposed shape.
5. Agent scaffolds the skill package or DB-backed equivalent.
6. Agent runs validation against sample prompts and expected outcomes.
7. User approves activation.
8. Skill becomes assignable to selected agents or capability profiles.

### Package shape

A future skill package should be able to represent:

| Element           | Purpose                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| Manifest          | Stable id, name, version, description, trigger guidance, owner, compatibility         |
| Instructions      | Concise model-facing workflow and constraints                                         |
| Tool dependencies | Required system tools, MCP tools, plugins, browser tools, or connectors               |
| Scripts           | Deterministic helpers for repeated or fragile work                                    |
| References        | Optional deeper context loaded only when needed                                       |
| Assets            | Templates or files used to produce outputs                                            |
| Examples          | Sample user requests, expected behaviour, and failure cases                           |
| Validation        | Automated or manual checks before activation                                          |
| Policy            | Risk tier, sandbox needs, approval requirements, network/file access, audit behaviour |

### Security and governance

Skill-owned scripts must not bypass platform controls. Any script or function execution must be:

- sandboxed through existing runtime controls
- subject to path jail, network, and approval policy
- visible in observability/audit logs
- tied to a skill version and authoring trace
- reviewable before activation

The skill authoring agent may generate scripts, but activation should require validation and explicit approval when the skill introduces execution, network access, file writes, credentials, or external service access.

## Relationship to other epics

| Related epic                         | Relationship                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `agent-platform-capability-registry` | Skill packages should eventually become capability registry entries with compatibility, policy, and assignment metadata. |
| `agent-platform-operator-experience` | Skill authoring, validation, approvals, and audits need human-readable UX, not raw system payloads.                      |
| `agent-platform-feedback-sensors`    | Skills can encode feedback-loop workflows and sensor-specific repair guidance.                                           |
| `agent-platform-browser-tools`       | Browser tooling can be exposed as a skill dependency with policy-aware permissions.                                      |
| `agent-platform-ui-quality-sensors`  | UI/UX grading workflows may become skills with references, screenshots, and validation scripts.                          |

## Initial task breakdown

Child tasks should be created after a refinement discussion with the owner. Likely tasks:

1. Document the current skill runtime and gaps against packaged skills.
2. Define a Skill Package v1 contract and migration strategy from DB-backed skills.
3. Design governance for skill resources, especially generated scripts.
4. Add a natural-language skill authoring planning flow.
5. Add skill package validation and preview before activation.
6. Add assignment and capability-profile integration.
7. Add UI for authoring, review, validation status, and audit history.
8. Add import/export or repository-backed storage if local files become the preferred package source.

## Open questions

- Should skill packages live in the database, the repository, a workspace folder, or both?
- What is the minimum viable package format for v1 without overbuilding?
- Should generated scripts be executable immediately after approval, or require a separate review step?
- How should skills be versioned and rolled back?
- Should skill resources be shared across agents or copied per agent profile?
- How should the system evaluate whether a skill is useful, stale, duplicated, or unsafe?
- Should the authoring workflow reuse the capability registry UI or have a dedicated Skill Studio surface?

## Tests and validation expectations

When implementation tasks are created, they should include:

- unit tests for contract parsing and validation
- runtime tests for lazy loading and assignment policy
- permission tests for script/tool/resource access
- API tests for create/update/activate/deactivate flows
- UI tests for authoring and approval workflows
- manual scenarios for creating instruction-only and script-backed skills

## Definition of done

- The platform has a documented Skill Package v1 model.
- Users can start from natural language and receive a proposed skill design.
- Users can review and approve generated skill content before activation.
- Skill resources are validated and governed before use.
- Script/function execution from skills is sandboxed, auditable, and policy controlled.
- Skills can be assigned to agents or capability profiles.
- The system explains why a skill is available, unavailable, blocked, or unsafe.

## Refinement notes

Before implementation begins, run a refinement session with the owner to decide the v1 storage model, the minimum package elements, and the security posture for generated scripts.
