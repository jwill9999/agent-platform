import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BrowserActionResult, Output } from '@agent-platform/contracts';
import {
  BrowserSessionManager,
  BROWSER_TOOL_IDS,
  executeBrowserTool,
} from '../src/tools/browserTools.js';

const HTML = `<!doctype html>
<html>
  <head>
    <title>Browser Tool Fixture</title>
  </head>
  <body>
    <main>
      <h1>Browser Tool Fixture</h1>
      <form id="search-form">
        <label for="search">Search</label>
        <input id="search" name="search" placeholder="Search terms" />
        <button type="submit">Search</button>
      </form>
      <button type="button" id="toggle">Toggle panel</button>
      <button type="button" class="duplicate">Duplicate</button>
      <button type="button" class="duplicate">Duplicate</button>
      <p id="status">Ready</p>
    </main>
    <script>
      document.getElementById('toggle').addEventListener('click', () => {
        document.getElementById('status').textContent = 'Panel opened';
      });
      document.getElementById('search-form').addEventListener('submit', (event) => {
        event.preventDefault();
        document.getElementById('status').textContent =
          'Searched: ' + document.getElementById('search').value;
      });
    </script>
  </body>
</html>`;

function toolData(output: Output | null): BrowserActionResult {
  expect(output?.type).toBe('tool_result');
  if (output?.type !== 'tool_result') throw new Error('Expected tool_result output');
  return output.data as unknown as BrowserActionResult;
}

async function startFixtureServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    if (request.url === '/redirect-external') {
      response.writeHead(302, { location: 'https://example.com/redirected' });
      response.end();
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(HTML);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe('browser tools integration', () => {
  let server: Server | undefined;
  let baseUrl = '';
  let workspaceRoot = '';
  let manager: BrowserSessionManager | undefined;

  beforeEach(async () => {
    workspaceRoot = join(process.cwd(), '.agent-platform/tmp/browser-tools-e2e', randomUUID());
    await mkdir(workspaceRoot, { recursive: true });
    const fixture = await startFixtureServer();
    server = fixture.server;
    baseUrl = fixture.url;
    manager = new BrowserSessionManager({ workspaceRoot });
  });

  afterEach(async () => {
    if (manager) {
      // Sessions may already be closed by individual tests.
      manager = undefined;
    }
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      server = undefined;
    }
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('drives a local UI through navigate, snapshot, screenshot, click, type, press, and close', async () => {
    const activeManager = manager ?? new BrowserSessionManager({ workspaceRoot });
    const start = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.start,
        { url: baseUrl, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(start.status).toBe('succeeded');
    expect(start.page?.title).toBe('Browser Tool Fixture');
    expect(start.sessionId).toBeDefined();

    const sessionId = String(start.sessionId);
    const navigate = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.navigate,
        { sessionId, url: `${baseUrl}/fixture`, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(navigate.status).toBe('succeeded');
    expect(navigate.evidence).toHaveLength(4);

    const snapshot = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.snapshot,
        { sessionId, maxBytes: 256 },
        { manager: activeManager },
      ),
    );
    expect(snapshot.status).toBe('succeeded');
    expect(snapshot.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'dom_summary', truncated: true }),
        expect.objectContaining({ kind: 'aria_snapshot' }),
      ]),
    );

    const click = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.click,
        { sessionId, target: { role: 'button', label: 'Toggle panel' }, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(click.status).toBe('succeeded');

    const type = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.type,
        {
          sessionId,
          target: { label: 'Search' },
          text: 'browser validation',
          timeoutMs: 10_000,
        },
        { manager: activeManager },
      ),
    );
    expect(type.status).toBe('succeeded');

    const press = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.press,
        {
          sessionId,
          target: { label: 'Search' },
          key: 'Enter',
          timeoutMs: 10_000,
        },
        { manager: activeManager },
      ),
    );
    expect(press.status).toBe('succeeded');
    const afterPressAria = press.evidence.find((artifact) => artifact.kind === 'aria_snapshot');
    expect(afterPressAria).toBeDefined();
    const afterPressContent = await readFile(String(afterPressAria?.uri), 'utf-8');
    expect(afterPressContent).toContain('browser validation');

    const screenshot = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.screenshot,
        { sessionId, maxBytes: 2_000_000 },
        { manager: activeManager },
      ),
    );
    expect(screenshot.status).toBe('succeeded');
    const screenshotArtifact = screenshot.evidence[0];
    expect(screenshotArtifact).toMatchObject({
      kind: 'screenshot',
      storage: 'workspace_file',
      mimeType: 'image/png',
      truncated: false,
    });
    await expect(stat(String(screenshotArtifact?.uri))).resolves.toMatchObject({
      size: expect.any(Number),
    });

    const close = toolData(
      await executeBrowserTool(BROWSER_TOOL_IDS.close, { sessionId }, { manager: activeManager }),
    );
    expect(close.status).toBe('succeeded');

    const afterClose = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.snapshot,
        { sessionId },
        { manager: activeManager },
      ),
    );
    expect(afterClose.status).toBe('failed');
    expect(afterClose.error?.code).toBe('BROWSER_SESSION_UNAVAILABLE');
  }, 60_000);

  it('blocks external navigation, approval-gates risky actions, and reports ambiguous targets', async () => {
    const activeManager = manager ?? new BrowserSessionManager({ workspaceRoot });
    const start = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.start,
        { url: baseUrl, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    const sessionId = String(start.sessionId);

    const external = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.navigate,
        { sessionId, url: 'https://example.com/' },
        { manager: activeManager },
      ),
    );
    expect(external.status).toBe('approval_required');
    expect(external.policyDecision.matchedRule).toBe('external_domain_requires_approval');

    const redirect = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.navigate,
        { sessionId, url: `${baseUrl}/redirect-external`, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(redirect.status).toBe('approval_required');
    expect(redirect.policyDecision.matchedRule).toBe('external_domain_requires_approval');

    const local = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.navigate,
        { sessionId, url: baseUrl, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(local.status).toBe('succeeded');

    const sensitive = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.type,
        {
          sessionId,
          target: { label: 'Search' },
          text: 'secret',
          sensitive: true,
        },
        { manager: activeManager },
      ),
    );
    expect(sensitive.status).toBe('approval_required');
    expect(sensitive.policyDecision.matchedRule).toBe('risky_browser_action_requires_approval');

    const ambiguous = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.click,
        { sessionId, target: { text: 'Duplicate' }, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    expect(ambiguous.status).toBe('failed');
    expect(ambiguous.error?.code).toBe('BROWSER_TARGET_AMBIGUOUS');

    await executeBrowserTool(BROWSER_TOOL_IDS.close, { sessionId }, { manager: activeManager });
  }, 60_000);

  it('keeps artifact content bounded and sidecar metadata workspace-relative', async () => {
    const activeManager = manager ?? new BrowserSessionManager({ workspaceRoot });
    const start = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.start,
        { url: baseUrl, timeoutMs: 10_000 },
        { manager: activeManager },
      ),
    );
    const sessionId = String(start.sessionId);
    const snapshot = toolData(
      await executeBrowserTool(
        BROWSER_TOOL_IDS.snapshot,
        { sessionId, maxBytes: 80 },
        { manager: activeManager },
      ),
    );

    const dom = snapshot.evidence.find((artifact) => artifact.kind === 'dom_summary');
    expect(dom).toMatchObject({
      storage: 'workspace_file',
      truncated: true,
      maxBytes: 80,
    });
    const content = await readFile(String(dom?.uri), 'utf-8');
    expect(Buffer.byteLength(content, 'utf-8')).toBeLessThanOrEqual(80);
    const sidecar = JSON.parse(await readFile(`${String(dom?.uri)}.json`, 'utf-8')) as {
      metadata?: { workspaceRelativePath?: string; storedSizeBytes?: number };
    };
    expect(sidecar.metadata?.storedSizeBytes).toBeLessThanOrEqual(80);
    expect(sidecar.metadata?.workspaceRelativePath).toMatch(
      /^\.agent-platform\/browser\/browser-session-/,
    );

    await executeBrowserTool(BROWSER_TOOL_IDS.close, { sessionId }, { manager: activeManager });
  }, 60_000);
});
