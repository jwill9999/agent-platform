import { createServer } from 'node:http';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MODEL_ENDPOINTS = new Set(['chatgpt.com:443', 'api.openai.com:443', 'auth.openai.com:443']);

/** Deploy only as the sole exit from an internal reviewer network, without host ports. */
export function createReviewProxy() {
  const server = createServer((_request, response) => {
    response.writeHead(405);
    response.end();
  });
  server.on('connect', (request, socket, head) => {
    if (!request.url || !MODEL_ENDPOINTS.has(request.url)) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const upstream = connect({ host: request.url.slice(0, -4), port: 443 });
    upstream.setTimeout(120_000, () => upstream.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    upstream.on('close', () => socket.destroy());
    upstream.once('connect', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createReviewProxy().listen(8080, '0.0.0.0');
}
