# Task: Deep health check endpoint

**Beads issue:** `agent-platform-ged`  
**Spec file:** `docs/tasks/agent-platform-ged.md` (this file)  
**Parent epic:** Observability & Health

## Task requirements

Upgrade the existing `/health` endpoint from a simple liveness check to a deep health check that verifies all critical subsystems: database connectivity, MCP server connections, model provider reachability, and disk space. Return structured health status per subsystem.

### Current state

- `/health` returns basic liveness response
- No database connectivity check
- No MCP server health verification
- No provider reachability check

### Target state

- `GET /health` — quick liveness (unchanged, for load balancers)
- `GET /health/ready` — deep readiness probe that checks:
  - Database: run a simple query (`SELECT 1`)
  - MCP servers: verify configured servers are reachable
  - Model providers: check API key validity (lightweight call)
  - Disk: SQLite file writable, sufficient space
- Response shape:
  ```json
  {
    "status": "healthy" | "degraded" | "unhealthy",
    "checks": {
      "database": { "status": "healthy", "latencyMs": 2 },
      "mcp_servers": { "status": "degraded", "details": { "filesystem": "healthy", "custom": "unreachable" } },
      "model_provider": { "status": "healthy", "latencyMs": 150 },
      "disk": { "status": "healthy", "freeBytes": 1073741824 }
    },
    "timestamp": "2025-01-01T00:00:00Z"
  }
  ```
- Overall status: `healthy` (all green), `degraded` (non-critical failure), `unhealthy` (DB or critical failure)

## Dependency order

### Upstream — must be complete before this task

None — independent of other tasks.

### Downstream — waiting on this task

None currently.

## Implementation plan

### Step 1: Define health check contract

**File:** `packages/contracts/src/schemas/health.ts` (new)

```typescript
const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  checks: z.record(
    z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      latencyMs: z.number().optional(),
      details: z.record(z.string()).optional(),
      error: z.string().optional(),
    }),
  ),
  timestamp: z.string().datetime(),
});
```

### Step 2: Create health check service

**File:** `apps/api/src/application/healthCheck.ts` (new)

- `checkDatabase(db)` — `SELECT 1`, measure latency
- `checkMcpServers(config)` — ping each configured server
- `checkModelProvider(config)` — lightweight validation
- `checkDisk(sqlitePath)` — check file writable + free space
- `runHealthCheck()` — orchestrate all checks with timeouts (max 5s per check)
- Aggregate into overall status

### Step 3: Extract health routes to dedicated router

**File:** `apps/api/src/infrastructure/http/healthRouter.ts` (new file)

Currently, the health endpoint is **inline in `apps/api/src/infrastructure/http/createApp.ts`** (line ~17, `app.get('/health', ...)`). Extract it to a dedicated router:

- Move existing `GET /health` liveness handler from `createApp.ts` to `healthRouter.ts`
- Add `GET /health/ready` — calls `runHealthCheck()`, returns structured response
- Set appropriate HTTP status codes: 200 (healthy/degraded), 503 (unhealthy)
- Mount the router in `createApp.ts`: `app.use(healthRouter)`

### Step 4: Add to OpenAPI spec

**File:** `apps/api/openapi.yaml`

Add `/health/ready` endpoint with response schema.

### Step 5: Tests

- Unit: Each check function with mocked dependencies
- Unit: Overall status aggregation logic
- Integration: `/health/ready` endpoint returns expected shape
- Test: degraded when non-critical service is down
- Test: unhealthy when DB is down

## Git workflow (mandatory)

| Rule                 | Detail                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Feature branch**   | `feature/observability`                                                                       |
| **Task branch**      | `task/agent-platform-ged` (branch from `feature/observability` or after `agent-platform-hkn`) |
| **Segment position** | TBD based on epic ordering                                                                    |

## Tests (required before sign-off)

- **Unit:** Health check logic tests
- **Integration:** `/health/ready` endpoint tests
- **Regression:** Existing `/health` endpoint unchanged

## Acceptance criteria

1. `GET /health` still works as liveness probe
2. `GET /health/ready` returns structured subsystem checks
3. Each subsystem check has timeout protection (max 5s)
4. Overall status correctly aggregates subsystem states
5. Unhealthy returns HTTP 503
6. OpenAPI spec updated

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from correct parent
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-ged --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
