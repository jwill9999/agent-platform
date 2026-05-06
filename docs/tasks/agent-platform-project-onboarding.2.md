# Task: Implement read-only project assessment and gap analysis

**Beads issue:** `agent-platform-project-onboarding.2`  
**Spec file:** `docs/tasks/agent-platform-project-onboarding.2.md`

## Summary

Run an LLM-led read-only assessment when a Project is first loaded or refreshed. The assessment
should inspect the working tree, compare inferred facts with `AGENTS.md`, and decide whether
onboarding can be approved or needs collaborative follow-up.

## Requirements

- Assessment must only use read-only tools.
- Assessment must read root `AGENTS.md` when present.
- Assessment must inspect enough project structure to infer shape: key config files, package/workspace
  manifests, Docker/compose files, build/test scripts, docs, and nested `AGENTS.md` files.
- Assessment must support monorepos and identify likely apps/packages/services/subproject scopes.
- Assessment must return structured output from task `.1`.
- If the existing instructions are sufficient and consistent, assessment may recommend `approved`.
- If missing, vague, stale, contradictory, or ambiguous, assessment must recommend `in_progress` and
  return questions/recommended updates.
- Assessment reasoning must be visible enough for the user to understand why approval was or was not
  granted.

## Implementation Plan

1. Add a read-only assessment use case that collects bounded project evidence.
2. Build a prompt/context payload for the onboarding assessment LLM call.
3. Parse and validate structured LLM output.
4. Persist the result and update onboarding state according to transition helpers.
5. Add UI surfaces for assessment summary, evidence, gaps, and questions.

## Dependency Order

| Upstream                              | Downstream                            |
| ------------------------------------- | ------------------------------------- |
| `agent-platform-project-onboarding.1` | `agent-platform-project-onboarding.3` |

Keep Beads dependencies aligned with this table.

## Tests And Verification

- Task testing strategy:
  - Local gates: `pnpm build`, `pnpm format:check`, `pnpm lint`, and `pnpm test`.
  - Focused tests: read-only evidence collection, truncation, structured LLM-output parsing,
    invalid-output fallback, persistence, and missing/sufficient/insufficient fixture Projects.
  - Playwright: run first-load assessment flows for sufficient and insufficient fixture Projects;
    assert visible assessment summary, evidence, gaps, questions, and onboarding state.
  - CI: open the task PR, monitor GitHub Actions checks/logs/artifacts until green, and fix failures
    before closing the Bead.
- Unit tests for evidence collection boundaries and truncation.
- Tests for structured LLM output parsing and invalid-output fallback.
- Integration tests for missing, sufficient, and insufficient `AGENTS.md` fixture projects.
- UI tests for assessment summary/gaps/questions rendering.

## Definition Of Done

- [ ] First load can run read-only Project assessment.
- [ ] Assessment inspects Project evidence without writes or destructive commands.
- [ ] Assessment returns and persists structured status, evidence, gaps, questions, and recommended
      updates.
- [ ] Sufficient existing `AGENTS.md` can move onboarding to approved.
- [ ] Missing/insufficient `AGENTS.md` moves onboarding to in-progress with visible gaps/questions.
