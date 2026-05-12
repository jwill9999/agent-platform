import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getDesktopBackendPaths,
  resolveDesktopBackendNodePath,
  resolveDesktopBackendMode,
  startDesktopBackend,
  type DesktopBackendHandle,
} from './backendSupervisor.js';
import { assertTrustedIpcSender, validateIpcPayload, validateNoPayload } from './ipcValidation.js';
import {
  desktopResetConfirmationText,
  resetDesktopLocalData,
  validateDesktopLocalDataResetRequest,
} from './localDataReset.js';
import { selectDesktopProjectFolder } from './projectFolderPicker.js';
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
  createElectronSafeStorageProtector,
  ensureDesktopSecretsMasterKey,
} from './secretStorage.js';
import {
  ensureDesktopRuntimeDirectories,
  resolveDesktopRuntimePathsFromApp,
} from './runtimePaths.js';
import {
  resetLocalDataConfirmationIpcChannel,
  resetLocalDataIpcChannel,
  selectProjectFolderIpcChannel,
} from '../preload/desktopBridge.js';
import {
  applyRendererSecurity,
  buildBootstrapHtml,
  createWindowOptions,
  getPreloadPath,
} from './windowConfig.js';

const smokeMode = process.argv.includes('--smoke');
let mainWindow: BrowserWindow | undefined;
let desktopBackend: DesktopBackendHandle | undefined;
let standaloneRenderer: StandaloneRendererHandle | undefined;

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainDir = dirname(fileURLToPath(import.meta.url));
  const window = new BrowserWindow(
    createWindowOptions(getPreloadPath(mainDir), {
      devTools: process.env.AGENT_PLATFORM_DESKTOP_DEVTOOLS === '1',
    }),
  );
  const rendererMode = resolveDesktopRendererMode(process.env);
  const rendererUrl = await resolveRendererUrl(mainDir, rendererMode);

  mainWindow = window;
  applyRendererSecurity(window, rendererUrl);
  await window.loadURL(rendererUrl);

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
  const runtimePaths = resolveDesktopRuntimePathsFromApp(app, process.env);

  if (resolveDesktopBackendMode(process.env) === 'managed') {
    ensureDesktopRuntimeDirectories(runtimePaths);
    const secrets = await ensureDesktopSecretsMasterKey({
      env: process.env,
      filePath: runtimePaths.secretsMasterKeyPath,
      protector: createElectronSafeStorageProtector(safeStorage),
    });
    desktopBackend = await startDesktopBackend({
      nodePath: resolveDesktopBackendNodePath(process.env, process.execPath),
      paths: getDesktopBackendPaths(repoRoot, runtimePaths),
      secretsMasterKeyB64: secrets.masterKeyB64,
    });
    process.env.API_PROXY_URL = desktopBackend.url;
  }

  const window = await createMainWindow();
  registerDesktopMaintenanceIpc(window, runtimePaths);
  registerDesktopProjectIpc(window);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const activatedWindow = await createMainWindow();
      registerDesktopMaintenanceIpc(activatedWindow, runtimePaths);
      registerDesktopProjectIpc(activatedWindow);
      return;
    }

    focusMainWindow();
  });
}

function registerDesktopProjectIpc(window: BrowserWindow): void {
  ipcMain.removeHandler(selectProjectFolderIpcChannel);
  ipcMain.handle(selectProjectFolderIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    validateIpcPayload(payload, validateNoPayload);

    return selectDesktopProjectFolder({ dialog, window });
  });
}

function registerDesktopMaintenanceIpc(
  window: BrowserWindow,
  runtimePaths: ReturnType<typeof resolveDesktopRuntimePathsFromApp>,
): void {
  ipcMain.removeHandler(resetLocalDataConfirmationIpcChannel);
  ipcMain.handle(resetLocalDataConfirmationIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    validateIpcPayload(payload, validateNoPayload);
    return desktopResetConfirmationText;
  });

  ipcMain.removeHandler(resetLocalDataIpcChannel);
  ipcMain.handle(resetLocalDataIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopLocalDataResetRequest);

    await desktopBackend?.stop();
    desktopBackend = undefined;

    return resetDesktopLocalData({
      confirmation: request.confirmation,
      paths: runtimePaths,
    });
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
