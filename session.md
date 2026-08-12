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

- **Date:** 2026-08-12
- **Session:** Implemented task `.7` Project Chat resource cards/viewer and refined its follow-on tasks.
- **Branch:** `task/project-experience-7`
- **Head:** `38a40d4` (`Add Project Chat resource previews`)

## What Happened

- Task `.7` now adds Project Chat cards for generated HTML, Markdown, PDF, and image resources,
  plus repository file/source and diff review. The viewer remains Project/session scoped and does
  not perform Git mutations.
- Focused API, harness, web unit/component, and Playwright coverage was added. Manual validation
  previously confirmed the interaction works as expected.
- Follow-on tasks are fully specified: `.15` secure Download/Save As, `.16` multi-tab previews,
  `.8` activity/evidence panel, and `.6` staged Project Experience E2E gate.

## Current State

**Merged Project Experience Foundation:**

- PR #236, PR #238, documentation closeout PR #239, PR #240, and closeout PR #241 are merged into
  `staging`; their remote topic branches can be deleted.
- Project Experience `.1` through `.5` are closed in Beads.
- The `agent-platform-electron-experience` epic is complete: all eight child tasks are closed.
- Workspaces exposes general Chat and one Coding Project entry with New project, Open folder, recent
  Project reopen, and explicit loading/error states.
- Opening a Coding Project lands in Project Chat with Project-bound session context.
- `Open local IDE` uses the selected Electron Project, supports configured/common IDE launchers and
  system folder fallback, and presents explicit unavailable states in browser-only contexts.
- User-facing Project navigation avoids `/workspace` and backend implementation terminology in the
  surfaces covered so far.

**Project Experience `.5` Complete:**

- The relevance audit found most original scope already complete; remaining work was limited to the
  Project header, command availability copy, and terminal location chrome.
- Project Chat now uses a compact navigable Workspaces / Project / Chat breadcrumb and no longer
  shows an always-visible host folder path.
- Command readiness uses user-facing labels instead of runtime modes/messages, and the terminal
  header shows `Project root` instead of its absolute initial working directory.
- Project and terminal control screenshots use explicit Darwin and Linux baselines; the Linux images
  are stable Ubuntu/Xvfb CI captures.
- The Project access flow now synchronizes on the Workspaces chooser readiness heading and uses the
  visible Project-header Workspaces action only when the sidebar leaves stale Project content.
- PR #240 passed every required check, including desktop E2E, and the staging packaged macOS VM E2E
  passed. It merged into `staging` as `2c3a227`; the merged topic branch can be deleted.

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

- `staging` includes merged closeout PR #241 at `b0ebd41`. Task `.7` is committed locally on
  `task/project-experience-7` and awaiting push/PR pipeline confirmation.
- Manual local validation now confirms normal typed input works without voice input, the terminal uses
  the correct Node version, and the Electron app can be started locally.
- The merged Project Experience topic branches may be deleted when convenient; no deletion is required
  for this handoff.
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
- The completed `.1` through `.5` chain establishes capability metadata, simplified navigation,
  Project Chat-first entry, local IDE handoff, and user-facing Project location/status context.
- Generated previews are implemented in task `.7`; activity/evidence, exports, multi-tab previews,
  and staged E2E remain before the Project Experience epic can close.

## Next

1. Push task `.7`, open/monitor its PR into `staging`, and close the Beads task only after required
   CI, E2E, SonarQube/Problems, and review checks pass.
2. Implement `.15` (secure Download/Save As) and `.16` (multi-tab previews), then `.8` (activity/
   evidence panel). Finalize `.6` once `.7` and `.8` are complete.
3. Keep `agent-platform-context-optimisation` visible as a P1 follow-up: its stale-session/token
   pressure is demonstrated, but its validation path remains parked on self-hosted runner availability.
4. Refine `agent-platform-llm-observability-export` before implementation; its tooling, redaction,
   deployment, and first-increment decisions are still open.
5. Keep macOS signing/notarization release tasks open until real signed and notarized artifact
   evidence exists; staging capability does not satisfy the production release hold.
