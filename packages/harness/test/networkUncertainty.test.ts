import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { executeMediumRiskTool, MEDIUM_RISK_IDS } from '../src/tools/mediumRiskTools.js';
import type { RunExecutionControl } from '../src/runControl.js';

async function localTransport(server: Server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture unavailable');
  const realFetch = globalThis.fetch;
  // Transport fixture only: URL policy still validates the public test hostname unchanged.
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((_url, init) =>
      realFetch(`http://127.0.0.1:${address.port}/fixture`, init),
    );
  return async () => {
    fetch.mockRestore();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
}

describe('native remote request uncertainty', () => {
  it('does not classify a server-applied mutation and dropped response as a known tool failure', async () => {
    let effects = 0;
    const server = createServer((request) => {
      request.resume();
      effects++;
      request.socket.destroy();
    });
    const close = await localTransport(server);
    try {
      const output = await executeMediumRiskTool(MEDIUM_RISK_IDS.httpRequest, {
        url: 'https://fixture.example/operation',
        method: 'POST',
        body: '{"action":"fixture"}',
      });
      expect(effects).toBe(1);
      expect(output).toMatchObject({ type: 'error', code: 'HTTP_OUTCOME_UNKNOWN' });
    } finally {
      await close();
    }
  });

  it('propagates user Stop to an admitted POST while retaining unknown remote effects', async () => {
    const controller = new AbortController();
    let effects = 0;
    const server = createServer((request) => {
      request.resume();
      effects++;
      controller.abort('user_stop');
    });
    const close = await localTransport(server);
    const settlements: unknown[] = [];
    const control: RunExecutionControl = {
      assertActive() {},
      invoke(_kind, action) {
        return action().then((result) => {
          settlements.push(result);
          return result;
        });
      },
    };
    try {
      const output = await executeMediumRiskTool(
        MEDIUM_RISK_IDS.httpRequest,
        { url: 'https://fixture.example/operation', method: 'POST' },
        { signal: controller.signal, runControl: control },
      );
      expect(effects).toBe(1);
      expect(output).toMatchObject({ type: 'error', code: 'HTTP_OUTCOME_UNKNOWN' });
      expect(settlements).toEqual([
        expect.objectContaining({ type: 'error', code: 'HTTP_OUTCOME_UNKNOWN' }),
      ]);
    } finally {
      await close();
    }
  });

  it('cancels a download body while admitting that the file can remain partial', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'download-uncertainty-'));
    const path = join(directory, 'partial');
    const controller = new AbortController();
    const server = createServer((request, response) => {
      request.resume();
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.write('partial fixture');
    });
    const close = await localTransport(server);
    const pending = executeMediumRiskTool(
      MEDIUM_RISK_IDS.downloadFile,
      { url: 'https://fixture.example/file', path },
      { signal: controller.signal },
    );
    try {
      await vi.waitFor(async () => expect(await readFile(path, 'utf8')).toBe('partial fixture'));
      controller.abort('user_stop');
      expect(await pending).toMatchObject({ type: 'error', code: 'DOWNLOAD_OUTCOME_UNKNOWN' });
      expect(await readFile(path, 'utf8')).toBe('partial fixture');
    } finally {
      controller.abort('user_stop');
      await close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
