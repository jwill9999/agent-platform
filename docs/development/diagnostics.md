# Local diagnostic reports

The diagnostics MVP provides the local workflow below under
[the approved task](../tasks/agent-platform-harness-v1.md). See the
[implementation results](../reviews/agent-observability-mvp-results.md) for actual verification and
remaining delivery gates. Checkout-free distribution verification remains release work.

## Inspecting a problem

In the connected desktop app, choose **Export diagnostic report** for the current chat session.
The app asks where to save the file. The report contains a readable `summary` and structured
technical events in one JSON file, suitable for you or an agent to inspect. Attach the file to a
support ticket only when you choose to share it. Export does not submit or upload it.

A report can identify requests, model/tool phases, attempts, timings, failures and waiting states.
It excludes conversation contents, tool arguments/results, API keys, file paths, raw exceptions
and custom provider/model labels. A provider is recorded as a fixed family; unknown names become
`other`. Overlapping durations are not added together as total elapsed time.

Check the report's coverage fields before interpreting it: queued, dropped, conflicting or expired
events can leave gaps. Idempotence and content-conflict detection cover retained events only;
after pruning, an event ID may be recorded again with a new sequence. This is not execution
deduplication or permanent audit storage. An unfinished event from an earlier process has unknown status after restart.
A connection loss does not prove an action failed. If the backend is unavailable, a partial report
can contain only the current view's safe failure observation; it is explicitly unverified and
non-durable. Missing events do not prove an action did not occur.

A browser connected to the supported local web/API topology offers a manual file download. The
normal Docker split-network deployment does not currently meet this topology and therefore cannot
read diagnostic history. This restriction does not block normal chat operation.

## Model connection probes

The [provider compatibility work](../tasks/agent-platform-model-connection-diagnostics.md) adds
request-scoped settings-probe events to the same durable local history. **Models → Test Connection**
performs one bounded SDK generation request, with no retries. A real external service may charge for
that user-initiated request. A successful authentication check alone is not a successful generation.
A valid response with no visible reply within the fixed output budget reports `output_limited`;
it does not establish an invalid key or an unusable model for normal chat.

Probe events contain fixed provider family, configuration UUID, request/operation identity, duration
and safe outcome/failure category. They exclude credentials, endpoint, prompt, raw provider response
and private reasoning. A rejected parameter response remains failed; an accessible message is shown
in Models rather than relying on a tooltip. Storage/logging failure cannot turn a failed probe into
success or change the provider outcome.

Settings probes have no chat-session scope. A current-chat export therefore does not automatically
include them. Export an application-wide historical window without a session filter through Local
monitoring, or use the developer-operated `list` and `report --request` commands below with their
existing local capability requirements. Check coverage/loss before interpreting missing events.
Reports remain local until the owner chooses to share them; no automatic transmission is added.

## Context decisions

The context/token MVP branch adds optional V1 context-decision metadata; it remains under
[implementation verification](../tasks/agent-platform-context-optimisation.md). Existing V1 records
stay readable. A context event records the estimator and effective-policy versions, configured and
effective input allowances, estimated before/after input and schema cost, included/omitted group
counts, output cap and a fixed decision reason. It contains no prompt, tool name, argument, result,
working-memory content, file path or custom model label.

`unchanged` and `windowed` describe admission. `required_overflow` and `invalid_history` describe a
local rejection. Rejection does not create a model-attempt event. Actual retries remain separate
attempts of a model operation. Estimates are not provider-reported usage; a length-limited model
response is incomplete, even if it includes partial text. Check request/operation identity and
coverage before interpreting absent attempts or comparing totals.

## Local configuration

Desktop manages a per-launch private capability and loopback service addresses automatically.
Its API stores a separate `diagnostics.sqlite` beside the application database. Starting the app
with these environment settings changes retention without a new settings panel:

| Setting                      | Default | Allowed values           |
| ---------------------------- | ------- | ------------------------ |
| `DIAGNOSTICS_RETENTION_DAYS` | 7       | Whole number, 1–90       |
| `DIAGNOSTICS_MAX_EVENTS`     | 10000   | Whole number, 100–100000 |

Invalid settings or a storage failure disable/degrade diagnostics, rather than blocking agent
execution. The database has a 64 MiB page limit and a 66 MiB rollback-journal budget. Record count
and retention are additional bounds, not a guarantee that every event fits. Events awaiting an
acknowledgement can be lost on a crash. Reports expose that uncertainty.

For a developer-operated API, explicitly bind `HOST=127.0.0.1` (or `::1`), set `DIAGNOSTICS_HOST`
to that exact address and port, and supply a private `DIAGNOSTICS_LOCAL_CAPABILITY` consisting of
64 lowercase hexadecimal characters generated from 32 random bytes. Keep it in the server/main
process environment. Do not put it in a `NEXT_PUBLIC_` variable, renderer code, URL, ticket or report.
For a developer-operated web server, `DIAGNOSTICS_WEB_HOST` must match its exact loopback address
and port, `DIAGNOSTICS_LOCAL_TOPOLOGY=loopback` must be explicit, and `API_PROXY_URL` must be the
loopback API. Both servers need the same private capability. The API checks its actual socket peer,
exact Host and capability; the browser proxy also checks its exact Origin.

## Command-line inspection

After building the workspace, run the command with the same private capability as the local API
in your process environment. `DIAGNOSTICS_API_URL` defaults to `http://127.0.0.1:3000`; only literal
loopback HTTP origins are accepted. The desktop's automatically generated capability is kept
private; the command is intended for a developer-operated local API configured as above.

```bash
pnpm diagnostics list
pnpm diagnostics report --request <request-uuid>
pnpm diagnostics report --session <session-uuid> --run <run-uuid> --json
```

The command refuses redirects and mismatched report scopes, bounds its response to 5 MiB, and
regenerates the readable summary from safe metadata. It does not open the database directly.
JSON output can be redirected to a local file for manual sharing. Failure messages deliberately
omit raw upstream response bodies, credentials and URLs.

## Durable resource recording and historical windows

The [monitoring task](../tasks/agent-platform-local-diagnostics-monitoring.md) adds this bounded local
workflow on its implementation branch. See [actual results and pending gates](../reviews/local-diagnostics-monitoring-results.md);
this guide is not a stress-testing or release sign-off.

In the desktop app, open **Settings → Workspace → Local monitoring**. Enable resource recording
and save the retention preference once; the private backend acknowledges only the durable setting.
It survives restart and works without a rendered chat view. This toggle controls the new resource
samples only: existing V1 request/model/tool/approval/Stop diagnostics continue unchanged. A failed
or unloaded preference is shown as unknown, not a successful disabled/default setting.

While enabled, the API records one fixed numeric resource sample every30seconds, including API-process
user/system CPU deltas, RSS, main-thread event-loop p95/max, distinct owned-run/unresolved-admission
and lock-key/waiter counts, and free bytes on the fixed app-data volume. The initial CPU baseline and
unavailable metrics are explicit. CPU excludes child/provider/host/container totals. These are
observations for finding suspect intervals; they do not establish a cause or universal bottleneck.
No paths, prompts, tool contents, raw errors, keys or custom labels are collected.

The companion `monitoring.sqlite` is bounded by a32MiB page limit,34MiB rollback-journal budget,
25,000 fixed sample rows and age retention. Age defaults to seven days/configurable1–90 days, but
25,000 rows at30seconds retain only about8.68 continuous days. Actual oldest/newest coverage,
pruning, missing intervals, drops/pending data and unclean restart are reported; ninety days is not
a guaranteed history length. Storage failure does not change execution permission.

The same developer-operated local CLI can inspect this history without a UI or a live observer:

```bash
pnpm diagnostics monitoring-status
pnpm diagnostics monitoring-set --enabled true --retention-days 7
pnpm diagnostics window --from 2026-10-16T10:00:00Z --to 2026-10-16T11:00:00Z --json
```

The CLI retains the private loopback/capability restrictions above. It does not discover the managed
desktop credential or open SQLite directly. Use the desktop Settings history **Save** action for the
managed app. Each saved JSON contains a regenerated readable summary plus safe structured samples
and V1 events; neither command nor app uploads it. The destination/cancellation is explicit.

Private POST routes under `/v1/diagnostics/monitoring/` are `status` with an empty object,
`preference` with exactly `samplingEnabled`/`retentionDays`, and `window` with a bounded `window`
(`fromMs`,`toMs`), optional session filter/cursors and a page limit up to1,000 per store. A combined
window read has one200ms budget and a5MiB output cap. V1 and resource stores have independent signed
snapshots, not an atomic cross-database transaction. Each stream returns a `nextCursor` or a signed
`completedCursor`; carry both independently so a completed stream is not replayed while the other
continues. The CLI flags are `--session`, `--monitoring-cursor`, `--diagnostic-cursor` and `--limit`.
The desktop offers an explicit next-page save only when needed. It never walks unbounded pages or
exposes the capability to the renderer. Changed range/session, expired history or restarted worker
invalidates affected cursors; preserve the original report and start a new bounded read.

Check coverage before interpreting a historical window. Disabled/degraded recording, startup/CPU
baselines, pruning, unacknowledged samples, unclean shutdown or missing V1 events prevent a claim of
complete history. An admitted action can remain unknown after its transport finishes. For periodic
review, give the agent the safe saved report, record its window/revision/coverage and add concrete,
deduplicated findings to Beads with uncertainty and a next validation. No automatic repair, upload,
scheduled review or model-provider spend is authorized by recording.

## Bounded API pagination

Authenticated local clients can POST a scope and optional `cursor` to `/v1/diagnostics/report`.
Each response contains at most 1,000 safe observations. When another page exists, the response
header `x-diagnostics-next-cursor` contains a generated opaque cursor; pass it unchanged with the
same scope to retrieve the next page. Pages retain the first request's snapshot upper bound, so
new writes do not change the export mid-read. Invalid or cross-scope cursors fail. Terminal/error
responses carry no continuation header. The route remains local-capability protected and no-store.
The manual UI/CLI report stays one bounded file and clearly marks truncation; it does not fetch
unbounded history automatically. The cursor is transport metadata, not part of the shared report.

## Scope and release verification

This phase provides local history and manual support reports. It does not add accounts, central
session lookup, automatic error submission, a dashboard, or telemetry uploads. Calling an external
model provider remains separate from sharing a diagnostic report: model requests can leave the
machine according to the user's provider configuration, while diagnostic history stays local.

The MVP must pass connected browser and standalone Electron export tests. Verification of the
released distributable without a checkout or development Node belongs to
[the release follow-up](../tasks/agent-platform-electron-release.diagnostics-export.md). Repository
Electron tests do not establish that release guarantee.
