# Session handoff

**Purpose:** short rolling handoff for the next agent or developer. Keep this file current, concise,
and actionable.

## Maintenance Rules

- Maximum target length: 160 lines.
- Keep only the current state, the last 3-5 meaningful iterations, and the next prioritized actions.
- Archive older detail before adding new detail. Current archive:
  [session-archive-2026-05.md](session-archive-2026-05.md).
- Do not paste long logs, full PR histories, or old task narratives here. Link to GitHub PRs, Beads
  tasks, docs, or archive entries instead.
- Each session update should replace stale content, not append indefinitely.

## Last Updated

- **Date:** 2026-07-17
- **Session:** Fixed Project Experience `.5` desktop visual regression coverage with
  platform-specific Project controls baselines after the Linux CI diagnosis.
- **Branch:** `jwill9999/project-experience-label-context`
- **Base:** `staging` at `e788063` after PR #239 merged

## Current State

**Merged Project Experience Foundation:**

- PR #236, PR #238, and documentation closeout PR #239 are merged into `staging`; their remote topic
  branches were deleted.
- Project Experience `.1`, `.2`, `.3`, and `.4` are closed in Beads.
- Workspaces exposes general Chat and one Coding Project entry with New project, Open folder, recent
  Project reopen, and explicit loading/error states.
- Opening a Coding Project lands in Project Chat with Project-bound session context.
- `Open local IDE` uses the selected Electron Project, supports configured/common IDE launchers and
  system folder fallback, and presents explicit unavailable states in browser-only contexts.
- User-facing Project navigation avoids `/workspace` and backend implementation terminology in the
  surfaces covered so far.

**Project Experience `.5` In Progress:**

- The relevance audit found most original scope already complete; remaining work was limited to the
  Project header, command availability copy, and terminal location chrome.
- Project Chat now uses a compact navigable Workspaces / Project / Chat breadcrumb and no longer
  shows an always-visible host folder path.
- Command readiness uses user-facing labels instead of runtime modes/messages, and the terminal
  header shows `Project root` instead of its absolute initial working directory.
- Focused web unit, browser Playwright, and Electron Project access tests pass locally. Reviewed
  Project and terminal control visual baselines pass locally; their first capture exposed and fixed
  a visually truncated `Project root` label.
- PR #240's first visual-baseline CI run passed browser E2E and application verification but exposed
  two stale Electron test definitions: Playwright rejected a non-destructured fixture argument, and
  the packaged VM scenarios still targeted the removed runtime-oriented status label. Both tests now
  use the current Playwright API and user-facing command status labels. The focused Electron run
  passes 3/3 locally under Node 24, including both visual baselines and the packaged VM ready/failure
  paths.
- The replacement Linux run then exposed a deterministic platform rendering difference for Project
  controls: Darwin is 647x52 and Ubuntu/Xvfb is 672x52. The test now selects a platform-specific
  Project controls baseline; the Linux image is the exact stable capture uploaded by CI. Focused
  Electron Project access passes 1/1 on Darwin under Node 24, and the pre-push desktop gate passes
  build, typecheck, dependency-cycle analysis, and 107/107 unit tests. Keep the Bead open until the
  new GitHub Actions run validates Linux and review is complete.

**Merged Verification:**

- PR #238 required checks passed: browser and desktop E2E, packaged macOS VM E2E, verify, Docker,
  CodeQL, SonarCloud, Promptfoo, dependency cycles, docs checks, GitGuardian, and Sourcery.
- Browser Playwright passed 21/21 with the CI two-worker configuration.
- Focused Electron Project access and Git workflow coverage passed 4/4 before merge.
- Manual QA confirmed local IDE handoff, development DevTools, and existing Project reopen behavior.
- The Promptfoo action is pinned to its Node 24-compatible `v0.1.8` commit. Its initial GitHub API
  `503` passed on retry and did not reproduce in the completed scan.
- The post-merge CodeQL run on `f1debb7` passed.

**Repository State:**

- Remote branches are `main`, `staging`, and the active PR #240 topic branch.
- `staging` is 48 commits ahead of `main`.
- Draft PR #240 is mergeable against `staging`, with required checks running.
- No open `staging` to `main` pull request was visible at this handoff.

**Context Optimisation:**

- Beads issue `agent-platform-context-optimisation` is now P1.
- Evidence added: a simple Beads question reused stale Coding session
  `bad6e0a5-d8e0-4eee-b94d-a2dc4c8f65da` with 87 messages and about 526k stored characters,
  including multiple very large tool outputs, causing OpenAI API TPM pressure.
- Current implementation has an 8k approximate context window, but still needs durable compaction,
  bounded tool-output replay, stale-session handling, explicit output-token caps, and clearer
  rate-limit/context diagnostics.
- Parked for now because self-hosted runner validation is unavailable; keep it as a P1 follow-up.

**Developer Diagnostics And Observability:**

- Beads issue `agent-platform-llm-observability-export` is now P1 and retitled
  `Add developer diagnostics and LLM observability export`.
- Spec now separates general app observability from agent/LLM observability:
  Electron/Next/API logs, request failures, metrics, traces, crashes, and desktop diagnostics vs.
  prompt assembly, context windows, memory retrieval, model calls, token usage, tool calls, and agent
  run timelines.
- Refinement gate added before implementation: choose concrete tooling, define data/redaction policy,
  environment controls, implementation increment, and Definition of Done.
- Candidate general observability stack: OpenTelemetry Collector, SigNoz, Grafana Loki/Grafana, and
  Sentry-compatible error tooling. Candidate AI observability stack: Phoenix, Langfuse, Helicone.

## Product Direction

- Current visible workspace surfaces are:
  - general Chat for assistant conversation and general tooling/app context;
  - Coding Project for folder/repository workflows with Git/GitHub, branches, terminal, previews,
    activity/evidence, and external/default IDE handoff.
- Automation, scheduled tasks, email/application workflows, docs/research workspaces, and
  generated-app workspaces remain deferred until their own product decisions and epics.
- The completed `.1` through `.4` chain establishes capability metadata, simplified navigation,
  Project Chat-first entry, and local IDE handoff.
- Generated previews and activity/evidence remain required before the Project Experience epic can
  close.

## Next

1. Monitor Project Experience `.5` PR #240 after the platform-specific visual baseline fix, and
   close the Bead only after required checks and review feedback are complete.
2. Continue the Project Experience chain with `.7` generated previews and `.8` activity/evidence;
   both are ready, while `.6` remains blocked on the remaining experience tasks.
3. Decide whether `agent-platform-context-optimisation` should interrupt the UI chain. It remains a
   P1 due to demonstrated stale-session replay and token-pressure failures.
4. Refine `agent-platform-llm-observability-export` before implementation; its tooling, redaction,
   deployment, and first-increment decisions are still open.
5. Keep macOS signing/notarization release tasks open until real signed and notarized artifact
   evidence exists; staging capability does not satisfy the production release hold.
