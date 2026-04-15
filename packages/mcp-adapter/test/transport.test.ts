import { describe, expect, it } from 'vitest';
import { createTransportForMcpServer } from '../src/transport.js';
import { McpAdapterError } from '../src/errors.js';

const HTTP_TRANSPORTS = ['sse', 'streamable-http'] as const;

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
