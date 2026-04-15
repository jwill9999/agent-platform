import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Agent, McpServer, Skill, Tool as ContractTool } from '@agent-platform/contracts';
import type { McpSession } from '@agent-platform/mcp-adapter';
import {
  buildAgentContext,
  destroyAgentContext,
  AgentNotFoundError,
} from '../src/factory.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@agent-platform/db', () => ({
  loadAgentById: vi.fn(),
  getSkill: vi.fn(),
  getTool: vi.fn(),
  getMcpServer: vi.fn(),
}));

vi.mock('@agent-platform/mcp-adapter', () => ({
  openMcpSession: vi.fn(),
}));

import { loadAgentById, getSkill, getTool, getMcpServer } from '@agent-platform/db';
import { openMcpSession } from '@agent-platform/mcp-adapter';

const mockLoadAgent = vi.mocked(loadAgentById);
const mockGetSkill = vi.mocked(getSkill);
const mockGetTool = vi.mocked(getTool);
const mockGetMcpServer = vi.mocked(getMcpServer);
const mockOpenMcpSession = vi.mocked(openMcpSession);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeDb = {} as Parameters<typeof loadAgentById>[0];

const baseAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  systemPrompt: 'You are a test assistant.',
  allowedSkillIds: ['s1'],
  allowedToolIds: ['t1'],
  allowedMcpServerIds: ['mcp-1'],
  executionLimits: { maxSteps: 10, maxParallelTasks: 2, timeoutMs: 60_000 },
};

const skill1: Skill = {
  id: 's1',
  goal: 'Summarize text',
  constraints: ['max 100 words'],
  tools: ['t1'],
};

const tool1: ContractTool = {
  id: 't1',
  name: 'TextSummarizer',
  description: 'Summarizes input text',
};

const mcpServer1: McpServer = {
  id: 'mcp-1',
  name: 'Filesystem',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
};

const mcpTool: ContractTool = {
  id: 'mcp-1:read_file',
  name: 'read_file',
  description: 'Read a file from disk',
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
  vi.resetAllMocks();
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
    mockOpenMcpSession.mockResolvedValue(session);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.agent).toBe(baseAgent);
    expect(ctx.skills).toEqual([skill1]);
    expect(ctx.tools).toEqual([tool1, mcpTool]);
    expect(ctx.mcpSessions.size).toBe(1);
    expect(ctx.mcpSessions.get('mcp-1')).toBe(session);
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
    const skill2: Skill = { id: 's2', goal: 'Translate text', constraints: [], tools: [] };
    const tool2: ContractTool = { id: 't2', name: 'Translator' };

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
    const skillSection = ctx.systemPrompt.split('## Available Skills')[1]!.split('## Available Tools')[0]!;
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

  it('system prompt includes skill constraints and tool descriptions', async () => {
    mockLoadAgent.mockReturnValue({ ...baseAgent, allowedMcpServerIds: [] });
    mockGetSkill.mockReturnValue(skill1);
    mockGetTool.mockReturnValue(tool1);

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    expect(ctx.systemPrompt).toContain('max 100 words');
    expect(ctx.systemPrompt).toContain('Summarizes input text');
  });

  it('gracefully handles MCP session failure', async () => {
    mockLoadAgent.mockReturnValue(baseAgent);
    mockGetSkill.mockReturnValue(skill1);
    mockGetTool.mockReturnValue(tool1);
    mockGetMcpServer.mockReturnValue(mcpServer1);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockOpenMcpSession.mockRejectedValue(new Error('Connection refused'));

    const ctx = await buildAgentContext(fakeDb, 'agent-1');

    // Should still succeed, with only registry tools
    expect(ctx.tools).toEqual([tool1]);
    expect(ctx.mcpSessions.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('MCP session failed for server "mcp-1"'),
    );

    warnSpy.mockRestore();
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
    expect(ctx.tools).toEqual([tool1]);
  });
});

describe('destroyAgentContext', () => {
  it('closes all MCP sessions', async () => {
    const session1 = createMockSession();
    const session2 = createMockSession();

    const ctx = {
      agent: baseAgent,
      systemPrompt: 'test',
      skills: [],
      tools: [],
      mcpSessions: new Map<string, McpSession>([
        ['mcp-1', session1],
        ['mcp-2', session2],
      ]),
      pluginDispatcher: { chain: [] } as never,
      modelConfig: { provider: 'openai', model: 'gpt-4o' },
    };

    await destroyAgentContext(ctx);

    expect(session1.close).toHaveBeenCalledOnce();
    expect(session2.close).toHaveBeenCalledOnce();
    expect(ctx.mcpSessions.size).toBe(0);
  });

  it('handles close errors gracefully', async () => {
    const failingSession = createMockSession();
    (failingSession.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('shutdown error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = {
      agent: baseAgent,
      systemPrompt: 'test',
      skills: [],
      tools: [],
      mcpSessions: new Map<string, McpSession>([['mcp-fail', failingSession]]),
      pluginDispatcher: { chain: [] } as never,
      modelConfig: { provider: 'openai', model: 'gpt-4o' },
    };

    // Should not throw
    await destroyAgentContext(ctx);

    expect(ctx.mcpSessions.size).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
