import { app, BrowserWindow } from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getDesktopBackendPaths,
  resolveDesktopBackendNodePath,
  resolveDesktopBackendMode,
  startDesktopBackend,
  type DesktopBackendHandle,
} from './backendSupervisor.js';
import {
  getRepoRootFromMainDir,
  getStandaloneRendererPaths,
  resolveDesktopDevServerUrl,
  resolveDesktopRendererMode,
  startStandaloneRenderer,
  type DesktopRendererMode,
  type StandaloneRendererHandle,
} from './rendererServer.js';
import {
  ensureDesktopRuntimeDirectories,
  resolveDesktopRuntimePathsFromApp,
} from './runtimePaths.js';
import { buildBootstrapHtml, createWindowOptions, getPreloadPath } from './windowConfig.js';

const smokeMode = process.argv.includes('--smoke');
let mainWindow: BrowserWindow | undefined;
let desktopBackend: DesktopBackendHandle | undefined;
let standaloneRenderer: StandaloneRendererHandle | undefined;

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainDir = dirname(fileURLToPath(import.meta.url));
  const window = new BrowserWindow(createWindowOptions(getPreloadPath(mainDir)));
  const rendererMode = resolveDesktopRendererMode(process.env);

  mainWindow = window;
  await window.loadURL(await resolveRendererUrl(mainDir, rendererMode));

  if (process.env.AGENT_PLATFORM_DESKTOP_DEVTOOLS === '1') {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  if (smokeMode) {
    window.close();
    app.quit();
  }

  return window;
}

async function resolveRendererUrl(
  mainDir: string,
  rendererMode: DesktopRendererMode,
): Promise<string> {
  if (rendererMode === 'dev-server') {
    return resolveDesktopDevServerUrl(process.env);
  }

  if (rendererMode === 'standalone') {
    const repoRoot = getRepoRootFromMainDir(mainDir);
    standaloneRenderer = await startStandaloneRenderer({
      electronPath: process.execPath,
      paths: getStandaloneRendererPaths(repoRoot),
    });

    return standaloneRenderer.url;
  }

  return `data:text/html;charset=utf-8,${encodeURIComponent(buildBootstrapHtml())}`;
}

function focusMainWindow(): void {
  if (mainWindow?.isDestroyed() === false) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

async function bootstrap(): Promise<void> {
  const mainDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = getRepoRootFromMainDir(mainDir);

  if (resolveDesktopBackendMode(process.env) === 'managed') {
    const runtimePaths = resolveDesktopRuntimePathsFromApp(app, process.env);
    ensureDesktopRuntimeDirectories(runtimePaths);
    desktopBackend = await startDesktopBackend({
      nodePath: resolveDesktopBackendNodePath(process.env, process.execPath),
      paths: getDesktopBackendPaths(repoRoot, runtimePaths),
    });
    process.env.API_PROXY_URL = desktopBackend.url;
  }

  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      return;
    }

    focusMainWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  standaloneRenderer?.stop().catch((error: unknown) => {
    console.error('Failed to stop Agent Platform standalone renderer.', error);
  });
  standaloneRenderer = undefined;

  desktopBackend?.stop().catch((error: unknown) => {
    console.error('Failed to stop Agent Platform desktop backend.', error);
  });
  desktopBackend = undefined;
});

app.on('ready', async () => {
  try {
    await bootstrap();
  } catch (error: unknown) {
    console.error('Failed to start Agent Platform desktop shell.', error);
    app.quit();
  }
});
