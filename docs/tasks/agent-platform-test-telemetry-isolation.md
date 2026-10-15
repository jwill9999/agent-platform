# Isolate default tests from external tracing

**Beads issue:** `agent-platform-test-telemetry-isolation`

**Spec file:** `docs/tasks/agent-platform-test-telemetry-isolation.md`

Status: open P2 follow-up discovered during Git-delivery verification; separate from the approved Git MVP implementation.

## Task requirements and evidence

The normal API suite emitted rejected LangSmith multipart uploads (HTTP403) during older and new Git-delivery tests. Current API Vitest uses a shared `isolate:false` fork without process-wide tracing isolation; the existing chat environment helper does not snapshot tracing flags. Safe inspection found an inherited API-key variable present and tracing flags absent, but key presence alone does not explain activation. The exact enabling source and asynchronous trace ownership are unproven. Do not record credential values or infer that rejected requests were stored successfully.

Evidence: `/Users/letuscode/.codex/git-delivery-implementation-20261014/test-telemetry-isolation-finding.json` and retained `chat-checkpoint-push.log`. The actual API suite passed459 tests; telemetry403 is not an assertion-failure claim. Independent critic recommended this separate follow-up and no Git-MVP gate waiver.

## Dependency order and boundaries

Discovered from `agent-platform-git-delivery-verification`; this relation does not block or expand that MVP. No implementation has been performed for this issue. Any later work uses its own bounded task branch and review. Do not alter global configuration/credentials or disable product diagnostic requirements.

## Implementation plan and verification

Investigate trace activation and shared-fork restoration order with process-scoped synthetic environment controls before imports. Make default test runs perform zero external trace-upload attempts even when tracing credentials/configuration are inherited. Explicit telemetry tests must opt into an owned fake endpoint and retain their assertions. Future local qualification commands set the three tracing flags false before process startup; this mitigation is not a completed suite-wide repair.

Test inherited true/false flags, parent environment preservation, repeated/shared-fork order and import-time clients; count outbound requests through an owned endpoint. Run relevant API/harness tests and normal quality gates. Obtain independent source/effect review, publish/read back this specification and actual results, then close/read back/sync Beads only after the acceptance criteria pass.

## Definition of done

Default tests prove zero external trace uploads, explicit telemetry tests prove the owned endpoint behavior, product diagnostics and meaningful assertions remain intact, and no secrets/globals were changed. Source/tests/review, pushed branch and complete documentation readbacks are required before closure. Do not claim the root cause from variable presence alone.
