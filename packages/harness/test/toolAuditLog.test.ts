import { describe, it, expect } from 'vitest';
import {
  createToolAuditLogger,
  createNoopAuditLogger,
  redactArgs,
} from '../src/audit/toolAuditLog.js';
import type {
  ToolAuditStore,
  ToolAuditEntry,
  ToolAuditCompletion,
} from '../src/audit/toolAuditLog.js';
import type { Output } from '@agent-platform/contracts';

// ---------------------------------------------------------------------------
// In-memory store for testing
// ---------------------------------------------------------------------------

function createMemoryStore() {
  const entries: ToolAuditEntry[] = [];
  const completions: { id: string; data: ToolAuditCompletion }[] = [];

  const store: ToolAuditStore = {
    insert(entry) {
      entries.push(entry);
    },
    complete(id, data) {
      completions.push({ id, data });
    },
  };

  return { store, entries, completions };
}

function completeCodingEnvelope(
  evidenceStatus: 'failed' | 'denied',
  error: { code: string; message: string },
) {
  const { store, completions } = createMemoryStore();
  const logger = createToolAuditLogger(store);

  const id = logger.logStart('coding_apply_patch', { operations: [] }, 'agent-1', 'session-1');
  const output: Output = {
    type: 'tool_result',
    toolId: 'coding_apply_patch',
    data: {
      ok: false,
      evidence: { status: evidenceStatus },
      error,
    },
  };
  logger.logComplete(id!, output);

  return completions;
}

// ---------------------------------------------------------------------------
// redactArgs
// ---------------------------------------------------------------------------

describe('redactArgs', () => {
  it('redacts known secret keys', () => {
    const result = redactArgs({
      command: 'ls',
      password: 'hunter2',
      token: 'abc123',
      apiKey: 'sk-xxx',
    });
    expect(result.command).toBe('ls');
    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('redacts nested objects recursively', () => {
    const result = redactArgs({
      config: {
        secret: 'hidden',
        host: 'localhost',
      },
    });
    expect(result.config).toEqual({
      secret: '[REDACTED]',
      host: 'localhost',
    });
  });

  it('leaves non-secret keys untouched', () => {
    const result = redactArgs({
      path: '/workspace/file.txt',
      content: 'hello world',
      mode: 'write',
    });
    expect(result).toEqual({
      path: '/workspace/file.txt',
      content: 'hello world',
      mode: 'write',
    });
  });

  it('handles empty objects', () => {
    expect(redactArgs({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// createToolAuditLogger
// ---------------------------------------------------------------------------

describe('createToolAuditLogger', () => {
  it('logs start and complete for non-zero-risk tools', () => {
    const { store, entries, completions } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    const id = logger.logStart(
      'sys_read_file',
      { path: '/workspace/f.txt' },
      'agent-1',
      'session-1',
    );
    expect(id).toBeTruthy();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.toolName).toBe('sys_read_file');
    expect(entries[0]!.agentId).toBe('agent-1');
    expect(entries[0]!.status).toBe('pending');

    const output: Output = { type: 'tool_result', data: 'file content' };
    logger.logComplete(id!, output);
    expect(completions).toHaveLength(1);
    expect(completions[0]!.id).toBe(id);
    expect(completions[0]!.data.status).toBe('success');
    expect(completions[0]!.data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('defaults unknown tool audit entries to high risk', () => {
    const { store, entries } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    const id = logger.logStart('dynamic_tool', { value: 1 }, 'agent-1', 'session-1');

    expect(id).toBeTruthy();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.riskTier).toBe('high');
  });

  it('skips zero-risk tools', () => {
    const { store, entries } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    const id = logger.logStart('sys_generate_uuid', {}, 'agent-1', 'session-1');
    expect(id).toBeNull();
    expect(entries).toHaveLength(0);
  });

  it('logs error status for error outputs', () => {
    const { store, completions } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    const id = logger.logStart('sys_bash', { command: 'ls' }, 'agent-1', 'session-1');
    const output: Output = { type: 'error', code: 'BASH_BLOCKED', message: 'Command not allowed' };
    logger.logComplete(id!, output);

    expect(completions[0]!.data.status).toBe('error');
  });

  it('logs failed coding envelopes as error status', () => {
    const completions = completeCodingEnvelope('failed', {
      code: 'PATCH_DOES_NOT_APPLY',
      message: 'Patch does not apply',
    });

    expect(completions[0]!.data.status).toBe('error');
  });

  it('logs denied coding envelopes as denied status', () => {
    const completions = completeCodingEnvelope('denied', {
      code: 'BINARY_FILE_DENIED',
      message: 'Refusing binary file',
    });

    expect(completions[0]!.data.status).toBe('denied');
  });

  it('redacts secrets in args', () => {
    const { store, entries } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    logger.logStart('sys_bash', { command: 'curl', token: 'secret-val' }, 'a', 's');

    const parsed = JSON.parse(entries[0]!.argsJson) as Record<string, unknown>;
    expect(parsed.command).toBe('curl');
    expect(parsed.token).toBe('[REDACTED]');
  });

  it('logDenied creates a denied entry', () => {
    const { store, entries, completions } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    logger.logDenied('sys_write_file', { path: '/etc/passwd' }, 'a', 's', 'Path blocked');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.status).toBe('denied');
    expect(completions).toHaveLength(1);
    expect(completions[0]!.data.status).toBe('denied');
    const result = JSON.parse(completions[0]!.data.resultJson) as Record<string, unknown>;
    expect(result.denied).toBe(true);
    expect(result.reason).toBe('Path blocked');
  });

  it('logDenied skips zero-risk tools', () => {
    const { store, entries } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    logger.logDenied('sys_json_parse', {}, 'a', 's', 'some reason');
    expect(entries).toHaveLength(0);
  });

  it('logPendingApproval creates a pending entry without completing it', () => {
    const { store, entries, completions } = createMemoryStore();
    const logger = createToolAuditLogger(store);

    const id = logger.logPendingApproval('sys_bash', { command: 'date' }, 'a', 's', 'high');

    expect(id).toBeTruthy();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id,
      toolName: 'sys_bash',
      agentId: 'a',
      sessionId: 's',
      riskTier: 'high',
      status: 'pending',
    });
    expect(JSON.parse(entries[0]!.argsJson)).toEqual({ command: 'date' });
    expect(completions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createNoopAuditLogger
// ---------------------------------------------------------------------------

describe('createNoopAuditLogger', () => {
  it('returns null for logStart', () => {
    const logger = createNoopAuditLogger();
    expect(logger.logStart('sys_bash', {}, 'a', 's')).toBeNull();
  });

  it('logComplete and logDenied do not throw', () => {
    const logger = createNoopAuditLogger();
    logger.logComplete('some-id', { type: 'tool_result', data: 'ok' });
    logger.logDenied('sys_bash', {}, 'a', 's', 'reason');
    expect(logger.logPendingApproval('sys_bash', {}, 'a', 's')).toBeNull();
  });
});
