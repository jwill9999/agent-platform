# Operator Branch And Diff Workflows

This document defines frontend workflow patterns for branch state, check status, diffs, and review
decisions in the operator experience.

It is frontend-only. It does not add backend contracts, tool contracts, GitHub contracts, or runtime
policy. Future implementation should consume existing data first, then defer provider-specific data
shape work to `agent-platform-branch-feedback-status`.

## Scope

Branch and diff review should help the operator answer four questions before code is pushed, merged,
or approved:

- What branch am I looking at?
- What changed?
- What feedback has already been found?
- What decision is being asked of me?

The UI should behave like a workbench, not a raw Git log. Technical evidence must remain available,
but the default view should be human-readable and action-oriented.

## Coordination Points

| Source                                                       | Responsibility in this task                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `operator-experience-design-system.md`                       | Provides shared layout, status, risk, and component rules.                 |
| `operator-artifact-viewer-patterns.md`                       | Defines artifact card and viewer behavior for screenshots, reports, logs.  |
| `operator-tool-event-display-model.md`                       | Defines human-readable activity summaries and technical details handling.  |
| `agent-platform-branch-feedback-status`                      | Owns future provider discovery, branch data, PR mapping, and check import. |
| `agent-platform-feedback-sensors` and browser/tool artifacts | Provide current and future evidence that can be linked to a branch review. |

This task defines how the frontend should present branch and diff evidence once data is available.
It must not imply that merge, push, CI, SonarQube, CodeQL, or review enforcement already exists.

## Branch Status Panel

The branch status panel belongs in the right drawer or workbench inspector when the user is working
with a repository. It should be compact enough to scan from chat, but detailed enough to support a
review decision.

### Anatomy

The panel should show:

- repository name or path
- current branch
- base branch or target branch when known
- upstream remote when known
- working tree state
- ahead, behind, or diverged status when known
- changed file count, grouped by added, modified, deleted, and renamed when available
- check status summary
- SonarQube, CodeQL, review, and local sensor summary when available
- provider availability state
- last refreshed time and retry action

### States

| State           | Meaning                                      | UI guidance                                                                     |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Clean           | No local changes detected.                   | Quiet success state; no review action unless remote checks still matter.        |
| Dirty           | Local changes exist.                         | Show changed file count and invite diff review.                                 |
| Staged          | Staged changes exist.                        | Separate staged from unstaged when data allows.                                 |
| Ahead           | Local branch has commits not on upstream.    | Show push-ready copy only when checks and review state support it.              |
| Behind          | Upstream has commits not present locally.    | Show update-required copy and avoid implying merge readiness.                   |
| Diverged        | Local and upstream both have unique commits. | Block merge-ready language and point to rebase/merge evidence.                  |
| Checks pending  | Remote checks are still running.             | Show pending status and avoid final approval language.                          |
| Checks failed   | One or more checks failed.                   | Prominent failed state with links to failing artifacts or details.              |
| Checks passed   | Required checks are green.                   | Success state, still paired with diff and risk summary.                         |
| Review required | Human or automated review is still open.     | Show review-required status and link to review comments when available.         |
| Merge ready     | Branch, checks, and review state are ready.  | Only show when data explicitly supports it.                                     |
| Auth required   | Provider needs login or consent.             | Show setup/retry action; do not show stale status as current.                   |
| Unavailable     | Repo/provider data cannot be read.           | Muted warning with clear limitation copy and no speculative branch conclusions. |

Status labels should use sentence case. Internal values such as `checks_pending` or
`review_required` may exist in code, but they should not appear as primary user-facing text.

## Diff Review Shell

The diff review shell should appear in the workbench area or in a focused dialog/drawer when the
operator chooses to inspect changes.

### Anatomy

The shell should include:

- branch and base summary
- file list with additions/deletions and feedback badges
- selected file diff area
- summary strip for changed files, risk, checks, and review blockers
- artifact area for related reports, logs, screenshots, or scan results
- technical details affordance for raw command/provider payloads

### File Row Signals

File rows should be able to show:

- changed line counts
- file operation: added, modified, deleted, renamed
- local Problems or lint/test feedback
- SonarQube issue or hotspot count
- CodeQL alert count
- GitHub annotation count
- review-comment count
- generated or binary file indication

Rows with security, failed-check, or review feedback should sort above purely clean rows when the
operator is making a decision.

### Diff Viewer Modes

The first implementation may use a simple unified diff. The design should leave room for:

- unified diff
- split diff
- file-only summary for binary/generated files
- redacted diff when sensitive content is detected
- artifact-backed diff reports when the diff cannot be rendered inline

Diff artifacts should follow the artifact model in `operator-artifact-viewer-patterns.md`. Until a
dedicated diff contract exists, the UI should treat diffs as display data derived from an existing
source, not as a new backend artifact contract.

## Review And Approval Decisions

Branch and diff approval must be phrased as an operator decision, not as guaranteed backend
enforcement.

### Decision Card Anatomy

A branch or diff decision card should show:

- requested action, such as "Approve branch changes" or "Reject branch changes"
- repository and branch
- base or target branch when known
- check status summary
- changed file summary
- risk and feedback summary
- what approving permits
- what denying prevents
- details affordance for raw provider/tool evidence

### Decision States

| State               | Meaning                                                 | UI guidance                                                      |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Pending review      | The user has not made a decision.                       | Show Approve and Reject actions.                                 |
| Approved locally    | The user approved in the current platform workflow.     | Record as a local decision unless backend persistence exists.    |
| Rejected locally    | The user rejected in the current platform workflow.     | Record reason when available and keep evidence visible.          |
| Blocked by checks   | Failing or pending checks prevent a confident approval. | Disable or warn on approval depending on available policy data.  |
| Blocked by provider | GitHub/SonarQube/CodeQL/review data cannot be read.     | Show provider setup state instead of pretending review is green. |
| Superseded          | Branch changed after the decision was made.             | Mark the prior decision stale and require review again.          |

Approval copy should be explicit. For example:

- Approving records that these branch changes look acceptable based on the evidence currently
  available.
- Denying records that the branch should not proceed until the listed issues are addressed.

Do not say "This will merge the pull request", "This will push the branch", or "All checks are safe"
unless the backend action and policy state explicitly support that statement.

## Feedback Linkage

Branch feedback should use one evidence model across local tools and remote providers.

| Feedback source | Branch panel placement                         | Diff placement                                      | Artifact/details placement                            |
| --------------- | ---------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| GitHub checks   | Overall checks summary and failing check list. | File rows when annotations map to files.            | Check logs and annotations as report/log artifacts.   |
| CodeQL          | Security alert summary.                        | File rows for mapped alerts.                        | Alert details as security report artifacts.           |
| SonarQube       | Quality gate, issues, hotspots, duplication.   | File rows for mapped issues/hotspots.               | Quality gate and issue reports as report artifacts.   |
| Review comments | Review-required summary.                       | File rows and inline comment markers when possible. | Comment threads as review evidence artifacts.         |
| Local sensors   | Local pre-push readiness summary.              | File rows for Problems, lint, tests, or build.      | Terminal excerpts and reports as bounded artifacts.   |
| Agent questions | Open clarification or unresolved assumption.   | Linked to affected file or branch decision.         | Conversation trace or decision details when relevant. |

When a finding cannot be mapped to a file, it should appear in the branch summary and artifact list
rather than being dropped.

## Empty And Unavailable States

The UI should distinguish unavailable data from successful empty results.

| Case                 | User-facing meaning                                      |
| -------------------- | -------------------------------------------------------- |
| No repository        | No repository is open for this session.                  |
| Detached HEAD        | A commit is open, but no named branch is active.         |
| No upstream          | Local branch exists without a configured remote branch.  |
| No pull request      | No pull request is associated with this branch.          |
| Provider unavailable | The provider is not configured, reachable, or permitted. |
| Auth required        | The user needs to sign in or authorize the provider.     |
| Checks not found     | No check runs were found for this branch or commit.      |
| Diff unavailable     | The platform could not read or render the diff.          |
| Evidence stale       | Branch changed since evidence was captured.              |

Each unavailable state should include the next useful action when one is known, such as retry,
authenticate, open a repository, refresh branch status, or inspect details.

## Relationship To Branch Feedback Status Epic

`agent-platform-branch-feedback-status` should own implementation of:

- repository and active branch discovery
- upstream/base branch resolution
- pull request mapping
- GitHub check run import
- GitHub annotation and review comment import
- CodeQL alert import
- SonarQube quality gate, issue, hotspot, and duplication import
- provider authentication and permission states
- MCP capability discovery for branch feedback
- normalized finding contracts for branch and file feedback
- decision persistence and enforcement policy, if needed

This operator-experience task only defines how those future capabilities should appear in the UI.
If branch-feedback work needs data contracts, API routes, polling rules, or harness integration, those
changes belong in the branch-feedback epic, not here.

## Definition Of Ready For Implementation

A future frontend implementation task can start when it has:

- a source for repository/branch state
- a source for changed-file summaries
- a source for check/review/provider state, or explicit unavailable states
- artifact URLs or inline evidence for details
- a clear statement of whether decisions are local UI state, persisted records, or enforced gates

Without those inputs, the UI may still show static fixtures or documented patterns, but it should not
claim live branch readiness.
