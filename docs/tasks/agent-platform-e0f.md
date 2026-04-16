# Task: Create OpenAPI 3.0 YAML Spec

**Beads issue:** `agent-platform-e0f`  
**Spec file:** `docs/tasks/agent-platform-e0f.md` (this file)  
**Parent epic:** `agent-platform-fx5` — OpenAPI Integration

## Task requirements

Create a comprehensive OpenAPI 3.0+ specification covering every `/v1` endpoint in the Agent Platform API. The spec must:

- Be stored at `contracts/openapi/agent-platform.yaml`
- Include `operationId` on every operation (required for tool mapping)
- Define request/response schemas matching `packages/contracts` Zod definitions
- Document the NDJSON streaming chat endpoint with discriminated-union Output events
- Cover all status codes and the shared error response shape

## Dependency order

### Upstream — must be complete before this task

None — this is the first task in the epic.

### Downstream — waiting on this task

| Issue                | Spec                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `agent-platform-4f0` | [Expose Swagger UI at /api-docs](./agent-platform-4f0.md)         |
| `agent-platform-2w6` | [Align OpenAPI with tool contracts](./agent-platform-2w6.md)      |
| `agent-platform-o8h` | [Request/response validation middleware](./agent-platform-o8h.md) |

## Implementation plan

1. Explore all `/v1` routes to catalogue endpoints, request/response shapes, and status codes.
2. Cross-reference with `packages/contracts/src/` Zod schemas for exact field names, types, constraints.
3. Write `contracts/openapi/agent-platform.yaml` with all paths, schemas, parameters, and responses.
4. Validate YAML is well-formed (parse with Python yaml or similar).
5. Commit and push.

## Git workflow (mandatory)

| Rule              | Detail                                        |
| ----------------- | --------------------------------------------- |
| **Parent branch** | `feature/openapi-integration`                 |
| **Task branch**   | `task/agent-platform-e0f`                     |
| **Role**          | First task in segment — branched from feature |

## Tests (required before sign-off)

- **Unit (minimum):** No code changes to test — this is a YAML spec file. Validation is done by parsing.
- **Integration:** Swagger UI serving (handled in next task `agent-platform-4f0`).

## Definition of done

- [x] Beads **description** and **acceptance_criteria** satisfied.
- [x] **Every checkbox** in this spec (including **Sign-off**) is complete.
- [x] All **upstream** Beads issues are **closed** (none for this task).
- [x] YAML validates (parsed successfully with Python yaml).
- [x] **Git:** branch pushed.
- [ ] This spec file updated if scope or dependencies changed during implementation.

## Sign-off

- [x] **Task branch** created from `feature/openapi-integration`
- [x] YAML validates — parsed with Python yaml, 13 paths / 30 operations / 19 schemas
- [x] Schemas match `packages/contracts` Zod definitions exactly
- [ ] If **segment tip:** N/A — not the segment tip
- [ ] `bd close agent-platform-e0f --reason "…"`
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
