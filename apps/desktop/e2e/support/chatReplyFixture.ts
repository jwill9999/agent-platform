import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page, Route } from 'playwright';
import {
  CONTEXT_TOKEN_MODEL,
  emitContextTokenReply,
  type ContextTokenProviderReply,
  type ContextTokenProviderRequest,
} from './contextTokenProvider.js';

export function replyBarrier(timeoutMs = 30_000) {
  let release!: () => void;
  const settled = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release,
    wait: async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          settled,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Owned reply fixture barrier timed out')),
              timeoutMs,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type ControlledReply = {
  reply: ContextTokenProviderReply;
  gate?: ReturnType<typeof replyBarrier>;
};
/** The provider wire is real; only the external response and its release are deterministic. */
export async function startChatReplyProvider(replies: ControlledReply[]) {
  const requests: ContextTokenProviderRequest[] = [];
  const errors: string[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions')
          throw new Error('Unexpected fixture provider route');
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          const buffer = Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > 512_000) throw new Error('Fixture provider body exceeds bound');
          chunks.push(buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString()) as ContextTokenProviderRequest;
        requests.push(body);
        const response = replies[requests.length - 1];
        if (!response || body.model !== CONTEXT_TOKEN_MODEL || !body.stream)
          throw new Error('Unexpected fixture provider request');
        await response.gate?.wait();
        if (response.reply.kind === 'error') {
          res.writeHead(response.reply.status, {
            'content-type': 'application/json',
            'retry-after': '0',
          });
          res.end(JSON.stringify({ error: { message: 'Controlled reply fixture failure' } }));
        } else {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          emitContextTokenReply(res, response.reply);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ error: { message: 'Controlled reply fixture rejected request' } }),
        );
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    requests,
    errors,
    close: async () => {
      for (const response of replies) response.gate?.release();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

/** Fetch actual GET data before holding delivery. No replacement transcript/approval handler. */
export async function holdReplyRead(page: Page, url: string | RegExp) {
  const captured = replyBarrier();
  const release = replyBarrier();
  const delivered = replyBarrier();
  let record: { url: string; status: number; body: string } | undefined;
  let held = false;
  let deliveryError: unknown;
  let fulfilled = false;
  const handler = async (route: Route) => {
    if (held || route.request().method() !== 'GET') return route.continue();
    held = true;
    try {
      const actual = await route.fetch();
      record = { url: route.request().url(), status: actual.status(), body: await actual.text() };
      captured.release();
      await release.wait();
      await route.fulfill({ response: actual });
      fulfilled = true;
    } catch (error) {
      // Aborted stale generations may close their browser request before delivery.
      deliveryError = error;
      if (!route.request().failure() && !page.isClosed()) throw error;
    } finally {
      delivered.release();
    }
  };
  await page.route(url, handler);
  return {
    captured: captured.wait,
    release: release.release,
    delivered: delivered.wait,
    record: () => ({
      ...record,
      fulfilled,
      deliveryError: deliveryError instanceof Error ? deliveryError.message : deliveryError,
    }),
    close: async () => {
      release.release();
      await page.unroute(url, handler);
      if (held) await delivered.wait();
    },
  };
}
