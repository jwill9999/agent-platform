# SDK modernization assessment — source review

15 September 2026. **Independent supervised critic review: PASS. Owner review pending.** Source baseline: staging commit 1be9301. Read-only product assessment: no package installation, paid model call or application modification. This report is the initial source-assessment artifact; task acceptance remains pending critic review and owner review; compatibility experiments and migration are separate work.

## Recommendation

Compare a modern AI SDK cohort against direct LangChain provider/agent adoption before upgrading production dependencies. Do not modernize AI SDK first merely to obtain tracing if the selected runtime will retire it. For the first experiment, retain existing application tool authorization and use one representative loop; do not rebuild the whole harness or adopt Deep Agents as an untested default.

The current runtime already uses LangGraph for custom graph execution and AI SDK for provider/model calls. The material choice is which generic loop and provider responsibilities to replace, not whether to introduce a framework into an entirely bespoke system.

## Verified baseline and candidate evidence

The lockfile resolves AI SDK 4.3.19, LangChain Core 0.3.80, LangGraph 0.2.74, Zod 3.25.76 and Electron 42.0.1. Manifests still permit older major cohorts. Node is configured at version 24. The current provider factory returns AI SDK LanguageModelV1, with OpenAI, Anthropic and an OpenAI-compatible Ollama path. The factory supports an optional base URL, but the ordinary reasoning path does not pass it and the harness model configuration lacks that field. Ollama uses its environment/default URL there; saved/UI URL propagation is not established.

Registry metadata captured in [assessment metadata](sdk-assessment-metadata.json) identifies these current non-prerelease latest-tag candidates:

| Route             | Candidate packages                                                                         | Source-level compatibility observation                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Modern AI SDK     | ai 7.0.100; openai provider 4.0.66; anthropic provider 4.0.53; openai-compatible 3.0.48    | Reported Node minimum 22 and Zod range admits existing 3.25.76; provider/model API changes still require migration and testing                |
| LangChain/Graph   | langchain 1.5.11; core 1.2.11; graph 1.4.15; OpenAI 1.5.13; Anthropic 1.5.10; Ollama 1.3.0 | Reported core peer ranges overlap at 1.2.11; Node24 meets listed minimums. This is not a full dependency solve or runtime proof               |
| Later persistence | LangGraph SQLite saver 1.0.4                                                               | Native better-sqlite3 dependency differs from repository major 13; Electron ABI/bundling remains untested                                     |
| Later tracing     | Phoenix OTel 2.2.0                                                                         | Current integration guidance targets newer AI SDK shapes; choose instrumentation after runtime choice; narrow application spans remain useful |

The LangGraph migration documentation currently states Node 22+, while the version-specific registry entry for LangGraph 1.4.15 declares Node >=18. Node 24 meets both; the manifest alone does not establish supported operation on Node 18. Latest-tag/non-prerelease status is not a contractual maintenance guarantee. No LTS/support-end commitment was established. Candidate versions are evidence for an experiment, not a validated installation set. Current manifests and complete registry dependency metadata are retained to make this distinction inspectable. A solver, build, browser and packaged Electron run remain later evidence gates.

### Baseline inventory and ownership

The following are lockfile-resolved versions, not an observation of packages loaded in a running process. The adjacent metadata preserves each importer and manifest range. Repository source links below are relative to this report and were inspected at the accepted staging baseline.

| Layer                | Resolved baseline                                                    | Ownership and disposition                                                                                                                          |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model APIs           | ai 4.3.19; OpenAI 1.3.24; Anthropic 1.2.12; OpenAI-compatible 0.2.16 | Third-party libraries behind the in-house provider factory; upgrade as one cohort or replace audited call sites                                    |
| Graph                | Core 0.3.80; LangGraph 0.2.74                                        | Third-party execution engine with in-house graph construction, routing and state; modernize for either route, keeping one loop owner               |
| UI                   | AI SDK React 1.2.12; Next 15.5.15; React/React DOM 19.2.5            | Third-party presentation dependencies with in-house stream adapter/cards; preserve UI versions initially unless dependency solving requires change |
| Validation/toolchain | Zod 3.25.76; TypeScript 5.9.3; configured Node 24                    | Retain as initial compatibility baseline; do not equate host Node with Electron's embedded Node                                                    |
| Desktop/native       | Electron 42.0.1; node-pty 1.1.0; better-sqlite3 13.0.3               | Existing third-party runtime/native dependencies; retain and verify packaging, ABI and subprocess boundary                                         |
| Telemetry            | In-house plugin-observability and harness trace records              | No Phoenix exporter dependency in that plugin manifest; later instrumentation must connect existing signals and fill gaps                          |

Frontend AI SDK message types are imported by the custom chat hook and presentation components; an installed React adapter is not proof that its hook drives our chat. Do not remove frontend AI SDK dependencies until those imports and tests are migrated. Next/React upgrades are not a prerequisite established by this assessment; their latest releases are deliberately not additional candidates in this bounded runtime comparison.

### Concrete migration surface

[Provider construction](../../../packages/model-router/src/providers.ts) returns `LanguageModelV1`. [LLM reasoning](../../../packages/harness/src/nodes/llmReason.ts) maps `CoreMessage`, tool argument/result shapes and `parameters`, invokes one SDK step, consumes streamed text/tool calls and normalizes usage. The AI SDK [4-to-5 guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0) changes message types, tool schemas and step control; its [5-to-6 guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) introduces further model/test and agent API changes, and the [6-to-7 guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) changes lifecycle callback names. These guides establish migration work, not a complete call-site audit or compatibility pass. Preserve the explicit single SDK step if the outer graph continues to own the loop; adopting a framework's multi-step default would change execution behavior.

Other direct model calls exist in [connection testing](../../../packages/model-router/src/testConnection.ts), [streaming](../../../packages/model-router/src/streamChat.ts), [legacy OpenAI helper](../../../packages/model-router/src/openai.ts), and [inferential sensors](../../../packages/harness/src/sensors/inferentialSensorRunner.ts). Direct calls also exist in [plan generation](../../../packages/harness/src/nodes/planGenerate.ts), [critic evaluation](../../../packages/harness/src/nodes/critic.ts), [completion checking](../../../packages/harness/src/nodes/dodCheck.ts) and [completion proposal](../../../packages/harness/src/nodes/dodPropose.ts). Preserving these behaviors requires migrating their model calls or explicitly retaining the SDK cohort temporarily. Retiring AI SDK requires tracing callers of each export and migrating or proving it unused, plus frontend type references. Replacing only the generic agent loop will not remove AI SDK from the repository. Retirement criteria are zero intended runtime imports, updated contract tests and a dependency graph that no longer requires the retired direct packages; transitive SDK packages must be accounted for separately.

[Graph construction](../../../packages/harness/src/buildGraph.ts) and [state](../../../packages/harness/src/graphState.ts) use LangGraph directly, including an in-memory saver. LangChain `createAgent` is an alternative loop implementation, not a transparent replacement for our custom graph. Retain explicit outer planning/sensor/completion behavior or demonstrate equivalent composition. The [LangGraph migration guide](https://docs.langchain.com/oss/javascript/migrate/langgraph-v1) informs graph upgrade review; neither its existence nor provider peer overlap proves this custom graph migrates unchanged.

The [public output schema](../../../packages/contracts/src/output.ts) already includes text, code, tool results, images, errors, thinking, approvals and workspace events. Preserve that contract through the [custom chat hook](../../../apps/web/hooks/use-harness-chat.ts). Richer library events can feed a later projection; they do not automatically expose meaningful progress in this UI.

### Behavior that each experiment must demonstrate

| Area                      | Acceptance evidence for later F1/F2 experiments                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider configuration    | Configured model and credentials reach the intended provider; preserve demonstrated Ollama environment/default `/v1` behavior and factory overrides where actually used. Saved/UI URL propagation would be a separately identified capability, not assumed baseline parity |
| Model/tool interaction    | Streaming order, partial failure, tool name normalization, call/result identifiers, schema conversion and usage accounting retain intended behavior                                                                                                                        |
| Permissions and approvals | Denied tools never execute; approval request/resume/rejection uses existing policy services; a framework interrupt cannot confer authorization                                                                                                                             |
| Execution control         | One loop owner, explicit step/token/time limits, cancellation and retry behavior; no double tool dispatch when a resumed or retried call crosses a side-effect boundary                                                                                                    |
| Outer workflow            | Planner, sensors, critic/completion checks and plugins retain accepted behavior; identify existing recovery limitations separately from regressions                                                                                                                        |
| UI and desktop            | Existing output/card consumers still function; packaged Electron loads native modules and its backend with the actual embedded runtime, not merely the developer's Node version                                                                                            |
| Trace/cost hooks          | Usage is attributed to each call, including retries and auxiliary model calls; instrumentation failure does not break a run and secret-bearing payloads are excluded                                                                                                       |

Persistence, durable recovery and expanded telemetry are later work. A saver alone does not guarantee safe side-effect replay. This checklist protects interfaces during modernization and does not claim those later capabilities already work.

## Replacement map

| Responsibility                           | Existing runtime upgrade                                                     | LangChain adoption                                                              | Retain in application                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Provider construction                    | Update SDK provider classes/types and model-call APIs                        | Use supported LangChain model integrations; retire replaced AI SDK provider use | Demonstrated model/credential resolution and Ollama environment/default URL behavior; saved URL propagation is unproven |
| Generic model/tool loop                  | Modern SDK loop primitives or existing graph node with supported model calls | createAgent and middleware; one loop owner                                      | Tool permission and execution services, operation identity                                                              |
| Context before each call                 | Modern SDK hooks/application context adapter                                 | before-model middleware and optional summarization                              | Context scope, provenance and token/cost policy                                                                         |
| Approvals                                | Preserve existing application approval service through tool boundary         | Integrate interruption middleware without bypassing existing service            | Authorization, old approval semantics, side-effect reconciliation                                                       |
| Streaming                                | Adapt current NDJSON projection to supported events                          | Map model/tool/interrupt events to same public projection                       | Existing cards, safe payload contract and truthful live status                                                          |
| Planner/critic/sensors/completion checks | Retain explicitly                                                            | Retain behind explicit nodes/hooks unless parity demonstrates replacement       | Accepted behavior; no accidental loss from swapping the generic loop                                                    |

Additional policy boundary: [tool dispatch](../../../packages/harness/src/nodes/toolDispatch.ts). This is existing graph-coupled implementation containing reusable policy and execution logic, not an already isolated application service. Extraction or adaptation effort belongs in F1/F2; framework integration must preserve its policy checks. These are source boundaries, not an assertion that each needs rewriting.

## Order and tradeoffs

1. Freeze the baseline behavior and candidate metadata from this assessment. Record unsupported or unknown provider features before comparison.
2. Under separately authorized compatibility work, resolve/build isolated fixtures for the two routes, preserving production manifests. Test provider configuration, streaming, tool call/result identity, denial/approval and Electron compatibility. Offline success does not establish live provider support.
3. Compare one authorized tool journey and a controlled error/approval wait. Measure adapter responsibilities and actual reusable code, not feature-list size. Treat unavailable credentials or hardware as explicit blocked evidence.
4. Choose the path. If LangChain's loop/middleware removes meaningful maintenance while retaining behavior, migrate directly and avoid a discarded AI SDK upgrade. If most custom policy/graph code remains and provider migration dominates, modernize the existing SDK path first. Coexist only with explicit boundary and removal criteria.
5. Only then implement selected runtime modernization and model-specific tracing. Shared event design can remain reusable, but visibility implementation is queued by owner direction.

For Ollama, a supported ChatOllama integration does not automatically preserve our current OpenAI-compatible /v1 URL semantics. Choose a compatible integration or an explicit configuration migration and test it. For LangChain, current migration guidance changes model selection, hooks, state and streaming node names; wrappers alone cannot be assumed to preserve semantics.

Effort remains a planning range, not measured savings: remaining F1 compatibility 2–4 person-days, F2 comparison 2–4, F3 decision 0.5–1. These are sequential under current owner direction and exclude waiting for credentials/hardware. The 3–7 person-day R1 migration range is provisional and must be replaced by a path-specific estimate. This source assessment cannot justify a delivery-time winner yet.

## Preserved constraints and unresolved checks

Connected local execution with explicit recovery; no background service adoption. Keep existing scopes, provider configuration, permissions, approvals and Electron behavior. No vector database, subagent expansion, new UI framework or paid evaluation is required for this decision.

Unresolved: complete dependency resolution, major-version API migration coverage, representative live provider parity, actual code removable, native packaging and operation recovery. These are intentionally later experiment gates, not grounds for claiming a validated stack now. Full costing must include summaries, planner/critic, fallback and child calls if enabled. Default trace helper payload capture needs explicit redaction configuration before real data.

## Orchestration and review status

On 15 September, after an owner progress prompt, the canonical journal still contained four cancelled historical runs and no run for this assessment. The self-check automation was active, but that does not prove execution or successful resumption. No managed launch was established before the parent turn ended. The cause of the subsequent continuation gap is unknown; this is not a reproduced child-callback stall. See the [field observation](../../reviews/orchestration-field-evaluation.md).

The currently inspected CLI exposes phase-runtime/coordinator/preflight/status interfaces but no general approved-assessment start entrypoint. The staged pilot-zero documentation records missing start/preapproval composition and runtime-readiness concerns. No exact managed assessment run/contract, managed critic execution or ready runtime configuration has been established here. Do not fabricate a run, copy credentials or call a built-in critic and label it managed orchestration.

This source assessment was authored by the parent in supervised mode after the stall was identified. It has now passed the owner-authorized supervised critic review; owner acceptance remains pending. The owner subsequently authorized a one-off supervised read-only critic exception, including rechecks of parent corrections. The independent harness critic was dispatched against report revision 2108340; the first review requested two content corrections and a current-status update. The parent corrected URL propagation claims and added four auxiliary SDK call sites, acknowledged the Node support discrepancy, and clarified tool-dispatch coupling. The focused recheck passed with no remaining substantive findings. See the [review record](reviews/sdk-assessment-critic-review.md). This exception does not authorize product implementation, paid experiments or orchestration repairs, and does not establish managed-runtime acceptance.

## Source-review limitations and decision boundary

The source evidence supports two plausible experiment candidates, with LangChain offering potential removal of generic loop/context plumbing and the existing-runtime route limiting provider-interface disruption. It does not establish measured savings, equal model output or runtime parity. No installation, model experiment, test suite or packaged application was run for this assessment. Document formatting, links and inventory consistency checks are artifact checks only.

The candidate registry snapshot records package engine/peer declarations. The full dependency solve, complete major-version migration audit and provider/hardware checks belong in F1/F2. If either candidate cannot meet an invariant, record the failure and stop expanding that candidate. Keep the decision in F3 rather than preselecting a stack from documentation alone. Source assessment effort remains the original 1–2 person-day planning allowance; no time tracking supports an actual-hours claim. Remaining sequential assessment effort is 4.5–9 person-days, excluding external waits and product implementation.

## Sources

- [LangChain migration guide](https://docs.langchain.com/oss/javascript/migrate/langchain-v1): agent/provider/hooks/state migration guidance.
- [ChatOllama integration](https://docs.langchain.com/oss/javascript/integrations/chat/ollama): supported native integration; no inference of automatic URL compatibility.
- [Phoenix TypeScript integration](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-otel.html): instrumentation boundaries and capture defaults, verified in earlier independent review.
- Public npm registry latest metadata for named packages, captured in the adjacent evidence JSON. Metadata is read-only and not a dependency installation.
- Existing critic findings and source links in [independent review](reviews/final-independent-critic-review.md). Earlier research is reused; no repeat broad survey.
