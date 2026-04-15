# Epic 1 — Agent Schema & Factory: Architecture Reference

Source: Sourcery AI review of PR #24 (`feature/agent-platform-runtime` → `main`)

## buildAgentContext Assembly Flow

```mermaid
sequenceDiagram
  participant Caller
  participant AgentFactory
  participant Db as DbModule
  participant McpManager as McpSessionManager
  participant McpServer as McpServers
  participant PluginSession as PluginSessionModule
  participant PluginSdk as PluginSdkModule

  Caller->>AgentFactory: buildAgentContext(db, agentId, options)

  AgentFactory->>Db: loadAgentById(db, agentId)
  Db-->>AgentFactory: Agent or undefined
  AgentFactory->>AgentFactory: throw AgentNotFoundError if undefined

  AgentFactory->>Db: getSkill(db, allowedSkillIds)
  Db-->>AgentFactory: Skill[]
  AgentFactory->>Db: getTool(db, allowedToolIds)
  Db-->>AgentFactory: ContractTool[]
  AgentFactory->>Db: getMcpServer(db, allowedMcpServerIds)
  Db-->>AgentFactory: McpServer[]

  AgentFactory->>McpManager: new McpSessionManager()
  AgentFactory->>McpManager: openSessions(mcpConfigs)
  McpManager->>McpServer: openMcpSession(config) parallel
  McpServer-->>McpManager: McpSession or error
  McpManager-->>AgentFactory: McpSessionOpenResult[]

  loop for each healthy MCP session
    AgentFactory->>McpManager: getSession(serverId)
    McpManager-->>AgentFactory: McpSession
    AgentFactory->>McpServer: listContractTools()
    McpServer-->>AgentFactory: ContractTool[]
  end

  AgentFactory->>AgentFactory: buildAugmentedPrompt(agent.systemPrompt, skills, allTools)
  AgentFactory->>PluginSession: resolveEffectivePluginHooks(globalPlugins, userPlugins, agent)
  PluginSession-->>AgentFactory: PluginHooks
  AgentFactory->>PluginSdk: createPluginDispatcher(hooks)
  PluginSdk-->>AgentFactory: PluginDispatcher

  AgentFactory->>AgentFactory: resolveModelConfig(agent, options.modelConfig)
  AgentFactory-->>Caller: AgentContext

  Caller->>AgentFactory: destroyAgentContext(ctx)
  AgentFactory->>McpManager: closeAll()
  McpManager-->>AgentFactory: void
```

## Agent Schema (DB)

```mermaid
erDiagram
  agents {
    string id PK
    string name
    string system_prompt
    string description
    string execution_limits_json
    string model_override_json
    string plugin_allowlist_json
  }
```

## Class Relationships

```mermaid
classDiagram
  class Agent {
    +string id
    +string name
    +string systemPrompt
    +string description
    +string[] allowedSkillIds
    +string[] allowedToolIds
    +string[] allowedMcpServerIds
    +ExecutionLimits executionLimits
    +ModelOverride modelOverride
  }

  class AgentContext {
    +Agent agent
    +string systemPrompt
    +Skill[] skills
    +ContractTool[] tools
    +McpSessionManager mcpManager
    +PluginDispatcher pluginDispatcher
    +ModelConfig modelConfig
  }

  class McpSessionManager {
    -Map~string, McpSession~ sessions
    +getSessions() Map~string, McpSession~
    +openSessions(configs McpServer[]) McpSessionOpenResult[]
    +getSession(serverId string) McpSession
    +isHealthy(serverId string) bool
    +reconnect(config McpServer) bool
    +closeAll() void
  }

  class AgentFactory {
    +buildAgentContext(db DrizzleDb, agentId string, options BuildAgentContextOptions) AgentContext
    +destroyAgentContext(ctx AgentContext) void
  }

  AgentContext "1" --> "1" Agent
  AgentContext "1" --> "*" Skill
  AgentContext "1" --> "*" ContractTool
  AgentContext "1" --> "1" McpSessionManager
  AgentContext "1" --> "1" PluginDispatcher
  AgentContext "1" --> "1" ModelConfig

  McpSessionManager "*" --> "1" McpSession : manages
  AgentFactory ..> AgentContext : builds
  AgentFactory ..> McpSessionManager : creates
```
