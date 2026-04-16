# Task: Plugin sandboxing design spike

**Beads issue:** `agent-platform-3kd`  
**Spec file:** `docs/tasks/agent-platform-3kd.md` (this file)  
**Parent epic:** Security

## Task requirements

Research and document how to sandbox plugin execution so that a misbehaving or malicious plugin cannot crash the host process, access unauthorized data, or consume unbounded resources. This is a **design spike** — the deliverable is a decision document with a recommended approach, not an implementation.

### Current state

- Plugins run in the same Node.js process as the harness
- No resource isolation (CPU, memory, time limits)
- Plugins have full access to the host process (file system, network, globals)
- Hook dispatcher calls plugin functions synchronously in-process

### Target state (design document)

A decision document in `decisions.md` covering:

1. **Isolation strategies evaluated** — at minimum:
   - Node.js `vm` module (lightweight but incomplete isolation)
   - Worker threads (`worker_threads`) with message passing
   - Subprocess isolation (child_process)
   - V8 isolates (via `isolated-vm` package)
   - WebAssembly (WASM) for plugin execution
2. **Recommended approach** with rationale
3. **Resource limits** — CPU time, memory, execution timeout
4. **API surface** — what should plugins be able to access?
5. **Performance implications** — overhead of each approach
6. **Migration path** — how to move from current in-process to sandboxed
7. **Risk assessment** — what happens if we DON'T sandbox?

## Dependency order

### Upstream — must be complete before this task

None — this is independent research.

### Downstream — waiting on this task

Implementation tasks will be created based on the spike's recommendation.

## Implementation plan

### Step 1: Evaluate isolation strategies

Research each strategy (vm, worker_threads, child_process, isolated-vm, WASM):

- Security guarantees
- Node.js compatibility
- Performance overhead
- API complexity
- Maturity / community support

### Step 2: Prototype top 2 candidates

Create throwaway prototypes testing:

- Hook execution through the isolation boundary
- Data serialisation overhead
- Error propagation from sandboxed plugin back to host
- Resource limit enforcement (timeout, memory cap)

### Step 3: Write decision document

**File:** Add to `decisions.md` under "Plugin Sandboxing"

- Problem statement
- Options evaluated (with pros/cons table)
- Recommended approach
- Resource limit recommendations
- Migration plan (phased: opt-in → default → required)
- Follow-up tasks to create

### Step 4: Create follow-up implementation tasks

Based on spike findings, create new beads issues for:

- Sandbox runtime implementation
- Plugin API adapter (serialisation layer)
- Resource limit enforcement
- Plugin manifest/permissions system

## Git workflow (mandatory)

| Rule                 | Detail                                                     |
| -------------------- | ---------------------------------------------------------- |
| **Feature branch**   | `feature/security`                                         |
| **Task branch**      | `task/agent-platform-3kd` (branch from `feature/security`) |
| **Segment position** | TBD based on epic ordering                                 |

## Tests (required before sign-off)

- **Unit:** None required (design spike — prototypes are throwaway)
- **Build:** `pnpm build` still passes (no production code changes)
- **Validation:** Decision document reviewed by human stakeholder

## Acceptance criteria

1. Decision document added to `decisions.md`
2. At least 3 isolation strategies evaluated (e.g. vm2, isolated-vm, Worker threads, process-level isolation, Wasm sandbox)
3. Top 2 strategies prototyped; benchmarks include: latency overhead per hook call (target: <5ms p99), memory isolation verified (plugin can't read host memory), CPU time limiting tested
4. Recommended approach includes comparison table with performance data
5. Follow-up implementation tasks created in beads with acceptance criteria

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] Decision document reviewed by stakeholder
- [ ] Follow-up implementation tasks created in beads
- [ ] **Git:** branch pushed
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Decision document** reviewed
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-3kd --reason "…"`
- [ ] `decisions.md` updated with sandboxing decision
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
