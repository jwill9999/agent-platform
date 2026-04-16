# Task: UUID-based referential integrity

**Beads issue:** `agent-platform-6db`  
**Spec file:** `docs/tasks/agent-platform-6db.md` (this file)  
**Parent epic:** Identity & Data Integrity

## Task requirements

Ensure all foreign key relationships use UUIDs consistently. Verify cascade deletes work correctly with new UUID primary keys. Ensure junction tables (agent_skills, agent_tools, agent_mcp_servers) reference UUIDs. Frontend should never pass names/slugs for relationship mutations — only UUIDs.

### Current state

- Foreign keys exist and are enforced (`foreign_keys = ON`)
- Cascade deletes configured on relationship tables
- But IDs are currently user-provided strings — not guaranteed UUIDs
- After `agent-platform-5pa`, IDs will be UUIDs — this task validates and hardens the relationships

### Target state

- All foreign key columns store UUID references
- API endpoints for relationship mutations (e.g. "add skill to agent") accept only UUIDs
- Cascade deletes verified with integration tests
- Referential integrity violations return clear error messages (not raw SQLite errors)

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `agent-platform-5pa` | [System-generated UUIDs with auto-slug](./agent-platform-5pa.md) |

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Audit all foreign key definitions

**File:** `packages/db/src/schema.ts`

Verify all `references()` columns are documented and correctly typed. Ensure no foreign key points to a slug (should all be UUID primary keys).

### Step 2: Add referential integrity error handling

**File:** `packages/db/src/repositories/registry.ts` (or new error module)

Catch SQLite foreign key constraint errors (SQLITE_CONSTRAINT_FOREIGNKEY) and wrap them in typed application errors:

- "Agent not found" when linking to non-existent agent
- "Skill not found" when linking to non-existent skill
- etc.

### Step 3: Update API relationship endpoints

**Files:** `apps/api/src/infrastructure/http/v1/*.ts`

- "Add skill to agent" accepts `{ agentId: uuid, skillId: uuid }` (not names)
- Validate UUIDs in request body (Zod schema with `z.string().uuid()`)
- Return proper error when referenced entity doesn't exist

### Step 4: Add cascade delete integration tests

**File:** `apps/api/test/` (new or existing test files)

- Test: delete agent → agent_skills entries cascade deleted
- Test: delete agent → agent_tools entries cascade deleted
- Test: delete agent → agent_mcp_servers entries cascade deleted
- Test: delete agent → messages cascade deleted
- Test: attempt to link non-existent skill → clear 404 error

### Step 5: Add foreign key constraint test

Verify that inserting an agent_skill with a non-existent agent_id fails cleanly (not with raw SQLITE_CONSTRAINT error).

## Git workflow (mandatory)

| Rule                 | Detail                                                            |
| -------------------- | ----------------------------------------------------------------- |
| **Feature branch**   | `feature/identity`                                                |
| **Task branch**      | `task/agent-platform-6db` (branch from `task/agent-platform-5pa`) |
| **Segment position** | Second (and last) task in segment — **segment tip**               |

## Tests (required before sign-off)

- **Unit:** Referential integrity error wrapping
- **Integration:** Cascade delete tests, FK constraint violation tests
- **Regression:** All existing tests pass

## Acceptance criteria

1. All FK relationships use UUID columns
2. FK constraint violations return typed application errors (not raw SQLite)
3. Cascade deletes verified with tests
4. API relationship mutations accept only UUIDs
5. Existing tests pass

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass
- [ ] **Git:** branch pushed; **segment tip PR merged**
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from `task/agent-platform-5pa`
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] **Segment tip:** PR merged `task/agent-platform-6db` → `feature/identity` (link: ********\_********)
- [ ] `bd close agent-platform-6db --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
