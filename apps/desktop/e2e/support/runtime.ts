import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function seedDesktopDatabase(
  sqlitePath: string,
  options: { secretsMasterKey?: string } = {},
): void {
  execFileSync(process.execPath, [join(repoRoot, 'packages/db/dist/seed/run.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SQLITE_PATH: sqlitePath,
      E2E_SEED: '1',
      ...(options.secretsMasterKey ? { SECRETS_MASTER_KEY: options.secretsMasterKey } : {}),
    },
    stdio: 'inherit',
  });
}

export function getOpenPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolvePort(address.port);
          return;
        }
        reject(new Error('Failed to allocate a local port.'));
      });
    });
  });
}

/** Hold every reservation together so our own allocations cannot reuse a released port.
 * Reservations end before child processes bind; unrelated processes can still race us.
 */
async function reservePorts(count: 2 | 4): Promise<number[]> {
  const servers = Array.from({ length: count }, () => createServer());
  const listen = (server: ReturnType<typeof createServer>) =>
    new Promise<number>((resolvePort, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address === 'object' && address) resolvePort(address.port);
        else reject(new Error('Failed to allocate a local port.'));
      });
    });
  try {
    return await Promise.all(servers.map(listen));
  } finally {
    await Promise.all(
      servers.map(
        (server) => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
      ),
    );
  }
}

export async function getDesktopPorts(): Promise<{ backendPort: number; rendererPort: number }> {
  const ports = await reservePorts(2);
  return { backendPort: ports[0]!, rendererPort: ports[1]! };
}

/** Explicit inspector ports prevent Playwright's ephemeral debuggers taking an app port. */
export async function getDesktopLaunchPorts(): Promise<{
  backendPort: number;
  rendererPort: number;
  nodeInspectorPort: number;
  chromiumDebuggerPort: number;
}> {
  const ports = await reservePorts(4);
  return {
    backendPort: ports[0]!,
    rendererPort: ports[1]!,
    nodeInspectorPort: ports[2]!,
    chromiumDebuggerPort: ports[3]!,
  };
}
