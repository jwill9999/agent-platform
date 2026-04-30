# Task: Add LLM observability export strategy

**Beads id:** `agent-platform-llm-observability-export`  
**Priority:** P2  
**Related work:** `agent-platform-memory`, `agent-platform-context-optimisation`

## Summary

Define and implement an export strategy for platform-native LLM, context, memory, prompt assembly, model-call, and tool trace events. Agent Platform should keep its own canonical observability events, while allowing export to OpenTelemetry/OpenInference-compatible tooling such as Arize Phoenix or Langfuse.

## Background

The platform already has internal observability tools and trace events, and `agent-platform-context-optimisation` records the need for context-window trace metadata. What is not yet explicit is the integration strategy for third-party LLM observability and evaluation tools.

The desired direction is:

- Build product-specific instrumentation ourselves.
- Store enough local trace information for debugging and user-facing inspection.
- Keep event names and attributes compatible with common observability conventions where practical.
- Add optional exporters without coupling the platform to a single vendor.

## Requirements

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

## Candidate Tools

- Arize Phoenix: open-source tracing, evaluations, datasets, experiments, and prompt debugging.
- Langfuse: open-source LLM observability, prompt management, evals, and experiments.
- Helicone: LLM gateway, provider observability, cost/routing, and prompt management.

## Proposed Timing

Pick this up after the memory/context foundations define the event payloads that need exporting:

- `agent-platform-memory` for memory events and source metadata.
- `agent-platform-context-optimisation` for context-window and compaction events.

## Tests And Verification

- Unit tests for event-to-span mapping.
- Redaction tests for prompt, memory, and tool payloads.
- Integration test for disabled exporter mode.
- Integration or smoke test for an enabled exporter adapter using a mock collector.

## Definition Of Done

- Internal observability remains canonical and vendor-neutral.
- Export mapping is documented and covered by tests.
- At least one exporter path or adapter interface exists.
- Secrets and sensitive payloads are redacted before export.
