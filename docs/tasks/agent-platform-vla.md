# Task: Plugin authoring guide

**Beads issue:** `agent-platform-vla`  
**Spec file:** `docs/tasks/agent-platform-vla.md` (this file)  
**Parent epic:** Documentation

## Task requirements

Create a comprehensive plugin authoring guide that explains how to build, test, and deploy plugins for the agent platform. Plugins can extend or override built-in features (memory, observability, tool dispatch). The guide should be accessible to external developers unfamiliar with the codebase.

### Current state

- `packages/plugin-sdk/` exists with hook types and dispatcher
- Hooks: `onSessionStart`, `onTaskStart`, `onPromptBuild`, `onToolCall`, `onTaskEnd`, `onError`
- No documentation exists for plugin authoring
- Plugin interface defined but not documented

### Target state

- `docs/plugin-guide.md` — comprehensive authoring guide
- Code examples for each hook type
- Plugin lifecycle documentation
- Testing guide for plugins
- Registration and configuration guide

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                        |
| -------------------- | ------------------------------------------- |
| `agent-platform-1nx` | [Docs restructure](./agent-platform-1nx.md) |

The docs restructure establishes the `docs/` structure and creates the stub page.

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Document plugin interface

**File:** `docs/plugin-guide.md`

- Plugin interface contract (TypeScript types)
- Hook lifecycle (when each hook fires in the agent execution flow)
- Hook execution order
- Data available in each hook context

### Step 2: Write code examples for each hook

For each hook type, provide:

- Minimal example
- Real-world use case
- Input/output type signatures
- Error handling guidance

### Step 3: Document plugin registration

- How to register a plugin with the runtime
- Configuration options
- Priority/ordering when multiple plugins exist
- Override vs augment semantics

### Step 4: Testing guide

- How to unit test a plugin
- Mock hook contexts
- Integration testing with the harness

### Step 5: Advanced topics

- Overriding built-in observability
- Custom memory backends
- Plugin sandboxing considerations (reference `agent-platform-3kd`)
- Performance implications

### Step 6: Add example plugin

Create `packages/plugin-sdk/examples/` with:

- `logging-plugin.ts` — simple observability plugin
- `README.md` — explains the example

## Git workflow (mandatory)

| Rule                 | Detail                                                            |
| -------------------- | ----------------------------------------------------------------- |
| **Feature branch**   | `feature/documentation`                                           |
| **Task branch**      | `task/agent-platform-vla` (branch from `task/agent-platform-1nx`) |
| **Segment position** | Second (and last) task — **segment tip**                          |

## Tests (required before sign-off)

- **Unit:** None required (docs-only change)
- **Validation:** Code examples compile (TypeScript check)
- **Build:** `pnpm build` still passes

## Acceptance criteria

1. `docs/plugin-guide.md` exists with comprehensive content
2. All 6 hook types documented with examples
3. Plugin registration process documented
4. Testing guide included
5. Example plugin in `packages/plugin-sdk/examples/`
6. Code examples compile without errors

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] Code examples compile
- [ ] **Git:** branch pushed; **segment tip PR merged**
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from `task/agent-platform-1nx`
- [ ] **Checklists** complete
- [ ] **Segment tip:** PR merged `task/agent-platform-vla` → `feature/documentation` (link: ********\_********)
- [ ] `bd close agent-platform-vla --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
