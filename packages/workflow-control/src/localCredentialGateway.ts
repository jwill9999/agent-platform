import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { z } from 'zod';
import { LocalCredentialLeases } from './localCredentialLeases.js';
import { modelEndpoint } from './reviewProxy.js';

const accountSchema = z.object({
  tokens: z.object({ access_token: z.string().min(1), account_id: z.string().min(1) }),
});
interface Active {
  leaseId: string;
  generation: string;
  abort: () => void;
}
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/** Trusted account credentials are read only here. Caller authorization/account headers never pass through. */
export function createLocalCredentialGateway(leases: LocalCredentialLeases, accountFile: string) {
  const active = new Set<Active>();
  const gateway = createServer((request, response) => {
    const endpoint = modelEndpoint(request.method, request.url);
    const token = /^Bearer ([a-f0-9]{64})$/u.exec(request.headers.authorization ?? '')?.[1];
    let lease: ReturnType<LocalCredentialLeases['authorize']>;
    try {
      lease = token ? leases.authorize(token) : undefined;
    } catch {
      lease = undefined;
    }
    if (!endpoint || !lease) {
      response.writeHead(403).end();
      return;
    }
    const encoding = request.headers['content-encoding'];
    if (
      encoding !== undefined &&
      !['identity', 'gzip', 'deflate', 'zstd'].includes(String(encoding))
    ) {
      response.writeHead(415).end();
      return;
    }
    let account: z.infer<typeof accountSchema>;
    try {
      account = accountSchema.parse(JSON.parse(readFileSync(accountFile, 'utf8')));
    } catch {
      response.writeHead(503).end();
      return;
    }
    const upstream = httpsRequest(
      {
        protocol: 'https:',
        hostname: 'chatgpt.com',
        servername: 'chatgpt.com',
        port: 443,
        rejectUnauthorized: true,
        path: endpoint,
        method: request.method,
        timeout: 180_000,
        headers: {
          authorization: `Bearer ${account.tokens.access_token}`,
          'chatgpt-account-id': account.tokens.account_id,
          'content-type': 'application/json',
          ...(encoding ? { 'content-encoding': encoding } : {}),
          accept: request.headers.accept ?? 'text/event-stream',
          ...(request.headers['openai-beta']
            ? { 'openai-beta': request.headers['openai-beta'] }
            : {}),
          ...(request.headers.originator ? { originator: request.headers.originator } : {}),
          ...(request.headers['user-agent'] ? { 'user-agent': request.headers['user-agent'] } : {}),
        },
      },
      (incoming) => {
        incoming.on('error', () => response.destroy());
        if (incoming.statusCode && incoming.statusCode >= 300 && incoming.statusCode < 400) {
          incoming.destroy();
          response.writeHead(502).end();
          return;
        }
        response.writeHead(incoming.statusCode ?? 502, {
          'content-type': incoming.headers['content-type'] ?? 'application/json',
          ...(incoming.headers['content-encoding']
            ? { 'content-encoding': incoming.headers['content-encoding'] }
            : {}),
        });
        incoming.pipe(response);
      },
    );
    const entry: Active = {
      ...lease,
      abort: () => {
        upstream.destroy();
        response.destroy();
        request.destroy();
      },
    };
    active.add(entry);
    const done = () => {
      active.delete(entry);
      upstream.destroy();
    };
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    upstream.on('timeout', entry.abort);
    request.on('aborted', entry.abort);
    request.on('error', entry.abort);
    response.on('close', done);
    response.on('error', entry.abort);
    let bytes = 0;
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) entry.abort();
    });
    request.pipe(upstream);
  });
  gateway.on('connect', (_request, socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  gateway.on('upgrade', (_request, socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  const sweep = setInterval(() => {
    for (const entry of active) {
      try {
        if (leases.status(entry.leaseId, entry.generation) === 'active') continue;
      } catch {
        /* fail closed */
      }
      entry.abort();
      active.delete(entry);
    }
  }, 50);
  sweep.unref();
  gateway.on('close', () => {
    clearInterval(sweep);
    for (const entry of active) entry.abort();
    active.clear();
  });
  return {
    gateway,
    revoke(leaseId: string, generation: string) {
      leases.revoke(leaseId, generation);
      for (const entry of active)
        if (entry.leaseId === leaseId && entry.generation === generation) {
          entry.abort();
          active.delete(entry);
        }
      // Local sockets are destroyed before acknowledgment. Already accepted upstream computation cannot be undone.
      return { leaseId, generation, status: 'revoked' as const };
    },
  };
}

const commandSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('issue'),
      leaseId: z.string(),
      generation: z.string(),
      executionId: z.string(),
    })
    .strict(),
  z
    .object({ operation: z.literal('revoke'), leaseId: z.string(), generation: z.string() })
    .strict(),
  z
    .object({ operation: z.literal('status'), leaseId: z.string(), generation: z.string() })
    .strict(),
  z.object({ operation: z.literal('conformance') }).strict(),
]);
const equal = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Separate trusted control server; key is never included in worker config or mounted in workers. */
export function createCredentialControlServer(
  leases: LocalCredentialLeases,
  gateway: ReturnType<typeof createLocalCredentialGateway>,
  controlKey: string,
) {
  if (!/^[a-f0-9]{64}$/u.test(controlKey)) throw new Error('private control key required');
  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    if (
      request.method !== 'POST' ||
      request.url !== '/control' ||
      !equal(request.headers.authorization ?? '', `Bearer ${controlKey}`)
    ) {
      response.writeHead(403).end();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const value of request) {
      const chunk = Buffer.from(value as Uint8Array);
      size += chunk.length;
      if (size > 4096) {
        response.writeHead(413).end();
        request.destroy();
        return;
      }
      chunks.push(chunk);
    }
    const command = commandSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    let result: unknown;
    switch (command.operation) {
      case 'issue':
        result = leases.issue(command.leaseId, command.generation, command.executionId);
        break;
      case 'revoke':
        result = gateway.revoke(command.leaseId, command.generation);
        break;
      case 'status':
        result = {
          leaseId: command.leaseId,
          generation: command.generation,
          status: leases.status(command.leaseId, command.generation),
        };
        break;
      case 'conformance':
        result = leases.conformance();
        break;
    }
    response
      .writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      .end(JSON.stringify(result));
  };
  return createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(409);
      response.end('{"error":"credential_operation_rejected"}');
    });
  });
}
