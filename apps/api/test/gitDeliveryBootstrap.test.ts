import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  getGitDeliveryOperation,
  insertGitDeliveryOperation,
  openDatabase,
  transitionGitDeliveryOperation,
} from '@agent-platform/db';

const host = vi.hoisted(() => ({
  listen: vi.fn(),
  close: vi.fn(),
  createApp: vi.fn(),
}));
vi.mock('node:http', () => ({ createServer: () => host }));
vi.mock('../src/infrastructure/http/createApp.js', () => ({ createApp: host.createApp }));
vi.mock('../src/infrastructure/terminal/attachTerminalWs.js', () => ({
  attachTerminalWs: vi.fn(),
}));
vi.mock('../src/application/scheduler/schedulerService.js', () => ({
  createSchedulerService: vi.fn(),
}));

let directory: string;
let connection: ReturnType<typeof openDatabase> | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (connection) closeDatabase(connection.sqlite);
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it('recovers interrupted receipts exactly once before the API accepts work, never on auxiliary opens', async () => {
  directory = mkdtempSync(join(tmpdir(), 'git-delivery-host-'));
  const path = join(directory, 'state.sqlite');
  connection = openDatabase(path);
  const id = randomUUID();
  const now = Date.now();
  const receipt = {
    id,
    projectId: 'project',
    source: 'panel' as const,
    action: { kind: 'stage' as const, mode: 'stage' as const, paths: ['file'] },
    state: 'executing' as const,
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs: now + 900000,
    review: {
      branch: 'feature/test',
      head: 'a'.repeat(40),
      indexTree: 'b'.repeat(40),
      paths: ['file'],
    },
  };
  insertGitDeliveryOperation(connection.db, {
    receipt,
    repositoryRoot: '/owned-fixture',
    agentId: null,
    toolCallId: null,
    actionKey: 'stage:stage',
    materialJson: '{}',
  });
  vi.stubEnv('SQLITE_PATH', path);
  vi.stubEnv('SCHEDULER_ENABLED', 'false');
  vi.stubEnv('DIAGNOSTICS_LOCAL_CAPABILITY', '');
  vi.stubEnv('AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON', '');
  vi.stubEnv('AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT', '');
  // Prevent test import from registering long-lived process signal listeners.
  vi.spyOn(process, 'on').mockReturnValue(process);
  let hostDb: ReturnType<typeof openDatabase>['db'] | undefined;
  host.createApp.mockImplementation(({ db }) => {
    hostDb = db;
    expect(getGitDeliveryOperation(db, id)?.receipt).toMatchObject({
      state: 'unknown',
      updatedAtMs: expect.any(Number),
    });
    expect(host.listen).not.toHaveBeenCalled();
    return {};
  });
  await import('../src/index.js');
  expect(host.createApp).toHaveBeenCalledTimes(1);
  expect(host.listen).toHaveBeenCalledTimes(1);
  // Simulate new work after startup. Opening another DB connection must not recover it.
  expect(transitionGitDeliveryOperation(connection.db, id, 'unknown', receipt)).toBe(true);
  const auxiliary = openDatabase(path);
  try {
    expect(getGitDeliveryOperation(auxiliary.db, id)?.receipt.state).toBe('executing');
  } finally {
    closeDatabase(auxiliary.sqlite);
    // The actual host bootstrap opened its own connection; close only this owned test DB.
    const sqlite = (hostDb as unknown as { $client: ReturnType<typeof openDatabase>['sqlite'] })
      .$client;
    closeDatabase(sqlite);
  }
});
