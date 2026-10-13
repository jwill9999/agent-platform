import { describe, expect, it } from 'vitest';
import { createTransportForMcpServer } from '../src/transport.js';
import { McpAdapterError } from '../src/errors.js';

const HTTP_TRANSPORTS = ['http', 'sse', 'streamable-http'] as const;

describe('createTransportForMcpServer', () => {
  it('rejects stdio without command', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'stdio',
      }),
    ).toThrow(McpAdapterError);
  });

  it.each(HTTP_TRANSPORTS)('rejects %s without url', (transport) => {
    expect(() => createTransportForMcpServer({ id: 'm1', name: 't', transport })).toThrow(
      McpAdapterError,
    );
  });

  it.each(HTTP_TRANSPORTS)('rejects %s with syntactically invalid url', (transport) => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport,
        url: 'not a valid url',
      }),
    ).toThrow(McpAdapterError);
  });

  it.each(HTTP_TRANSPORTS)('creates transport for %s with valid url', (transport) => {
    const result = createTransportForMcpServer({
      id: 'm1',
      name: 't',
      transport,
      url: 'http://localhost:3000/mcp',
    });
    expect(result).toBeDefined();
    expect(result.start).toBeTypeOf('function');
    expect(result.close).toBeTypeOf('function');
  });

  it('rejects unknown transport', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'websocket',
      }),
    ).toThrow(McpAdapterError);
  });
});

describe('resolved connection boundary', () => {
  it.each([
    'http://example.com/mcp',
    'https://user:secret@example.com/mcp',
    'https://example.com/mcp?token=secret',
    'https://example.com/mcp#secret',
    'file:///tmp/mcp',
  ])('rejects unsafe endpoint %s', (url) => {
    expect(() =>
      createTransportForMcpServer({ id: 'safe', name: 'Safe', transport: 'http', url }),
    ).toThrow('Check the MCP transport');
  });
  it.each([
    'NODE_OPTIONS',
    'NODE_PATH',
    'SECRETS_MASTER_KEY',
    'LD_PRELOAD',
    'DYLD_INSERT_LIBRARIES',
  ])('rejects injected env %s before spawning', (name) => {
    expect(() =>
      createTransportForMcpServer({
        id: 'safe',
        name: 'Safe',
        transport: 'stdio',
        command: process.execPath,
        env: { [name]: 'private-value' },
      }),
    ).toThrow('environment or header');
  });
  it.each(['Host', 'Cookie', 'Mcp-Session-Id', 'Content-Type', 'Authorization\r\nX-Evil'])(
    'rejects reserved/invalid header %s',
    (name) => {
      expect(() =>
        createTransportForMcpServer({
          id: 'safe',
          name: 'Safe',
          transport: 'http',
          url: 'https://example.com/mcp',
          headers: { [name]: 'private-value' },
        }),
      ).toThrow('environment or header');
    },
  );
  it('rejects invalid header value without echoing it', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'safe',
        name: 'Safe',
        transport: 'http',
        url: 'https://example.com/mcp',
        headers: { Authorization: 'secret\r\nX-Evil: bad' },
      }),
    ).toThrow('environment or header');
  });
});
