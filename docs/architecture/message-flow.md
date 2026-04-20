# Message Flow — Agent Platform

This document traces the complete lifecycle of a chat message, from the user's browser to the LLM response. It is the canonical reference for understanding security checkpoints, error handling, and the ReAct execution loop.

> **Audience:** AI agents working on this codebase, and human developers.
> Source files are annotated in each section so you can `grep` for the exact code.

---

## 1. End-to-End Request Flow

This is the primary diagram. It shows every layer a message passes through and where errors are caught.

```mermaid
sequenceDiagram
    autonumber
    participant U as Browser
    participant W as Web BFF<br/>(Next.js /api/chat)
    participant A as API<br/>(POST /v1/chat)
    participant DB as SQLite<br/>(Drizzle ORM)
    participant F as Factory<br/>(buildAgentContext)
    participant G as LangGraph<br/>(buildHarnessGraph)
    participant LLM as LLM Provider<br/>(model-router)
    participant T as Tool Dispatch<br/>(MCP / Native)

    U->>W: POST /api/chat { sessionId, message }
    Note over W: Zod validate body<br/>Resolve x-openai-key<br/>(header → env → fallback)

    alt Invalid body
        W-->>U: 400 INVALID_BODY
    end

    W->>A: POST /v1/chat { sessionId, message }<br/>+ x-openai-key header

    alt Upstream unreachable
        W-->>U: 502 UPSTREAM_UNREACHABLE
    else Header timeout (90s default)
        W-->>U: 504 UPSTREAM_HEADER_TIMEOUT
    end

    Note over A: Zod validate body

    A->>DB: getSession(sessionId)
    alt Session not found
        A-->>W: 404 NOT_FOUND
        W-->>U: 404 (proxied)
    end

    A->>F: buildAgentContext(db, agentId)
    Note over F: Load agent, skills, tools, MCP configs<br/>Open MCP sessions (parallel)<br/>🔒 MCP Trust Guard filters tools<br/>Build augmented system prompt<br/>+ security reinforcement suffix<br/>Resolve plugin chain + model config

    alt Agent not found
        F-->>A: AgentNotFoundError
        A-->>W: 404 NOT_FOUND
    end

    A->>A: resolveModelConfig(agentOverride, headerKey)
    alt Model resolution failure
        A-->>W: 400 (MISSING_KEY / INVALID_MODEL)
    end

    A->>A: sessionLock.acquire(sessionId, timeoutMs)
    alt Session lock timeout
        A-->>W: 409 SESSION_BUSY
    end

    Note over A: Start AbortController<br/>• setTimeout → abort('timeout')<br/>• req.on('close') → abort('client_disconnect')<br/>• setInterval heartbeat (15s keep-alive)

    A->>A: 🔌 onSessionStart plugin hook

    A->>DB: listMessagesBySession + appendMessage(user)
    A->>A: buildWindowedContext<br/>(system prompt + history + user msg)<br/>Fits within maxInputTokens budget

    A->>G: graph.invoke(initialState, { signal })
    Note over G: Mode router:<br/>state.mode == 'react' → ReAct path<br/>state.mode == 'plan' → Plan path

    rect rgb(240, 248, 255)
        Note over G,T: ReAct Loop (see Diagram 2 for detail)
        loop Until text response, halt, or limit
            G->>LLM: streamText (with retry)
            LLM-->>G: text deltas / tool_calls
            G-->>U: NDJSON text chunks (streamed)
            opt LLM requests tool calls
                G->>T: dispatch tools (with security checks)
                T-->>G: tool results
            end
        end
    end

    G-->>A: finalState { messages }

    A->>DB: persistNewMessages (assistant + tool)
    A->>A: destroyAgentContext (close MCP sessions)
    A->>A: release session lock, clear timers
    A-->>W: End NDJSON stream
    W-->>U: End response stream
```

**Key source files:**

- `apps/web/app/api/chat/route.ts` — BFF proxy
- `apps/api/src/infrastructure/http/v1/chatRouter.ts` — API handler
- `packages/harness/src/factory.ts` — agent context assembly
- `packages/harness/src/buildGraph.ts` — graph construction
- `packages/harness/src/contextBuilder.ts` — context windowing

---

## 2. ReAct Loop — LLM ↔ Tool Dispatch

This diagram zooms into the LangGraph ReAct cycle, showing every security checkpoint and limit check.

```mermaid
flowchart TD
    START((START)) --> MODE{state.mode?}
    MODE -->|react| LLM_WRAP[react_llm_reason wrapper]
    MODE -->|plan| PLAN[plan_generate → resolve_plan → execute]
    PLAN --> END_NODE((END))

    subgraph LLM_REASON ["LLM Reasoning (llmReason.ts)"]
        LLM_WRAP --> ABORT_CHECK{signal.aborted?}
        ABORT_CHECK -->|yes| HALT_ABORT[halted: true<br/>trace: stream_aborted]
        ABORT_CHECK -->|no| PROMPT_HOOK["🔌 onPromptBuild hook"]
        PROMPT_HOOK --> SANITISE["Sanitise tool names<br/>colon → __ for OpenAI"]
        SANITISE --> STREAM["streamText via model-router<br/>with exponential backoff retry"]
        STREAM --> STREAM_OUT["Stream text deltas → NDJSON emitter"]
        STREAM_OUT --> BUILD_OUTPUT["Build LlmOutput<br/>text or tool_calls"]
        BUILD_OUTPUT --> TOKEN_CHECK{"totalTokensUsed >=<br/>maxTokens?"}
        TOKEN_CHECK -->|yes| HALT_TOKEN["halted: true<br/>trace: limit_hit max_tokens"]
        TOKEN_CHECK -->|no| COST_CHECK{"totalCostUnits >=<br/>maxCostUnits?"}
        COST_CHECK -->|yes| HALT_COST["halted: true<br/>trace: limit_hit max_cost"]
        COST_CHECK -->|no| BUDGET_WARN["Emit 80% budget warnings<br/>if approaching limits"]
        BUDGET_WARN --> INC_STEP["stepCount++<br/>Emit graph_start on step 0"]
    end

    HALT_ABORT --> END_NODE
    HALT_TOKEN --> END_NODE
    HALT_COST --> END_NODE

    INC_STEP --> ROUTE_LLM{llmOutput.kind?}
    ROUTE_LLM -->|text| END_NODE
    ROUTE_LLM -->|tool_calls| TOOL_WRAP[react_tool_dispatch wrapper]

    subgraph TOOL_DISPATCH ["Tool Dispatch (toolDispatch.ts)"]
        TOOL_WRAP --> TOOL_LOOP["For each tool call in llmOutput.calls"]
        TOOL_LOOP --> CUMUL_CHECK{"totalToolCalls >=<br/>maxToolCallsTotal?"}
        CUMUL_CHECK -->|yes| LIMIT_MSG["Return TOOL_LIMIT_REACHED<br/>to LLM as tool message"]
        CUMUL_CHECK -->|no| RATE_CHECK{"Per-tool<br/>rate limit?"}
        RATE_CHECK -->|exceeded| RATE_MSG["Return RATE_LIMITED<br/>to LLM as tool message"]
        RATE_CHECK -->|ok| SKILL_CHECK{"sys_get_skill_detail?"}
        SKILL_CHECK -->|yes| SKILL_GOV["🔍 Lazy skill loading:<br/>governor check (warn@3, error@5)<br/>→ skillResolver callback<br/>→ return full skill detail"]
        SKILL_CHECK -->|no| HOOK["🔌 onToolCall hook"]
        HOOK --> ALLOWLIST{"isToolExecutionAllowed?<br/>agent allowlist check"}
        ALLOWLIST -->|denied| TOOL_DENIED["Return TOOL_NOT_ALLOWED<br/>+ audit log denied"]
        ALLOWLIST -->|allowed| SYS_CHECK{System tool?}
        SYS_CHECK -->|yes| PATH_JAIL["🔒 PathJail.enforce<br/>mount validation"]
        SYS_CHECK -->|no| PARSE_ID["parseToolId"]
        PATH_JAIL -->|denied| PATH_ERR["Return PATH_ACCESS_DENIED"]
        PATH_JAIL -->|ok| PARSE_ID

        PARSE_ID -->|mcp| MCP_DISPATCH["MCP session.callToolAsOutput<br/>with timeout + retry"]
        PARSE_ID -->|native| NATIVE_DISPATCH["nativeToolExecutor<br/>with timeout + retry"]

        MCP_DISPATCH --> AUDIT_LOG["Audit log complete"]
        NATIVE_DISPATCH --> AUDIT_LOG

        AUDIT_LOG --> SEC_SCAN["🔒 Security scan:<br/>scanForInjection<br/>scanOutput credentials"]
        SEC_SCAN --> WRAP["wrapToolResult<br/>untrusted content tags"]
        WRAP --> EMIT_TOOL["Emit tool_result via NDJSON"]
        EMIT_TOOL --> TRACE_EVENT["trace: tool_dispatch"]
    end

    LIMIT_MSG --> LOOP_DETECT
    RATE_MSG --> LOOP_DETECT
    SKILL_GOV --> LOOP_DETECT
    TOOL_DENIED --> LOOP_DETECT
    PATH_ERR --> LOOP_DETECT
    TRACE_EVENT --> LOOP_DETECT

    LOOP_DETECT{"Loop detection:<br/>3 identical tool calls?"}
    LOOP_DETECT -->|yes| HALT_LOOP["halted: true<br/>trace: loop_detected"]
    LOOP_DETECT -->|no| ROUTE_DISPATCH{stepCount >= maxSteps?}

    HALT_LOOP --> END_NODE
    ROUTE_DISPATCH -->|yes| END_NODE
    ROUTE_DISPATCH -->|no| LLM_WRAP
```

**Key source files:**

- `packages/harness/src/nodes/llmReason.ts` — LLM streaming, budget checks, retry
- `packages/harness/src/nodes/toolDispatch.ts` — tool dispatch, security scans
- `packages/harness/src/buildGraph.ts` — wrappers (step counting, loop detection)
- `packages/harness/src/security/injectionGuard.ts` — injection scanning + content wrapping
- `packages/harness/src/security/outputGuard.ts` — credential leak detection

---

## 3. Security Checkpoints

All security guards mapped to where they execute in the flow.

```mermaid
flowchart LR
    subgraph BOOT ["Agent Boot — factory.ts"]
        A1["🔒 MCP Trust Guard<br/>Blocks: shadowing,<br/>description injection,<br/>suspicious schemas"]
        A2["🔒 Security Reinforcement<br/>Appended to system prompt<br/>never dropped by windowing"]
    end

    subgraph REASON ["LLM Reasoning"]
        B1["Tool name sanitisation<br/>colon to __ for provider"]
        B2["Token/cost budget limits"]
    end

    subgraph DISPATCH ["Tool Dispatch"]
        C1["🔒 Agent allowlist check"]
        C2["🔒 PathJail enforcement<br/>mount boundaries"]
        C3["🔒 Cumulative tool call limit"]
        C4["🔒 Tool timeout + retry"]
        C5["🔒 Injection scan on result"]
        C6["🔒 Credential leak scan"]
        C7["🔒 Untrusted content wrap"]
    end

    subgraph GRAPH ["Graph Level"]
        D1["🔒 Loop detection<br/>3 identical calls then halt"]
        D2["🔒 Max steps limit"]
        D3["🔒 Abort signal<br/>timeout / disconnect"]
    end

    BOOT --> REASON --> DISPATCH --> GRAPH
```

**Source locations:**

| Guard                  | File                                              | Integration point                              |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------- |
| MCP Trust Guard        | `packages/harness/src/security/mcpTrustGuard.ts`  | `factory.ts` → `discoverMcpTools()`            |
| Security Reinforcement | `packages/harness/src/security/injectionGuard.ts` | `factory.ts` → `buildAugmentedPrompt()`        |
| Agent Allowlist        | `packages/agent-validation`                       | `toolDispatch.ts` → `isToolExecutionAllowed()` |
| PathJail               | `packages/harness/src/security/pathJail.ts`       | `toolDispatch.ts` → `enforcePathJail()`        |
| Injection Scan         | `packages/harness/src/security/injectionGuard.ts` | `toolDispatch.ts` → `scanToolOutput()`         |
| Credential Scan        | `packages/harness/src/security/outputGuard.ts`    | `toolDispatch.ts` → `scanToolOutput()`         |
| Content Wrapping       | `packages/harness/src/security/injectionGuard.ts` | `toolDispatch.ts` → `outputToContent()`        |
| URL Guard              | `packages/harness/src/security/urlGuard.ts`       | `mediumRiskTools.ts`                           |
| Bash Guard             | `packages/harness/src/security/bashGuard.ts`      | System tool level                              |
| Loop Detection         | `packages/harness/src/buildGraph.ts`              | `createReactToolWrapper()`                     |
| Budget Limits          | `packages/harness/src/nodes/llmReason.ts`         | `checkBudgetLimits()`                          |
| Cumulative Tool Limit  | `packages/harness/src/nodes/toolDispatch.ts`      | Top of tool dispatch loop                      |

---

## 4. Error Handling

How errors propagate and are handled at each layer.

```mermaid
flowchart TD
    subgraph WEB ["Web BFF — route.ts"]
        W1[/"fetch to API"/]
        W1 -->|network error| W_502["502 UPSTREAM_UNREACHABLE<br/>JSON error response"]
        W1 -->|AbortError| W_504["504 UPSTREAM_HEADER_TIMEOUT<br/>JSON error response"]
        W1 -->|invalid body| W_400["400 INVALID_BODY<br/>JSON error response"]
        W1 -->|ok| W_PROXY["Proxy NDJSON body to browser"]
    end

    subgraph API ["API Pre-Stream — chatRouter.ts"]
        A_ZOD["Zod validation"] -->|fail| A_400["400 VALIDATION_ERROR"]
        A_SESSION["getSession"] -->|null| A_404S["404 NOT_FOUND session"]
        A_AGENT["buildAgentContext"] -->|AgentNotFoundError| A_404A["404 NOT_FOUND agent"]
        A_MODEL["resolveModelConfig"] -->|error| A_400M["400 MISSING_KEY"]
        A_LOCK["sessionLock.acquire"] -->|timeout| A_409["409 SESSION_BUSY"]
    end

    subgraph STREAM ["During NDJSON Stream"]
        S_GRAPH["graph.invoke"]
        S_GRAPH -->|throws| S_CATCH["catch block"]
        S_CATCH --> S_PLUGIN["🔌 onError plugin hook<br/>errors swallowed"]
        S_PLUGIN --> S_EMIT["emitStreamError"]
        S_EMIT -->|signal timeout| NDJSON_T["NDJSON: type error<br/>code TIMEOUT"]
        S_EMIT -->|client disconnect| NDJSON_D["NDJSON: type stream_aborted<br/>reason client_disconnect"]
        S_EMIT -->|other error| NDJSON_E["NDJSON: type error<br/>message from exception"]
    end

    subgraph GRAPH_ERRORS ["Inside Graph Nodes"]
        G_LLM["LLM call failure"] -->|retryable| G_RETRY["Retry with exponential backoff<br/>max 3 attempts"]
        G_RETRY -->|exhausted| G_THROW["Throw → caught by<br/>chatRouter catch block"]
        G_LLM -->|non-retryable| G_THROW

        G_TOOL["Tool call failure"] -->|retryable| G_TRETRY["Retry with backoff"]
        G_TRETRY -->|exhausted or timeout| G_TERR["Return error Output<br/>to LLM as tool message"]
        G_TOOL -->|non-retryable| G_TERR

        G_SEC["Security violation<br/>allowlist, path, limit"] --> G_SERR["Return error Output<br/>to LLM — graph continues"]

        G_PLUG["Plugin hook error"] --> G_SWALLOW["Swallowed silently<br/>never crashes the graph"]
    end

    subgraph CLEANUP ["Always — finally block"]
        F1["clearTimeout / clearInterval"]
        F2["release session lock"]
        F3["destroyAgentContext<br/>close all MCP sessions"]
        F4["res.end if still writable"]
    end

    API --> STREAM
    STREAM --> CLEANUP
```

### Error handling principles

1. **Pre-stream errors** (validation, auth, locking) return standard JSON `{ error: { code, message } }` with appropriate HTTP status codes.
2. **Mid-stream errors** (graph execution failures) are written as NDJSON error events to the open stream, then the stream ends.
3. **Tool errors** are returned to the LLM as tool-result messages — the graph continues and the LLM can reason about the failure.
4. **Plugin errors** are always swallowed. Plugin failures must never crash a user request.
5. **Cleanup** runs unconditionally via the `finally` block: timers cleared, session lock released, MCP sessions closed, stream ended.

---

## 5. NDJSON Event Types

The streaming protocol emits these event types to the client (each as a JSON line):

| Event            | When                         | Key fields                  |
| ---------------- | ---------------------------- | --------------------------- |
| `text`           | LLM text delta               | `content`                   |
| `thinking`       | LLM reasoning delta          | `content`                   |
| `code`           | Code block                   | `content`, `language`       |
| `tool_result`    | Tool execution complete      | `toolId`, `data`            |
| `image`          | Screenshot / image from MCP  | `data` (base64), `mimeType` |
| `error`          | Fatal or budget limit hit    | `code`, `message`           |
| `stream_aborted` | Client disconnect or timeout | `reason`                    |

The browser (`apps/web/hooks/useHarnessChat.ts`) reads these via `ReadableStream`, parsing each NDJSON line and dispatching to the appropriate UI handler. Tool-scoped errors (codes prefixed `TOOL_`, `MCP_`, `NATIVE_`) are rendered inline; other errors surface as a top-level error banner.
