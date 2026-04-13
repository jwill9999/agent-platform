# Task index (Beads is source of truth)

**Work items live in [bd](https://github.com/beads) (Beads), not in this folder.**  
Each issue has a **title**, **description** (what to build), and **acceptance criteria** (definition of done). Use:

```bash
bd ready --json
bd show <issue-id>
```

## Why this file exists

- **Navigation:** Quick map from **epic → child task ids** without opening the database.
- **Policy:** Avoid duplicating long specifications in Markdown (drift risk). If a task needs a **design spike** or **RFC**, add a file under `docs/tasks/` and link it from the Beads issue **description** with `See docs/tasks/<name>.md`.

## When to add a Markdown supplement

| Use Beads only | Add a linked `.md` when |
|----------------|-------------------------|
| Normal feature work | Spike needs diagrams, alternatives, or multi-page research |
| Bug fixes | Postmortem or repro is long |
| Small refactors | — |

Link from the issue: `Design: docs/tasks/2026-04-13-mcp-transport.md`

## Epic → task IDs (snapshot)

Regenerate mentally with `bd list --parent <epic-id>` when this drifts.

| Epic ID | Theme | Child tasks (examples) |
|---------|--------|-------------------------|
| `agent-platform-mov` | Foundation | `mov.1` … `mov.5` |
| `agent-platform-j9x` | Persistence + API | `j9x.1` … `j9x.4` |
| `agent-platform-2tw` | Harness | `2tw.1` … `2tw.5` |
| `agent-platform-dx3` | Planner + plugins | `dx3.1` … `dx3.4` |
| `agent-platform-ast` | Frontend | `ast.1` … `ast.3` |
| `agent-platform-o36` | MVP E2E | `o36.1`, `o36.2` |

**Next unblocked work** after this snapshot: start with **`agent-platform-mov.1`** (scaffold monorepo), then run `bd ready` again.
