import { describe, expect, it, vi } from 'vitest';
import {
  monitoringApi,
  monitoringPost,
  maximumMonitoringBytes,
} from '../src/main/monitoringTransport.js';
import { assertMonitoringSender } from '../src/main/monitoringIpc.js';

const capability = 'b'.repeat(64);
const config = { apiBaseUrl: 'http://127.0.0.1:4310', capability };

describe('private monitoring transport', () => {
  it.each([
    'https://example.com',
    'http://localhost:4310',
    'http://user:secret@127.0.0.1:4310',
    'broken',
  ])('rejects backend %s without a request', async (apiBaseUrl) => {
    const fetchImpl = vi.fn();
    await expect(
      monitoringPost('status', {}, (x) => x, { ...config, apiBaseUrl, fetchImpl }),
    ).rejects.toThrow('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'private-secret', 'b'.repeat(63)])(
    'rejects an absent or invalid capability',
    (value) => {
      expect(() => monitoringApi({ ...config, capability: value })).toThrow('unavailable');
    },
  );
  it('uses only the private loopback endpoint with redirects disabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ safe: true }));
    expect(await monitoringPost('status', {}, (value) => value, { ...config, fetchImpl })).toEqual({
      safe: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('http://127.0.0.1:4310/v1/diagnostics/monitoring/status');
    expect(request).toMatchObject({
      method: 'POST',
      redirect: 'error',
      body: '{}',
      headers: { 'x-diagnostics-capability': capability },
    });
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    new Response('PRIVATE_BODY_CANARY', { status: 503 }),
    new Response('PRIVATE_PARSE_CANARY'),
  ])('masks upstream response failure', async (response) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    const error = await monitoringPost('status', {}, (x) => x, { ...config, fetchImpl }).catch(
      (x) => x,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toBe(
      'Local monitoring could not be read or updated. Refresh its status before retrying.',
    );
  });
  it('masks fetch and schema errors without logging or exposing payloads', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('PRIVATE_FETCH_CANARY'));
    await expect(monitoringPost('status', {}, (x) => x, { ...config, fetchImpl })).rejects.toThrow(
      'could not be read',
    );
    fetchImpl.mockResolvedValue(Response.json({ private: 'PRIVATE_SCHEMA_CANARY' }));
    await expect(
      monitoringPost(
        'status',
        {},
        () => {
          throw new Error('PRIVATE_SCHEMA_CANARY');
        },
        { ...config, fetchImpl },
      ),
    ).rejects.toThrow('could not be read');
  });
  it('cancels an oversized stream and does not invoke the projector', async () => {
    const cancel = vi.fn();
    const parse = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(maximumMonitoringBytes + 1));
        },
        cancel,
      }),
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(monitoringPost('window', {}, parse, { ...config, fetchImpl })).rejects.toThrow(
      'could not be read',
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });
});

describe('monitoring IPC sender', () => {
  const trustedFrame = { url: 'http://127.0.0.1:4300/settings/workspace' };
  const trusted = { mainFrame: trustedFrame };
  function check(sender: unknown, senderFrame: unknown, rendererUrl = 'http://127.0.0.1:4300/') {
    return () =>
      assertMonitoringSender(
        { sender, senderFrame } as Parameters<typeof assertMonitoringSender>[0],
        trusted as Parameters<typeof assertMonitoringSender>[1],
        rendererUrl,
      );
  }
  it('accepts only the actual top-level app frame on its captured origin', () =>
    expect(check(trusted, trustedFrame)).not.toThrow());
  it('rejects a foreign WebContents and a same-origin subframe', () => {
    expect(check({}, trustedFrame)).toThrow('untrusted');
    expect(check(trusted, { ...trustedFrame })).toThrow('untrusted');
  });
  it('rejects a replaced origin, missing frame, invalid URL or nonlocal trusted URL', () => {
    expect(check(trusted, trustedFrame, 'http://127.0.0.1:4301')).toThrow('untrusted');
    expect(check(trusted, null)).toThrow('untrusted');
    expect(check(trusted, trustedFrame, 'invalid')).toThrow('untrusted');
    expect(check(trusted, trustedFrame, 'https://example.com')).toThrow('untrusted');
  });
});
