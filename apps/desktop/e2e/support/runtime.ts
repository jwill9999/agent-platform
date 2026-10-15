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

/** Reserve both ports together so the OS cannot reuse the first for the second.
 * Reservations end before child processes bind; unrelated processes can still race us.
 */
export async function getDesktopPorts(): Promise<{ backendPort: number; rendererPort: number }> {
  const backend = createServer();
  const renderer = createServer();
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
    const backendPort = await listen(backend);
    const rendererPort = await listen(renderer);
    return { backendPort, rendererPort };
  } finally {
    await Promise.all(
      [backend, renderer].map(
        (server) => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
      ),
    );
  }
}
