import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/apiClient';
import { parseMcpImport } from '@agent-platform/contracts';
import {
  McpEditor,
  McpImportReviewEntry,
  McpTestResultPanel,
} from '@/components/config/mcp-dashboard';
import { McpTrustNotice } from '@/components/config/mcp-trust-notice';
import {
  credentialChanges,
  credentialRows,
  currentTestResult,
  editorBody,
  mcpWriteError,
  transportLabel,
} from '@/lib/mcp-onboarding';

beforeAll(() => vi.stubGlobal('React', React));

const saved = {
  id: 'server-1',
  slug: 'reference',
  name: 'Reference',
  transport: 'streamable-http',
  url: 'https://example.test/mcp',
  configurationRevision: 4,
  credentialStatus: { env: {}, headers: { Authorization: true, 'X-Required-Key': false } },
  needsReconfiguration: true,
};

const result = {
  status: 'ok' as const,
  discoveredCount: 7,
  eligibleCount: 4,
  rejections: [{ category: 'shadowed_tool', count: 3 }],
  latencyMs: 12,
  testedAt: '2026-10-13T12:00:00.000Z',
  configurationRevision: 4,
};

describe('MCP credential editing', () => {
  it('retains without transmitting a fake masked replacement and distinguishes clear from replace', () => {
    const rows = credentialRows({ Authorization: true, 'X-Key': true, 'X-Other': true });
    expect(rows.every((row) => row.value === '')).toBe(true);
    rows[1] = { ...rows[1]!, action: 'clear' };
    rows[2] = { ...rows[2]!, action: 'replace', value: 'synthetic-new-secret' };
    expect(credentialChanges(rows)).toEqual({ 'X-Key': null, 'X-Other': 'synthetic-new-secret' });
    expect(JSON.stringify(credentialChanges(rows))).not.toContain('Authorization');
  });

  it('rejects duplicate names and empty replacement instead of silently dropping or clearing values', () => {
    const rows = credentialRows({ Authorization: true });
    expect(() =>
      credentialChanges([...rows, { ...rows[0]!, id: 'another', name: 'authorization' }]),
    ).toThrow('unique');
    expect(() => credentialChanges([{ ...rows[0]!, action: 'replace' }])).toThrow('replacement');
  });

  it('renders public configured flags as immutable names and empty password inputs only after replacement', () => {
    const html = renderToStaticMarkup(
      createElement(McpEditor, { server: saved, onSaved: vi.fn(), onCancel: vi.fn() }),
    );
    expect(html).toContain('Saved value configured');
    expect(html).toContain('No saved value');
    expect(html).toContain('Keep saved value');
    expect(html).toContain('needs reconfiguration');
    expect(html).not.toContain('Metadata (JSON)');
    expect(html).not.toContain('type="password"');
    expect(html).toMatch(/id="headers-name-Authorization"[^>]*disabled=""/);
  });

  it('normalizes explicitly saved legacy alias and removes obsolete command fields from an HTTP update', () => {
    const body = editorBody({
      name: 'Reference',
      transport: 'sse',
      command: 'old-node',
      argsText: '["old-script"]',
      url: 'https://example.test/mcp',
      env: [],
      headers: credentialRows({ Authorization: true }),
    });
    expect(body).toEqual({
      name: 'Reference',
      transport: 'streamable-http',
      url: 'https://example.test/mcp',
      credentials: { env: {}, headers: {} },
    });
    expect(transportLabel('sse')).toContain('not SSE');
  });

  it('uses shared validation for unsafe endpoints and process injection variables', () => {
    const input = {
      name: 'Reference',
      transport: 'streamable-http',
      command: '',
      argsText: '[]',
      url: 'https://example.test/mcp?token=secret',
      env: [],
      headers: [],
    };
    expect(() => editorBody(input)).toThrow('Unsupported configuration');
    expect(() =>
      editorBody({
        ...input,
        transport: 'stdio',
        command: 'node',
        env: [
          {
            id: 'new',
            name: 'NODE_OPTIONS',
            value: '--require evil',
            configured: false,
            existing: false,
            action: 'replace',
          },
        ],
      }),
    ).toThrow('Unsupported configuration');
  });
});

describe('MCP review and connection feedback', () => {
  it('provides fixed actionable write guidance without echoing raw errors or credentials', () => {
    const raw = new ApiRequestError(
      'synthetic-secret in server response',
      503,
      'MCP_SECRET_KEY_UNAVAILABLE',
    );
    expect(mcpWriteError(raw)).toContain('SECRETS_MASTER_KEY');
    expect(mcpWriteError(raw)).not.toContain('synthetic-secret');
    expect(mcpWriteError(new Error('synthetic-secret'))).not.toContain('synthetic-secret');
    expect(mcpWriteError(new ApiRequestError('synthetic-secret', 400, 'toString'))).toContain(
      'not saved',
    );
  });

  it('shows credential names without values or a raw metadata preview', () => {
    const entry = parseMcpImport(
      JSON.stringify({
        reference: {
          url: 'https://example.test/mcp',
          headers: { Authorization: 'Bearer synthetic-private-token' },
        },
      }),
    ).entries[0]!;
    const html = renderToStaticMarkup(
      createElement(McpImportReviewEntry, { entry, selected: true, onSelect: vi.fn() }),
    );
    expect(html).toContain('Authorization');
    expect(html).toContain('values hidden');
    expect(html).not.toContain('synthetic-private-token');
    expect(html).toContain('checked=""');
  });

  it('keeps invalid batch entries visible and unselectable instead of silently importing them', () => {
    const entries = parseMcpImport(
      JSON.stringify({
        valid: { command: 'node', args: ['fixture.mjs'] },
        invalid: { command: 'node', cwd: '/unsupported' },
      }),
    ).entries;
    expect(entries).toHaveLength(2);
    const html = renderToStaticMarkup(
      createElement(McpImportReviewEntry, {
        entry: entries[1]!,
        selected: false,
        onSelect: vi.fn(),
      }),
    );
    expect(html).toContain('invalid');
    expect(html).toContain('role="alert"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('checked=""');
  });

  it('does not reuse discovery success after a configuration revision changes', () => {
    expect(currentTestResult({ configurationRevision: 4 }, result)).toBe(result);
    expect(currentTestResult({ configurationRevision: 5 }, result)).toBeUndefined();
    expect(currentTestResult({}, result)).toBeUndefined();
  });

  it('distinguishes discovered from eligible counts and grants no tool permission', () => {
    const html = renderToStaticMarkup(createElement(McpTestResultPanel, { result }));
    expect(html).toContain('7 discovered');
    expect(html).toContain('4 eligible');
    expect(html).toContain('shadowed_tool');
    expect(html).toContain('Discovery does not grant permission');
    expect(html).toContain(result.testedAt);
    expect(html).toContain('configuration revision 4');
  });

  it('presents a safe failure stage and corrective guidance as a failure, not zero available tools', () => {
    const failure = {
      ...result,
      status: 'error' as const,
      error: 'Authentication failed.',
      stage: 'connect',
      code: 'MCP_AUTH_REQUIRED',
      retryGuidance: 'Replace the configured credential and test again.',
    };
    const html = renderToStaticMarkup(createElement(McpTestResultPanel, { result: failure }));
    expect(html).toContain('Connection failed');
    expect(html).toContain('MCP_AUTH_REQUIRED');
    expect(html).toContain('Replace the configured credential');
    expect(html).not.toContain('eligible tools');
  });

  it('discloses the actual execution host and startup authority before test or assignment', () => {
    const html = renderToStaticMarkup(createElement(McpTrustNotice));
    expect(html).toContain('API container');
    expect(html).toContain('desktop app');
    expect(html).toContain('a Mac path');
    expect(html).toContain('does not sandbox server startup');
    expect(html).toContain('Saving a configuration does not connect');
  });
});
