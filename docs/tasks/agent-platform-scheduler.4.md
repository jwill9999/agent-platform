# Task: Add UI and API controls for scheduled and background work

**Beads id:** `agent-platform-scheduler.4`
**Parent epic:** `agent-platform-scheduler` - Scheduler and background work

## Summary

Expose scheduler management through the API and Settings UI so users can create, inspect, pause, resume, cancel, manually run, and review logs for scheduled/background work.

## Requirements

- Add REST endpoints for jobs, runs, manual run, pause/resume, cancel, and log inspection.
- Validate all request bodies through shared contracts.
- Add Settings navigation and a scheduler dashboard UI.
- Show job status, next run time, last run summary, retry state, and recent logs.
- Make state changes visually obvious and responsive.
- Keep destructive actions confirmed and policy-aligned.

## Implementation Plan

1. Add API router and contract-aligned request/response schemas.
2. Add frontend API client usage and scheduler Settings page.
3. Build list/detail views for jobs and runs.
4. Add action controls for pause/resume/cancel/manual run.
5. Add focused API and web tests.
6. Add manual testing guidance to the task handoff.

## Tests And Verification

- API router tests for CRUD/actions/logs.
- Web tests for rendering and action calls where practical.
- Manual test via `make restart` and Settings UI.
- `pnpm --filter @agent-platform/api test`
- `pnpm --filter @agent-platform/web test`
- Relevant typecheck/lint commands.

## Definition Of Done

- Users can manage scheduled/background work from Settings.
- State transitions are visible and understandable.
- API and UI enforce the same validation and safety expectations.
