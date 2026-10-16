# Audit harness APIs for UI-independent consumers

**Beads:** `agent-platform-harness-interface-audit`, planning/source-audit only.
[Results](../reviews/harness-interface-audit.md); [Stop plan](../planning/project-chat-stop-mvp.md).

## Scope and definition of done

Inspect actual staging backend ownership for chat, approvals, Git delivery, MCP configuration and
execution, context policy and diagnostics. Check identity/state/error/permission boundaries and
separate missing clients from capabilities incorrectly owned by a UI. Produce source references,
limitations, concrete dispositions and independent source critique; link real Beads follow-ups and
Stop requirements. This is a bounded audit, not a repository-wide code rewrite or proof of unbuilt
voice/CLI journeys. Planned runtime tests are not executed audit evidence.

Completion: pushed audit/spec/plan, direct Markdown/format/link validation, distinct critic findings
resolved, complete Notion mirrors and source metadata read back, Beads notes/readback/Dolt sync.
Intermediate docs task within the current planning chain; no independent feature merge or runtime
implementation follows from closing this source audit. Preserve all paused work and current product
permission controls. Only Stop's actual missing control capability is included in its proposed
implementation. Broader UI/status/recovery clients remain separately selected backlog work.
