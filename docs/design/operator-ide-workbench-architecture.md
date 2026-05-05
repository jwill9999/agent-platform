# Operator IDE And Workbench Architecture

This document reassesses the code viewing and workbench direction for the operator experience.

It is architecture/design documentation only. It does not add frontend components, backend
contracts, terminal behavior, workspace contracts, or host integration behavior.

## Current State

The current `/ide` surface is a bespoke browser workbench implemented in
`apps/web/components/ide/ide-with-chat.tsx`.

It currently provides:

- a browser File System Access API folder picker and file tree
- simple text editing through a textarea-based editor
- save through browser-granted file handles
- tabbed open files
- file context attachment for chat
- a side chat panel using the same harness chat flow
- an embedded terminal using xterm over an API WebSocket
- a manual terminal working-directory input because browsers do not expose the selected folder path

Related storage behavior is separate. The managed platform workspace is mounted into Docker at
`/workspace` and exposed through Settings > Workspace. That workspace is safer and more predictable
for agent-created artifacts than arbitrary host folders opened through the browser.

## Current Pain Points

| Area                  | Pain point                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browser folder access | File System Access API support is browser-specific and permission restoration can be brittle after refresh.   |
| Host path visibility  | The browser folder picker does not expose the host path, so the terminal cannot automatically match Explorer. |
| Docker path mismatch  | The API, terminal, tools, and agents run in Docker, while user IDEs and selected folders may be host-side.    |
| Editor depth          | The textarea editor cannot realistically compete with VS Code/Cursor-style language services and extensions.  |
| Plugin feedback       | SonarQube, CodeQL, diagnostics, review comments, and terminal outputs may originate from host IDE plugins.    |
| Security boundary     | Arbitrary host folder editing creates a broader risk surface than the bounded managed workspace.              |
| Product focus         | Building a full IDE competes with higher-value operator surfaces: branch status, diffs, artifacts, approvals. |
| Maintenance cost      | Every IDE feature adds browser compatibility, persistence, keyboard, accessibility, and Docker edge cases.    |

The platform should not block chat, agent execution, browser tools, or branch feedback on full IDE
maturity.

## Options

### Option A: Continue Embedded IDE Investment

Continue expanding the current browser IDE into a richer editor and file-management experience.

| Strengths                                                       | Weaknesses                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Keeps the user inside one application.                          | High maintenance cost for editor features and browser file permissions.    |
| Enables tight integration with chat and future review surfaces. | Difficult to match mature IDE extensions, diagnostics, and keyboard flows. |
| Can show platform-specific artifacts and approvals inline.      | Host/container path mismatch remains unresolved.                           |
| Avoids requiring a separate host app integration in v1.         | Risks turning the product into a weaker clone of existing IDEs.            |

This is not recommended as the primary direction.

### Option B: External Host IDE Or Browser Handoff

Lean on users' existing IDEs and host browsers. The platform would provide commands, links, or
instructions that open files, branches, diffs, terminals, or local preview URLs externally.

| Strengths                                                            | Weaknesses                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Reuses mature IDE capabilities, extensions, diagnostics, and themes. | Requires host integration that Docker containers do not get automatically. |
| Better fit for SonarQube, CodeQL, Problems, and review plugins.      | Harder to keep evidence, approvals, and agent context in one UI.           |
| Lower frontend maintenance burden.                                   | Cross-platform URL schemes and file paths need careful design.             |
| Lets technical users work where they are already productive.         | Non-technical users may lose orientation when context moves externally.    |

This is valuable, but it should not be the only operator experience.

### Option C: Hybrid Internal Workbench Plus Host Handoff

Keep the platform-owned workbench focused on evidence, branch status, diffs, artifacts, approvals,
and bounded file inspection. Use host IDE/browser handoff for deep editing and plugin-driven
diagnostics when host integration is available.

| Strengths                                                        | Weaknesses                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Keeps the platform focused on decisions and evidence.            | Requires clear boundaries so users know when to use each surface.       |
| Avoids rebuilding a full IDE.                                    | Still needs future host integration for seamless external workflows.    |
| Works well with branch/diff approval and artifact viewer design. | Needs unavailable-state handling when host integration is not present.  |
| Supports non-technical review without hiding technical details.  | Requires path mapping between host paths, Docker paths, and repo paths. |

This is the recommended direction.

## Recommendation

Adopt the hybrid model.

The internal platform should become a review workbench, not a full IDE. It should prioritize:

- branch status and pull-request context
- diff review
- artifact viewing
- check/SonarQube/CodeQL/review feedback summaries
- approval decisions
- bounded file inspection
- terminal evidence and logs where available
- clear unavailable states when host, provider, or plugin access is missing

External host IDE/browser workflows should be introduced as an enhancement layer, not as a hard
dependency. Users who have VS Code, Cursor, browser dev tools, SonarQube IDE plugins, GitHub
extensions, or CodeQL tooling should be able to use them, but the core platform should still provide
enough evidence for review and agent feedback when those tools are unavailable.

## Workbench Boundaries

### Keep Internal

The product should keep these surfaces inside the platform:

- chat and agent narrative
- tool activity summaries
- approval cards and decision history
- artifact cards and viewers
- branch status summaries
- diff review shell
- feedback drawer
- trace/details panels
- managed workspace artifact downloads

These are platform-specific and need to be visible to non-technical operators.

### Limit Internal

The current embedded IDE should remain bounded:

- simple file inspection
- simple text edits when already supported
- attaching files to chat context
- viewing generated or workspace-managed files
- reading diffs and review evidence once branch feedback exists

It should not aim to become a full replacement for language servers, refactoring tools, extension
marketplaces, debugger integrations, or complete Git porcelain.

### Move Or Handoff Externally

The platform should support handoff for:

- opening a repository folder in a host IDE
- opening a specific file and line in a host IDE
- opening a local preview URL in a host browser
- opening PRs, check runs, SonarQube issues, CodeQL alerts, and review comments in their source
  systems
- letting host IDE plugins surface diagnostics that can later be imported into the feedback loop

The handoff should be optional and capability-detected. If unavailable, the UI should show why and
keep the internal evidence path usable.

## Plugin And Feedback Implications

Host and provider feedback should feed the agent loop through normalized evidence, not through a
monolithic IDE dependency.

| Feedback source | Preferred role in the hybrid model                                                |
| --------------- | --------------------------------------------------------------------------------- |
| IDE Problems    | Imported as local diagnostics when an IDE/plugin bridge exists.                   |
| Terminal output | Captured as bounded evidence from platform tools or exposed IDE terminals.        |
| SonarQube       | Shown as quality gate/issues/hotspots and linked to files or branch summaries.    |
| CodeQL          | Shown as security alerts and linked to files or PR checks.                        |
| GitHub reviews  | Shown as review-required status, file comments, and conversation artifacts.       |
| MCP servers     | Discovered as optional capability providers for branch feedback and tool actions. |
| Browser tools   | Remain platform-owned for governed UI verification and screenshot artifacts.      |

The agent should receive these as branch/workspace artifacts, sensor findings, or trace evidence.
The UI should not require every feedback provider to appear in the embedded IDE before it becomes
useful.

## Docker And Host Constraints

Docker is the default runtime boundary. That creates several constraints:

- container paths such as `/workspace` may not equal host paths opened in an external IDE
- browser File System Access handles are browser-local and cannot automatically configure container
  tool paths
- opening a host IDE from inside the container is not portable without a host bridge
- IDE plugins usually run on the host, not in the API container
- local preview URLs differ by caller: browser users may use `localhost:3001`, while container
  browser tools may need `http://web:3001`
- terminal commands may execute in the API container even when the user is viewing a host folder
- provider authentication may live in host tools, container tools, MCP servers, or remote services

The next Docker constraints task should define path mapping, host bridge boundaries, and unavailable
states more deeply. This task only sets the product direction.

## User Workflows

### Non-Technical Review

1. User opens chat or branch review.
2. Platform shows branch status, changed files, check state, and artifacts.
3. User opens screenshots, reports, or diff summaries in-app.
4. User approves, denies, or asks the agent to address a visible issue.

This user should not need to understand raw Git, JSON payloads, or IDE plugins.

### Developer Review

1. User opens branch status or diff review in the platform.
2. User opens affected files in their host IDE when deeper editing is needed.
3. IDE plugins provide Problems, SonarQube, CodeQL, or review feedback.
4. Platform imports or links that feedback when available.
5. User returns to the platform for agent coordination and approval state.

This user benefits from mature external tooling without losing platform evidence.

### Agent Feedback Loop

1. Agent runs local checks, browser tools, or sensor reflection at an appropriate cadence.
2. Platform captures evidence as artifacts, findings, or trace details.
3. Branch feedback imports remote checks/reviews when available.
4. Agent uses normalized feedback to repair issues before asking for final approval.

This workflow should work even when the embedded IDE is not open.

## Open Risks

- Host IDE handoff may require OS-specific commands, URL schemes, and user consent.
- Path mapping between host, Docker, browser tools, GitHub annotations, and SonarQube findings may
  be lossy.
- File editing through browser handles may conflict with agent edits inside the container.
- IDE/plugin feedback bridges may be hard to secure and standardize.
- Non-technical users may be confused if context moves between platform and host tools without clear
  labels.
- Over-investing in the embedded IDE could delay higher-value branch, feedback, and artifact work.

## Follow-Up Work

Use existing epics/tasks where possible:

- `agent-platform-branch-feedback-status` should own branch discovery, PR mapping, check import,
  provider auth states, and normalized branch feedback.
- `agent-platform-operator-experience.9` should own Docker host integration constraints, including
  path mapping and host bridge boundaries.
- `agent-platform-ide-rethink` should be reconciled with this recommendation. If kept, narrow it to
  implementation planning for the hybrid workbench and host handoff path rather than reopening the
  same product decision.
- Future implementation should add internal workbench UI only after the branch-feedback data sources
  exist or explicit fixture/prototype scope is agreed.

## Decision

Proceed with a hybrid model:

- platform-owned internal workbench for evidence, branch/diff review, artifacts, approvals, and
  bounded inspection
- external host IDE/browser handoff for deep editing, mature plugin ecosystems, and host-native
  diagnostics
- clear capability detection and unavailable states when Docker, browser, provider, or host
  integration prevents a workflow

This direction keeps the operator experience focused on successful agent outcomes without committing
the product to maintaining a full browser IDE.
