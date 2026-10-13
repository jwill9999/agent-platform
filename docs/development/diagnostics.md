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
