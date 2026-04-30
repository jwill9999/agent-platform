# Task: Add observability-driven improvement goals

**Beads id:** `agent-platform-improvement-goals`  
**Priority:** P2  
**Related work:** `agent-platform-memory`, `agent-platform-context-optimisation`, `agent-platform-llm-observability-export`

## Summary

Define a limited self-learning loop that turns observability, context-efficiency, memory, and tool-use signals into reviewed improvement candidates. Start with a small measurable objective to validate the loop before expanding to broader self-improvement.

## Objective

The first version should prove that Agent Platform can observe a recurring inefficiency or failure mode, compare it against a goal, and propose a safe improvement candidate for human review.

The platform must not silently change prompts, policies, memory, tasks, or code based only on self-observed data.

## Candidate Signals

- High input-token usage.
- Context compaction followed by a correction or failed tool use.
- Repeated recoverable tool failures, such as missing directories or path mistakes.
- Repeated quality-gate failures with the same root cause.
- Memory retrieval returning too many or low-value items.
- User corrections such as "you forgot", "that was already decided", or "we fixed this before".
- Expensive model calls where a cheaper/default model may have been sufficient.

## Initial Small Objective

Start with one narrow objective, for example:

- Detect repeated recoverable workspace path/file errors across recent sessions.
- Generate a reviewed candidate such as:
  - update short-term memory guidance,
  - add a test fixture,
  - create a Beads follow-up,
  - adjust a tool schema or helper prompt.

This gives us a low-risk proof that the loop works before applying it to larger optimisation goals.

## Requirements

- Define monitored goals with thresholds and time/session windows.
- Query observability/memory data for those goals.
- Generate improvement candidates with:
  - source evidence,
  - affected area,
  - proposed action,
  - expected benefit,
  - risk level,
  - required human review status.
- Allow candidates to become Beads tasks only after review/approval.
- Allow candidates to become durable memories only after review/approval.
- Record before/after metrics when an improvement is implemented.

## Non-Goals For First Pass

- Autonomous code changes.
- Autonomous prompt or policy changes.
- Broad optimisation across every metric.
- Vendor-specific observability dashboards.

## Tests And Verification

- Unit tests for goal threshold evaluation.
- Unit tests for candidate generation from mocked observability records.
- Safety tests proving candidates remain pending review and are not auto-applied.
- Integration test for turning an approved candidate into a Beads task proposal or memory candidate.

## Definition Of Done

- A small self-learning objective is implemented and measured.
- Improvement candidates are evidence-backed and review-gated.
- No autonomous changes are applied without approval.
- The workflow can be expanded to additional goals later.
