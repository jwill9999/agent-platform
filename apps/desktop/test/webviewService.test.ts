import { describe, expect, it, vi } from 'vitest';

import {
  classifyDesktopWebViewUrl,
  createEmbeddedWebPreferences,
  decodeWorkspaceWebTarget,
  DesktopWebViewService,
  shouldAllowDesktopWebViewNavigation,
  type DesktopWebViewFactory,
  type DesktopWebViewView,
} from '../src/main/webviewService.js';

function createFakeView(): DesktopWebViewView & {
  readonly loadedUrls: string[];
  readonly visibleStates: boolean[];
  readonly bounds: Electron.Rectangle[];
} {
  const loadedUrls: string[] = [];
  const visibleStates: boolean[] = [];
  const bounds: Electron.Rectangle[] = [];
  return {
    loadedUrls,
    visibleStates,
    bounds,
    webContents: {
      canGoBack: () => false,
      canGoForward: () => false,
      goBack: vi.fn(),
      goForward: vi.fn(),
      loadURL: (url: string) => {
        loadedUrls.push(url);
        return Promise.resolve();
      },
      on: vi.fn(),
      reload: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      stop: vi.fn(),
      getTitle: () => 'Loaded page',
      session: {
        on: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
      } as unknown as Electron.Session,
      close: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
    },
    setBounds: (next) => bounds.push(next),
    setVisible: (visible) => visibleStates.push(visible),
  };
}

function createFakeFactory() {
  const attached: DesktopWebViewView[] = [];
  const detached: DesktopWebViewView[] = [];
  const view = createFakeView();
  const factory: DesktopWebViewFactory = {
    create: () => view,
    attach: (next) => attached.push(next),
    detach: (next) => detached.push(next),
  };
  return { attached, detached, factory, view };
}

describe('desktop WebView service', () => {
  it('uses isolated persistent WebView preferences', () => {
    expect(createEmbeddedWebPreferences()).toMatchObject({
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:agent-platform-webview',
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    });
  });

  it('allows HTTPS and local preview URLs but falls back for non-local HTTP', () => {
    expect(classifyDesktopWebViewUrl('https://github.com/acme/app')).toMatchObject({
      allowed: true,
      tier: 'trusted',
    });
    expect(classifyDesktopWebViewUrl('https://example.com/docs')).toMatchObject({
      allowed: true,
      tier: 'external',
    });
    expect(classifyDesktopWebViewUrl('http://127.0.0.1:4310/')).toMatchObject({
      allowed: true,
      tier: 'local',
    });
    expect(classifyDesktopWebViewUrl('http://example.com/')).toMatchObject({
      allowed: false,
      externalFallbackUrl: 'http://example.com/',
    });
  });

  it('blocks unsafe schemes', () => {
    expect(classifyDesktopWebViewUrl('javascript:alert(1)')).toMatchObject({ allowed: false });
    expect(classifyDesktopWebViewUrl('file:///Users/test/secrets.txt')).toMatchObject({
      allowed: false,
    });
  });

  it('decodes preview and webview workspace resource targets', () => {
    expect(
      decodeWorkspaceWebTarget(
        'workspace://project/project-1/webview/https%3A%2F%2Fgithub.com%2Facme%2Fapp',
      ),
    ).toBe('https://github.com/acme/app');
    expect(
      decodeWorkspaceWebTarget('workspace://project/project-1/file/src%2Findex.ts'),
    ).toBeNull();
  });

  it('opens an allowed WebView and emits state', async () => {
    const updates: string[] = [];
    const { attached, factory, view } = createFakeFactory();
    const service = new DesktopWebViewService({
      factory,
      onUpdate: (state) => updates.push(state.status),
    });

    const result = await service.openWebView({
      url: 'https://github.com/acme/app',
      projectId: 'project-1',
    });

    expect(result.handled).toBe(true);
    expect(attached).toEqual([view]);
    expect(view.loadedUrls).toEqual(['https://github.com/acme/app']);
    expect(view.visibleStates).toContain(true);
    expect(updates).toContain('loading');
  });

  it('returns a browser fallback for non-local HTTP', async () => {
    const { factory, view } = createFakeFactory();
    const service = new DesktopWebViewService({ factory });

    const result = await service.openWebView({ url: 'http://example.com/' });

    expect(result).toMatchObject({
      handled: false,
      externalFallbackUrl: 'http://example.com/',
    });
    expect(view.loadedUrls).toEqual([]);
  });

  it('allows external HTTPS navigation between user-opened external origins', () => {
    expect(
      shouldAllowDesktopWebViewNavigation(
        { origin: 'https://example.com', policyTier: 'external' },
        'https://docs.example.net',
      ),
    ).toMatchObject({ allowed: true, tier: 'external' });
  });
});
