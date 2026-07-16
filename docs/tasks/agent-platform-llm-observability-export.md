# Task: Add developer diagnostics and LLM observability export

**Beads id:** `agent-platform-llm-observability-export`
**Priority:** P1
**Related work:** `agent-platform-memory`, `agent-platform-context-optimisation`, `agent-platform-project-experience`

## Summary

Add a developer diagnostics workflow that makes desktop/browser/API failures and agent runs easy to
inspect in human-readable form, then define and implement an export strategy for platform-native LLM,
context, memory, prompt assembly, model-call, and tool trace events. Agent Platform should keep its own
canonical observability events, while allowing export to OpenTelemetry/OpenInference-compatible tooling
such as Arize Phoenix or Langfuse.

This work has two related but separate layers:

- **General app observability:** Electron, Next.js BFF, API, request failures, structured logs, metrics,
  traces, crashes, and local desktop diagnostics.
- **Agent/LLM observability:** prompt assembly, context windows, memory retrieval, model calls, token
  usage, tool calls, agent trace timelines, evaluations, and run-level debugging.

## Background

The platform already has internal observability tools and trace events, and `agent-platform-context-optimisation` records the need for context-window trace metadata. What is not yet explicit is the integration strategy for third-party LLM observability and evaluation tools.

Desktop development now supports `AGENT_PLATFORM_DESKTOP_DEVTOOLS=1` through `make electron:local`,
which gives developers access to renderer DevTools and Network inspection. That helps, but it is not a
complete workflow for debugging failures such as generic `Request failed (500)` banners, hidden BFF/API
errors, slow model calls, oversized context payloads, or agent tool failures. Developers need one place
to inspect recent app errors, request metadata, correlation IDs, backend logs, and agent traces without
manually hunting across browser DevTools, Electron logs, and in-memory agent tools.

The desired direction is:

- Build product-specific instrumentation ourselves.
- Provide a local human-readable diagnostics surface for development and support.
- Store enough local trace information for debugging and user-facing inspection.
- Keep general app telemetry compatible with OpenTelemetry conventions where practical.
- Keep agent/LLM telemetry compatible with OpenTelemetry/OpenInference conventions where practical.
- Add optional exporters without coupling the platform to a single logging, APM, or LLM observability
  vendor.

## Requirements

- Add a local developer diagnostics workflow for desktop and web development:
  - recent frontend/BFF/API request failures with route, method, status, timestamp, and correlation ID
  - clear pointers to desktop backend logs (`backend.stdout.log` and `backend.stderr.log`)
  - recent agent run timeline, including prompt build, context decisions, model calls, tool calls, errors,
    and completion status
  - copy/export diagnostic bundle with redacted request, log, and trace metadata
  - a path from user-facing error banners to developer diagnostics, without exposing raw internals in
    normal product copy
- Define canonical internal events for:
  - prompt assembly
  - context-window decisions
  - memory retrieval
  - session summary inclusion
  - model calls
  - tool calls and tool summaries
  - compaction/compression decisions
- Map internal events to OpenTelemetry/OpenInference-style spans and attributes.
- Support at least one optional export path or adapter design.
- Keep local observability working when no third-party service is configured.
- Avoid logging secrets, raw API keys, or unsafe prompt/tool payloads.
- Document recommended third-party options and tradeoffs.
- Decide whether external observability is development-only, opt-in per environment, or suitable for
  staging/production with stricter redaction.

## Candidate Tooling

### General App Observability

- OpenTelemetry Collector: vendor-neutral pipeline for logs, metrics, and traces. Treat this as the
  preferred export contract unless refinement proves otherwise.
- SigNoz: open-source/OpenTelemetry-native observability platform for logs, traces, metrics, errors,
  dashboards, and alerts. Candidate first combined developer stack because it can cover both app and AI
  observability signals in one place.
- Grafana Loki + Grafana: open-source log aggregation and querying. Candidate lightweight logging-focused
  fallback, especially if we only need log search/dashboards initially.
- Sentry, GlitchTip, or Bugsink: error and crash monitoring options for frontend/backend exceptions and
  renderer crashes. Candidate complement if stack traces and release/error grouping are more valuable
  than log aggregation for the first increment.

### Agent/LLM Observability

- Arize Phoenix: open-source tracing, evaluations, datasets, experiments, and prompt debugging; strong
  OpenTelemetry/OpenInference alignment.
- Langfuse: open-source/self-hostable LLM observability, prompt management, evals, experiments, cost and
  latency tracking; useful for multi-turn session traces.
- Helicone: open-source LLM gateway/observability with request, cost, latency, and routing visibility;
  potentially lower-friction for provider-call monitoring.

During refinement, compare the candidates against:

- free/self-hosted/open-source availability
- TypeScript/Node integration quality
- OpenTelemetry/OpenInference compatibility
- support for both general logs/traces/metrics and agent-specific traces
- local development setup effort
- support for multi-turn sessions, tool calls, token usage, latency, and cost
- data redaction and self-hosting controls
- whether it observes only provider calls or the full agent process

## Refinement And Planning Gate

Before implementation starts, complete a short refinement pass and record the decision in this spec:

1. Define the exact first increment:
   - local diagnostics only
   - OpenTelemetry export only
   - SigNoz/Loki/Sentry-style general logging integration
   - Phoenix/Langfuse/Helicone-style LLM observability integration
   - or a staged combination
2. Choose the first concrete tooling target and fallback option.
3. Define the data model and redaction policy:
   - request IDs and correlation IDs
   - session IDs and run IDs
   - route/method/status/timing
   - model/provider/token/cost metadata
   - tool names/status/duration
   - bounded prompt/context summaries, never raw secrets
4. Define environment controls:
   - development defaults
   - staging opt-in
   - production safety requirements
5. Define the final Definition of Done for the chosen increment, including local verification and any
   smoke test against the selected external/local observability target.

## Proposed Timing

Pick this up as a P1 follow-up after the current Project Experience task closes, because recent manual
testing showed that generic UI failures and context/rate-limit issues are hard to diagnose without a
developer-readable diagnostics workflow.

This can start before the full memory/context optimisation work if the first increment focuses on:

- request/error diagnostics
- existing agent trace events
- local log discovery/export
- exporter interface design

The deeper event model should stay aligned with:

- `agent-platform-memory` for memory events and source metadata.
- `agent-platform-context-optimisation` for context-window and compaction events.

## Tests And Verification

- Unit tests for diagnostics view models and redaction helpers.
- API/BFF tests proving correlation IDs and request metadata are exposed safely to diagnostics.
- Desktop tests proving log locations are discoverable without exposing raw paths in primary UI.
- Unit tests for event-to-span mapping.
- Redaction tests for prompt, memory, and tool payloads.
- Integration test for disabled exporter mode.
- Integration or smoke test for an enabled exporter adapter using a mock collector.

## Definition Of Done

- Developers can inspect recent UI/API failures and agent runs in a human-readable local diagnostics
  workflow without relying only on Electron DevTools or raw log files.
- Error banners/debug details include enough correlation metadata to locate the relevant diagnostics.
- Internal observability remains canonical and vendor-neutral.
- Export mapping is documented and covered by tests.
- At least one exporter path or adapter interface exists.
- Secrets and sensitive payloads are redacted before export.
- A recommendation is documented for the first third-party tool to support, including why it was chosen
  over the alternatives.
