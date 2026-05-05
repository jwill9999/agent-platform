# Operator Experience Design System

This document defines the frontend design-system foundation for `agent-platform-operator-experience`.

It is intentionally frontend-only. It does not change backend contracts, streaming contracts, tool contracts, or runtime policy. Future implementation tasks should consume existing frontend data shapes unless their own specs explicitly introduce backend work.

## Stack Constraints

Use:

- Next.js App Router for structure and routes.
- shadcn/ui components for reusable primitives.
- Tailwind CSS for styling.
- TypeScript for implementation.
- Radix behavior through shadcn/ui primitives.
- lucide icons, matching the existing `apps/web/components.json` configuration.

Do not:

- introduce new UI libraries
- introduce new styling systems
- introduce new animation libraries
- introduce new state-management libraries
- change data contracts
- include backend logic

Installed shadcn/ui components today:

- `badge`
- `button`
- `dialog`
- `dropdown-menu`
- `input`
- `label`
- `resizable`
- `scroll-area`
- `select`
- `textarea`

When a future task needs a missing shadcn/ui primitive, add it through the shadcn CLI and review the generated source. Do not add a separate component library to fill the gap.

## Product Posture

Operator surfaces should feel like a calm workbench, not a system log.

The UI should prioritize:

- fast scanning
- clear state
- confident approvals
- persistent evidence
- technical depth on demand
- compact but readable operational density

Avoid:

- raw JSON as the primary UI
- internal tool ids as primary labels
- oversized marketing-style panels
- nested cards inside cards
- decorative gradients or unrelated visual flourishes
- hiding risk behind neutral styling

## Core Layout

| Surface                  | Purpose                                                  | Guidance                                                                                  |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Chat transcript          | Conversation and outcome narrative                       | Keep the primary story readable; show concise activity summaries inline.                  |
| Tool activity block      | Skimmable sequence of agent actions                      | Collapsible summary by default after completion; running state stays open while active.   |
| Right drawer / inspector | Sensors, artifacts, traces, branch status, debug details | Prefer this for secondary operational context over expanding the transcript indefinitely. |
| Dialog                   | Focused artifact inspection or high-risk decision        | Use for screenshot/image inspection and high-risk confirmations.                          |
| Details panel            | Raw/redacted payloads and trace metadata                 | Explicitly technical; never the first thing non-technical users must read.                |
| Workbench/IDE area       | Code, branch, diff, and execution evidence               | Prefer split or resizable layouts when comparing evidence and code.                       |

## Visual Language

Use the existing semantic Tailwind tokens from `apps/web/app/globals.css`:

- `bg-background`
- `bg-card`
- `bg-muted`
- `text-foreground`
- `text-muted-foreground`
- `border-border`
- `text-destructive`
- `bg-primary`
- `text-primary`

Use Tailwind utilities for layout only when composing shadcn/ui primitives. Prefer `gap-*` over `space-*`, `size-*` for square icon buttons, and `cn()` for conditional classes.

Recommended density:

- activity rows: compact, one primary line plus optional secondary line
- approval cards: moderate density, enough room for risk and decision copy
- artifact cards: compact metadata, larger preview only when useful
- debug/details: dense, monospace only for payloads or identifiers

Border radius:

- Follow existing shadcn/new-york defaults.
- Keep operational cards and panels at `rounded-md` or `rounded-lg`.
- Do not introduce large pill/card radii for dense workbench surfaces.

## Status Vocabulary

Use these statuses consistently across activity, approvals, artifacts, branch status, and trace views.

| Status              | Meaning                                | Default treatment                                          |
| ------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `pending`           | Queued but not started                 | muted icon, secondary badge                                |
| `running`           | Currently executing                    | spinner/progress affordance, neutral active treatment      |
| `approval_required` | Waiting for human decision             | warning/risk treatment, clear Approve/Deny actions         |
| `approved`          | Human approved the action              | success treatment, decision recorded                       |
| `denied`            | Human rejected or policy denied        | warning/destructive-adjacent treatment depending on source |
| `completed`         | Action completed successfully          | success treatment                                          |
| `failed`            | Action attempted and failed            | destructive/error treatment with next step                 |
| `blocked`           | Cannot proceed until condition changes | warning treatment with blocker reason                      |
| `unavailable`       | Capability/provider/runtime missing    | muted or warning treatment with setup guidance             |

Status labels should be sentence case in UI copy, not raw enum names.

## Risk Vocabulary

Use existing risk tiers where available. Do not invent runtime policy beyond the data already present.

| Risk     | Meaning                                                | UI expectation                                         |
| -------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Low      | Read-only or bounded inspection                        | Quiet badge or no badge if already clear               |
| Medium   | Navigation/session or contextual access                | Visible badge and short reason when approval appears   |
| High     | Mutating, external, sensitive, or consequential action | Prominent badge, explicit reason, clear Approve/Deny   |
| Critical | Destructive, credential, or irreversible action        | Modal or strongly emphasized card; do not bury details |

If a tool reports a specific risk reason, show it in human language. If only an internal risk tier exists, show the tier but avoid speculative explanations.

## Component Inventory

### Tool Activity Event Row

Purpose: show one agent action or lifecycle event.

Required content:

- friendly action label
- status
- target or short context when available
- timestamp/duration when available
- detail affordance when technical payload exists

Preferred primitives:

- `Badge`
- `Button`
- `ScrollArea` for expanded details
- future shadcn `Accordion` or `Collapsible` if needed

Example labels:

| Tool/system signal          | User label            |
| --------------------------- | --------------------- |
| `sys_browser_start`         | Open browser page     |
| `sys_browser_screenshot`    | Capture screenshot    |
| `sys_browser_snapshot`      | Capture page snapshot |
| `sys_browser_click`         | Click page element    |
| `sys_browser_type`          | Type into page        |
| `sys_git_diff`              | Read code changes     |
| `sys_query_recent_errors`   | Check recent errors   |
| `sys_query_sensor_findings` | Check sensor findings |

### Approval Card

Purpose: let users make a clear, informed decision.

Required content:

- action
- target
- reason approval is required
- risk tier
- what approval permits
- approve and deny actions
- details affordance for raw/redacted payload

Preferred primitives:

- `Button`
- `Badge`
- future shadcn `Card` or current semantic `section`
- `Dialog` for critical risk or expanded review

Approval copy should answer:

- What does the agent want to do?
- What target is affected?
- Why is approval required?
- What is the risk?
- What happens if the user approves?
- What happens if the user denies?

### Artifact Card

Purpose: preserve evidence without flooding the transcript.

Required content:

- artifact type
- title or label
- source tool or source context when available
- size/truncation/redaction state
- open/inspect action

Artifact types:

- screenshot
- snapshot
- diff
- log excerpt
- report
- generated file
- trace export
- review evidence
- approval evidence

Preferred primitives:

- `Button`
- `Badge`
- `Dialog` for focused viewing
- `ScrollArea` for long text/log/snapshot content

### Artifact Viewer

Purpose: inspect evidence in the app surface.

Viewer expectations:

- screenshots/images: fit page, fit width, zoom in/out, reset
- text/snapshot/log: monospace viewer, copy affordance, bounded height
- report: summary first, details second
- diff: side-by-side or unified shell when diff data exists

Artifacts should open inside the app surface. Avoid surprise new tabs unless explicitly opening a downloadable file.

### Debug / Details Drawer

Purpose: expose technical evidence for engineers.

Content:

- raw/redacted tool arguments
- raw/redacted tool result
- trace id
- policy decision
- approval id/status
- duration/timing
- error code/message

Preferred primitives:

- future shadcn `Sheet` for side inspector
- `Dialog` if side sheet is not available
- `Tabs` for Details / Policy / Payload / Audit when available
- `ScrollArea` for payloads

### Branch / Check Status Panel

Purpose: explain repository state and review readiness.

States:

- clean
- dirty
- ahead
- behind
- diverged
- checks pending
- checks failed
- checks passed
- review required
- merge ready

This panel should coordinate with `agent-platform-branch-feedback-status`; do not create fake backend state in operator-experience tasks.

### Diff Viewer Shell

Purpose: review changes before approval.

Required behavior:

- show changed files
- show summary by file when available
- show diff body when data exists
- show approval/rejection affordance only when backed by existing workflow data

### Empty / Loading / Error / Blocked States

Use consistent states:

- Empty: explain what will appear here after the agent acts.
- Loading: show what is being loaded, not generic "Loading".
- Error: show what failed and what the user/agent can do next.
- Blocked: show the blocker and whether it needs user action, auth, runtime setup, or policy change.

## Interaction Rules

- User-facing summaries come first.
- Technical detail is available but explicit.
- Raw JSON is never the primary card content.
- Internal ids may appear in details, not as primary labels.
- Approvals always include a clear target and reason.
- External, destructive, or sensitive actions get stronger visual treatment.
- Artifacts remain visible after the model reply completes.
- Clicking an artifact opens an in-app viewer.
- Long content uses `ScrollArea` or bounded overflow.
- Buttons use icons where helpful, but labels remain clear for consequential actions.

## Example States

| State             | Example summary                                             |
| ----------------- | ----------------------------------------------------------- |
| Pending           | Waiting to run browser check                                |
| Running           | Opening browser page                                        |
| Approval required | Approval required to open external domain                   |
| Approved          | External browser navigation approved                        |
| Denied            | Browser navigation denied                                   |
| Failed            | Screenshot capture failed: browser session unavailable      |
| Completed         | Screenshot captured                                         |
| Blocked           | GitHub checks unavailable until GitHub CLI is authenticated |
| Unavailable       | Browser runtime unavailable in this container               |

## Implementation Boundaries

This foundation task may create documentation and low-risk static prototypes. It should not:

- add backend endpoints
- change output contracts
- change approval contracts
- change browser artifact contracts
- add new runtime policies
- add new third-party UI libraries

Later tasks may implement UI components using existing contracts. If a later task discovers that a backend contract is genuinely required, create or update the appropriate backend/API task instead of smuggling contract changes into frontend work.

## Current Frontend References

Current files to review before implementation:

- `apps/web/components/chat/tool-trace-block.tsx`
- `apps/web/components/chat/approval-card.tsx`
- `apps/web/components/chat/browser-artifact-previews.tsx`
- `apps/web/components/chat/message.tsx`
- `apps/web/components/chat/sensor-status-panel.tsx`
- `apps/web/components/layout/app-shell.tsx`
- `apps/web/components/layout/sidebar.tsx`
- `apps/web/components/ui/*`
- `apps/web/lib/browser-tool-results.ts`
- `apps/web/hooks/use-harness-chat.ts`

Current shadcn project config:

- `apps/web/components.json`
- `style`: `new-york`
- `rsc`: `true`
- `tailwind.css`: `app/globals.css`
- `iconLibrary`: `lucide`

## Follow-Up Task Alignment

| Task                                 | Uses this foundation by                           |
| ------------------------------------ | ------------------------------------------------- |
| `.2` Human-readable tool event model | Applying status/risk vocabulary and action labels |
| `.3` Activity/debug separation       | Moving payloads into explicit details patterns    |
| `.4` HITL approval cards             | Applying approval card anatomy and copy rules     |
| `.5` Observability trace view        | Applying details drawer and trace layout rules    |
| `.6` Artifact viewers                | Applying artifact card and viewer patterns        |
| `.7` Branch/diff workflows           | Applying artifact and workbench shell rules       |
| `.8` IDE/workbench architecture      | Applying layout and host-boundary expectations    |
| `.9` Docker host constraints         | Applying blocked/unavailable state copy rules     |
