# Browser Tools Guide

The platform includes governed browser tools backed by Playwright. They let an agent open a web page, inspect what loaded, capture screenshots and accessibility-oriented snapshots, interact with the page, and save evidence artifacts into the workspace.

Use this guide when you want the agent to verify a web UI, gather visual evidence, explore a page, or exercise a browser flow.

## What The Browser Tools Can Do

| Capability           | What to ask for                                         |
| -------------------- | ------------------------------------------------------- |
| Open a page          | "Open `http://web:3001` and tell me what loaded."       |
| Navigate             | "Navigate the existing browser session to `/settings`." |
| Capture a snapshot   | "Capture a DOM and ARIA snapshot of the current page."  |
| Capture a screenshot | "Take a screenshot and keep it visible in chat."        |
| Click                | "Click the Settings button."                            |
| Type                 | "Type `browser tools` into the search box."             |
| Press keys           | "Press Enter after typing the search query."            |
| Close                | "Close the browser session."                            |

The registered system tools are:

- `sys_browser_start`
- `sys_browser_navigate`
- `sys_browser_snapshot`
- `sys_browser_screenshot`
- `sys_browser_click`
- `sys_browser_type`
- `sys_browser_press`
- `sys_browser_close`

Most users should not need to know those internal names. Use natural language and describe the browser outcome you want.

## Good Use Cases

### Smoke-test the local app

Ask:

```text
Use the browser tools to open http://web:3001, capture a snapshot and screenshot, then summarize what page loaded.
```

Expected outcome:

- The browser opens the Docker Compose web service.
- The agent reports the page title and visible UI.
- A screenshot artifact is saved and shown in the chat.
- A snapshot artifact is saved for DOM and ARIA evidence.

### Verify a feature after code changes

Ask:

```text
Open http://web:3001, go to the chat page, send a short message, and confirm the response area renders correctly. Capture before and after screenshots.
```

This is useful after frontend changes because it gives the agent visual evidence, not just test output.

### Inspect visual layout problems

Ask:

```text
Open the app, capture a screenshot at the current viewport, and tell me whether any text, cards, buttons, or images appear clipped or overlapping.
```

The browser tools provide the screenshot evidence. A future UI-quality sensor can build on this by grading visual quality more formally.

### Reproduce a bug report

Ask:

```text
Open http://web:3001, click Settings, then try to open the model selector. Capture a snapshot and screenshot at each step.
```

For bug reports, ask for step-by-step evidence so the transcript shows what the agent tried and where the UI changed.

### Test an external website with approval

Ask:

```text
Open https://www.bbc.co.uk/iplayer, capture a snapshot and screenshot, and summarize what loaded. I approve opening this external domain.
```

External domains normally require human approval. The approval step protects users from sending session or browser activity to unexpected sites.

## Approval Behaviour

Browser actions are risk-scored:

| Action type        | Examples               | Typical approval behaviour                                                         |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| Read-only          | snapshot, screenshot   | Low risk; usually no approval after a session exists                               |
| Navigation/session | start, navigate, close | Medium risk; external domains usually require approval                             |
| Mutating input     | click, type, press     | High risk when the action can submit data, change state, or expose sensitive input |

Approval-sensitive actions should render a human-in-the-loop approval card in chat. After approval, the agent resumes the action and captures the requested evidence.

## Artifacts

Browser evidence is stored in the workspace under:

```text
.agent-platform/browser/<browser-session-id>/
```

Artifacts can include:

- screenshot PNG files
- DOM or ARIA snapshot text files
- metadata sidecars with URL, title, timestamp, viewport, size, redaction, and truncation information

The chat UI should show screenshot artifacts as persistent previews. Users should be able to click a screenshot to inspect it without needing to open raw tool output.

API endpoints for artifact inspection:

| Method | Path                             | Purpose                                |
| ------ | -------------------------------- | -------------------------------------- |
| `GET`  | `/v1/browser/artifacts`          | List browser artifact metadata         |
| `GET`  | `/v1/browser/artifacts/download` | Download an artifact by workspace path |

Downloads are restricted to `.agent-platform/browser/**`.

## Prompt Patterns

Use direct, outcome-oriented prompts.

Good:

```text
Open http://web:3001 and confirm the AI Studio home screen loads. Capture a screenshot and summarize the visible navigation.
```

Good:

```text
Use the current browser session. Click the Chat navigation item, capture a snapshot, and list the main interactive controls.
```

Good:

```text
Try the failed path: open Settings, leave the required field blank, click Save, and capture the validation error.
```

Less useful:

```text
Run Playwright.
```

The browser tools work best when the agent knows the page, the action, the evidence to capture, and the success condition.

## Local Development Notes

When the app is running through Docker Compose, ask the browser tools to open:

```text
http://web:3001
```

That hostname is available from inside the API container. `localhost:3001` refers to the API container itself when the browser runs inside Docker, so it may not reach the web service from that context.

Before testing browser tools locally:

```bash
make up
make coding-runtime-verify
```

`make coding-runtime-verify` confirms the container has the required command-line baseline, including Chromium-related runtime expectations used by browser tools.

## Limitations

- The tools are designed for governed browser automation, not unrestricted scraping.
- External domains may require approval and may still fail if policy blocks the request.
- Screenshots can be truncated or bounded to protect storage and transcript size.
- Pages with heavy animation, cookie banners, login walls, or bot detection may require extra steps.
- Browser sessions are runtime state; if the API process restarts, follow-up snapshot or screenshot calls may need a new session.
- The browser evidence proves what rendered, but it does not automatically grade UI quality. UI grading belongs to the UI quality sensor work.

## Troubleshooting

| Symptom                               | Likely cause                                 | What to do                                                                                                 |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BROWSER_RUNTIME_UNAVAILABLE`         | Chromium or browser dependencies are missing | Rebuild the API image and rerun `make coding-runtime-verify`                                               |
| `ENOSPC` or `mkdtemp` under `/tmp`    | Docker temp or overlay storage is full       | Reclaim Docker space or restart/rebuild so `AGENT_BROWSER_TMPDIR` points at workspace-backed temp storage  |
| External site says approval required  | Domain is not allowlisted                    | Approve the request in the chat approval UI                                                                |
| Screenshot is tiny or hard to inspect | Preview sizing issue                         | Click the artifact preview; if still poor, capture another screenshot with a specific viewport requirement |
| Snapshot says session is inactive     | Browser session expired or API restarted     | Start a new browser session and repeat the snapshot                                                        |

## Related Documentation

- [API Reference](api-reference.md) documents the registered browser tool IDs and artifact endpoints.
- [Architecture](architecture.md) explains browser tools as a platform-owned tool pack.
- [Development](development.md) explains Docker runtime setup and troubleshooting.
- [Browser tools epic](tasks/agent-platform-browser-tools.md) records the implementation scope and completed task chain.
