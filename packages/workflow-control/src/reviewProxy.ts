import { createServer } from 'node:http';
import { request as upstreamRequest } from 'node:https';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORWARDED_HEADERS = new Set([
  'authorization',
  'chatgpt-account-id',
  'content-type',
  'content-encoding',
  'accept',
  'openai-beta',
  'user-agent',
  'originator',
  'session_id',
  'x-codex-turn-state',
  'x-codex-turn-metadata',
  'x-codex-beta-features',
]);

export function modelEndpoint(
  method: string | undefined,
  target: string | undefined,
): string | undefined {
  if (method === 'POST' && target === '/responses') return '/backend-api/codex/responses';
  if (method !== 'GET') return undefined;
  if (target === '/models') return '/backend-api/codex/models';
  const version = /^\/models\?client_version=([0-9A-Za-z._-]{1,64})$/u.exec(target ?? '')?.[1];
  return version === undefined
    ? undefined
    : '/backend-api/codex/models?client_version=' + encodeURIComponent(version);
}

/** Fixed application gateway: no client-selected upstream, CONNECT, redirects or WebSockets. */
export function createReviewProxy() {
  const server = createServer((request, response) => {
    // Select fixed upstream paths; accept only the model-discovery version query.
    const path = modelEndpoint(request.method, request.url);
    if (path === undefined) {
      response.writeHead(403);
      response.end();
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => FORWARDED_HEADERS.has(name)),
    );
    const upstream = upstreamRequest(
      {
        protocol: 'https:',
        hostname: 'chatgpt.com',
        port: 443,
        servername: 'chatgpt.com',
        rejectUnauthorized: true,
        path,
        method: request.method,
        headers,
        timeout: 180_000,
      },
      (incoming) => {
        incoming.on('error', () => response.destroy());
        // Never expose an upstream redirect that could move credentials or calls to another host.
        if (incoming.statusCode && incoming.statusCode >= 300 && incoming.statusCode < 400) {
          incoming.destroy();
          response.writeHead(502);
          response.end();
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
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on('aborted', () => upstream.destroy());
    request.on('error', () => upstream.destroy());
    response.on('close', () => upstream.destroy());
    response.on('error', () => upstream.destroy());
    request.pipe(upstream);
  });
  server.on('connect', (_request, socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  server.on('upgrade', (_request, socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createReviewProxy().listen(8080, '0.0.0.0');
}
