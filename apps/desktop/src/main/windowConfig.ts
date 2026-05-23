import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { join } from 'node:path';

export function getPreloadPath(mainDir: string): string {
  return join(mainDir, '../preload/preload.js');
}

export interface WindowOptionsConfig {
  readonly devTools?: boolean;
}

export function createWindowOptions(
  preloadPath: string,
  config: WindowOptionsConfig = {},
): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Agent Platform',
    backgroundColor: '#050505',
    webPreferences: {
      preload: preloadPath,
      devTools: config.devTools === true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
  };
}

export function isAllowedRendererNavigation(candidateUrl: string, rendererUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const renderer = new URL(rendererUrl);

    if (renderer.protocol === 'data:') {
      return candidate.href === renderer.href;
    }

    if (renderer.protocol === 'file:') {
      return candidate.protocol === 'file:';
    }

    return candidate.origin === renderer.origin;
  } catch {
    return false;
  }
}

export function applyRendererSecurity(window: BrowserWindow, rendererUrl: string): void {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedRendererNavigation(navigationUrl, rendererUrl)) {
      event.preventDefault();
    }
  });

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

export function buildBootstrapHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; script-src 'none'; style-src 'unsafe-inline'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Platform</title>
    <style>
      :root {
        color-scheme: dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #050505;
        color: #f5f5f5;
      }

      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        place-items: center;
      }

      main {
        max-width: 440px;
        padding: 24px;
        text-align: center;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 24px;
        font-weight: 650;
      }

      p {
        margin: 0;
        color: #a3a3a3;
        font-size: 14px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Agent Platform</h1>
      <p>Desktop shell is ready. The web renderer and backend supervisor are wired in later tasks.</p>
    </main>
  </body>
</html>`;
}
