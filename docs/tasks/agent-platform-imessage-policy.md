# Owner iMessage notification policy

## Summary and scope

Record the owner-approved notification policy in shared agent instructions, reachable from AGENTS.md.
Documentation only on `task/development-lifecycle-plan`, targeting `feature/harness-backlog-review`.
No orchestration transport, worker permissions, merge or staging changes are authorized by this task.

## Requirements

- Preserve the exact authorized recipient and the three event triggers supplied by the owner.
- Require brief messages, no routine updates or duplicates, and no secrets or sensitive file content.
- Require the iMessage reply tool and confirmed success; report failure or unavailability in Codex.
- Distinguish the host connection from isolated worker access and proposed dispatcher integration.

## Implementation plan and dependencies

Update the canonical shared instructions and AGENTS.md link, then validate Markdown and references.
There are no implementation dependencies for this documentation change. A future runtime adapter
requires its own bounded plan and tests; it is not delivered or scheduled by this specification.
Beads remains authoritative for status. Publish through existing PR276; no separate runtime task is claimed.

## Verification and definition of done

Read back recipient, triggers and failure rules against the owner's request; validate Markdown and
local links; commit and push the documentation; publish and verify the Notion mirrors. A completion
notification must be confirmed by the tool or explicitly reported as failed/unavailable in Codex.
No application tests are needed for this documentation-only change. Feature integration remains
subject to the existing PR checks and owner merge decision.

## Sign-off

Owner explicitly authorized the policy in chat. Documentation validation and publication evidence
are recorded in Beads. Runtime iMessage integration remains proposed and unimplemented.
