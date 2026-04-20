import type { Agent, McpServer, Skill, Tool as ContractTool } from '@agent-platform/contracts';
import { SYSTEM_TOOLS } from './systemTools.js';
import type { DrizzleDb } from '@agent-platform/db';
import { loadAgentById, getMcpServer, getSkill, getTool } from '@agent-platform/db';
import { createLogger } from '@agent-platform/logger';
import { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import type { RegisteredPlugin } from '@agent-platform/plugin-session';
import { resolveEffectivePluginHooks } from '@agent-platform/plugin-session';
import { getSecurityReinforcement } from './security/injectionGuard.js';
import { validateMcpTools } from './security/mcpTrustGuard.js';

const log = createLogger('harness');

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
  mcpManager: McpSessionManager;
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

/**
 * Emit lightweight skill stubs (name + description + hint) for lazy loading.
 * The model must call `sys_get_skill_detail` to fetch full instructions before using a skill.
 * When `description` is absent, truncates `goal` to ~100 chars.
 */
function formatSkillSection(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const sorted = [...skills].sort((a, b) => a.id.localeCompare(b.id));
  const lines = sorted.map((s) => {
    const desc = s.description ?? truncateGoal(s.goal);
    let entry = `- **${s.id}** (${s.name}): ${desc}`;
    if (s.hint) entry += `\n  Hint: ${s.hint}`;
    return entry;
  });
  return `\n\n## Available Skills\nCall \`sys_get_skill_detail\` with the skill ID before using any skill.\n${lines.join('\n')}`;
}

/** Truncate a goal string for use as a stub description. */
function truncateGoal(goal: string, maxLen = 100): string {
  if (goal.length <= maxLen) return goal;
  return goal.slice(0, maxLen - 1) + '…';
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

/** Explicit guidance when the harness will not pass any tools to the model. */
function formatNoToolsCapabilitySection(): string {
  return `\n\n## Capabilities\nYou do not have access to tools or function calls in this session. Do not claim to invoke tools, run shell commands, or call external APIs; respond using natural language only.`;
}

function buildAugmentedPrompt(base: string, skills: Skill[], tools: ContractTool[]): string {
  const body = `${base}${formatSkillSection(skills)}${formatToolSection(tools)}`;
  const withCaps = tools.length === 0 ? `${body}${formatNoToolsCapabilitySection()}` : body;
  // Append security reinforcement (non-negotiable rules about untrusted data)
  return `${withCaps}\n\n${getSecurityReinforcement()}`;
}

// ---------------------------------------------------------------------------
// Model config resolution (provider + model only; API key resolved separately)
// ---------------------------------------------------------------------------

function resolveProviderAndModel(agent: Agent, override?: ModelConfig): ModelConfig {
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
// DB loading helpers (reduce cognitive complexity of main factory fn)
// ---------------------------------------------------------------------------

function loadAllowedSkills(db: DrizzleDb, ids: readonly string[]): Skill[] {
  return ids.map((id) => getSkill(db, id)).filter((s): s is Skill => s != null);
}

function loadAllowedTools(db: DrizzleDb, ids: readonly string[]): ContractTool[] {
  return ids.map((id) => getTool(db, id)).filter((t): t is ContractTool => t != null);
}

function loadAllowedMcpConfigs(db: DrizzleDb, ids: readonly string[]): McpServer[] {
  return ids.map((id) => getMcpServer(db, id)).filter((m): m is McpServer => m != null);
}

async function discoverMcpTools(
  manager: McpSessionManager,
  configs: McpServer[],
): Promise<ContractTool[]> {
  const tools: ContractTool[] = [];
  for (const config of configs) {
    const session = manager.getSession(config.id);
    if (!session) continue;
    try {
      const discovered = await session.listContractTools();
      // Filter through MCP trust guard (blocks shadowing, injection, suspicious schemas)
      const validation = validateMcpTools(config.id, discovered);
      if (validation.rejected.length > 0) {
        for (const r of validation.rejected) {
          log.warn('MCP tool rejected by trust guard', {
            serverId: config.id,
            toolId: r.tool.id,
            reasons: r.reasons,
          });
        }
      }
      tools.push(...validation.safe);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn('Tool discovery failed', { serverId: config.id, error: message });
    }
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Assembles a fully resolved runtime context for an agent.
 *
 * - Loads the agent, skills, tools, and MCP configs from the database.
 * - Opens MCP sessions via McpSessionManager (parallel, graceful on failure).
 * - Discovers remote tools from healthy sessions.
 * - Constructs the augmented system prompt with skill/tool descriptions.
 * - Resolves the plugin chain and model config.
 */
export async function buildAgentContext(
  db: DrizzleDb,
  agentId: string,
  options: BuildAgentContextOptions = {},
): Promise<AgentContext> {
  const agent = loadAgentById(db, agentId);
  if (!agent) throw new AgentNotFoundError(agentId);

  const skills = loadAllowedSkills(db, agent.allowedSkillIds);
  const registryTools = loadAllowedTools(db, agent.allowedToolIds);
  const mcpConfigs = loadAllowedMcpConfigs(db, agent.allowedMcpServerIds);

  const mcpManager = new McpSessionManager();
  await mcpManager.openSessions(mcpConfigs);

  const mcpTools = await discoverMcpTools(mcpManager, mcpConfigs);
  const allTools = [...SYSTEM_TOOLS, ...registryTools, ...mcpTools];

  const systemPrompt = buildAugmentedPrompt(agent.systemPrompt, skills, allTools);

  const hooks = resolveEffectivePluginHooks({
    global: options.globalPlugins ?? [],
    user: options.userPlugins ?? [],
    agent,
  });
  const pluginDispatcher = createPluginDispatcher(hooks);

  const modelConfig = resolveProviderAndModel(agent, options.modelConfig);

  return {
    agent,
    systemPrompt,
    skills,
    tools: allTools,
    mcpManager,
    pluginDispatcher,
    modelConfig,
  };
}

/**
 * Tears down an agent context by closing all open MCP sessions via the manager.
 */
export async function destroyAgentContext(ctx: AgentContext): Promise<void> {
  await ctx.mcpManager.closeAll();
}
