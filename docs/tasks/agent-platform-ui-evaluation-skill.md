# Task: Selective UI evaluation skill

**Beads issue:** `agent-platform-ui-evaluation-skill`  
**Status:** IN_PROGRESS; documentation/tooling implementation, not merged.  
**Owner direction:** 16 October 2026 side discussion: evaluate actionable local-MVP changes, select
checks by change type, and specify when gathered data informs decisions.  
**Branch:** `task/ui-evaluation` into `feature/ui-evaluation`, from staging `cf5f0452`.  
**Parent/dependencies:** Standalone developer-tooling task; no hard upstream or downstream edges.
Stop, monitoring and paused orchestration work retain their own scope and state.

## Requirements

- E01: A portable skill routes by actual change/consumer, rather than whenever the app starts.
- E02: Separate on-demand layout, accessibility and frontend investigation references; backend-only
  work uses existing API/diagnostic gates and documentation work uses document checks.
- E03: Each evidence class has a scope/reproduction, post-focused-test, failure-investigation and
  pre-completion use. Reuse valid existing evidence; recapture only what later changes invalidate.
- E04: Basic changed-control keyboard/name/focus/readability checks apply now. Broader accessibility
  audits run for an agreed audit, relevant broad redesign or observed repeated defects.
- E05: Chrome MCP is an optional Chrome investigation tool. Actual Electron/native claims use
  supported Electron/backend evidence; no unverified MCP Electron support or new mandatory tools.
- E06: Fix actionable in-scope defects; distinguish aesthetic preferences/hypotheses, deduplicate
  unrelated Beads findings, preserve required gates, stop once the scoped questions are answered.
- E07: Install the reusable skill in `/Users/letuscode/.codex/skills/ui-evaluation` as requested by
  the owner. Keep its versioned source in the repository, verify installed/source file hashes match,
  and keep Agent Platform-specific commands, Beads and acceptance rules in its existing QA skill.
  Other interfaces can copy/link the skill using their supported discovery mechanism; no unrelated
  interface configuration or tool installation is included.
- E08: Create and install `shared-tooling-setup` to make this user-level placement, versioned-source
  matching and requested MCP configuration workflow reusable. Verify discovery links under
  `~/.agents/skills` without replacing existing entries. MCP servers belong in the applicable
  Codex `config.toml`; a skill is not a server connection. No new MCP server is required or configured
  by this task. Keep credentials, existing connections and other interfaces untouched.

No runtime, tests, dependencies, unrelated global settings, debug ports, recurring automation, connector installation,
permission policy, paused work or merge authority changes. No UI audit or app test is executed merely
to validate documentation. Shared backend operations remain usable beyond the UI.

- E09: Install portable planning, implementation and critique skills under distinct `portable-*`
  names, preserving reusable requirements/tests/review/delivery guidance while leaving original
  project-specific skills and existing shared skills unchanged. Check relative links and installed
  source equality; do not invent independent reviews or execute their product workflows.

## Implementation and document manifest

The existing feature implementation skill already delegates connected QA to the Playwright quality
gate. Add one conditional link there and maintain each guidance item in a single place.

| Artifact                                                                                          | Purpose                                                           |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Skill](../../.agents/skills/ui-evaluation/SKILL.md)                                              | Module selection, evidence timing and disposition                 |
| [Layout](../../.agents/skills/ui-evaluation/references/layout.md)                                 | Scoped visual review and baseline interpretation                  |
| [Accessibility](../../.agents/skills/ui-evaluation/references/accessibility.md)                   | Changed controls now; broader audit selection                     |
| [Frontend investigation](../../.agents/skills/ui-evaluation/references/frontend-investigation.md) | Symptom-led Chrome/Electron/backend evidence                      |
| [Shared tooling setup](../../.agents/skills/shared-tooling-setup/SKILL.md)                        | Portable installation, discovery and requested MCP setup workflow |
| [Portable planning](../../.agents/skills/portable-feature-planning/SKILL.md)                      | Source-backed MVP requirements, feasible tests and review handoff |
| [Portable implementation](../../.agents/skills/portable-feature-implementation/SKILL.md)          | Authorized delivery, diagnostics and exact-head review/checks     |
| [Portable critique](../../.agents/skills/portable-plan-critique/SKILL.md)                         | Independent source-aware read-only assessment                     |
| [QA entrypoint](../../.agents/skills/playwright-quality-gate/SKILL.md)                            | Conditional integration with existing acceptance                  |
| This spec and [session handoff](../../session.md)                                                 | Requirements, actual validation and delivery state                |

Skill UI metadata lives in `agents/openai.yaml`; normal discovery remains enabled. No scripts or
runtime instrumentation are introduced. Full changed substantive documents need branch-specific
Notion mirrors/readbacks at the actual pushed source revision.

## Verification strategy

Run the Skill Creator validator, changed-file Markdown/formatting, relative-link and diff checks.
Review the following routing cases against the guidance as a desk review; this is not independent
agent forward-testing or execution of product tests:

| Case                                                      | Expected selection and decision                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Backend JSON serialization fix with unchanged consumers   | API/persistence/diagnostics; no visual modules                                 |
| Backend response changes a rendered error/action state    | Focused UI consumer journey; only affected visual/semantic checks              |
| Chat panel spacing/wrapping change                        | Layout at relevant sizes; reflow/readability accessibility if affected         |
| New approval modal/keyboard interaction                   | Functional Electron/browser path plus changed-control accessibility            |
| Slow provider response without renderer symptoms          | Backend diagnostic evidence; no speculative Chrome performance audit           |
| Reproduced renderer lag/layout shift                      | Short targeted frontend trace, relevant request evidence and retest            |
| Native picker/IPC change                                  | Actual Electron/backend gates; no browser-only proof of native behaviour       |
| Explicit screen-reader/accessibility audit                | Named surfaces/technology/criteria; scoped accessibility module                |
| Documentation-only change                                 | Document validation; no application tests or UI audit                          |
| Optional Chrome MCP unavailable during required UI review | Supported existing capture plus disclosed limits; no skipped required evidence |

No code files change, so runtime unit/build/E2E and Sonar code analysis are not applicable locally.
Normal hooks and actual hosted checks still apply to the PR. Do not substitute desk review for
independent review, create another agent from this side conversation, or claim application evidence.

## Definition of done and sign-off

The requirements and validation above pass; complete mirrors/readbacks and preservation are
verified; scoped commits are pushed; task-to-feature PR has no actionable unresolved findings and
all executed/required current-head checks pass. As a segment tip, this task remains IN_PROGRESS
until its actual owner-authorized feature merge is verified. Staging/main require their own grant.

Actual validation, publication and PR evidence will be recorded in Beads and the handoff. No merge,
full accessibility assessment or runtime qualification is claimed here. User-level skill installation
is separately verified against the versioned source; it does not imply a repository merge.

## Actual local verification

Skill Creator validation passes for the portable source and installed Codex copy. All thirteen source/installed file
SHA-256 values match across five skills. User discovery links resolve to the installed directories. Direct Markdown checks cover all eleven changed documents, including this
otherwise-ignored task spec; explicit formatting, relative skill references and diff checks pass.
The ten routing cases above passed a desk review, not independent agent forward-testing. No product
runtime or accessibility audit was performed. Normal hooks, source-bound full mirrors/readbacks and
the PR are delivery steps; their actual results are recorded in Beads after execution.
