import { describe, expect, it } from 'vitest';
import { createTransportForMcpServer } from '../src/transport.js';
import { McpAdapterError } from '../src/errors.js';

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

  it('rejects sse without url', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'sse',
      }),
    ).toThrow(McpAdapterError);
  });

  it('rejects streamable-http without url', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'streamable-http',
      }),
    ).toThrow(McpAdapterError);
  });

  it('rejects sse with syntactically invalid url', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'sse',
        url: 'not a valid url',
      }),
    ).toThrow(McpAdapterError);
  });

  it('rejects streamable-http with syntactically invalid url', () => {
    expect(() =>
      createTransportForMcpServer({
        id: 'm1',
        name: 't',
        transport: 'streamable-http',
        url: 'not a valid url',
      }),
    ).toThrow(McpAdapterError);
  });

  it('creates transport for streamable-http with valid url', () => {
    const transport = createTransportForMcpServer({
      id: 'm1',
      name: 't',
      transport: 'streamable-http',
      url: 'http://localhost:3000/mcp',
    });
    expect(transport).toBeDefined();
    expect(transport.start).toBeTypeOf('function');
    expect(transport.close).toBeTypeOf('function');
  });

  it('creates transport for sse with valid url (maps to StreamableHTTP)', () => {
    const transport = createTransportForMcpServer({
      id: 'm1',
      name: 't',
      transport: 'sse',
      url: 'http://localhost:3000/mcp',
    });
    expect(transport).toBeDefined();
    expect(transport.start).toBeTypeOf('function');
    expect(transport.close).toBeTypeOf('function');
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
