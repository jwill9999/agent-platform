import { describe, expect, it } from 'vitest';

import {
  applyRendererSecurity,
  buildBootstrapHtml,
  createWindowOptions,
  getPreloadPath,
  isAllowedRendererNavigation,
} from '../src/main/windowConfig.js';

describe('desktop window configuration', () => {
  it('uses a constrained renderer security boundary', () => {
    const options = createWindowOptions('/app/dist/preload/preload.js');

    expect(options.webPreferences).toMatchObject({
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: false,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      preload: '/app/dist/preload/preload.js',
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    });
  });

  it('only enables devtools when explicitly requested', () => {
    const options = createWindowOptions('/app/dist/preload/preload.js', { devTools: true });

    expect(options.webPreferences?.devTools).toBe(true);
  });

  it('resolves the compiled preload script beside the main bundle', () => {
    expect(getPreloadPath('/app/dist/main')).toBe('/app/dist/preload/preload.js');
  });

  it('allows renderer navigation within the active renderer origin', () => {
    expect(
      isAllowedRendererNavigation(
        'http://127.0.0.1:3456/projects?active=1',
        'http://127.0.0.1:3456/',
      ),
    ).toBe(true);
  });

  it('blocks renderer navigation to unexpected origins', () => {
    expect(isAllowedRendererNavigation('https://example.com', 'http://127.0.0.1:3456/')).toBe(
      false,
    );
  });

  it('only allows the exact bootstrap data URL for bootstrap navigation', () => {
    const bootstrapUrl = 'data:text/html;charset=utf-8,%3Ch1%3EAgent%20Platform%3C%2Fh1%3E';

    expect(isAllowedRendererNavigation(bootstrapUrl, bootstrapUrl)).toBe(true);
    expect(
      isAllowedRendererNavigation(
        'data:text/html;charset=utf-8,%3Ch1%3EUnexpected%3C%2Fh1%3E',
        bootstrapUrl,
      ),
    ).toBe(false);
  });

  it('registers popup, navigation, and webview guards', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    let windowOpenHandler: (() => { action: 'deny' }) | undefined;
    const fakeWindow = {
      webContents: {
        on: (eventName: string, handler: (...args: unknown[]) => void) => {
          handlers.set(eventName, handler);
        },
        setWindowOpenHandler: (handler: () => { action: 'deny' }) => {
          windowOpenHandler = handler;
        },
      },
    };

    applyRendererSecurity(
      fakeWindow as Parameters<typeof applyRendererSecurity>[0],
      'http://127.0.0.1:3456/',
    );

    expect(windowOpenHandler?.()).toEqual({ action: 'deny' });
    expect(handlers.has('will-navigate')).toBe(true);
    expect(handlers.has('will-attach-webview')).toBe(true);
  });

  it('renders a minimal bootstrap shell until the web renderer is wired', () => {
    const html = buildBootstrapHtml();

    expect(html).toContain('<title>Agent Platform</title>');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('Desktop shell is ready');
  });
});
