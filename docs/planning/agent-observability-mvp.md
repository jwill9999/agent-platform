# Agent diagnostics MVP — implementation proposal

Status: planning proposal for final owner review; no runtime implementation authorized or started.
Date: 11 October 2026. Source inspected: staging `7814b59845b52ad5f850bfc99b7baee0e6742a25`.

## Outcome and stopping point

A developer or support engineer can inspect one chat request, understand its model/tool steps,
identify the slow or failed step, and share the same safe evidence with an agent. An app user can
save a diagnostic report from the packaged app and manually attach it to a support ticket.
The report must disclose missing evidence rather than inventing a complete history.

Stop after the connected journeys in the verification plan pass. This increment does not build a
dashboard, a telemetry platform, or a new execution coordinator. It does not close the broader
observability parent, implement new recovery semantics, or resume paused orchestration.

## Owner decisions

The owner agreed foundation first, configurable seven-day retention, local SQLite behind a small
storage adapter, and external-model compatibility. The app remains local and single user without
platform accounts. External provider requests are separate from sharing diagnostics with support.
The owner subsequently agreed a small export action as the practical human support workflow.
No diagnostic upload, account creation, third-party installation or paid model experiment is required.
The owner requested the final written plan and independent critique before implementation begins.

## Manifest and scheduling

| Responsibility                                      | Beads identity                            | Artifact / delivery                                                                 |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Broader feature                                     | `agent-platform-llm-observability-export` | Existing parent remains open; later tracing/dashboard/exporter obligations retained |
| This bounded MVP, including integrated verification | `agent-platform-harness-v1`               | [Canonical task spec](../tasks/agent-platform-harness-v1.md)                        |
| Required tests                                      | V1 implementation owner                   | [Verification plan](../testing/agent-observability-mvp.md), scenarios T01–T12       |
| Independent planning review                         | Distinct plan critic                      | [Findings and dispositions](../reviews/agent-observability-mvp-plan-review.md)      |
| Session handoff                                     | Coordinator                               | [Session](../../session.md)                                                         |

Repository: `jwill9999/agent-platform`. Clean planning worktree:
`/Users/letuscode/.codex/worktrees/codex-developer-autonomy/agent-platform`.
The planning branch is `task/observability-mvp-plan`, from `feature/agent-observability`, based on
source staging above. Both are new, separate from the four paused orchestration refs.
After owner acceptance, proposed implementation segment tip `task/diagnostic-event-foundation`
branches from the pushed planning tip, carries this plan, and opens one PR to
`feature/agent-observability`. It does not yet exist. Eventual feature promotion is to protected
staging under actual owner merge authority and current gates; main is excluded.

Beads currently retains the blocking edge from `agent-platform-harness-review-gate` to V1.
The final owner implementation decision should reconcile only this V1 edge and record that scoped
decision, leaving the broad historical gate open for unrelated work. Until then V1 is open and
planning-only, not schedulable implementation. No framework migration, F0/F3, paused pilot, V2/V3
or full activity panel is a prerequisite for this current-stack slice. Existing downstream edges
stay recorded; their closure/readiness is not implied by this proposal.

## Requirements and acceptance

| ID  | Requirement                                                                                            | Observable completion                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Unique trusted request identities before validation, linked session/run/operation/attempt observations | Concurrent equal caller IDs cannot collide; pre-run failures have request-only reports; retries/resume distinguish attempts                       |
| R2  | One versioned safe metadata projection for diagnostic logs, persistence, reads and exports             | Canary secrets and free-form payloads absent at every sink; unknown fields rejected                                                               |
| R3  | Durable ordered local history through a minimal storage adapter                                        | Restart retains acknowledged events; duplicate handling, scoped cursor and SQLite conformance pass                                                |
| R4  | Bounded retention, storage, queue and outage behavior                                                  | Seven-day default configurable; limits enforced; loss/freshness visible; telemetry outage cannot block or change execution                        |
| R5  | Readable run report and machine-readable safe data, including focused backend logging                  | A human and agent can locate known slow/failing steps from the same report without developer tools                                                |
| R6  | Small explicit export action in browser and packaged desktop                                           | Actual saved file inspected; cancellation writes nothing; invalid scope/IPC denied; no automatic outbound submission                              |
| R7  | Preserve execution authority and truthful state                                                        | Waiting is distinct from running, disconnection and unknown after restart; no fabricated success, automatic replay or changed permission behavior |

## Source-backed implementation boundary

The existing pieces are useful but not a composed diagnostic history:

- `apps/api/src/infrastructure/http/correlationMiddleware.ts` accepts/echoes caller correlation;
  `packages/logger/src/context.ts` propagates it. It is not a unique trusted request key.
- `apps/web/app/api/chat/route.ts` validates before forwarding, without consistently carrying
  correlation. BFF failures and direct API entry both need their own trusted attempt identity.
- `packages/plugin-observability/src/events.ts`, `observability.ts`, `store.ts` provide events,
  partial sanitization and bounded memory. The logger currently receives the original event while
  the store sanitizes a copy. New diagnostic projection must occur before either sink.
- `packages/harness/src/trace.ts` supplies model/tool/retry/approval observations. Add metadata
  mapping at existing hooks; do not replace the harness or introduce execution transitions.
- `apps/api/src/infrastructure/http/v1/chatRouter.ts` creates runs after several failure points,
  has protected plugin callbacks and existing approval/resume claims. Keep these authorities.
- `packages/db/src/repositories/toolExecutions.ts` persists tool timings alongside raw args/results.
  Reuse safe timing/status identifiers; never bulk-export these rows or copy their raw payloads.
- `apps/web/components/chat/chat.tsx` has an accessory area; `apps/web/hooks/use-harness-chat.ts`
  owns chat observations. Add one compact export control beside current-session actions.
- `apps/desktop/src/main/workspaceResourceExport.ts` provides a tested Save As pattern. Add a
  separate validated diagnostics IPC request in main/preload contracts, not an arbitrary file writer
  or a fabricated Project workspace URI. Use the existing main-process dialog boundary.

Expected source areas: the files above; `packages/contracts/src/` for diagnostic schemas;
`packages/plugin-observability/src/` for projection/store interface/report formatting;
`packages/db/src/` and API infrastructure for SQLite adapter lifecycle; API/BFF diagnostic read
routes; web chat action and hook; desktop main/preload validation and tests. No unrelated
runtime policies, credentials, dependencies or paused workflow-control implementation changes.
A focused SQLite worker entry may be needed to isolate the synchronous driver; it belongs only to
this store, not a general worker framework. No new database dependency is planned.

## Identity, events and interpretation

Generate a server-owned UUID at BFF entry before parsing; direct API ingress generates its own
unique UUID. Treat all forwarded headers as untrusted metadata: bound caller correlation to 128
safe characters, omit invalid values, and never use it as a primary key, lookup credential or
execution claim. The API request ID is authoritative for its records; echo it through the BFF when
available and retain the BFF ID as a link. A BFF-only error has no fabricated session/run identity.

A schema-v1 record has a random event ID, process instance ID, scoped request/session/run IDs when
known, diagnostic operation ID and attempt number, optional parent operation ID, phase/event enum,
UTC observation time, monotonic duration when measured, outcome/error-code enums and bounded safe
numeric metadata. Existing execution/tool IDs may be linked but remain separate authorities.
Provider/model identity uses an internal configured ID plus recognized provider family; arbitrary
custom model names, endpoints and user-entered labels are omitted. Tokens are optional known counts,
not guessed zeroes; no billing estimates. Tool identity is a registered internal identifier, never
an arbitrary command or tool argument. No free-form error message, stack, URL, path, prompt, message,
file content, credential, header or tool result enters this diagnostic envelope.

A model retry is another attempt within one observed operation. A resumed approval request creates
a new ingress/run observation linked to the existing approval/operation identifier only when actual
source evidence supports that link. Unavailable links are reported as unknown. Final task callbacks
must not turn approval-wait into completed operation success. Only observed terminal outcomes are
terminal. After backend restart, unfinished prior-instance work is shown as unknown/interrupted
observation, never automatically resumed. Connection loss and heartbeat age indicate freshness,
not execution failure. Total elapsed time and measured step durations may overlap; do not sum them
into a false total or infer unobserved queue time.

## Storage, retention and failure behavior

Use a separate local `diagnostics.sqlite` alongside application data, keeping execution/control
transactions and existing raw tool records untouched. SQLite is suitable for this desktop MVP,
including production desktop use. A future hosted backend requires another adapter and migration;
it is not just a URL setting. Docker is a deployment option, not a storage adapter.

Interface: open/version check, append batch, query by explicit scope and opaque cursor, prune,
health snapshot and close. SQLite is the only implementation. A reusable adapter conformance suite
is required; no plugin discovery or second backend is built. Append assigns a persistent increasing
sequence atomically. Same event ID and same canonical content is idempotent; different content is
rejected and counted as a diagnostic conflict. Page snapshots capture a maximum sequence; cursors
bind scope and snapshot, and invalid/cross-scope cursors fail. Pruned cursors return an explicit
expired-history response with the earliest available sequence, not silently incomplete success.

Proposed defaults: seven days (configurable 1–90), 10,000 retained events (100–100,000), 4 KiB encoded
per event, 256 pending events, batches of at most 32, 250 ms flush timer. Settings are documented
startup configuration `DIAGNOSTICS_RETENTION_DAYS` and `DIAGNOSTICS_MAX_EVENTS`; desktop supports the
same values in its local config file read at startup, requiring restart. No settings screen is
needed in this increment. Validate values; malformed diagnostic configuration disables only this
store with a safe visible reason and documented repair, not application boot.

Writer I/O runs off the request execution path. Use the existing SQLite driver in a small worker
so busy waits, migration and pruning cannot block the main event loop. Zero SQLite busy timeout;
one bounded retry on the next flush, then count loss. Keep main/worker pending acknowledgements
inside the same 256-event bound. No synchronous filesystem fallback from a chat handler. Unknown
schema or failed migration disables diagnostics without changing control storage or execution.
Flush on orderly shutdown has a one-second deadline; abrupt termination can lose only unacknowledged
queue entries. Report this limitation. Stored records and stream watermark/health are distinct.

Prune oldest records by age or event count on startup and after append batches. Use rollback journal DELETE mode, not WAL, for this one-worker store. Fix page size at 4 KiB and
max_page_count at 16,384 (64 MiB including indexes). One bounded writer transaction runs at a time;
no attached database, persistent journal or full VACUUM. The rollback journal copies at most the
bounded database pages plus headers: budget 66 MiB for it and 130 MiB total database/journal footprint.
Reject incompatible existing page size/mode; startup recovery finishes before enabling writes.
Report reads run in the same worker, materialize bounded pages, close transactions before sending
results and have a 200 ms deadline. External held readers cause SQLITE_BUSY immediately; after the
single retry, lose diagnostics visibly rather than grow a queue or wait on the request thread.
Allocation/journal failures disable appends with a storage-limited state. Test actual transient
file sizes with an active/held transaction, journal recovery and disk errors, including platform
variation; if the stated bound cannot be established, correct the adapter before claiming R4.
Physical bounds are not inferred merely from row count.
Retain minimal sequence/loss/prune counters, not old event bodies. Decreasing limits prunes on next
maintenance; increasing retention does not restore deleted history. Queue overflow increments
counters and exposes degraded coverage; a subsequent successful flush persists the gap summary.
After crash, unconfirmed recent coverage is marked uncertain even if no loss counter survived.
Local permissions follow app-private data defaults; report exports are deliberately user-shared.

## Human report and export

The current API defaults to a wildcard listener and has a no-auth stub; those are not sufficient
protection for diagnostic reads. Enable diagnostic read/export routes only in an explicitly
configured loopback deployment. The managed desktop already binds its API to 127.0.0.1; desktop
main supplies a new per-launch 256-bit random capability to its managed backend via private child
environment. It stays in main/server memory, never renderer, logs, query strings or export. Routes
require that capability, an actual loopback peer and an exact configured loopback Host; ignore
forwarded identity/host headers and deny missing/invalid capability before touching the store.
Remote/custom unmanaged backends have diagnostics export disabled unless the local development
configuration supplies this same boundary; no general authentication system is introduced.

For browser development, diagnostics is enabled only when both API and web are explicitly launched
on loopback with the same private server-only capability. Add an explicit launch/config assertion;
do not infer loopback binding from a URL alone. Wildcard/remote deployments fail closed for these
routes. The BFF checks exact configured local Host and Origin (reject missing/null/foreign Origin
for browser report POST); requires the same-origin fetch guard, does not enable CORS, validates
scope, then adds the private capability to its loopback upstream request. Browser report downloads
use that POST response. Direct CLI/main callers use the private capability, not browser exceptions.
No NEXT_PUBLIC value, cookies/session-login feature or renderer-readable token is added.

Within the one local installation, session/run scopes are validated against real records: an
explicit session+run pair must match, request-only lookups use their own trusted key, and a cursor
cannot change scope. There is no claim of per-account isolation within this single-user store;
remote or cross-installation access is denied at the transport/capability boundary. Existing
trusted IPC sender checks apply to every diagnostics bridge call. A small repository CLI wraps the
same read-only report API to list runs or output text/JSON for developers. CLI is convenience;
packaged users need no shell, source checkout, Node install or account.

The app action is labeled **Export diagnostic report** for the current session or latest failed
request. Explain that it includes safe technical metadata and is saved locally for manual sharing.
No prompts or user content; no automatic send. Produce one UTF-8 `.json` document containing
`schemaVersion`, a readable `summary`, ordered safe `events`, scope/version/platform-family metadata,
coverage/freshness/gap information and known timing/error categories. The UI explains that support
can read the summary or give the same file to an agent. No ZIP dependency or HTML script content.
The summary lists slow observed steps and failures, not automated recommendations or fixes.

Bound reports to 1,000 events and 5 MiB; disclose truncation and the query window. Capture a stable
sequence upper bound so active writes cannot silently change the exported selection. The current
session is the default; validate every requested scope through existing access rules. Request IDs
are not authorization. Never trust a renderer-selected destination path or remote fetch URL.
Desktop main chooses a Save As path and fetches a validated scoped report from its configured local
backend; renderer sees basename only. Browser uses a same-origin download. Revalidate safe schema
at the export boundary; cancellation, fetch failure and write failure are separate visible outcomes.

If a request fails before reaching the API, retain only its minimal safe BFF/UI failure observation
for the current view and allow a clearly labeled partial report through the same schema. For
packaged backend-unavailable export, a separate typed partial-failure IPC request accepts only a
UUID attempt ID, finite timestamp/duration and fixed phase/error-code enums, capped at 1 KiB.
Main checks the trusted sender, rejects unknown fields, constructs the report itself through the
same safe projector, labels source current-view/unverified/non-durable, and uses Save As without
fetching the backend. No arbitrary report body, URL, path, session ID or free-form text is accepted.
The browser builds the same bounded partial report locally. These observations are reported as
client evidence, not trusted API history. This path is not restart-durable; no session inference
from submitted text. If the entire app/backend is unavailable
and no safe current-view observation exists, show diagnostics unavailable with manual troubleshooting
instructions. No promise to recover absent history or inspect another person's installation remotely.

## Verification, effort and release boundary

T01–T12 in the linked verification plan are mandatory for this V1 scope. These are planned tests,
not reported passes. The implementation owner also owns the final composed success/failure report
exercise; it is not deferred to V5 or a future dashboard task. Preserve existing permission, duplicate
resume, cancellation and persistence regressions. Actual hosted quality/security checks, detailed
Sonar/CodeQL findings and resolved reviews remain required for any later protected delivery.

Estimate: **4–6 focused engineering days**, excluding owner response and hosted CI queue time:
identity/projection 1 day, store/lifecycle 1–2, report/CLI/export 1–2, integrated verification/repairs
1 day (some test work accompanies each slice). This supersedes the old provisional 1–2 day envelope-only
estimate. It is an estimate, not a deadline. Review progress after two days: if a request→model→tool
report is still not demonstrable, report the concrete blocker and revised estimate before expanding
scope. Do not silently grow into generalized infrastructure. After two unsuccessful approaches to
the same architectural obstacle, stop that approach, obtain focused critique and escalate only a
material scope/delivery decision. Routine fixes continue within the agreed scope. Paid provider
budget is zero; use deterministic provider doubles and disclose that live provider behavior is unverified.

No new subscriptions/logins/downloads are needed for V1 beyond existing development prerequisites.
The agent handles authorized local configuration and tests after implementation agreement; the
owner retains any future account sign-in, verification, subscription and billing decisions.
SigNoz/Phoenix remain phase-two candidates to evaluate later, not a selected dependency.

## Deferred and preserved

Full activity dashboard/history browsing UI, OTLP/OpenInference exporter, third-party dashboards,
central account/telemetry service, automatic ticket submission, cross-user querying, additional
storage backends, generalized logging across every route, advanced analytics, execution intent
journals and new recovery/cancel semantics are deferred. Existing broader V2–V5/parent requirements
remain recorded. Paused PR283 and its four retained branches and all dirty/unrelated worktrees stay
separate. No code, release, staging merge or test execution is implied by publishing this plan.
