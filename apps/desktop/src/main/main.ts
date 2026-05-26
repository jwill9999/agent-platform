import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, WebContentsView } from 'electron';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node-pty';

import {
  getDesktopBackendPaths,
  repairPackagedMacosVmRuntime,
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
import {
  createDesktopProjectFolder,
  selectDesktopProjectFolder,
  validateDesktopCreateProjectFolderRequest,
} from './projectFolderPicker.js';
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
  repairMacosVmRuntimeIpcChannel,
  createProjectFolderIpcChannel,
  createTerminalIpcChannel,
  closeWorkspaceWebViewIpcChannel,
  disposeTerminalIpcChannel,
  focusWorkspaceWebViewIpcChannel,
  goBackWorkspaceWebViewIpcChannel,
  goForwardWorkspaceWebViewIpcChannel,
  inputTerminalIpcChannel,
  listWorkspaceWebViewsIpcChannel,
  openWorkspaceExternalFallbackIpcChannel,
  openWorkspaceResourceIpcChannel,
  openWorkspaceWebViewIpcChannel,
  reloadWorkspaceWebViewIpcChannel,
  resizeTerminalIpcChannel,
  selectProjectFolderIpcChannel,
  setWorkspaceWebViewBoundsIpcChannel,
  terminalDataIpcChannel,
  terminalExitIpcChannel,
  workspaceWebViewUpdatedIpcChannel,
} from '../preload/desktopBridge.js';
import {
  DesktopTerminalService,
  fetchDesktopProjectRootFromApi,
  resolveDesktopTerminalShell,
  validateDesktopTerminalCreateRequest,
  validateDesktopTerminalDisposeRequest,
  validateDesktopTerminalInputRequest,
  validateDesktopTerminalResizeRequest,
  type DesktopPtySpawnOptions,
} from './terminalService.js';
import {
  validateDesktopWorkspaceOpenExternalFallbackRequest,
  validateDesktopWorkspaceOpenResourceRequest,
  validateDesktopWorkspaceOpenWebViewRequest,
  validateDesktopWorkspaceWebViewBoundsRequest,
  validateDesktopWorkspaceWebViewIdRequest,
  workspaceOpenFallbackResult,
} from './workspaceResourceBridge.js';
import { createElectronWebViewFactory, DesktopWebViewService } from './webviewService.js';
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
let desktopTerminalService: DesktopTerminalService | undefined;
let desktopWebViewService: DesktopWebViewService | undefined;

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
  registerDesktopTerminalIpc(window);
  registerDesktopWorkspaceIpc(window);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const activatedWindow = await createMainWindow();
      registerDesktopMaintenanceIpc(activatedWindow, runtimePaths);
      registerDesktopProjectIpc(activatedWindow);
      registerDesktopTerminalIpc(activatedWindow);
      registerDesktopWorkspaceIpc(activatedWindow);
      return;
    }

    focusMainWindow();
  });
}

function registerDesktopTerminalIpc(window: BrowserWindow): void {
  desktopTerminalService?.disposeAll();
  desktopTerminalService = new DesktopTerminalService({
    fetchProjectRoot: (projectId) =>
      fetchDesktopProjectRootFromApi(resolveDesktopTerminalApiBaseUrl(), projectId),
    onData: (payload) => {
      if (!window.isDestroyed()) {
        window.webContents.send(terminalDataIpcChannel, payload);
      }
    },
    onExit: (payload) => {
      if (!window.isDestroyed()) {
        window.webContents.send(terminalExitIpcChannel, payload);
      }
    },
    shellResolver: resolveDesktopTerminalShell,
    spawnPty: spawnDesktopPty,
  });

  window.once('closed', () => {
    desktopTerminalService?.disposeAll();
    desktopTerminalService = undefined;
  });

  ipcMain.removeHandler(createTerminalIpcChannel);
  ipcMain.handle(createTerminalIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopTerminalCreateRequest);
    return desktopTerminalService?.create(request);
  });

  ipcMain.removeHandler(inputTerminalIpcChannel);
  ipcMain.handle(inputTerminalIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopTerminalInputRequest);
    desktopTerminalService?.write(request);
  });

  ipcMain.removeHandler(resizeTerminalIpcChannel);
  ipcMain.handle(resizeTerminalIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopTerminalResizeRequest);
    desktopTerminalService?.resize(request);
  });

  ipcMain.removeHandler(disposeTerminalIpcChannel);
  ipcMain.handle(disposeTerminalIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopTerminalDisposeRequest);
    desktopTerminalService?.dispose(request);
  });
}

function resolveDesktopTerminalApiBaseUrl(): string {
  return desktopBackend?.url ?? process.env.API_PROXY_URL ?? 'http://127.0.0.1:3000';
}

function spawnDesktopPty(options: DesktopPtySpawnOptions) {
  return spawn(options.shell, [...options.args], {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });
}

function registerDesktopProjectIpc(window: BrowserWindow): void {
  ipcMain.removeHandler(createProjectFolderIpcChannel);
  ipcMain.handle(createProjectFolderIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopCreateProjectFolderRequest);

    return createDesktopProjectFolder({ dialog, request, window });
  });

  ipcMain.removeHandler(selectProjectFolderIpcChannel);
  ipcMain.handle(selectProjectFolderIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    validateIpcPayload(payload, validateNoPayload);

    return selectDesktopProjectFolder({ dialog, window });
  });
}

function registerDesktopWorkspaceIpc(window: BrowserWindow): void {
  desktopWebViewService?.disposeAll();
  desktopWebViewService = new DesktopWebViewService({
    factory: createElectronWebViewFactory(window, WebContentsView),
    onUpdate: (state) => {
      if (!window.isDestroyed()) {
        window.webContents.send(workspaceWebViewUpdatedIpcChannel, state);
      }
    },
  });

  window.once('closed', () => {
    desktopWebViewService?.disposeAll();
    desktopWebViewService = undefined;
  });

  ipcMain.removeHandler(openWorkspaceResourceIpcChannel);
  ipcMain.handle(openWorkspaceResourceIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceOpenResourceRequest);
    return (
      desktopWebViewService?.openResource(request.uri, request.projectId) ??
      workspaceOpenFallbackResult('Workspace WebView service is unavailable.')
    );
  });

  ipcMain.removeHandler(openWorkspaceExternalFallbackIpcChannel);
  ipcMain.handle(openWorkspaceExternalFallbackIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(
      payload,
      validateDesktopWorkspaceOpenExternalFallbackRequest,
    );
    await shell.openExternal(request.url);
    return {
      ok: true,
      handled: true,
      externalFallbackUrl: request.url,
    };
  });

  ipcMain.removeHandler(openWorkspaceWebViewIpcChannel);
  ipcMain.handle(openWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceOpenWebViewRequest);
    return (
      desktopWebViewService?.openWebView(request) ??
      workspaceOpenFallbackResult('Workspace WebView service is unavailable.')
    );
  });

  ipcMain.removeHandler(closeWorkspaceWebViewIpcChannel);
  ipcMain.handle(closeWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewIdRequest);
    return desktopWebViewService?.close(request.webviewId) ?? null;
  });

  ipcMain.removeHandler(focusWorkspaceWebViewIpcChannel);
  ipcMain.handle(focusWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewIdRequest);
    return desktopWebViewService?.focus(request.webviewId) ?? null;
  });

  ipcMain.removeHandler(listWorkspaceWebViewsIpcChannel);
  ipcMain.handle(listWorkspaceWebViewsIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    validateIpcPayload(payload, validateNoPayload);
    return desktopWebViewService?.list() ?? [];
  });

  ipcMain.removeHandler(setWorkspaceWebViewBoundsIpcChannel);
  ipcMain.handle(setWorkspaceWebViewBoundsIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewBoundsRequest);
    return desktopWebViewService?.setBounds(request) ?? null;
  });

  ipcMain.removeHandler(goBackWorkspaceWebViewIpcChannel);
  ipcMain.handle(goBackWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewIdRequest);
    return desktopWebViewService?.goBack(request.webviewId) ?? null;
  });

  ipcMain.removeHandler(goForwardWorkspaceWebViewIpcChannel);
  ipcMain.handle(goForwardWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewIdRequest);
    return desktopWebViewService?.goForward(request.webviewId) ?? null;
  });

  ipcMain.removeHandler(reloadWorkspaceWebViewIpcChannel);
  ipcMain.handle(reloadWorkspaceWebViewIpcChannel, (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceWebViewIdRequest);
    return desktopWebViewService?.reload(request.webviewId) ?? null;
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

  ipcMain.removeHandler(repairMacosVmRuntimeIpcChannel);
  ipcMain.handle(repairMacosVmRuntimeIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    validateIpcPayload(payload, validateNoPayload);

    await desktopBackend?.stop();
    desktopBackend = undefined;

    return repairPackagedMacosVmRuntime({
      paths: getDesktopBackendPaths(
        getRepoRootFromMainDir(dirname(fileURLToPath(import.meta.url))),
        runtimePaths,
      ),
      env: process.env,
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  desktopWebViewService?.disposeAll();
  desktopWebViewService = undefined;

  desktopTerminalService?.disposeAll();
  desktopTerminalService = undefined;

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
