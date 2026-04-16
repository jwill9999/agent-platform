# Task: System-generated UUIDs with auto-slug

**Beads issue:** `agent-platform-5pa`  
**Spec file:** `docs/tasks/agent-platform-5pa.md` (this file)  
**Parent epic:** Identity & Data Integrity

## Task requirements

Replace user-provided IDs with system-generated UUIDs across all entity types (agents, skills, tools, MCP servers, sessions). Add auto-generated slugs from the `name` field for human-readable URLs and display. Both UUID and slug are unique and queryable.

### Current state

- All entities use `z.string().min(1)` for IDs — caller provides arbitrary strings
- No auto-generation of IDs
- No slug field exists
- Schema defined in `packages/contracts/src/schemas/`
- Database schema in `packages/db/src/schema.ts`

### Target state

- UUID v4 auto-generated on insert (not provided by caller)
- Slug auto-derived from `name` field using `slugify(name)` logic (e.g. "Coding Agent" → "coding-agent")
- `id` (UUID) is primary key in DB
- `slug` is unique indexed column
- API accepts UUID or slug for lookups (GET /v1/agents/:idOrSlug)
- POST/PUT bodies do NOT include `id` — system generates it
- Responses always include both `id` and `slug`

### ⚠️ Breaking API change — migration strategy

**This is a breaking change:** Currently clients provide `id` on POST. After this task, `id` is system-generated and clients cannot set it.

**Why this is acceptable for MVP:**

- Single-user, local-only deployment — no external API consumers
- No published API stability guarantees yet
- Seed data is the only persistent data set; it will be updated

**Migration steps:**

1. Drizzle migration adds `slug` column (nullable initially)
2. Data migration generates UUIDs + slugs for existing rows (using existing names)
3. Alter `slug` to NOT NULL + UNIQUE after population
4. Seed script updated to omit `id` and use system generation
5. Frontend (when implemented) will use UUIDs from API responses, not hardcoded IDs

**Slug collision under concurrency:** Use a DB-level UNIQUE constraint on `slug`. On insert, catch SQLite unique constraint error (`SQLITE_CONSTRAINT_UNIQUE`), retry with incremented suffix (`-2`, `-3`, etc.) up to 5 attempts.

### Slug rules

- Lowercase, hyphens replace spaces, strip non-alphanumeric
- Max 128 characters
- Must be unique per entity type
- On name change, slug updates (no redirect tracking for MVP)
- Collision handling: append `-2`, `-3`, etc.

## Dependency order

### Upstream — must be complete before this task

| Issue                | Spec                                              |
| -------------------- | ------------------------------------------------- |
| `agent-platform-7tq` | [DB transaction support](./agent-platform-7tq.md) |

Transactions needed because the insert-then-check-slug-uniqueness flow must be atomic.

### Downstream — waiting on this task

| Issue                | Spec                                                        |
| -------------------- | ----------------------------------------------------------- |
| `agent-platform-6db` | [UUID-based referential integrity](./agent-platform-6db.md) |

## Implementation plan

### Step 1: Add `slugify()` utility

**File:** `packages/db/src/slug.ts` (new)

```typescript
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

export function uniqueSlug(base: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(base)) return base;
  let i = 2;
  while (existingSlugs.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
```

**Note:** The `uniqueSlug()` helper above is used for in-memory collision resolution (e.g. seed scripts). In production writes, the DB UNIQUE constraint is the source of truth — catch constraint violation and retry with incremented suffix.

### Step 2: Add `slug` column to all entity tables

**File:** `packages/db/drizzle/` (new migration)

Add `slug TEXT NOT NULL UNIQUE` column to: `agents`, `skills`, `tools`, `mcp_servers`.

For existing data: generate slugs from existing names during migration.

### Step 3: Update Drizzle schema

**File:** `packages/db/src/schema.ts`

Add `slug` column definition to each table. Add unique index on `slug`.

### Step 4: Update contracts/schemas

**File:** `packages/contracts/src/schemas/`

- Remove `id` from create/update request schemas (system generates)
- Add `slug` to response schemas
- Add `IdOrSlug` parameter schema for lookups

### Step 5: Update repository layer

**File:** `packages/db/src/repositories/registry.ts`

- On create: generate UUID + slugify(name) → check uniqueness → insert
- On update (name change): re-slugify → check uniqueness → update
- Add `findBySlug()` methods alongside existing `findById()`
- Add `findByIdOrSlug()` that tries UUID first, then slug

### Step 6: Update API routes

**Files:** `apps/api/src/infrastructure/http/v1/*.ts`

- POST routes: remove `id` from body validation, generate UUID
- GET/PUT/DELETE: accept `idOrSlug` parameter
- All responses include `id` and `slug`

### Step 7: Update seed data

**File:** `packages/db/src/seed/runSeed.ts`

Generate UUIDs and slugs for seed data.

### Step 8: Tests

- Unit: `slugify()` function (edge cases: unicode, spaces, duplicates)
- Unit: Repository create/update with auto-UUID and slug
- Integration: API CRUD with UUIDs and slug lookups
- Integration: slug collision handling

## Git workflow (mandatory)

| Rule                 | Detail                                                     |
| -------------------- | ---------------------------------------------------------- |
| **Feature branch**   | `feature/identity`                                         |
| **Task branch**      | `task/agent-platform-5pa` (branch from `feature/identity`) |
| **Segment position** | First task in segment                                      |

## Tests (required before sign-off)

- **Unit:** `slugify()` function tests, repository ID generation tests
- **Integration:** All existing API tests updated to work with system-generated IDs
- **Regression:** Seed still works, chat flow unaffected

## Acceptance criteria

1. All entity creation returns system-generated UUID
2. Slug is auto-derived from name and returned in responses
3. Both UUID and slug work for lookups
4. Slug collisions are handled with numeric suffix
5. POST/PUT bodies do not accept `id`
6. Existing tests pass (with adjustments for new ID format)

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass; slugify tests added
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from `feature/identity`
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-5pa --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
