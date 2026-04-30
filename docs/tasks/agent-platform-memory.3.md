# Task: Add memory candidate extraction from corrections, failures, and remediations

**Beads id:** `agent-platform-memory.3`  
**Parent epic:** `agent-platform-memory` - Memory management and self-learning

## Summary

Detect candidate memories from user corrections, repeated failures, and successful remediations, but keep them pending review.

## Requirements

- Extract memory candidates from:
  - user corrections
  - failed tool/test runs followed by fixes
  - repeated runtime errors
  - explicit user instructions to remember something
- Attach source metadata, confidence, scope suggestion, and rationale.
- Secret-scan candidate content before storage.
- Store candidates as pending review, not active memory.

## Implementation Plan

1. Add candidate extraction service and schemas.
2. Add conservative heuristics for explicit user correction and remediation patterns.
3. Add review status handling in the repository.
4. Add tests for false-positive and secret-redaction cases.

## Tests And Verification

- Unit tests for candidate extraction from mocked sessions/tool traces.
- Safety tests for credential-like content.
- Tests proving candidates are not retrieved as active memories before approval.

## Definition Of Done

- Memory candidates can be generated with evidence and rationale.
- Candidates require review before durable use.
- Sensitive content is rejected or redacted.
