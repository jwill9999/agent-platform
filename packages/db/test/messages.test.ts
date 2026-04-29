import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import type { DrizzleDb } from '../src/database.js';
import {
  appendMessage,
  listMessagesBySession,
  deleteMessagesBySession,
} from '../src/repositories/messages.js';
import { createSession, deleteSession, replaceAgent } from '../src/repositories/registry.js';

describe('message repository', () => {
  let db: DrizzleDb;
  let sqlite: ReturnType<typeof openDatabase>['sqlite'];
  let tmpDir: string;
  let sessionId: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-msg-'));
    const sqlitePath = path.join(tmpDir, 'test.sqlite');
    const opened = openDatabase(sqlitePath);
    db = opened.db;
    sqlite = opened.sqlite;

    // Create a minimal agent + session for FK constraints
    replaceAgent(db, {
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Test Agent',
      systemPrompt: 'sys',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const session = createSession(db, { agentId: 'agent-1' });
    sessionId = session.id;
  });

  afterEach(() => {
    closeDatabase(sqlite);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends and retrieves messages in order', () => {
    appendMessage(db, { sessionId, role: 'user', content: 'Hello' });
    appendMessage(db, { sessionId, role: 'assistant', content: 'Hi there!' });
    appendMessage(db, { sessionId, role: 'user', content: 'How are you?' });

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.role).toBe('user');
    expect(msgs[0]!.content).toBe('Hello');
    expect(msgs[1]!.role).toBe('assistant');
    expect(msgs[1]!.content).toBe('Hi there!');
    expect(msgs[2]!.role).toBe('user');
    expect(msgs[2]!.content).toBe('How are you?');
  });

  it('stores tool messages with toolCallId', () => {
    appendMessage(db, {
      sessionId,
      role: 'tool',
      content: '{"result": 42}',
      toolCallId: 'call-123',
    });

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.role).toBe('tool');
    expect(msgs[0]!.toolCallId).toBe('call-123');
  });

  it('stores assistant tool calls for replay', () => {
    appendMessage(db, {
      sessionId,
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call-123', name: 'sys_bash', args: { command: 'date' } }],
    });

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.role).toBe('assistant');
    expect(msgs[0]!.toolCalls).toEqual([
      { id: 'call-123', name: 'sys_bash', args: { command: 'date' } },
    ]);
  });

  it('returns empty array for session with no messages', () => {
    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toEqual([]);
  });

  it('deletes all messages for a session', () => {
    appendMessage(db, { sessionId, role: 'user', content: 'msg 1' });
    appendMessage(db, { sessionId, role: 'assistant', content: 'msg 2' });

    const count = deleteMessagesBySession(db, sessionId);
    expect(count).toBe(2);

    const remaining = listMessagesBySession(db, sessionId);
    expect(remaining).toEqual([]);
  });

  it('isolates messages between sessions', () => {
    const session2 = createSession(db, { agentId: 'agent-1' });

    appendMessage(db, { sessionId, role: 'user', content: 'session 1 msg' });
    appendMessage(db, { sessionId: session2.id, role: 'user', content: 'session 2 msg' });

    const msgs1 = listMessagesBySession(db, sessionId);
    const msgs2 = listMessagesBySession(db, session2.id);

    expect(msgs1).toHaveLength(1);
    expect(msgs1[0]!.content).toBe('session 1 msg');
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0]!.content).toBe('session 2 msg');
  });

  it('cascade-deletes messages when session is deleted', () => {
    appendMessage(db, { sessionId, role: 'user', content: 'will be deleted' });

    // Delete the session — cascade should remove messages
    deleteSession(db, sessionId);

    const msgs = listMessagesBySession(db, sessionId);
    expect(msgs).toEqual([]);
  });

  it('returns a valid MessageRecord shape', () => {
    const msg = appendMessage(db, { sessionId, role: 'user', content: 'check shape' });

    expect(msg.id).toBeDefined();
    expect(msg.sessionId).toBe(sessionId);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('check shape');
    expect(msg.createdAtMs).toBeGreaterThan(0);
    expect(msg.toolCallId).toBeNull();
  });
});
