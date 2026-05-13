# Electron Project Experience Manual QA

## Purpose

Use this checklist to manually verify the Electron Project experience during stabilisation.

The goal is to find regressions before the staging branch is merged toward `main`, then map every
finding to Beads as either existing coverage, a merge blocker, a follow-up task, a known limitation,
or a product decision.

## Test Environment

Run this checklist against the staging branch:

```bash
git switch feature/agent-platform-electron-stabilisation
git pull --ff-only
pnpm --filter @agent-platform/desktop run start:renderer
```

Use `start:renderer` for manual QA because it builds the renderer and launches the desktop app in a
production-like local mode.

Do not use browser-only `localhost:3001` testing for this checklist unless a finding specifically
asks for browser comparison. Browser-only testing cannot prove native folder selection, host Project
access, app data paths, backend supervision, or Electron preload behavior.

## Finding Template

Record each issue in this format:

```text
ID:
Feature:
Severity: blocker | high | medium | low
Steps:
Expected:
Actual:
Screenshot/log:
Classification: unclassified | existing task | merge blocker | follow-up | known limitation | decision
Beads issue:
Notes:
```

Severity guidance:

- `blocker`: prevents Project opening, Project chat, IDE handoff, settings/API key setup, or safe
  continuation of testing.
- `high`: breaks a primary user flow but has a workaround.
- `medium`: confusing or incorrect behavior that does not block the flow.
- `low`: copy, polish, or minor inconsistency.

## Checklist

### 1. App Launch

| Check                                  | Expected                                                                                         | Result | Finding ID |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ | ---------- |
| Launch Electron with `start:renderer`. | App opens without requiring Docker commands from the user-facing UI.                             |        |            |
| Initial screen is readable.            | Navigation, Chat, IDE, and Project affordances are visible at normal font sizes.                 |        |            |
| No implementation paths are visible.   | UI does not show `/workspace`, backend roots, hashes, or internal runtime states as normal copy. |        |            |
| Assistant panel is usable.             | Input is enabled unless a clear user-facing reason is shown.                                     |        |            |

### 2. Settings And Model/API Key Smoke

| Check                         | Expected                                                                                     | Result | Finding ID |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------ | ---------- |
| Open Settings.                | Settings opens from the left navigation.                                                     |        |            |
| Open model/provider settings. | User can find where model/API key configuration lives.                                       |        |            |
| Return to main workspace.     | Navigation back to Chat/Projects/IDE is clear.                                               |        |            |
| No reset requirement appears. | Testing should not require wiping saved API keys or local app data unless explicitly chosen. |        |            |

### 3. Native Open Project

| Check                             | Expected                                                                        | Result | Finding ID |
| --------------------------------- | ------------------------------------------------------------------------------- | ------ | ---------- |
| Click **Open Project**.           | Native operating-system folder picker opens.                                    |        |            |
| Select a local folder.            | App accepts the folder without asking the user to type an absolute path.        |        |            |
| Selected folder remains in place. | App does not copy the Project folder into app data as the normal open behavior. |        |            |
| Project name is shown.            | UI uses user-facing Project/folder names, not full host paths.                  |        |            |
| Project opens into chat first.    | User lands in Project chat, not directly in the IDE.                            |        |            |

### 4. Project Chat Default Surface

| Check                         | Expected                                                                                          | Result | Finding ID |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------ | ---------- |
| Project chat header is shown. | Header indicates Project chat context.                                                            |        |            |
| Chat input is enabled.        | User can type without first opening the IDE or selecting a file.                                  |        |            |
| Empty state is clear.         | Copy invites the user to ask what they want done in the Project.                                  |        |            |
| Send a normal message.        | Assistant has Project context or explains any missing setup in user-facing language.              |        |            |
| No internal status leakage.   | Copy avoids states like `in_progress`, `needs_review`, backend roots, hashes, or raw diagnostics. |        |            |

### 5. Slash Command Help

| Check                                | Expected                                                                                  | Result | Finding ID |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ------ | ---------- |
| Send `/help`.                        | Assistant lists available slash commands.                                                 |        |            |
| Confirm `/init` is listed.           | `/init` appears with a short user-facing description.                                     |        |            |
| Send `/help init`.                   | Assistant explains usage, scope, and whether the command changes Project state.           |        |            |
| Help works as first Project message. | Slash command does not require a prior ordinary chat message to discover Project context. |        |            |

### 6. Project Initialisation With `/init`

| Check                                            | Expected                                                                                  | Result | Finding ID |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------ | ---------- |
| Send `/init` as the first Project message.       | Command uses the selected Project context.                                                |        |            |
| Missing instructions are handled.                | App explains setup in plain language and prepares the Project instruction flow.           |        |            |
| User review is required before write enablement. | Any instruction file creation/update asks for review/approval before enabling file edits. |        |            |
| Repeat `/init`.                                  | Existing instructions are updated or refreshed rather than duplicated.                    |        |            |
| Chat remains usable after `/init`.               | Input does not become stuck or disabled after the command.                                |        |            |

### 7. IDE Handoff

| Check                                 | Expected                                                                   | Result | Finding ID |
| ------------------------------------- | -------------------------------------------------------------------------- | ------ | ---------- |
| Click **Open IDE** from Project chat. | IDE opens for the same selected Project/session.                           |        |            |
| Explorer renders files.               | File tree reflects the selected Project.                                   |        |            |
| Open a file.                          | Editor opens the selected file.                                            |        |            |
| Relative path display is correct.     | UI shows Project-relative path where needed, not host absolute path.       |        |            |
| IDE assistant input is usable.        | User can continue the Project conversation from the IDE.                   |        |            |
| Active file context is clear.         | If active file is attached to chat, UI shows that in user-facing language. |        |            |

### 8. Return Navigation

| Check                                  | Expected                                                     | Result | Finding ID |
| -------------------------------------- | ------------------------------------------------------------ | ------ | ---------- |
| Use breadcrumb/return action from IDE. | App returns to the same Project chat.                        |        |            |
| Session context is preserved.          | Conversation and selected Project remain consistent.         |        |            |
| Reopen IDE.                            | IDE opens the same Project, not a previous or empty Project. |        |            |
| Chat remains usable.                   | User can send another message after returning from IDE.      |        |            |

### 9. Recent Projects

| Check                                          | Expected                                                                    | Result | Finding ID |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ------ | ---------- |
| Open a second Project.                         | App switches active Project cleanly.                                        |        |            |
| Recent Projects list is visible.               | Previously opened Projects appear in the left explorer.                     |        |            |
| Reopen the first Project from Recent Projects. | Active Project switches to the first Project.                               |        |            |
| Chat context follows active Project.           | Project chat and URL/state agree on the selected Project.                   |        |            |
| IDE context follows active Project.            | Opening IDE after recent reopen uses the selected recent Project.           |        |            |
| Unavailable Project state is safe.             | Missing/unavailable Projects do not expose full host paths or crash the UI. |        |            |

### 10. User-Facing Copy And Internal State

| Check                        | Expected                                                                                    | Result | Finding ID |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------ | ---------- |
| Scan Project panels.         | Labels explain what the user can do next.                                                   |        |            |
| Scan assistant status.       | Technical availability details appear only where useful and user-facing.                    |        |            |
| Scan diagnostics disclosure. | Raw diagnostics are collapsed or kept out of normal primary UI.                             |        |            |
| Scan path labels.            | Normal UI avoids `/workspace`, backend roots, full host paths, hashes, and raw state names. |        |            |
| Scan Project terminology.    | Project is not described as coding-only unless the Project profile warrants it.             |        |            |

### 11. Restart Smoke

| Check                           | Expected                                                                     | Result | Finding ID |
| ------------------------------- | ---------------------------------------------------------------------------- | ------ | ---------- |
| Quit and relaunch Electron.     | App starts cleanly.                                                          |        |            |
| Recent Projects persist.        | Recent Projects are still listed.                                            |        |            |
| Reopen a recent Project.        | Project opens without requiring path entry.                                  |        |            |
| API key/model settings persist. | Previously configured settings remain unless user explicitly reset app data. |        |            |

## Closeout

After the checklist is complete:

1. Send all findings for triage.
2. Classify each finding against the template.
3. Create or update Beads tasks for merge blockers and follow-ups.
4. Decide whether the staging branch can proceed, needs fix-forward work, or should remain parked.

Do not close the stabilisation epic until every finding is classified.
