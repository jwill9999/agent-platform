# Provider SDK compatibility and model choice — bounded local MVP

Status: owner-authorized 18 October 2026; independent plan critique approved after SDK-P04/P05 corrections. Implementation and qualification in progress.

## Objective and authority

Restore maintained-SDK model calls and configurable provider choice before owner stress testing.
Owner approved completion through planning, critique, implementation and tests. Owner confirmed
OpenAI, Claude, Gemini, DeepSeek and Grok coverage plus OpenRouter alternatives; researched emulated
services are accepted. No paid calls are needed or authorized. Preserve paused orchestration/PR283,
main, disabled Docker gateway, unrelated worktrees and owner app/profile. No Notion publication.
SDK major changes are within this feature approval; merge authority must be established separately.

## Requirements and stopping point

- SDK-R1: Pin a compatible maintained SDK/provider cohort. Migrate SDK message/tool/stream/usage
  contracts, retaining the graph as execution owner, maxRetries0/controlled outer retries, Stop
  fences, output admission and application NDJSON. No new agent loop/framework/gateway.
- SDK-R2: Native adapters for OpenAI, Anthropic, Google, DeepSeek and xAI, plus maintained OpenRouter
  adapter and retained Ollama/compatible local endpoints. Model IDs remain user-configurable.
  Five representative connections are coverage, not rankings or a guarantee every model supports tools.
- SDK-R3: Shared API/DB saves provider, case-preserved model ID, optional validated endpoint and
  encrypted credential. Settings consumes a backend provider catalogue; all callers use the same
  configuration. Reject unknown-provider OpenAI-key fallback, URL credentials/query/fragment, unsafe
  schemes and credential-forwarding redirects. Remote endpoints require HTTPS; explicit loopback
  HTTP remains available for local services/fixtures. Explain custom endpoints receive the saved key.
  Changing provider clears its old credential unless replaced explicitly. Preserve existing config IDs.
- SDK-R4: Bounded one-attempt SDK generation connection probes, explicit output cap/deadline/no
  retries. Only completed valid SDK responses succeed. HTTP400 mentioning max_tokens remains failed.
  Fixed safe categories distinguish auth, quota/rate, access/model, request, transport, timeout and
  unknown errors. Accessible visible UI text replaces tooltip-only failure. No raw provider body/error.
- SDK-R5: Preserve SDK-private assistant parts required for stateless reasoning/tool continuation
  across approval waits and completed-history restart. A real process restart still interrupts
  old pending runs and fences their approvals under the existing Stop policy. OpenAI uses explicit store:false, no previousResponseId/server
  storage reliance. Capture actual SDK7 responseMessages, not reconstructed text/args. Separate
  encrypted internal DB table keyed to public message/session, cascading with session deletion;
  public MessageRecord/list APIs/plugins/working-memory/logs/diagnostic exports exclude private parts.
  Bind provider/model/API mode/normalized endpoint and credential/config revision (ciphertext-envelope
  digest plus config fields is acceptable, never key fingerprints in logs). Validate encrypted inner
  message/session/binding and tool IDs/args. Completed-turn provider switching strips foreign opaque
  parts but retains complete public history. Changed binding during pending approval fails closed
  before model/tool effects. Corrupt/missing required/duplicate/ambiguous parts fail closed.
  Serialized caps: 256KiB/message and4MiB/session, no truncation or eviction of required continuation.
  Validate before dispatch, then atomically persist public/private rows. Retention follows conversation
  lifecycle, independent of seven-day diagnostics. Attach private parts before context estimation and
  retain atomic reasoning/tool/result groups. Legacy history remains readable. App-local SDK warning
  logging uses fixed categories only; raw warnings can contain private metadata and must not escape.
- SDK-R6: Durable connection-probe start/outcome/duration/provider/config-ID through existing local
  diagnostics, including settings probes currently excluded by ingress. Coverage/loss remains visible.
  No keys/prompts/raw bodies/endpoints/private parts. Observation failure cannot alter execution result.
- SDK-R7: Connected browser/Electron qualifies saved configuration, model switching, streaming,
  tools/approval/deny, completed-history restart continuation, stale-approval rejection, Stop, context
  and diagnostic exports. Separate emulation,
  live provider access and actual owner-app readiness. Final diagnostic review owns finding disposition.

No dashboards, accounts, cloud distribution, automatic fallback, broad telemetry, new voice/CLI UI,
LangChain upgrade or paused code/test edits. Existing security debt stays tracked; record actual audit
changes, not assumed SDK remediation. Expected3–5 focused engineering days including qualification,
an estimate rather than a deadline. Stop at R1–7; do not expand into broad framework replacement.

## Researched connection matrix

Examples as of18October2026; confirm exact native wire/API capability in source-bound fixtures.

| Family   | Native example      | Native adapter                       | OpenRouter alternative       |
| -------- | ------------------- | ------------------------------------ | ---------------------------- |
| OpenAI   | gpt-6.1-sol         | @ai-sdk/openai Responses/store:false | openai/gpt-6.1-sol           |
| Claude   | claude-sonnet-5-5   | @ai-sdk/anthropic Messages           | anthropic/claude-sonnet-5.5  |
| Gemini   | gemini-4-argon      | @ai-sdk/google GenerateContent       | google/gemini-4-argon        |
| DeepSeek | deepseek-v4.1-flash | @ai-sdk/deepseek                     | deepseek/deepseek-v4.1-flash |
| Grok     | grok-4.7            | @ai-sdk/xai                          | x-ai/grok-4.7                |

Sources: [OpenAI](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[Claude](https://platform.claude.com/docs/en/models/overview),
[Gemini](https://ai.google.dev/gemini-api/docs/models),
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/),
[xAI](https://docs.x.ai/developers/models),
[OpenRouter catalogue](https://openrouter.ai/api/v1/models), [SDK index](https://ai-sdk.dev/llms.txt).
Catalogue presence proves neither account access nor compatibility. No runtime hardcoded model list.

Installed pinned cohort: ai7.0.143/OpenAI4.0.96/Anthropic4.0.82/Google4.0.99/compatible3.0.71/
xAI5.0.24/DeepSeek3.0.67/OpenRouter3.1.0. Exact registry tarball SRI/source verified;
Node>=22/Zod>=3.25.76 match Node24/Zod3.25.76. Unused web ai/@ai-sdk/react imports and dependencies
were removed instead of introducing SDK UI streams, as reviewed below.

## Source, tasks, manifest and delivery

Base staging ece78d8a3166bbe2d4d191e83cbe864ebe2229eb. Reused clean checkout
`/Users/letuscode/.codex/worktrees/openai-parameter-repair/agent-platform`; feature
`feature/provider-sdk-refresh`, task `task/provider-sdk-refresh-plan`, fast-forwarded with SHA guards
from retained plan ancestor d55. Base source serializes max_tokens for owner's model; connection
catch misreports HTTP400 as success. Saved config lacks endpoint; history drops private parts.
Most E2E fixtures cover compatible chat, not native protocols. Rebuilding alone cannot fix these.

| Responsibility                                       | Beads/spec                                                                                             | Order                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| SDK/providers/private continuation/final integration | [agent-platform-provider-interoperability](../tasks/agent-platform-provider-interoperability.md)       | Plan/critique → adapters/contracts → persistence/harness → connected/hosted qualification |
| Honest probes/UI/durable evidence                    | [agent-platform-model-connection-diagnostics](../tasks/agent-platform-model-connection-diagnostics.md) | Shared adapter types first; related same-segment task, no dependency cycle                |

Other artifacts: [verification](../testing/provider-sdk-compatibility.md),
[review/results](../reviews/provider-sdk-compatibility.md), session.md current handoff with full
historical body preserved. Beads owns scheduling. Coordinator owns documents/Git/qualification;
workers own disjoint source areas only after plan critique. Independent source/evidence review is
procedural read-only, not technical inherited-tool isolation. One segment-tip PR task→feature;
protected feature→staging requires actual merge authority and all real protections, never main.

Complete only after required verification and actual declared integration; no unit/mock-only closure.
All five protocols can be deterministically qualified without paid accounts. Owner stress readiness
additionally requires a tested rebuilt app, preserved profile/DB, recording/export/restart and an
owner-run or separately authorized real usable model request. Coordinate restart after build is ready.

## Critique corrections before implementation

SDK-P04: assign stable internal message IDs when constructing assistant output. Persist an independent
private-format/required-continuation marker on the public message row internally (never public DTO),
so missing required private rows cannot masquerade as legacy history. Add an awaited persistence
barrier before approval creation or tool dispatch: public row/required marker/encrypted private row
commit together, or fail with no downstream model/tool effect. Existing final persistence deduplicates
by stable ID and checks immutable identity rather than inserting again. Legacy marker0 remains readable;
required marker1 plus missing/invalid private data fails closed. Preserve IDs during internal hydration.
Cover dropped private row, crash between stages, duplicate callback/restart and failing transaction.

SDK-P05: fixed safe provider error conversion applies before all streaming/retry/plugin/NDJSON error
paths, not only connection probes. No raw SDK warnings/errors (which may embed private message/body)
reach trace events, onError plugins, logs or user streams. Preserve Abort/RunStopped identity and
internal status/retryable classification separately so controlled retry/deadline behavior is unchanged.
Adversarial raw error/warning/private markers must be absent from every public sink, with fixed safe
categories still explaining the failure. No serializing untrusted error objects as diagnostic payload.

## Implementation refinements and current evidence

Independent storage review approved the fourteen source/test files bound by the storage handoff.
The web uses an app-owned public NDJSON message shape: its previous ai/UIMessage imports were type
only, and @ai-sdk/react had no runtime consumer. Remove these unused web dependencies instead of
migrating the product to SDK UI streams. The independent critic approved this bounded refinement.

Valid SDK reasoning-only output-cap exhaustion is a distinct output_limited failed-probe outcome:
provider accepted the request but returned no visible reply within the fixed32-token probe budget.
Do not confuse it with malformed response or an unqualified successful/usable-model claim.
Router source review found SDK-RV01–04 (system-message flag, missing representative private replay,
unsafe default stream error logger and OpenRouter402 quota category); repairs passed135 router tests and independent source review. Final connected/hosted gates remain open.

SDK-I01 reviewed correction: a real backend restart must not resume an old pending approval.
Approve valid actions before restart, test private replay from completed history afterward, and
separately prove interrupted approvals return409 without provider/tool/file effects. The original
native failure is retained. Same-process SQLite reopen evidence is labeled separately. SDK-I02 adds
exactly-once interrupted-reply checkpoints after committed assistant prefixes while retaining later
partial output and tool outcomes before subsequent requests. Plain nonthinking keyless local text
remains compatible; opaque continuation and durable tool bindings never bypass their storage guard.

## S12 legacy-watermark compatibility repair, 19 October

PR363 delivered reviewed SDK source to staging at `be153c50`. Actual owner preflight then failed on
a private copy: canonical pending0021 has timestamp1778000000000 below a preserved unknown journal
watermark1785803000000. All22 original entries are retained; unknown provenance is not asserted.
The current app was restored with the original profile/key. S12 remains incomplete.

The bounded [repair task](../tasks/agent-platform-sdk-legacy-migration.md) owns MIG-S1–6: exact immutable
SDK21 compatibility, full canonical predecessor and trusted touched pre-schema proof (including legacy backfill tables),
bridge-only journal-trigger denial and exact original-journal-plus-one postcondition, atomic original
SQL/stamp plus final guard, negative/reopen/rollback tests and real native startup. The provider parent
depends on that child in Beads. It uses feature/provider-sdk-owner-upgrade and
task/provider-sdk-legacy-migration from actual stagingbe153; no runtime credential or paused changes.

Existing SDK alternatives and owner choices remain agreed. No generic migration relaxation, timestamp
rewrite, journal surgery, fresh-profile import or paid test is part of the repair. The test mapping is
[SDK-MIG](../testing/provider-sdk-compatibility.md#legacy-watermark-upgrade-regressions); results and
independent findings remain in the existing review. Owner end-to-end delivery authority continues;
final plan/source critique and every new current-head gate precede original-profile operation.

The exact pre-schema feasibility check identified the preserved workspace-events column. Its complete
legacy ALTER bytes independently match the retained journal SHA256; executing those proven bytes
only in a canonical in-memory reference reproduces all34 owner touched definitions. The repair
therefore includes one explicit hash/time-bound historical variant, before and after0021, with opaque
values preserved. See the task's proven-variant requirements; no generic extra-column tolerance or
new workspace-events capability is introduced. Refined contract and DB/native source review passed. Focused local migration/SDK journeys pass;
fresh hosted delivery and the actual retained-profile S12 remain required.
