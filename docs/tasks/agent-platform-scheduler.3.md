# Task: Add background process tracking and log capture

**Beads id:** `agent-platform-scheduler.3`  
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Make scheduled/background runs inspectable by capturing bounded structured events, stdout/stderr-style summaries where applicable, result artifacts, and failure details.

## Requirements

- Persist bounded run logs/events linked to `scheduled_job_runs`.
- Capture lifecycle events: claimed, started, output, retry scheduled, cancelled, failed, succeeded.
- Store enough evidence for the UI and agents to understand what happened without dumping unbounded output.
- Redact secrets before persistence.
- Add truncation metadata so users can tell when logs were clipped.
- Keep log capture reusable for later long-running coding/background processes.

## Implementation Plan

1. Add log append/read helpers if not complete in `.1`.
2. Wire runner lifecycle and target output into bounded log persistence.
3. Add redaction/truncation helpers or reuse existing output guard patterns.
4. Add API-level read models if needed for `.4`.
5. Add tests covering truncation, redaction, ordering, and terminal failure summaries.

## Tests And Verification

- DB tests for log append/read bounds.
- Runner tests for lifecycle event capture.
- Regression tests for secret redaction and truncation metadata.
- Relevant package typecheck/lint/test commands.

## Definition Of Done

- Every run has inspectable lifecycle evidence.
- Logs are bounded, ordered, and redacted.
- Large output cannot bloat SQLite or the UI.
