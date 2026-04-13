# @agent-platform/contracts

Zod schemas and exported TypeScript types for API, streaming, and harness boundaries.

## Public exports (`src/index.ts`)

| Export                                     | Description                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `ExecutionLimitsSchema`, `ExecutionLimits` | Per-run caps (steps, parallelism, timeout, optional token/cost).            |
| `OutputSchema`, `Output`                   | Chat/tool stream union: `text`, `code`, `tool_result`, `error`, `thinking`. |
| `SkillSchema`, `Skill`                     | Normalized skill definition.                                                |
| `SecretRefSchema`, `SecretRef`             | Reference to stored secret (no raw secret values).                          |
| `AgentSchema`, `Agent`                     | Persisted agent profile and allowlists.                                     |
| `PlanSchema`, `Plan`, `TaskSchema`, `Task` | Planner JSON shapes.                                                        |

## Scripts

- `pnpm run build` — emit `dist/`
- `pnpm run test` — Vitest round-trip tests
