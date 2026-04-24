import { mkdtempSync, rmSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, DEFAULT_AGENT_ID, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import type { Application } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const harnessMockState = {
  llmStep: 0,
  missingPath: '',
};

vi.mock('@agent-platform/harness', async () => {
  const actual =
    await vi.importActual<typeof import('@agent-platform/harness')>('@agent-platform/harness');

  return {
    ...actual,
    createLlmReasonNode: (options?: {
      emitter?: { emit: (event: { type: string; content?: string }) => Promise<void> | void };
      dispatcher?: {
        onPromptBuild?: (ctx: {
          sessionId: string;
          runId: string;
          plan: unknown;
          messages: Array<{ role: string; content: string }>;
        }) => Promise<void> | void;
      };
    }) => {
      harnessMockState.llmStep = 0;

      return async (state: {
        sessionId?: string;
        runId?: string;
        plan?: unknown;
        messages?: Array<{ role: string; content: string }>;
      }) => {
        await options?.dispatcher?.onPromptBuild?.({
          sessionId: state.sessionId ?? '',
          runId: state.runId ?? '',
          plan: state.plan ?? null,
          messages: (state.messages ?? []).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });

        if (harnessMockState.llmStep === 0) {
          harnessMockState.llmStep += 1;
          const call = {
            id: 'tool-1',
            name: 'sys_file_info',
            args: { path: harnessMockState.missingPath },
          };
          return {
            llmOutput: { kind: 'tool_calls' as const, calls: [call] },
            messages: [{ role: 'assistant' as const, content: '', toolCalls: [call] }],
            trace: [],
          };
        }

        if (harnessMockState.llmStep === 1) {
          harnessMockState.llmStep += 1;
          const call = {
            id: 'tool-2',
            name: 'sys_query_recent_errors',
            args: { limit: 5 },
          };
          return {
            llmOutput: { kind: 'tool_calls' as const, calls: [call] },
            messages: [{ role: 'assistant' as const, content: '', toolCalls: [call] }],
            trace: [],
          };
        }

        const content = 'I inspected the recent errors after the tool failure.';
        await options?.emitter?.emit({ type: 'text', content });
        return {
          llmOutput: { kind: 'text' as const, content },
          messages: [{ role: 'assistant' as const, content }],
          trace: [],
        };
      };
    },
    createCriticNode: () => async () => ({ critique: '', trace: [] }),
    createDodProposeNode: () => async () => ({
      dodContract: {
        criteria: ['Inspect recent errors after a tool failure.'],
        evidence: [],
        passed: false,
        failedCriteria: [],
      },
    }),
    createDodCheckNode:
      () => async (state: { dodContract?: { criteria?: string[]; evidence?: string[] } }) => ({
        dodContract: {
          criteria: state.dodContract?.criteria ?? ['Inspect recent errors after a tool failure.'],
          evidence: state.dodContract?.evidence ?? [],
          passed: true,
          failedCriteria: [],
        },
        trace: [],
      }),
  };
});

const CHAT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'AGENT_OPENAI_API_KEY',
  'OPENAI_ALLOW_LEGACY_ENV',
] as const;

function snapshotChatEnv(): Map<string, string | undefined> {
  const snap = new Map<string, string | undefined>();
  for (const key of CHAT_ENV_KEYS) snap.set(key, process.env[key]);
  return snap;
}

function restoreChatEnv(snap: Map<string, string | undefined>) {
  for (const key of CHAT_ENV_KEYS) {
    const value = snap.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function createSeededApp(dirs: string[]): Promise<{
  app: Application;
  sqlite: ReturnType<typeof openDatabase>['sqlite'];
}> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-observability-'));
  dirs.push(dir);
  const sqlitePath = path.join(dir, 'db.sqlite');
  const { db, sqlite } = openDatabase(sqlitePath);
  runSeed(db);

  vi.resetModules();
  const { createApp } = await import('../src/infrastructure/http/createApp.js');

  return { app: createApp({ db }), sqlite };
}

function parseNdjson(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function getResponseBody(response: { text?: unknown; body?: unknown }): string {
  if (typeof response.text === 'string') return response.text;
  if (typeof response.body === 'string') return response.body;
  if (Buffer.isBuffer(response.body)) return response.body.toString('utf8');
  return '';
}

function readTextResponse(
  res: IncomingMessage,
  callback: (error: Error | null, body?: string) => void,
): void {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => {
    body += chunk;
  });
  res.on('end', () => callback(null, body));
  res.on('error', (error: Error) => callback(error));
}

describe('observability tools (integration)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    harnessMockState.llmStep = 0;
    harnessMockState.missingPath = '';
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('returns recent tool failures for the current session through query_recent_errors', async () => {
    const envSnap = snapshotChatEnv();
    const { app, sqlite } = await createSeededApp(dirs);

    try {
      process.env.AGENT_OPENAI_API_KEY = 'sk-test-key';

      const missingPath = path.join(process.cwd(), 'definitely-missing-observability.txt');
      harnessMockState.missingPath = missingPath;

      const sessionRes = await request(app)
        .post('/v1/sessions')
        .send({ agentId: DEFAULT_AGENT_ID })
        .expect(201);

      const sessionId = sessionRes.body.data.id as string;
      const res = await request(app)
        .post('/v1/chat')
        .buffer(true)
        .parse(readTextResponse)
        .send({ sessionId, message: 'If a tool fails, inspect recent errors.' })
        .expect(200);

      expect(res.headers['content-type']).toContain('application/x-ndjson');

      const events = parseNdjson(getResponseBody(res));
      const toolExecutions = sqlite
        .prepare(
          'select tool_name as toolName, status, result_json as resultJson from tool_executions order by started_at_ms asc',
        )
        .all() as Array<{ toolName: string; status: string; resultJson: string | null }>;
      const recentErrors = events.find(
        (event) => event.type === 'tool_result' && event.toolId === 'sys_query_recent_errors',
      ) as
        | {
            data?: {
              total?: number;
              truncated?: boolean;
              records?: Array<{
                level?: string;
                kind?: string;
                event?: { message?: string; phase?: string };
              }>;
            };
          }
        | undefined;

      expect(recentErrors, JSON.stringify({ events, toolExecutions }, null, 2)).toBeDefined();
      expect(recentErrors?.data?.truncated).toBe(false);
      expect(recentErrors?.data?.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(recentErrors?.data?.records)).toBe(true);
      expect(
        recentErrors?.data?.records?.some(
          (record) =>
            record.level === 'error' &&
            record.kind === 'error' &&
            record.event?.phase === 'tool' &&
            record.event?.message?.includes('sys_file_info'),
        ),
      ).toBe(true);
    } finally {
      restoreChatEnv(envSnap);
      closeDatabase(sqlite);
    }
  });
});
