# Harness client-independence audit

**Date:** 16 October 2026. **Beads:** `agent-platform-harness-interface-audit`.
**Source:** staging cf5f04524c25c29635b0d84bda4e76282f28ddcb, identical runtime at docs head369ae334.
**Method:** bounded source inspection by coordinator and distinct plan critic. No new product tests,
new clients or runtime modifications. Result: shared backend foundations exist; explicit Stop is a gap.

| Capability     | Actual source                                                                                                                 | Assessment / disposition                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat execution | API infrastructure HTTP `v1/chatRouter.ts`, `sessionsRouter.ts`; harness graph                                                | POST chat/resume already works without a renderer. Stream ownership is transport-scoped; add shared logical run discovery/Stop, STOP-1–4. Existing IDs do not provide this authority.                                                                                     |
| Approvals      | `v1/approvalRequestsRouter.ts`; DB `repositories/approvalRequests.ts`                                                         | List/approve/reject/resume APIs exist; backend decides permissions. Stop must fence source run and fresh resumed execution, even after approval claim. STOP-4/5.                                                                                                          |
| Git delivery   | `apps/api/src/application/gitDelivery/service.ts`, `types.ts`; `interfaces/http/v1/gitDeliveryRouter.ts`; chatRouter executor | Chat and panel use shared application service/receipts. Future clients retain human confirmation/server actor binding; a client must not self-select a more privileged actor channel. No current renderer dependency established by the word panel.                       |
| MCP            | `v1/mcpServersRouter.ts`, application `mcp/testMcpConnection.ts`, mcp-adapter/session                                         | Validated import/CRUD/test and harness calls exist server-side. Browser text-format parsing is a convenience; no evidence a new CLI parser is an architectural prerequisite.                                                                                              |
| Context        | contracts `agent.ts`, harness `nodes/llmReason.ts`                                                                            | Persisted settings and server model admission are shared. Missing CLI settings UI is not a backend failure. Existing context tests remain required regression.                                                                                                            |
| Diagnostics    | `v1/diagnosticsRouter.ts`, `diagnostics/localAccess.ts`, `scripts/diagnostics.mjs`                                            | API and actual CLI already read safe history. Loopback/private capability is intentional security, not UI coupling. Docker bridge browser limitation remains; do not widen capability exposure. New monitoring must retain backend recording and headless history access. |

Stop has no durable independent control API today. Its design must be application-owned and return
stable typed state/errors/identity for every consumer. Direct HTTP acceptance without a renderer
will exercise the same control/effects as browser/Electron. Voice recognition, general CLI commands,
a public remote control API, distributed clients and broad HTTP/business-logic refactoring are excluded.

Findings map to Stop STOP-1–7 and monitoring MON-1, with existing `harness-r3.reconcile` and
`harness-v4.local` retained for broader recovery/status. No speculative defect tickets are created
merely because a client does not exist. The audit covers selected current local capabilities, not
all routes, arbitrary third-party clients or production network/auth design. Any later API feature
plan should identify its shared service, typed contract and no-renderer acceptance case explicitly.
