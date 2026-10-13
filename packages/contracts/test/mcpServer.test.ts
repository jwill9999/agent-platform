import { describe, expect, it } from 'vitest';
import {
  McpServerCreateBodySchema,
  parseMcpImport,
  validateMcpEndpoint,
} from '../src/mcpServer.js';

describe('MCP configuration contract', () => {
  it('normalizes http while preserving the labelled sse alias', () => {
    expect(
      McpServerCreateBodySchema.parse({
        name: 'HTTP',
        transport: 'http',
        url: 'http://localhost:3002/mcp',
      }).transport,
    ).toBe('streamable-http');
    expect(
      McpServerCreateBodySchema.parse({
        name: 'Legacy',
        transport: 'sse',
        url: 'https://example.test/mcp',
      }).transport,
    ).toBe('sse');
  });
  it('reviews each supported shape without hiding invalid entries', () => {
    for (const input of [
      'https://example.test/mcp',
      '{"command":"node","args":["fixture.js"]}',
      '{"local":{"command":"node"}}',
      '{"mcpServers":{"local":{"command":"node"}}}',
    ]) {
      expect(parseMcpImport(input).entries[0]?.config).toBeDefined();
    }
    const entries = parseMcpImport(
      '{"ok":{"command":"node"},"bad":{"command":"node","cwd":"/tmp"}}',
    ).entries;
    expect(entries[0]?.config).toBeDefined();
    expect(entries[1]?.error).toBeDefined();
    expect(parseMcpImport('{"mcpServers":{},"extra":true}').entries[0]?.error).toBeDefined();
  });
  it('rejects secret references, process injection, shell args strings and unsupported options', () => {
    const base = { name: 'Local', transport: 'stdio', command: 'node' };
    for (const extras of [
      { metadata: { secretRef: 'unrelated' } },
      { cwd: '/tmp' },
      { args: '--flag' },
      { credentials: { env: { NODE_OPTIONS: '--require evil' } } },
      { credentials: { env: { LD_PRELOAD: 'evil' } } },
      { credentials: { env: { TOKEN: '${HOST_SECRET}' } } },
    ]) {
      expect(McpServerCreateBodySchema.safeParse({ ...base, ...extras }).success).toBe(false);
    }
  });
  it('rejects URL credentials, query, fragment and nonlocal cleartext', () => {
    for (const url of [
      'https://user:secret@example.test/mcp',
      'https://example.test/mcp?key=secret',
      'https://example.test/mcp#secret',
      'http://example.test/mcp',
      'file:///tmp/mcp',
    ])
      expect(validateMcpEndpoint(url)).toBe(false);
    for (const url of [
      'https://example.test/mcp',
      'http://localhost:123/mcp',
      'http://127.0.0.1/mcp',
      'http://[::1]/mcp',
      'http://host.docker.internal:123/mcp',
    ])
      expect(validateMcpEndpoint(url)).toBe(true);
  });
  it('refuses prototype keys, ambiguous header casing and duplicate credential shapes', () => {
    for (const name of ['__proto__', 'constructor', 'prototype']) {
      const input = JSON.parse(
        `{"name":"Local","transport":"stdio","command":"node","credentials":{"env":{"${name}":"value"}}}`,
      );
      expect(McpServerCreateBodySchema.safeParse(input).success).toBe(false);
    }
    expect(
      McpServerCreateBodySchema.safeParse({
        name: 'Remote',
        transport: 'streamable-http',
        url: 'https://example.test/mcp',
        credentials: { headers: { Authorization: 'one', authorization: 'two' } },
      }).success,
    ).toBe(false);
    expect(
      parseMcpImport('{"command":"node","env":{"KEY":"one"},"credentials":{"env":{"KEY":"two"}}}')
        .entries[0]?.error,
    ).toBeDefined();
  });
  it('accepts horizontal tab and visible ASCII header values but rejects every other control', () => {
    const allowedAscii =
      '\t !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    const accepts = (value: string) =>
      McpServerCreateBodySchema.safeParse({
        name: 'Remote',
        transport: 'streamable-http',
        url: 'https://example.test/mcp',
        credentials: { headers: { 'X-Fixture': value } },
      }).success;
    for (let code = 0; code < 128; code += 1) {
      const character = String.fromCharCode(code);
      expect(accepts(`before${character}after`), `ASCII ${code}`).toBe(
        allowedAscii.includes(character),
      );
    }
    expect(accepts('safe\ttext café 漢字 😀')).toBe(true);
  });
  it('supports static auth while refusing protocol/header injection and crossed transports', () => {
    const base = { name: 'Remote', transport: 'streamable-http', url: 'https://example.test/mcp' };
    expect(
      McpServerCreateBodySchema.safeParse({
        ...base,
        credentials: { headers: { Authorization: 'Bearer fixture' } },
      }).success,
    ).toBe(true);
    for (const headers of [
      { Host: 'other.test' },
      { 'Mcp-Session-Id': 'session' },
      { 'X-Key': 'a\r\nb' },
      { 'X-Key': 'a\x01b' },
    ])
      expect(
        McpServerCreateBodySchema.safeParse({ ...base, credentials: { headers } }).success,
      ).toBe(false);
    expect(
      McpServerCreateBodySchema.safeParse({ ...base, credentials: { env: { TOKEN: 'value' } } })
        .success,
    ).toBe(false);
  });
});
