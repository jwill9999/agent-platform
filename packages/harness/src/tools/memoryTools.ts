import type { MemoryQueryInput, Output, Tool as ContractTool } from '@agent-platform/contracts';
import type { DrizzleDb } from '@agent-platform/db';
import {
  deleteMemory,
  getMemory,
  MemoryNotFoundError,
  queryMemories,
  updateMemory,
} from '@agent-platform/db';

import {
  SYSTEM_TOOL_PREFIX,
  buildRiskMap,
  errorMessage,
  stringArg,
  toolError,
  toolResult,
} from './toolHelpers.js';

export const MEMORY_TOOL_IDS = {
  list: `${SYSTEM_TOOL_PREFIX}memory_list`,
  get: `${SYSTEM_TOOL_PREFIX}memory_get`,
  review: `${SYSTEM_TOOL_PREFIX}memory_review`,
  delete: `${SYSTEM_TOOL_PREFIX}memory_delete`,
  export: `${SYSTEM_TOOL_PREFIX}memory_export`,
} as const;

export const MEMORY_TOOL_MAP = {
  ...buildRiskMap(
    {
      list: MEMORY_TOOL_IDS.list,
      get: MEMORY_TOOL_IDS.get,
      export: MEMORY_TOOL_IDS.export,
    },
    'low',
  ),
  [MEMORY_TOOL_IDS.review]: 'medium',
  [MEMORY_TOOL_IDS.delete]: 'high',
} as const;

export interface MemoryToolContext {
  db: DrizzleDb;
  sessionId: string;
  agentId?: string;
}

const MEMORY_STATUSES = new Set(['pending', 'approved', 'rejected', 'archived']);
const MEMORY_REVIEW_STATUSES = new Set(['unreviewed', 'approved', 'rejected', 'needs_review']);

export const MEMORY_TOOLS: readonly ContractTool[] = [
  {
    id: MEMORY_TOOL_IDS.list,
    slug: 'sys-memory-list',
    name: 'memory_list',
    description: 'List memory records in the current allowed scope.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'agent', 'session'] },
          scopeId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'archived'] },
          reviewStatus: {
            type: 'string',
            enum: ['unreviewed', 'approved', 'rejected', 'needs_review'],
          },
          tag: { type: 'string' },
          limit: { type: 'number', description: 'Maximum records to return, up to 50.' },
        },
      },
    },
  },
  {
    id: MEMORY_TOOL_IDS.get,
    slug: 'sys-memory-get',
    name: 'memory_get',
    description: 'Inspect one memory record if it is visible to the current session.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    id: MEMORY_TOOL_IDS.review,
    slug: 'sys-memory-review',
    name: 'memory_review',
    description: 'Approve or reject a pending memory record visible to the current session.',
    riskTier: 'medium',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          decision: { type: 'string', enum: ['approved', 'rejected'] },
          reason: { type: 'string' },
        },
        required: ['id', 'decision'],
      },
    },
  },
  {
    id: MEMORY_TOOL_IDS.delete,
    slug: 'sys-memory-delete',
    name: 'memory_delete',
    description: 'Delete a memory record visible to the current session. Requires approval.',
    riskTier: 'high',
    requiresApproval: true,
    config: {
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    id: MEMORY_TOOL_IDS.export,
    slug: 'sys-memory-export',
    name: 'memory_export',
    description: 'Export memory records in the current allowed scope as JSON-safe data.',
    riskTier: 'low',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'agent', 'session'] },
          scopeId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'archived'] },
          limit: { type: 'number', description: 'Maximum records to export, up to 100.' },
        },
      },
    },
  },
];

function requireContext(context?: MemoryToolContext): MemoryToolContext | Output {
  return context ?? toolError('MEMORY_CONTEXT_MISSING', 'Memory tools require a bound session.');
}

function isVisible(
  memory: { scope: string; scopeId?: string },
  context: MemoryToolContext,
): boolean {
  if (memory.scope === 'global') return true;
  if (memory.scope === 'session') return memory.scopeId === context.sessionId;
  if (memory.scope === 'agent') return memory.scopeId === context.agentId;
  return false;
}

function scopedQuery(args: Record<string, unknown>, context: MemoryToolContext): MemoryQueryInput {
  const scope = stringArg(args, 'scope', 'session');
  const requestedScopeId = stringArg(args, 'scopeId');
  if (scope === 'global') return { ...filterQuery(args), scope: 'global' };
  if (scope === 'agent') {
    const scopeId = requestedScopeId || context.agentId;
    if (!scopeId || scopeId !== context.agentId) {
      throw new Error('Agent memory scope is not visible to this session');
    }
    return { ...filterQuery(args), scope: 'agent', scopeId };
  }
  if (scope === 'session') {
    const scopeId = requestedScopeId || context.sessionId;
    if (scopeId !== context.sessionId) {
      throw new Error('Session memory scope is not visible to this session');
    }
    return { ...filterQuery(args), scope: 'session', scopeId };
  }
  throw new Error('Only global, agent, and session memory scopes are available to tools');
}

function filterQuery(args: Record<string, unknown>): MemoryQueryInput {
  const status = stringArg(args, 'status');
  const reviewStatus = stringArg(args, 'reviewStatus');
  return {
    status: MEMORY_STATUSES.has(status) ? status : undefined,
    reviewStatus: MEMORY_REVIEW_STATUSES.has(reviewStatus) ? reviewStatus : undefined,
    tag: stringArg(args, 'tag') || undefined,
    includeExpired: true,
    limit: typeof args.limit === 'number' ? args.limit : undefined,
  } as MemoryQueryInput;
}

function clampLimit(query: MemoryQueryInput, max: number): MemoryQueryInput {
  const limit = typeof query.limit === 'number' ? Math.min(Math.max(query.limit, 1), max) : max;
  return { ...query, limit };
}

export async function executeMemoryTool(
  toolId: string,
  args: Record<string, unknown>,
  context?: MemoryToolContext,
): Promise<Output | null> {
  if (!(toolId in MEMORY_TOOL_MAP)) return null;
  const ctx = requireContext(context);
  if ('type' in ctx) return ctx;

  try {
    switch (toolId) {
      case MEMORY_TOOL_IDS.list: {
        const query = clampLimit(scopedQuery(args, ctx), 50);
        const memories = queryMemories(ctx.db, query);
        return toolResult(toolId, { count: memories.length, memories });
      }
      case MEMORY_TOOL_IDS.export: {
        const query = clampLimit(scopedQuery(args, ctx), 100);
        const memories = queryMemories(ctx.db, query);
        return toolResult(toolId, { exportedAtMs: Date.now(), count: memories.length, memories });
      }
      case MEMORY_TOOL_IDS.get: {
        const memory = getMemory(ctx.db, stringArg(args, 'id'));
        if (!isVisible(memory, ctx))
          return toolError('MEMORY_SCOPE_DENIED', 'Memory is not visible');
        return toolResult(toolId, { memory });
      }
      case MEMORY_TOOL_IDS.review: {
        const id = stringArg(args, 'id');
        const decision = stringArg(args, 'decision');
        if (decision !== 'approved' && decision !== 'rejected') {
          return toolError('INVALID_ARGS', 'decision must be approved or rejected');
        }
        const existing = getMemory(ctx.db, id);
        if (!isVisible(existing, ctx)) {
          return toolError('MEMORY_SCOPE_DENIED', 'Memory is not visible');
        }
        const reason = stringArg(args, 'reason');
        const memory = updateMemory(ctx.db, id, {
          status: decision,
          reviewStatus: decision,
          reviewedAtMs: Date.now(),
          reviewedBy: 'agent-tool',
          metadata: { ...existing.metadata, ...(reason ? { reviewReason: reason } : {}) },
        });
        return toolResult(toolId, { memory });
      }
      case MEMORY_TOOL_IDS.delete: {
        const id = stringArg(args, 'id');
        const existing = getMemory(ctx.db, id);
        if (!isVisible(existing, ctx)) {
          return toolError('MEMORY_SCOPE_DENIED', 'Memory is not visible');
        }
        return toolResult(toolId, { deleted: deleteMemory(ctx.db, id), id });
      }
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof MemoryNotFoundError) return toolError('MEMORY_NOT_FOUND', error.message);
    return toolError('MEMORY_TOOL_FAILED', errorMessage(error));
  }
}
