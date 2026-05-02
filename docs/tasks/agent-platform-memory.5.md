# Task: Add memory tools and Memory UI for inspect, edit, delete, export

**Beads id:** `agent-platform-memory.5`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Expose memory safely through tools and UI so users can inspect, approve, edit, delete, export, and clear memory.

## Requirements

- Add memory management API endpoints and/or built-in tools.
- Add UI views for memory records and pending candidates.
- Support approve, reject, edit, delete, export, and clear-by-scope actions.
- Show source metadata, confidence, status, scope, and expiry.
- Keep destructive actions explicit and auditable.

## Implementation Plan

1. Add API routes and shared client types.
2. Add read-only and management tool definitions with risk tiers.
3. Add Memory settings UI.
4. Add audit/trace events for management actions.

## Tests And Verification

- API tests for list/filter/update/delete/export.
- UI tests for review and delete flows.
- Tool tests for scope enforcement and risk tiers.

## Definition Of Done

- Users can manage memory without direct DB access.
- Pending candidates are reviewable.
- Memory export/clear workflows are safe and documented.
