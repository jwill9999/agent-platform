# Task specifications (linked from Beads)

Every **task** (child of an epic) has a **Markdown spec** in this directory. **Beads remains the scheduler** (`blocks` dependencies); each issue **links** to its spec for narrative detail.

## Rules

1. **One file per task** — Filename **must** match the Beads id: `docs/tasks/<issue-id>.md`  
   Example: issue `agent-platform-mov.1` → `docs/tasks/agent-platform-mov.1.md`

2. **Beads issue points to the file** — In the issue **description** (or design field), include a line near the top:  
   `Spec: docs/tasks/<issue-id>.md`

3. **Content** — Each spec includes **requirements**, **implementation plan**, **dependency order** (upstream/downstream + note to sync new deps into `bd dep add`), **tests**, **definition of done**, and **sign-off**.

4. **Order of work** — **Do not** mark a task complete until:
   - Every **upstream** task in the spec’s table is done **and**
   - Beads `bd ready` / dependency graph agrees (if not, fix Beads first).

5. **Git (mandatory)** — **Never commit directly to `main`.**
   - **Naming:** **`feature/<feature-name>`** and **`task/<task-name>`** (e.g. `feature/agent-platform-persistence`, `task/agent-platform-mov.1`).
   - **Chained segments (default):** tasks run **in order** on Git. The **first** task in a segment branches from **`feature/<feature-name>`**. **Each following** task branches from the **previous task’s branch** (after that task is complete and pushed). **Intermediate** tasks do **not** get their own PR to `feature`—only the **last task in the segment** opens **one PR** from **`task/<tip>` → `feature/<feature-name>`**, merging the whole chain. Then the **next** segment’s first task branches from the **updated** `feature` branch.
   - **Sign-off:** **unit tests** pass; checklist complete; **`bd close`** per task when its work is done. **PR to `feature`** only on the **segment tip** (unless a spec explicitly says otherwise).
   - **Release:** when ready, run integration testing and ensure CI/CD pipelines are green, then merge **`feature/<feature-name>` → `main`** via one PR.

6. **Template** — Copy [`_template.md`](./_template.md) when creating a new task spec; then wire the Beads issue.

## Expected Beads Schema (required)

All task issues must follow this minimum schema so planning and execution stay consistent.

| Field                 | Required  | Format / rule                                            |
| --------------------- | --------- | -------------------------------------------------------- |
| `id`                  | Yes       | Beads issue id (for this repo, `agent-platform-...`)     |
| `title`               | Yes       | One-line action-oriented task title                      |
| `type`                | Yes       | `task` (unless explicitly using `bug`/`feature` etc.)    |
| `priority`            | Yes       | `P0`-`P4`                                                |
| `status`              | Yes       | `open`, `in_progress`, or `closed`                       |
| `description`         | Yes       | First line must be `Spec: docs/tasks/<issue-id>.md`      |
| `acceptance_criteria` | Yes       | Concrete, testable outcomes (not implementation notes)   |
| `spec file`           | Yes       | Must exist at `docs/tasks/<issue-id>.md`                 |
| dependencies          | As needed | Model ordering in Beads with `blocks`/`depends-on` edges |

### Required description prefix

Every task description must start with this exact prefix line:

```text
Spec: docs/tasks/<issue-id>.md
```

### Creation workflow (required)

1. Create Beads issue.
2. Create spec file from [`_template.md`](./_template.md) as `docs/tasks/<issue-id>.md`.
3. Update Beads description so the first line points to the spec file.
4. Ensure acceptance criteria in Beads and Definition of Done in spec are aligned.

### Validation checklist

- `bd show <issue-id> --json` includes description prefix to spec file.
- `docs/tasks/<issue-id>.md` exists and includes requirements, tests, DoD, and sign-off.
- Dependencies in Beads match upstream/downstream sections in the spec.

## Epic index (task spec files)

| Epic                | Beads id                             | Task spec files                            |
| ------------------- | ------------------------------------ | ------------------------------------------ |
| Foundation          | `agent-platform-mov`                 | `agent-platform-mov.{1-5}.md`              |
| Persistence + API   | `agent-platform-j9x`                 | `agent-platform-j9x.{1-4}.md`              |
| Harness             | `agent-platform-2tw`                 | `agent-platform-2tw.{1-5}.md`              |
| Planner + plugins   | `agent-platform-dx3`                 | `agent-platform-dx3.{1-4}.md`              |
| Frontend            | `agent-platform-ast`                 | `agent-platform-ast.{1-3}.md`              |
| MVP E2E             | `agent-platform-o36`                 | `agent-platform-o36.{1-2}.md`              |
| HITL approvals      | `agent-platform-hitl`                | `agent-platform-hitl.{1-5}.md`             |
| Workspace storage   | `agent-platform-ws`                  | `agent-platform-ws.{1,1a,2-6}.md`          |
| Coding tools        | `agent-platform-code-tools`          | `agent-platform-code-tools.{1-7}.md`       |
| Browser tools       | `agent-platform-browser-tools`       | child specs pending                        |
| Research tools      | `agent-platform-research-tools`      | child specs pending                        |
| Memory management   | `agent-platform-memory`              | child specs pending                        |
| Scheduler           | `agent-platform-scheduler`           | child specs pending                        |
| Multi-agent         | `agent-platform-multi-agent`         | child specs pending                        |
| Capability registry | `agent-platform-capability-registry` | child specs pending                        |
| Feedback sensors    | `agent-platform-feedback-sensors`    | `agent-platform-feedback-sensors.{1-6}.md` |

## Commands

```bash
bd show <issue-id> --json
bd dep list <issue-id>
bd ready --json
```
