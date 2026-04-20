import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Agent, McpServer, Skill, Tool as ContractTool } from '@agent-platform/contracts';
import type { McpSession } from '@agent-platform/mcp-adapter';
import { buildAgentContext, destroyAgentContext, AgentNotFoundError } from '../src/factory.js';
import { SYSTEM_TOOLS } from '../src/systemTools.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@agent-platform/db', () => ({
  loadAgentById: vi.fn(),
  getSkill: vi.fn(),
  getTool: vi.fn(),
  getMcpServer: vi.fn(),
}));

const mockCloseAll = vi.fn(async () => {});
const mockGetSession = vi.fn();
const mockOpenSessions = vi.fn(async () => []);
const mockGetSessions = vi.fn(() => new Map());

vi.mock('@agent-platform/mcp-adapter', () => ({
  McpSessionManager: vi.fn().mockImplementation(() => ({
    openSessions: mockOpenSessions,
    getSession: mockGetSession,
    closeAll: mockCloseAll,
    getSessions: mockGetSessions,
    isHealthy: vi.fn(),
    reconnect: vi.fn(),
  })),
}));

import { loadAgentById, getSkill, getTool, getMcpServer } from '@agent-platform/db';

const mockLoadAgent = vi.mocked(loadAgentById);
const mockGetSkill = vi.mocked(getSkill);
const mockGetTool = vi.mocked(getTool);
const mockGetMcpServer = vi.mocked(getMcpServer);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeDb = {} as Parameters<typeof loadAgentById>[0];

const baseAgent: Agent = {
  id: 'agent-1',
  slug: 'agent-1',
  name: 'Test Agent',
  systemPrompt: 'You are a test assistant.',
  allowedSkillIds: ['s1'],
  allowedToolIds: ['t1'],
  allowedMcpServerIds: ['mcp-1'],
  executionLimits: { maxSteps: 10, maxParallelTasks: 2, timeoutMs: 60_000 },
};

const skill1: Skill = {
  id: 's1',
  slug: 's1',
  name: 'Summarize text',
  goal: 'Summarize text',
  constraints: ['max 100 words'],
  tools: ['t1'],
};

const tool1: ContractTool = {
  id: 't1',
  slug: 't1',
  name: 'TextSummarizer',
  description: 'Summarizes input text',
};

const mcpServer1: McpServer = {
  id: 'mcp-1',
  slug: 'mcp-1',
  name: 'Filesystem',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
};

const mcpTool: ContractTool = {
  id: 'mcp-1:search_index',
  slug: 'mcp-1--search-index',
  name: 'search_index',
  description: 'Search an index',
};

function createMockSession(tools: ContractTool[] = []): McpSession {
  return {
    listContractTools: vi.fn(async () => tools),
    callToolAsOutput: vi.fn(async () => ({ type: 'text' as const, content: 'ok' })),
    close: vi.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockOpenSessions.mockResolvedValue([]);
  mockGetSession.mockReturnValue(undefined);
  mockCloseAll.mockResolvedValue(undefined);
});

describe('buildAgentContext', () => {
  it('throws AgentNotFoundError when agent does not exist', async () => {
    mockLoadAgent.mockReturnValue(undefined);

    await expect(buildAgentContext(fakeDb, 'missing')).rejects.toThrow(AgentNotFoundError);
    await expect(buildAgentContext(fakeDb, 'missing')).rejects.toThrow('Agent not found: missing');
  });

  it('assembles a full context with skills, tools, and MCP', async () => {
    mockLoadAgent.mockReturnValue(baseAgent);
    mockGetSkill.mockReturnValue(skill1);
    mockGetTool.mockReturnValue(tool1);
    mockGetMcpServer.mockReturnValue(mcpServer1);

    const session = createMockSession([mcpTool]);
    mockGetSession.mockReturnValue(session);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.agent).toBe(baseAgent);
    expect(ctx.skills).toEqual([skill1]);
    expect(ctx.tools).toEqual([...SYSTEM_TOOLS, tool1, mcpTool]);
    expect(ctx.mcpManager).toBeDefined();
    expect(mockOpenSessions).toHaveBeenCalledWith([mcpServer1]);
    expect(ctx.pluginDispatcher).toBeDefined();
    expect(ctx.modelConfig).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('builds augmented system prompt with skills and tools sorted by id', async () => {
    const agent: Agent = {
      ...baseAgent,
      allowedSkillIds: ['s2', 's1'],
      allowedToolIds: ['t2', 't1'],
      allowedMcpServerIds: [],
    };
    const skill2: Skill = {
      id: 's2',
      slug: 's2',
      name: 'Translate text',
      goal: 'Translate text',
      constraints: [],
      tools: [],
    };
    const tool2: ContractTool = { id: 't2', slug: 't2', name: 'Translator' };

    mockLoadAgent.mockReturnValue(agent);
    mockGetSkill.mockImplementation((_db, id) => {
      if (id === 's1') return skill1;
      if (id === 's2') return skill2;
      return undefined;
    });
    mockGetTool.mockImplementation((_db, id) => {
      if (id === 't1') return tool1;
      if (id === 't2') return tool2;
      return undefined;
    });

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    // Skills sorted: s1 before s2
    expect(ctx.systemPrompt).toContain('## Available Skills');
    const skillSection = ctx.systemPrompt
      .split('## Available Skills')[1]!
      .split('## Available Tools')[0]!;
    const s1Pos = skillSection.indexOf('s1');
    const s2Pos = skillSection.indexOf('s2');
    expect(s1Pos).toBeLessThan(s2Pos);

    // Tools sorted: t1 before t2
    expect(ctx.systemPrompt).toContain('## Available Tools');
    const toolSection = ctx.systemPrompt.split('## Available Tools')[1]!;
    const t1Pos = toolSection.indexOf('t1');
    const t2Pos = toolSection.indexOf('t2');
    expect(t1Pos).toBeLessThan(t2Pos);
  });

  it('system prompt includes skill stubs and tool descriptions (lazy loading)', async () => {
    mockLoadAgent.mockReturnValue({ ...baseAgent, allowedMcpServerIds: [] });
    mockGetSkill.mockReturnValue(skill1);
    mockGetTool.mockReturnValue(tool1);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    // Stubs show skill name, not full constraints
    expect(ctx.systemPrompt).toContain('Summarize text');
    expect(ctx.systemPrompt).toContain('sys_get_skill_detail');
    // Tool descriptions still appear in the tools section
    expect(ctx.systemPrompt).toContain('Summarizes input text');
  });

  it('excludes tools from failed MCP sessions', async () => {
    mockLoadAgent.mockReturnValue(baseAgent);
    mockGetSkill.mockReturnValue(skill1);
    mockGetTool.mockReturnValue(tool1);
    mockGetMcpServer.mockReturnValue(mcpServer1);

    // Session failed to open — getSession returns undefined
    mockGetSession.mockReturnValue(undefined);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    // Should still succeed, with system + registry tools
    expect(ctx.tools).toEqual([...SYSTEM_TOOLS, tool1]);
  });

  it('uses agent modelOverride when present', async () => {
    const agent: Agent = {
      ...baseAgent,
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    };
    mockLoadAgent.mockReturnValue(agent);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.modelConfig).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });

  it('uses explicit modelConfig option over agent override', async () => {
    const agent: Agent = {
      ...baseAgent,
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    };
    mockLoadAgent.mockReturnValue(agent);

    const ctx = await buildAgentContext(fakeDb, 'agent-1', {
      modelConfig: { provider: 'openai', model: 'gpt-4.1' },
    });

    expect(ctx.modelConfig).toEqual({ provider: 'openai', model: 'gpt-4.1' });
  });

  it('resolves plugin chain with global and user plugins', async () => {
    mockLoadAgent.mockReturnValue({
      ...baseAgent,
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
    });

    const globalHooks = { onSessionStart: vi.fn() };
    const userHooks = { onTaskStart: vi.fn() };

    const ctx = await buildAgentContext(fakeDb, 'agent-1', {
      globalPlugins: [{ id: 'global-1', hooks: globalHooks }],
      userPlugins: [{ id: 'user-1', hooks: userHooks }],
    });

    expect(ctx.pluginDispatcher.chain).toHaveLength(2);
  });

  it('filters missing skills and tools without error', async () => {
    mockLoadAgent.mockReturnValue({
      ...baseAgent,
      allowedSkillIds: ['s1', 's-missing'],
      allowedToolIds: ['t1', 't-missing'],
      allowedMcpServerIds: [],
    });
    mockGetSkill.mockImplementation((_db, id) => (id === 's1' ? skill1 : undefined));
    mockGetTool.mockImplementation((_db, id) => (id === 't1' ? tool1 : undefined));

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.skills).toEqual([skill1]);
    expect(ctx.tools).toEqual([...SYSTEM_TOOLS, tool1]);
  });

  it('when no registry/MCP tools, system tools are still present and skill tool refs are filtered', async () => {
    const skillWithToolRefs: Skill = {
      ...skill1,
      tools: ['t1', 'ghost-id'],
    };
    mockLoadAgent.mockReturnValue({
      ...baseAgent,
      allowedSkillIds: ['s1'],
      allowedToolIds: [],
      allowedMcpServerIds: [],
    });
    mockGetSkill.mockReturnValue(skillWithToolRefs);
    mockGetTool.mockReturnValue(undefined);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    // System tools are always injected even with no registry/MCP tools
    expect(ctx.tools).toEqual([...SYSTEM_TOOLS]);
    expect(ctx.systemPrompt).toContain('## Available Tools');
    // Skill tool refs that don't match executable tools are omitted
    expect(ctx.systemPrompt).not.toContain('Tools: t1');
    expect(ctx.systemPrompt).not.toContain('ghost-id');
  });

  it('skill stubs do not include tool IDs (lazy loading defers detail)', async () => {
    mockLoadAgent.mockReturnValue(baseAgent);
    mockGetSkill.mockReturnValue({
      ...skill1,
      tools: ['t1', 'ghost-id'],
    });
    mockGetTool.mockReturnValue(tool1);
    mockGetMcpServer.mockReturnValue(undefined);
    mockGetSession.mockReturnValue(undefined);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.tools).toEqual([...SYSTEM_TOOLS, tool1]);
    // Stubs never list individual tool IDs — those come from sys_get_skill_detail
    expect(ctx.systemPrompt).not.toContain('Tools: t1');
    expect(ctx.systemPrompt).not.toContain('ghost-id');
    expect(ctx.systemPrompt).toContain('sys_get_skill_detail');
  });
});

describe('destroyAgentContext', () => {
  it('delegates to mcpManager.closeAll', async () => {
    const ctx = {
      agent: baseAgent,
      systemPrompt: 'test',
      skills: [],
      tools: [],
      mcpManager: { closeAll: mockCloseAll } as never,
      pluginDispatcher: { chain: [] } as never,
      modelConfig: { provider: 'openai', model: 'gpt-4o' },
    };

    await destroyAgentContext(ctx);

    expect(mockCloseAll).toHaveBeenCalledOnce();
  });
});
