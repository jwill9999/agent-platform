import { createServer, type RequestListener, type Server } from 'node:http';

/** Bind the same address family that Supertest uses for its request URL. */
export async function listenLoopback(app: RequestListener): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

export async function closeLoopback(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Settle every owned listener before callers dispose dependent fixture resources. */
export async function closeLoopbacks(servers: Iterable<Server>): Promise<void> {
  const results = await Promise.allSettled([...servers].map(closeLoopback));
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Test listener cleanup failed');
}
