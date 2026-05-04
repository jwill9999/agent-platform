import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  BrowserSessionManager,
  BROWSER_TOOL_IDS,
  BROWSER_TOOLS,
  executeBrowserTool,
  type BrowserDriver,
  type BrowserLocatorDriver,
  type BrowserPageDriver,
} from '../src/tools/browserTools.js';

function makeLocator(overrides: Partial<BrowserLocatorDriver> = {}): BrowserLocatorDriver {
  return {
    count: vi.fn(async () => 1),
    click: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makePage(overrides: Partial<BrowserPageDriver> = {}): BrowserPageDriver {
  return {
    url: () => 'http://localhost:3001/',
    title: async () => 'Agent Platform',
    viewportSize: () => ({ width: 1280, height: 720 }),
    goto: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => Buffer.from('png bytes')),
    content: vi.fn(async () => '<html><body><h1>Agent Platform</h1></body></html>'),
    ariaSnapshot: vi.fn(async () => '- heading "Agent Platform"'),
    locator: vi.fn(() => makeLocator()),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makeDriver(page: BrowserPageDriver = makePage()): BrowserDriver {
  return {
    launch: vi.fn(async () => ({
      page,
      close: vi.fn(async () => undefined),
    })),
  };
}

async function withWorkspace<T>(fn: (workspaceRoot: string) => Promise<T>): Promise<T> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'browser-tools-test-'));
  try {
    return await fn(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function restoreTestEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe('browser tools', () => {
  it('registers browser tools with expected risk tiers', () => {
    expect(BROWSER_TOOLS.map((tool) => tool.id)).toEqual([
      BROWSER_TOOL_IDS.start,
      BROWSER_TOOL_IDS.navigate,
      BROWSER_TOOL_IDS.snapshot,
      BROWSER_TOOL_IDS.click,
      BROWSER_TOOL_IDS.type,
      BROWSER_TOOL_IDS.press,
      BROWSER_TOOL_IDS.screenshot,
      BROWSER_TOOL_IDS.close,
    ]);
    expect(BROWSER_TOOLS.find((tool) => tool.id === BROWSER_TOOL_IDS.start)?.riskTier).toBe(
      'medium',
    );
    expect(BROWSER_TOOLS.find((tool) => tool.id === BROWSER_TOOL_IDS.snapshot)?.riskTier).toBe(
      'low',
    );
    expect(BROWSER_TOOLS.find((tool) => tool.id === BROWSER_TOOL_IDS.click)?.riskTier).toBe('high');
  });

  it('starts and reuses an active browser session', async () => {
    const driver = makeDriver();
    const manager = new BrowserSessionManager({ driver, now: () => 1_000 });
    const first = await manager.start({ url: 'http://localhost:3001/' });
    const second = await manager.start({ sessionId: first.id });

    expect(second.id).toBe(first.id);
    expect(driver.launch).toHaveBeenCalledTimes(1);
    expect(first.page?.url).toBe('http://localhost:3001/');
  });

  it('uses a workspace-backed temp directory while launching a browser', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const previous = {
        AGENT_BROWSER_TMPDIR: process.env.AGENT_BROWSER_TMPDIR,
        TMPDIR: process.env.TMPDIR,
        TMP: process.env.TMP,
        TEMP: process.env.TEMP,
      };
      delete process.env.AGENT_BROWSER_TMPDIR;
      const expectedTempRoot = join(workspaceRoot, '.agent-platform/tmp/browser');
      const driver: BrowserDriver = {
        launch: vi.fn(async () => {
          expect(process.env.TMPDIR).toBe(expectedTempRoot);
          expect(process.env.TMP).toBe(expectedTempRoot);
          expect(process.env.TEMP).toBe(expectedTempRoot);
          return { page: makePage(), close: vi.fn(async () => undefined) };
        }),
      };

      try {
        const manager = new BrowserSessionManager({ driver, workspaceRoot });
        await manager.start({});

        expect((await stat(expectedTempRoot)).isDirectory()).toBe(true);
        expect(process.env.TMPDIR).toBe(previous.TMPDIR);
        expect(process.env.TMP).toBe(previous.TMP);
        expect(process.env.TEMP).toBe(previous.TEMP);
      } finally {
        restoreTestEnvValue('AGENT_BROWSER_TMPDIR', previous.AGENT_BROWSER_TMPDIR);
        restoreTestEnvValue('TMPDIR', previous.TMPDIR);
        restoreTestEnvValue('TMP', previous.TMP);
        restoreTestEnvValue('TEMP', previous.TEMP);
      }
    });
  });

  it('expires inactive sessions and closes their runtime context', async () => {
    const close = vi.fn(async () => undefined);
    const driver: BrowserDriver = {
      launch: vi.fn(async () => ({ page: makePage(), close })),
    };
    let now = 1_000;
    const manager = new BrowserSessionManager({
      driver,
      now: () => now,
      sessionTimeoutMs: 100,
    });
    const session = await manager.start({});

    now = 1_101;
    expect(await manager.getActiveSession(session.id)).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('denies external URLs under the default browser policy', async () => {
    const manager = new BrowserSessionManager({ driver: makeDriver() });
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.start,
      { url: 'https://example.com/' },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('approval_required');
      expect(result.data.policyDecision).toMatchObject({
        state: 'approval_required',
        matchedRule: 'external_domain_requires_approval',
      });
    }
  });

  it('opens external URLs after durable approval resumes the browser action', async () => {
    const page = makePage({ url: () => 'https://example.com/' });
    const manager = new BrowserSessionManager({ driver: makeDriver(page) });
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.start,
      { url: 'https://example.com/', approved: true },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('succeeded');
      expect(result.data.policyDecision).toMatchObject({
        state: 'allowed',
        matchedRule: 'browser_url_approved',
      });
    }
  });

  it('allows local navigation and captures bounded before and after evidence', async () => {
    await withWorkspace(async (workspaceRoot) => {
      let currentUrl = 'http://localhost:3001/';
      const page = makePage({
        url: () => currentUrl,
        goto: vi.fn(async (url: string) => {
          currentUrl = url;
        }),
      });
      const manager = new BrowserSessionManager({ driver: makeDriver(page), workspaceRoot });
      const start = await manager.start({ url: 'http://localhost:3001/' });
      const result = await executeBrowserTool(
        BROWSER_TOOL_IDS.navigate,
        { sessionId: start.id, url: 'http://localhost:3001/settings' },
        { manager },
      );

      expect(result?.type).toBe('tool_result');
      if (result?.type === 'tool_result') {
        expect(result.data.status).toBe('succeeded');
        expect(result.data.page).toMatchObject({ url: 'http://localhost:3001/settings' });
        expect(result.data.evidence).toHaveLength(4);
      }
    });
  });

  it('blocks navigation when a redirect lands on an external domain requiring approval', async () => {
    let currentUrl = 'http://localhost:3001/';
    const page = makePage({
      url: () => currentUrl,
      goto: vi.fn(async () => {
        currentUrl = 'https://example.com/redirected';
      }),
    });
    const manager = new BrowserSessionManager({ driver: makeDriver(page) });
    const start = await manager.start({ url: 'http://localhost:3001/' });
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.navigate,
      { sessionId: start.id, url: 'http://localhost:3001/redirect' },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('approval_required');
      expect(result.data.policyDecision).toMatchObject({
        matchedRule: 'external_domain_requires_approval',
      });
    }
  });

  it('captures bounded snapshot evidence into the workspace', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const page = makePage({
        content: vi.fn(async () => '<html><body>' + 'A'.repeat(200) + '</body></html>'),
      });
      const manager = new BrowserSessionManager({ driver: makeDriver(page), workspaceRoot });
      const start = await manager.start({ url: 'http://localhost:3001/' });
      const result = await executeBrowserTool(
        BROWSER_TOOL_IDS.snapshot,
        { sessionId: start.id, maxBytes: 64 },
        { manager },
      );

      expect(result?.type).toBe('tool_result');
      if (result?.type === 'tool_result') {
        expect(result.data.status).toBe('succeeded');
        expect(result.data.evidence).toHaveLength(2);
        const dom = result.data.evidence.find(
          (artifact: { kind: string }) => artifact.kind === 'dom_summary',
        );
        expect(dom).toMatchObject({
          storage: 'workspace_file',
          truncated: true,
          maxBytes: 64,
          redaction: { secretsRedacted: true, inputTextRedacted: true },
        });
        const content = await readFile(String(dom.uri), 'utf-8');
        expect(Buffer.byteLength(content, 'utf-8')).toBeLessThanOrEqual(64);
      }
    });
  });

  it('captures screenshot evidence into the workspace', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const manager = new BrowserSessionManager({ driver: makeDriver(), workspaceRoot });
      const start = await manager.start({ url: 'http://localhost:3001/' });
      const result = await executeBrowserTool(
        BROWSER_TOOL_IDS.screenshot,
        { sessionId: start.id, maxBytes: 1_000 },
        { manager },
      );

      expect(result?.type).toBe('tool_result');
      if (result?.type === 'tool_result') {
        const [artifact] = result.data.evidence;
        expect(artifact).toMatchObject({
          kind: 'screenshot',
          mimeType: 'image/png',
          storage: 'workspace_file',
          truncated: false,
        });
        await expect(stat(String(artifact.uri))).resolves.toMatchObject({ size: 9 });
        const metadata = JSON.parse(await readFile(`${String(artifact.uri)}.json`, 'utf-8')) as {
          metadata?: { workspaceRelativePath?: string };
        };
        expect(metadata.metadata?.workspaceRelativePath).toMatch(
          /^\.agent-platform\/browser\/browser-session-/,
        );
      }
    });
  });

  it('clicks a safe local target through a user-facing locator', async () => {
    await withWorkspace(async (workspaceRoot) => {
      const locator = makeLocator();
      const page = makePage({ locator: vi.fn(() => locator) });
      const manager = new BrowserSessionManager({ driver: makeDriver(page), workspaceRoot });
      const start = await manager.start({ url: 'http://localhost:3001/' });
      const result = await executeBrowserTool(
        BROWSER_TOOL_IDS.click,
        { sessionId: start.id, target: { role: 'button', label: 'Open settings' } },
        { manager },
      );

      expect(result?.type).toBe('tool_result');
      if (result?.type === 'tool_result') {
        expect(result.data.status).toBe('succeeded');
        expect(result.data.evidence).toHaveLength(4);
      }
      expect(page.locator).toHaveBeenCalledWith({
        role: 'button',
        label: 'Open settings',
      });
      expect(locator.click).toHaveBeenCalledTimes(1);
    });
  });

  it('fills and presses safe local targets', async () => {
    const locator = makeLocator();
    const page = makePage({ locator: vi.fn(() => locator) });
    const manager = new BrowserSessionManager({ driver: makeDriver(page) });
    const start = await manager.start({ url: 'http://localhost:3001/' });

    const fillResult = await executeBrowserTool(
      BROWSER_TOOL_IDS.type,
      {
        sessionId: start.id,
        target: { label: 'Search' },
        text: 'browser tools',
      },
      { manager },
    );
    const pressResult = await executeBrowserTool(
      BROWSER_TOOL_IDS.press,
      {
        sessionId: start.id,
        target: { label: 'Search' },
        key: 'Enter',
      },
      { manager },
    );

    expect(fillResult?.type).toBe('tool_result');
    expect(pressResult?.type).toBe('tool_result');
    if (fillResult?.type === 'tool_result') expect(fillResult.data.status).toBe('succeeded');
    if (pressResult?.type === 'tool_result') expect(pressResult.data.status).toBe('succeeded');
    expect(locator.fill).toHaveBeenCalledWith('browser tools', { timeout: 30_000 });
    expect(locator.press).toHaveBeenCalledWith('Enter', { timeout: 30_000 });
  });

  it('returns a structured failure for ambiguous selectors', async () => {
    const page = makePage({ locator: vi.fn(() => makeLocator({ count: vi.fn(async () => 2) })) });
    const manager = new BrowserSessionManager({ driver: makeDriver(page) });
    const start = await manager.start({ url: 'http://localhost:3001/' });
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.click,
      { sessionId: start.id, target: { text: 'Settings' } },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('failed');
      expect(result.data.error).toMatchObject({ code: 'BROWSER_TARGET_AMBIGUOUS' });
    }
  });

  it('requires approval for submit-like, destructive, and sensitive actions', async () => {
    const manager = new BrowserSessionManager({ driver: makeDriver() });
    const start = await manager.start({ url: 'http://localhost:3001/' });
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.type,
      {
        sessionId: start.id,
        target: { label: 'Password' },
        text: 'secret',
        sensitive: true,
      },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('approval_required');
      expect(result.data.policyDecision).toMatchObject({
        state: 'approval_required',
        riskTier: 'high',
      });
    }
  });

  it('returns an explicit runtime unavailable result when Playwright cannot launch', async () => {
    const manager = new BrowserSessionManager({
      driver: {
        launch: vi.fn(async () => {
          throw new Error('Executable does not exist at /ms-playwright/chromium');
        }),
      },
    });
    const result = await executeBrowserTool(BROWSER_TOOL_IDS.start, {}, { manager });

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('failed');
      expect(result.data.error).toMatchObject({
        code: 'BROWSER_RUNTIME_UNAVAILABLE',
      });
      expect(result.data.error.message).toContain('Playwright browser runtime is unavailable');
    }
  });

  it('closes a browser session through the close tool', async () => {
    const close = vi.fn(async () => undefined);
    const manager = new BrowserSessionManager({
      driver: {
        launch: vi.fn(async () => ({ page: makePage(), close })),
      },
    });
    const start = await manager.start({});
    const result = await executeBrowserTool(
      BROWSER_TOOL_IDS.close,
      { sessionId: start.id },
      { manager },
    );

    expect(result?.type).toBe('tool_result');
    if (result?.type === 'tool_result') {
      expect(result.data.status).toBe('succeeded');
    }
    expect(close).toHaveBeenCalledTimes(1);
  });
});
