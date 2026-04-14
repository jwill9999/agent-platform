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
