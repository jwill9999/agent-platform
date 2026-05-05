# Operator Tool Event Display Model

This document defines the frontend-only display model for human-readable tool activity in
`agent-platform-operator-experience`.

It builds on the [Operator Experience Design System](./operator-experience-design-system.md) and
does not change backend contracts, stream contracts, approval contracts, tool contracts, or runtime
policy.

## Current Inputs

The current chat UI receives tool activity from these existing frontend shapes.

| Source                                                           | Frontend shape                                                          | Current use                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| NDJSON `tool_result` output                                      | `{ type, toolId, data }` parsed in `apps/web/hooks/use-harness-chat.ts` | Adds a `ToolTraceEvent` with inferred success/error/denied status.                      |
| NDJSON `approval_required` output                                | `{ approvalRequestId, toolName, riskTier, argsPreview, message }`       | Adds an approval card associated with the current assistant message.                    |
| NDJSON `error` output                                            | `{ code, message }`                                                     | Recoverable tool-like errors become trace events; model/auth/global errors stay global. |
| Assistant text beginning with `Calling tool:` / `Calling tools:` | Parsed as a status event                                                | Shows transient running state while streaming.                                          |
| Approval records API                                             | `ApprovalRequest` loaded for resumed sessions                           | Rehydrates pending approval cards in the transcript.                                    |
| Browser tool result data                                         | Browser result summary parsed by `apps/web/lib/browser-tool-results.ts` | Shows page title, URL, policy state, errors, and screenshot/snapshot artifacts.         |

The display model should adapt these shapes in the frontend. It must not require new stream fields
for v1.

## Display Object

Future UI components should normalize existing inputs into a display object before rendering.

```ts
type OperatorToolEventDisplay = {
  id: string;
  kind: 'status' | 'result' | 'approval' | 'error';
  status:
    | 'pending'
    | 'running'
    | 'approval_required'
    | 'approved'
    | 'denied'
    | 'completed'
    | 'failed'
    | 'blocked'
    | 'unavailable';
  risk?: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  summary: string;
  target?: string;
  reason?: string;
  nextStep?: string;
  icon: string;
  details?: {
    title: string;
    payload: unknown;
    redacted: boolean;
  };
};
```

This is a frontend view model, not a shared API contract. It may live in `apps/web` as a mapper/helper
when implementation starts.

## Status Mapping

| Input condition                                         | Display status      | Summary pattern                                                    |
| ------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| Streaming status text from `Calling tool(s)`            | `running`           | `Running tool actions` or the best friendly action label if known. |
| `tool_result` with no error signals                     | `completed`         | `<Action> completed`                                               |
| `tool_result.data.ok === false` and denied evidence     | `denied`            | `<Action> denied by policy`                                        |
| `tool_result.data.ok === false` without denied evidence | `failed`            | `<Action> failed`                                                  |
| `tool_result.data.error` present                        | `failed`            | `<Action> failed: <short error>`                                   |
| `tool_result.data.exitCode !== 0`                       | `failed`            | `<Action> exited with code <n>`                                    |
| `approval_required` stream event                        | `approval_required` | `Approval required to <action>`                                    |
| Approval card status `approved`                         | `approved`          | `<Action> approved`                                                |
| Approval card status `rejected`                         | `denied`            | `<Action> denied`                                                  |
| Approval card status `expired`                          | `blocked`           | `<Action> expired before approval`                                 |
| Browser result status `approval_required`               | `approval_required` | `Approval required to open external page` or action-specific copy. |
| Browser result status `blocked` / policy denial         | `blocked`           | `<Action> blocked by policy`                                       |
| Runtime/tool unavailable error                          | `unavailable`       | `<Capability> unavailable in this environment`                     |

Status labels shown to users should be sentence case, not enum names.

## Risk Mapping

Use existing data first.

| Input                                                           | Display risk                                      |
| --------------------------------------------------------------- | ------------------------------------------------- |
| `approval_required.riskTier` exists                             | That risk tier.                                   |
| Browser policy matched external navigation                      | `medium` unless the tool reports a stronger risk. |
| Browser policy matched destructive/sensitive/submit-like action | `high` unless the tool reports `critical`.        |
| Tool metadata risk appears in available frontend data           | That risk tier.                                   |
| No risk data and read-only result                               | omit risk badge or treat as `low` visually.       |
| No risk data and approval is required                           | `high` visual treatment with neutral reason copy. |

Do not infer security claims that are not present in the data. If only a tier is available, show the
tier and a plain reason such as `This action requires approval by policy`.

## Friendly Labels

Render friendly labels as the primary line. Raw tool ids belong in details.

| Tool/system signal           | Primary label            | Target extraction                                     |
| ---------------------------- | ------------------------ | ----------------------------------------------------- |
| `sys_browser_start`          | Open browser page        | `data.page.url`, `argsPreview.url`, or URL in message |
| `sys_browser_screenshot`     | Capture screenshot       | `data.page.title` or `data.page.url`                  |
| `sys_browser_snapshot`       | Capture page snapshot    | `data.page.title` or `data.page.url`                  |
| `sys_browser_click`          | Click page element       | locator/label from args when present                  |
| `sys_browser_type`           | Type into page           | locator/label from args; redact sensitive values      |
| `sys_browser_press`          | Press key on page        | key plus locator when present                         |
| `sys_git_status`             | Check branch status      | branch/repository if present                          |
| `sys_git_diff`               | Read code changes        | file path or branch range if present                  |
| `sys_git_log`                | Read commit history      | branch/range if present                               |
| `sys_query_recent_errors`    | Check recent errors      | session/workspace if present                          |
| `sys_query_sensor_findings`  | Check sensor findings    | provider/sensor type if present                       |
| `sys_query_sensor_providers` | Check feedback providers | provider count or session                             |
| `sys_query_current_trace`    | Check current trace      | trace id if present                                   |
| `sys_bash`                   | Run terminal command     | command summary, with credentials redacted            |
| `sys_read_file`              | Read file                | file path                                             |
| `sys_write_file`             | Write file               | file path                                             |
| `sys_append_file`            | Update file              | file path                                             |
| `sys_list_files`             | List files               | directory path                                        |
| Unknown `sys_*`              | Run system tool          | tool id in details                                    |
| MCP tool id                  | Use connected tool       | server/tool friendly name if parseable                |

For unknown tools, prefer a safe generic action over exposing an internal id as the main label.

## Summary Copy Rules

Use one concise primary summary plus optional secondary detail.

| Event             | Primary summary                         | Secondary detail                          |
| ----------------- | --------------------------------------- | ----------------------------------------- |
| Running action    | `Opening browser page`                  | target URL or page title                  |
| Completed action  | `Screenshot captured`                   | artifact count and page title             |
| Approval required | `Approval required to open BBC iPlayer` | `External domain is not allowlisted`      |
| Approved          | `Browser navigation approved`           | approver/time if available                |
| Denied            | `Browser navigation denied`             | policy or user decision reason            |
| Failed            | `Screenshot capture failed`             | short error and next step                 |
| Blocked           | `GitHub checks unavailable`             | `Authenticate GitHub CLI to continue`     |
| Unavailable       | `Browser runtime unavailable`           | Docker/Chromium setup guidance if present |

Copy rules:

- Start with the action, not the tool id.
- Put the target in human terms: page title, URL, file path, branch, provider, or command summary.
- Keep primary text short enough for a compact activity row.
- Use details views for payloads, stack traces, raw stderr, and complete JSON.
- Redact credentials before display. If redaction happened, mark details as redacted.
- Preserve exact identifiers in details when useful for engineers.

## Details Affordance Rules

Raw or technical payloads should be available through an explicit affordance.

Show a details affordance when any of these are present:

- raw tool arguments
- raw tool result data
- approval request id
- policy decision details
- trace id
- error code
- stderr/stdout
- artifact metadata
- provider/runtime setup data

Default collapsed content should include:

- friendly label
- status
- target
- short reason/result
- artifact preview if it is visual evidence

Expanded/details content may include:

- raw/redacted JSON
- raw stdout/stderr
- full policy matched rule
- request ids and trace ids
- download/preview links

## Browser Result Display

Browser results already have structured summaries in `apps/web/lib/browser-tool-results.ts`.

Use these fields:

- `kind` for action category when the tool id is missing.
- `status` for completed/failed/approval/blocked mapping.
- `page.title` as the preferred target label.
- `page.url` as secondary target detail.
- `policyDecision.matchedRule` as the reason, translated into human copy.
- `error.message` as the short failure detail.
- `evidence[]` for artifact cards.

Policy copy mapping:

| Policy signal                            | User copy                              |
| ---------------------------------------- | -------------------------------------- |
| `external_domain_requires_approval`      | `External domain is not allowlisted`   |
| `risky_browser_action_requires_approval` | `Browser action requires approval`     |
| `action_allowed`                         | `Allowed by browser policy`            |
| `browser_url_approved`                   | `Previously approved for this session` |

## Approval Display

Approval cards should render:

- action label
- target
- risk tier
- reason approval is required
- what approval permits
- Approve and Deny actions
- details affordance for payload and ids

Approval cards should not show `argsPreview` as the primary body. The primary body should be
generated from the action, target, reason, and risk. Raw/redacted arguments should move behind
details in the implementation task that follows this model.

Approval status copy:

| Approval state | Display status      | Copy                        |
| -------------- | ------------------- | --------------------------- |
| `pending`      | `approval_required` | `Waiting for approval`      |
| `approving`    | `running`           | `Approving action`          |
| `rejecting`    | `running`           | `Denying action`            |
| `approved`     | `approved`          | `Approved`                  |
| `rejected`     | `denied`            | `Denied`                    |
| `expired`      | `blocked`           | `Expired`                   |
| `executed`     | `completed`         | `Approved action completed` |
| `failed`       | `failed`            | `Approval action failed`    |

## Error Display

Recoverable tool errors are already separated from global chat errors in
`apps/web/hooks/use-harness-chat.ts`.

Display rules:

- `PATH_ACCESS_DENIED`: `Path access blocked`
- `BASH_COMMAND_BLOCKED`: `Terminal command blocked`
- `QUALITY_GATE_DENIED`: `Quality gate blocked completion`
- `CONTENT_TOO_LARGE`: `Content too large to display`
- `INVALID_ARGS`: `Tool input was invalid`
- `TOOL_*_FAILED`, `MCP_*`, `NATIVE_*`: use a friendly action if the tool is known; otherwise
  `Tool action failed`

The error code belongs in details, not the primary label.

## Implementation Guidance

When this model is implemented:

1. Add a small frontend-only mapper, likely under `apps/web/lib/`.
2. Keep mapper inputs typed from existing frontend stream and approval state types.
3. Add unit tests for status mapping, tool label mapping, browser policy copy, approval status copy,
   unknown tool fallback, and redaction.
4. Update `ToolTraceBlock` and `ApprovalCard` in later tasks to consume the mapped display shape.
5. Do not add backend fields unless a later backend/API task is explicitly created.

## Follow-Up Task Alignment

| Task                           | Uses this model by                                                               |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `.3` Activity/debug separation | Rendering summaries first and moving payloads into explicit details.             |
| `.4` HITL approval cards       | Replacing raw argument-first approval cards with action/target/risk/reason copy. |
| `.5` Observability trace view  | Reusing status, labels, and details affordance rules for trace entries.          |
| `.6` Artifact viewers          | Reusing artifact labels, source context, and status copy.                        |
| `.7` Branch/diff workflows     | Reusing branch/check/diff action labels and blocked/unavailable states.          |
