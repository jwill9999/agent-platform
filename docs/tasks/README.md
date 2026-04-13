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

5. **Template** — Copy [`_template.md`](./_template.md) when creating a new task spec; then wire the Beads issue.

## Epic index (task spec files)

| Epic | Beads id | Task spec files |
|------|----------|-----------------|
| Foundation | `agent-platform-mov` | `agent-platform-mov.{1-5}.md` |
| Persistence + API | `agent-platform-j9x` | `agent-platform-j9x.{1-4}.md` |
| Harness | `agent-platform-2tw` | `agent-platform-2tw.{1-5}.md` |
| Planner + plugins | `agent-platform-dx3` | `agent-platform-dx3.{1-4}.md` |
| Frontend | `agent-platform-ast` | `agent-platform-ast.{1-3}.md` |
| MVP E2E | `agent-platform-o36` | `agent-platform-o36.{1-2}.md` |

## Commands

```bash
bd show <issue-id> --json
bd dep list <issue-id>
bd ready --json
```
