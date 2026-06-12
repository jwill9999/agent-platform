import { createServer } from 'node:http';

import { closeDatabase, openDatabase, runSeed } from '@agent-platform/db';
import type { HarnessStateType, ToolCallIntent } from '@agent-platform/harness';

import { createApp } from './infrastructure/http/createApp.js';
import { attachTerminalWs } from './infrastructure/terminal/attachTerminalWs.js';
import { createLogger } from '@agent-platform/logger';
import { createSchedulerService } from './application/scheduler/schedulerService.js';
import type { V1RouterOptions } from './infrastructure/http/v1/v1Router.js';

const log = createLogger('api');

const sqlitePath = process.env.SQLITE_PATH?.trim();
let dbHandle: ReturnType<typeof openDatabase> | null = null;

if (sqlitePath) {
  dbHandle = openDatabase(sqlitePath);
  runSeed(dbHandle.db);
  log.info('db.ready', { sqlitePath });
}

const app = createApp({
  db: dbHandle?.db ?? null,
  ...e2eMockV1Options(),
});
const server = createServer(app);
attachTerminalWs(server, { db: dbHandle?.db ?? null });
const scheduler =
  dbHandle && process.env.SCHEDULER_ENABLED !== 'false'
    ? createSchedulerService(dbHandle.db)
    : null;

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

server.listen(port, host, () => {
  log.info('api.listen', { host, port });
  scheduler?.start();
});

function shutdown() {
  scheduler?.stop();
  server.close(() => {
    if (dbHandle) {
      closeDatabase(dbHandle.sqlite);
      log.info('db.closed');
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function e2eMockV1Options(): { v1: V1RouterOptions } | Record<string, never> {
  const rawToolCall = process.env.AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON?.trim();
  if (!rawToolCall) return {};

  const toolCall = parseE2eToolCall(rawToolCall);
  const finalText = process.env.AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT ?? 'E2E tool call complete';

  return {
    v1: {
      chat: {
        disableEvaluatorNodes: true,
        llmReasonNode: async (state: HarnessStateType) => {
          const step = state.taskIndex ?? 0;
          if (state.messages.some((message) => message.role === 'tool')) {
            return {
              llmOutput: { kind: 'text', content: finalText },
              messages: [{ role: 'assistant', content: finalText }],
              trace: [{ type: 'llm_call', step }],
              totalTokensUsed: (state.totalTokensUsed ?? 0) + 1,
              totalCostUnits: state.totalCostUnits ?? 0,
            };
          }

          return {
            llmOutput: { kind: 'tool_calls', calls: [toolCall] },
            messages: [{ role: 'assistant', content: '', toolCalls: [toolCall] }],
            trace: [{ type: 'llm_call', step }],
            totalTokensUsed: (state.totalTokensUsed ?? 0) + 1,
            totalCostUnits: state.totalCostUnits ?? 0,
          };
        },
      },
    },
  };
}

function parseE2eToolCall(rawToolCall: string): ToolCallIntent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawToolCall);
  } catch (error) {
    throw new Error(
      `Invalid AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!isRecord(parsed) || typeof parsed.name !== 'string' || !isRecord(parsed.args)) {
    throw new Error(
      'Invalid AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: expected { "name": string, "args": object }.',
    );
  }
  return {
    id: 'e2e-tool-call',
    name: parsed.name,
    args: parsed.args,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
