import type { Agent, McpServer, Skill, Tool as ContractTool } from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import { loadAgentById, getMcpServer, getSkill, getTool } from '@agent-platform/db';
import type { McpSession } from '@agent-platform/mcp-adapter';
import { openMcpSession } from '@agent-platform/mcp-adapter';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import type { RegisteredPlugin } from '@agent-platform/plugin-session';
import { resolveEffectivePluginHooks } from '@agent-platform/plugin-session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelConfig = {
  provider: string;
  model: string;
};

export type AgentContext = {
  agent: Agent;
  systemPrompt: string;
  skills: Skill[];
  tools: ContractTool[];
  mcpSessions: Map<string, McpSession>;
  pluginDispatcher: PluginDispatcher;
  modelConfig: ModelConfig;
};

export type BuildAgentContextOptions = {
  /** Registered plugins at global scope. */
  globalPlugins?: readonly RegisteredPlugin[];
  /** Registered plugins at user scope. */
  userPlugins?: readonly RegisteredPlugin[];
  /** Override default model config instead of reading from agent or env. */
  modelConfig?: ModelConfig;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// System prompt construction
// ---------------------------------------------------------------------------

function formatSkillSection(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const sorted = [...skills].sort((a, b) => a.id.localeCompare(b.id));
  const lines = sorted.map((s) => {
    let entry = `- **${s.id}**: ${s.goal}`;
    if (s.constraints.length > 0) {
      entry += `\n  Constraints: ${s.constraints.join('; ')}`;
    }
    if (s.tools.length > 0) {
      entry += `\n  Tools: ${s.tools.join(', ')}`;
    }
    return entry;
  });
  return `\n\n## Available Skills\n${lines.join('\n')}`;
}

function formatToolSection(tools: ContractTool[]): string {
  if (tools.length === 0) return '';
  const sorted = [...tools].sort((a, b) => a.id.localeCompare(b.id));
  const lines = sorted.map((t) => {
    const desc = t.description ? `: ${t.description}` : '';
    return `- **${t.id}** (${t.name})${desc}`;
  });
  return `\n\n## Available Tools\n${lines.join('\n')}`;
}

function buildAugmentedPrompt(base: string, skills: Skill[], tools: ContractTool[]): string {
  return `${base}${formatSkillSection(skills)}${formatToolSection(tools)}`;
}

// ---------------------------------------------------------------------------
// Model config resolution
// ---------------------------------------------------------------------------

function resolveModelConfig(agent: Agent, override?: ModelConfig): ModelConfig {
  if (override) return override;
  if (agent.modelOverride) {
    return { provider: agent.modelOverride.provider, model: agent.modelOverride.model };
  }
  return {
    provider: process.env.DEFAULT_MODEL_PROVIDER ?? 'openai',
    model: process.env.DEFAULT_MODEL ?? 'gpt-4o',
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Assembles a fully resolved runtime context for an agent.
 *
 * - Loads the agent, skills, tools, and MCP configs from the database.
 * - Opens MCP sessions and discovers remote tools (failures are logged, not fatal).
 * - Constructs the augmented system prompt with skill/tool descriptions.
 * - Resolves the plugin chain and model config.
 */
export async function buildAgentContext(
  db: DrizzleDb,
  agentId: string,
  options: BuildAgentContextOptions = {},
): Promise<AgentContext> {
  // 1. Load agent
  const agent = loadAgentById(db, agentId);
  if (!agent) throw new AgentNotFoundError(agentId);

  // 2. Load skills
  const skills: Skill[] = [];
  for (const sid of agent.allowedSkillIds) {
    const skill = getSkill(db, sid);
    if (skill) skills.push(skill);
  }

  // 3. Load registry tools
  const registryTools: ContractTool[] = [];
  for (const tid of agent.allowedToolIds) {
    const tool = getTool(db, tid);
    if (tool) registryTools.push(tool);
  }

  // 4. Load MCP configs
  const mcpConfigs: McpServer[] = [];
  for (const mid of agent.allowedMcpServerIds) {
    const mcp = getMcpServer(db, mid);
    if (mcp) mcpConfigs.push(mcp);
  }

  // 5–6. Open MCP sessions and discover tools
  const mcpSessions = new Map<string, McpSession>();
  const mcpTools: ContractTool[] = [];

  for (const config of mcpConfigs) {
    try {
      const session = await openMcpSession(config);
      mcpSessions.set(config.id, session);
      const discovered = await session.listContractTools();
      mcpTools.push(...discovered);
    } catch (err) {
      // Graceful degradation: log warning, skip this server's tools
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[factory] MCP session failed for server "${config.id}": ${message}`);
    }
  }

  const allTools = [...registryTools, ...mcpTools];

  // 7. Build augmented system prompt
  const systemPrompt = buildAugmentedPrompt(agent.systemPrompt, skills, allTools);

  // 8. Resolve plugin chain
  const hooks = resolveEffectivePluginHooks({
    global: options.globalPlugins ?? [],
    user: options.userPlugins ?? [],
    agent,
  });
  const pluginDispatcher = createPluginDispatcher(hooks);

  // 9. Resolve model config
  const modelConfig = resolveModelConfig(agent, options.modelConfig);

  return {
    agent,
    systemPrompt,
    skills,
    tools: allTools,
    mcpSessions,
    pluginDispatcher,
    modelConfig,
  };
}

/**
 * Tears down an agent context by closing all open MCP sessions.
 */
export async function destroyAgentContext(ctx: AgentContext): Promise<void> {
  const errors: Error[] = [];
  for (const [serverId, session] of ctx.mcpSessions) {
    try {
      await session.close();
    } catch (err) {
      errors.push(
        new Error(
          `Failed to close MCP session "${serverId}": ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }
  ctx.mcpSessions.clear();
  if (errors.length > 0) {
    console.warn(`[factory] ${errors.length} MCP session(s) failed to close:`, errors);
  }
}
