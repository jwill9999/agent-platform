# Disappearing replies — bounded local MVP plan

Status: owner-approved bounded plan; implementation authorized on 13 October 2026.
Source reviewed: staging `211916739642f5b095ba35100b3b452779969feb`, 13 October 2026.
Owner request: use Feature Planning, review the existing bug/current code, obtain a critic review,
and present a bounded plan before implementation. Subsequent owner question adds explicit inspection
of existing logging/observability and whether existing tests cover the race.

## Outcome and boundary

A completed reply must remain visible in its intended conversation. Opening a saved conversation
must not let a late history response erase a newly submitted turn or leak state from another session.
This is one existing bug, `agent-platform-sizx`, with one integrated verification owner; no new epic.

Recommended MVP: briefly disable submission while the selected session's history AND pending
approvals load, then allow one operation at a time. Keep session-scoped asynchronous results from
changing another session. Show loading and recoverable restoration failure clearly. This deliberately
serializes initial restoration rather than adding a transcript merge/synchronization subsystem.
The historical acceptance wording mentions overlapping submission; reproduce that failure on the
baseline, then prove the repaired UI refuses premature submission and permits it after restoration.
A hook-level guard remains mandatory; disabling a button alone is insufficient.

## Source findings

- `apps/web/hooks/use-harness-chat.ts:556–610`: restoration replaces messages at line587,
  then loads approvals separately. A boolean cleanup protects old history requests after effect
  cleanup, but there is no restoration readiness exposed to callers.
- `sendMessage` at line729 appends a random-ID assistant placeholder; final publication at line615
  maps only an existing ID. A later history snapshot can remove that ID. History failure also clears
  messages. Do not solve this by blindly appending missing assistant IDs across sessions.
- Stream callbacks, approval decisions and their catch/finally state updates lack complete active
  session/operation ownership checks. The diagnostic session ref guards only selected diagnostic writes.
- `apps/web/app/page.tsx:1403–1450`: Send is gated by session/model/approval, not restoration;
  attachment clearing occurs immediately. `components/chat/chat-input.tsx:83–89` clears its draft
  after a void callback. `components/ide/ide-with-chat.tsx:2598–2611` also clears immediately and uses
  the same hook without resume. These callers must honor refusal without losing draft/attachments.
- `apps/web/test/use-harness-chat.test.ts` covers parsing/approval helpers, not mounted asynchronous
  lifecycle. Existing context E2E fixtures wait for restored history/enabled submission and therefore
  do not prove this race fixed. Earlier evidence records a persisted final assistant and three reads
  despite a missing visible reply; it is historical evidence, not a fresh reproduction this turn.
- `app/page.tsx:1037–1055`: requested-session Project reopen calls `openProjectChat`, which resets
  `isResuming=false`, then selects the saved session without setting it true. Include saved-session
  links/reopen, menu selection and reusable-session paths in the caller repair; only genuinely new
  sessions skip restoration.
- React's [effect guidance](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
  documents discarding stale responses and cleanup stress testing. Modern Web Guidance search yielded
  no directly applicable race recipe; no library/global skill update is proposed.

## Requirements

| ID    | Required outcome                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-R1 | A selected resumed session is not sendable until both history and pending approvals succeed. Loading is visible; keyboard, click and direct hook submission are guarded. All saved-session entry points (including requested-session links) restore; genuinely new sessions initialize without an unnecessary history fetch. |
| CR-R2 | Each accepted send/resume owns its session generation and operation. Old history, streams, approvals, errors and finally callbacks cannot replace current messages, metadata, diagnostics or busy state, including A→B→A. One active operation per hook instance; no automatic replay.                                       |
| CR-R3 | A same-session premature/duplicate submission is refused without clearing its draft or attachments. Restoration error/timeout is explicit, keeps submission blocked, and offers a manual Retry history action. A retry does not send a message or execute a tool.                                                            |
| CR-R4 | Normal final replies match persisted assistant content and remain present once, including after reopening. Approval cards remain usable, pending approvals block sends, approve executes once, reject executes zero times. Existing context-limit refusal and MCP not-completed semantics remain unchanged.                  |
| CR-R5 | Browser and Electron deterministic race evidence connects UI/network ordering, SQLite state and existing safe diagnostic request/session records. Logs alone are not proof of visibility; disclose unavailable/dropped telemetry.                                                                                            |

### Approved implementation choices

Use a small session lifecycle inside the hook (unbound/restoring/ready/restore-error), with a
monotonic generation and per-operation token. Readiness must be derived against the current session
identity even before the new effect runs. A→B→A must not revive A's earlier generation. Guard all
asynchronous publications and stale caller callbacks, not only final text. Reset/hide session-owned
message/event/error/busy data together when the selection changes. Retain existing final-answer-only
rendering; adding progressive token display is out of scope.

Load history and approvals as one readiness transaction. Commit them only for the current generation.
Bound the combined restoration to 15 seconds; a hung fetch moves to visible retryable failure.
Abort obsolete restoration reads where the existing fetch interface supports it; generation checks
remain the correctness boundary. Retry invalidates the prior generation and repeats reads once at
user request. No automatic retry loop. Do not reset successful active-turn state with a late restore.

Submission admission must synchronously return accepted/refused plus the existing asynchronous
completion (or an equivalent explicit contract). Only accepted submission clears draft/attachments.
Use the same synchronous operation guard for send and approval decisions; React render state alone
must not admit two submissions in one tick. Both Home/Project Chat and the existing IDE caller honor
that contract. No new IDE features. Normal intentional navigation keeps the current draft-reset policy;
this bug does not add cross-session draft storage.

Navigating away invalidates display ownership; it does not claim to cancel a server run. Do not abort
an accepted POST and automatically replay it. Drain/ignore stale responses without applying UI state;
the server may finish and persist the original operation. Reopening retrieves its durable result when
complete. Server cancellation, cross-window concurrency and durable resumable streams are excluded.
Parent post-send refresh callbacks must check current ownership before mutating the selected Project.

## Logging and evidence: reuse V1

No new telemetry service, dashboard, schema or prompt logging is needed on current evidence. Correlate
existing request/session IDs, model/tool timing and terminal outcome with Playwright network ordering
and independent SQLite inspection. V1 does not currently record React hydration commits or prove
that a message was painted. Capture restore-start/release, send admission, completion and rendered
text in test evidence. Use safe synthetic markers; do not add conversation contents to diagnostics.
A no-send attempt during restoration must produce zero chat/provider/tool effects; absence of a run
record alone is not proof, so independently count HTTP POSTs and database/audit deltas.

The old Docker context test explicitly records diagnostics unavailable in that topology. Reuse the
native managed-runtime fixture with its existing server-side diagnostic capability for Electron AND
a separate real Chromium page, as demonstrated by `diagnostic-export.e2e.ts:95–120`. Do not expose
that capability to the renderer or disable authentication. Retain normal Docker browser CI separately.
The required joined diagnostic evidence must come from the supported topology, not be silently skipped.

## Non-goals and stopping point

No backend persistence migration, provider/NDJSON contract change, general event bus, cache framework,
transcript merging, streaming UI redesign, auto-resubmit, global logging expansion, multi-user sync,
new account/service, paid model call or distribution qualification. Do not absorb API blocking checks,
keyless local-model selection, Git UX or hook-baseline bugs. Paused orchestration, PR283, main and
unrelated dirty worktrees remain untouched.

Stop after CR-T01–08 and relevant quality/review gates prove this bounded bug fixed. If a backend or
wire protocol change is necessary, document why this boundary fails and return that material scope
change for discussion rather than quietly expanding. Budget estimate: 1–2 focused developer days
for implementation and deterministic tests, plus roughly half a day for review/publication; hosted
queues vary. If no reliable reproduction after half a day, inspect retained traces and report the
missing evidence before extending the investigation. These are estimates, not a time-based waiver.

## Task, dependency and document manifest

| Item                    | Mapping                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Existing standalone bug | `agent-platform-sizx` — Preserve visible chat replies while Project session history is restoring                                          |
| Origin relationship     | `discovered-from` closed `agent-platform-context-optimisation`; not a blocking edge or parent epic. No new hard prerequisite found.       |
| Owner                   | Native implementer owns all CR requirements and final integrated verification; a distinct critic reviews source/plan.                     |
| Checkout                | `/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`                                                               |
| Planning branch         | `task/chat-reply-reliability-plan`, from actual `feature/chat-reply-reliability` at staging21191673                                       |
| Proposed next branch    | `task/chat-reply-reliability` from the pushed planning tip; does not exist yet.                                                           |
| Delivery                | Cumulative task tip → `feature/chat-reply-reliability` → protected `staging`; no PR or merge authorized in this planning-only assignment. |
| Canonical spec          | [agent-platform-sizx](../tasks/agent-platform-sizx.md)                                                                                    |
| Verification            | [Scenarios and gates](../testing/chat-reply-reliability.md)                                                                               |
| Critique/results        | [Planning review](../reviews/chat-reply-reliability.md)                                                                                   |
| Handoff                 | [session.md](../../session.md)                                                                                                            |
| Existing architecture   | [Native development ADR](../adr/0005-native-codex-development.md); no architectural change proposed.                                      |

Expected implementation areas: the hook; `app/page.tsx`; `components/chat/chat.tsx` and
`chat-input.tsx`; bounded existing IDE caller adaptation; hook lifecycle helper/tests if useful;
test-only `apps/web/package.json`/lockfile and per-file Vitest DOM environment;
new browser `e2e/chat-reply-reliability.spec.ts` and desktop
`apps/desktop/e2e/chat-reply-reliability.e2e.ts`, with narrowly shared test fixtures. Names are proposed,
not claims of existing tests. No runtime API/DB/security-policy change expected.

## Feasibility and current results

On13October: Docker engine29.8.0 reachable, macOS ARM64 host, Electron executable and Chromium1217
cache present; existing managed API/SQLite, standalone renderer and deterministic loopback provider
fixtures inspected. Dependencies already installed. Existing fixture uses an isolated disposable Git
Project with no remotes, private runtime/SQLite/profile, owned ports/processes and network guard;
reuse those boundaries. Web Vitest currently uses the Node environment and has no DOM test package. Plan one Node24-compatible
`jsdom` dev dependency, locked during implementation, and React19 `act`/`react-dom/client` to mount
the actual hook in a per-file DOM environment. Keep existing Node tests unchanged; no runtime
dependency or global Vitest environment change. No cloud credentials or paid calls required. Build artifacts/ports/services
must be refreshed at implementation time; a present executable is not a passing test.

This planning turn does not start services, run the product journeys, reproduce the bug anew or
install tooling. Required test outcomes are not-run. Documentation validation/critic/publication
results belong in the linked review, and Beads remains in progress until actual delivery gates pass.
