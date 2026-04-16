# Task: Observability layer with pluggable metrics forwarding

**Beads issue:** `agent-platform-hkn`  
**Spec file:** `docs/tasks/agent-platform-hkn.md` (this file)  
**Parent epic:** Observability & Health

## Task requirements

Add a built-in observability layer that collects structured metrics and traces from agent execution, and forwards them to a pluggable backend. Default backend: structured JSON logging. Plugins can override to send metrics to Prometheus, OpenTelemetry, Datadog, etc.

### Current state

- **Trace events** exist in `packages/harness/src/trace.ts` — rich execution trace (`graph_start`, `llm_call`, `tool_dispatch`, `task_done`, `loop_detected`, etc.)
- **Traces are ephemeral** — live only during a single request, not persisted or exported
- **Plugin hooks** (`onSessionStart`, `onTaskStart`, `onPromptBuild`, `onToolCall`, `onTaskEnd`, `onError`) provide lifecycle events
- **No metrics collection** — no counters, histograms, gauges
- **No onMetric or onHealthCheck plugin hooks**
- **Logging** via `packages/logger` (structured pino logger)
- **No Prometheus/OTel export**

### Target state

- **Metrics collector** that tracks:
  - Request count, latency, errors (per endpoint)
  - LLM call count, latency, tokens (per model/provider)
  - Tool call count, latency, success rate (per tool)
  - Active sessions, active executions
  - Token usage, cost units
- **Trace persistence** — execution traces saved to DB or file for post-mortem analysis
- **Plugin hook: `onMetric`** — fires on every metric emission; plugins forward to their backend
- **Default backend** — structured JSON log lines (via existing pino logger)
- **Pluggable** — plugins can replace the default with Prometheus, OTel, StatsD, etc.
- **`/metrics`** endpoint (optional) — Prometheus scrape endpoint with default backend

## Dependency order

### Upstream — must be complete before this task

None — independent task.

### Downstream — waiting on this task

| Issue                | Spec                                         |
| -------------------- | -------------------------------------------- |
| `agent-platform-ged` | [Deep health check](./agent-platform-ged.md) |

Health check can leverage the metrics layer for latency data.

## Implementation plan

### Step 1: Define metrics types

**File:** `packages/contracts/src/schemas/metrics.ts` (new)

```typescript
export type MetricType = 'counter' | 'histogram' | 'gauge';

export interface MetricEvent {
  name: string; // e.g. 'llm.call.latency'
  type: MetricType;
  value: number;
  labels: Record<string, string>; // e.g. { provider: 'openai', model: 'gpt-4' }
  timestamp: number;
}
```

### Step 2: Create metrics collector

**File:** `packages/harness/src/metrics.ts` (new)

```typescript
export interface MetricsCollector {
  counter(name: string, labels?: Record<string, string>): void;
  histogram(name: string, value: number, labels?: Record<string, string>): void;
  gauge(name: string, value: number, labels?: Record<string, string>): void;
}

export function createMetricsCollector(emitFn: (event: MetricEvent) => void): MetricsCollector;
```

### Step 3: Add `onMetric` plugin hook

**File:** `packages/plugin-sdk/src/hooks.ts`

```typescript
onMetric?: (ctx: MetricContext) => void | Promise<void>;
```

**File:** `packages/plugin-sdk/src/contexts.ts`

```typescript
export interface MetricContext {
  metric: MetricEvent;
}
```

Update dispatcher to call `onMetric` for each metric emission.

### Step 4: Instrument harness nodes

**File:** `packages/harness/src/nodes/llmReason.ts`

Add metrics:

- `llm.call.count` (counter)
- `llm.call.latency_ms` (histogram)
- `llm.call.tokens` (histogram, labels: input/output)
- `llm.call.error` (counter)

**File:** `packages/harness/src/nodes/toolDispatch.ts`

Add metrics:

- `tool.call.count` (counter)
- `tool.call.latency_ms` (histogram)
- `tool.call.error` (counter)
- `tool.call.timeout` (counter)

### Step 5: Instrument chat router

**File:** `apps/api/src/infrastructure/http/v1/chatRouter.ts`

Add metrics:

- `chat.request.count` (counter)
- `chat.request.latency_ms` (histogram)
- `chat.request.error` (counter)
- `session.active` (gauge)

### Step 6: Create default logging backend

**File:** `packages/harness/src/backends/logMetrics.ts` (new)

Default implementation: log metrics as structured JSON via pino logger.

### Step 7: Add trace persistence (optional)

**File:** `packages/db/src/repositories/traces.ts` (new)

Store execution traces in a `traces` table:

```sql
CREATE TABLE traces (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  events TEXT NOT NULL,  -- JSON array of trace events
  created_at_ms INTEGER NOT NULL
);
```

### Step 8: Tests

- Unit: MetricsCollector counter/histogram/gauge
- Unit: onMetric hook dispatched
- Unit: Default logging backend outputs structured JSON
- Integration: Chat request emits expected metrics
- Integration: LLM call metrics include latency and tokens

## Git workflow (mandatory)

| Rule                 | Detail                                                          |
| -------------------- | --------------------------------------------------------------- |
| **Feature branch**   | `feature/observability`                                         |
| **Task branch**      | `task/agent-platform-hkn` (branch from `feature/observability`) |
| **Segment position** | First task in segment                                           |

## Tests (required before sign-off)

- **Unit:** Metrics collector, plugin hook dispatch, logging backend
- **Integration:** End-to-end metric emission on chat request
- **Regression:** Existing tests pass (metrics are additive, not breaking)

## Acceptance criteria

1. Metrics collected for LLM calls, tool calls, and chat requests
2. `onMetric` plugin hook fires for each metric
3. Default backend logs structured JSON via pino
4. Plugins can override metric forwarding via `onMetric` hook
5. Trace persistence controlled by env var `TRACE_PERSISTENCE_ENABLED` (default: off); when enabled, traces written to `traces` table after each execution
6. Existing tests pass

## Definition of done

- [ ] Beads **description** and **acceptance_criteria** satisfied
- [ ] **Every checkbox** in this spec is complete
- [ ] All **upstream** Beads issues are **closed**
- [ ] **Unit tests** run and pass
- [ ] **Git:** branch pushed; if segment tip, PR merged
- [ ] This spec file updated if scope changed

## Sign-off

- [ ] **Task branch** created from `feature/observability`
- [ ] **Unit tests** executed and passing
- [ ] **Checklists** complete
- [ ] If **segment tip:** PR merged (link: ********\_********) — _or "N/A — merge at segment end"_
- [ ] `bd close agent-platform-hkn --reason "…"`
- [ ] `decisions.md` updated only if architectural decision changed
- [ ] `session.md` updated if handoff needed

**Reviewer / owner:** **********\_********** **Date:** ******\_******
