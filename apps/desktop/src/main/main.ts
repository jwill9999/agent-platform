import { DesktopLifecycle } from './desktopLifecycle.js';
import { diagnosticChildEnvironment, takeDiagnosticCapability } from './diagnosticEnvironment.js';
import { randomBytes } from 'node:crypto';
import {
  saveDiagnosticReport,
  savePartialDiagnosticReport,
  validateDiagnosticScope,
  validateDiagnosticPartial,
} from './diagnosticExport.js';
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
import { openProjectRootInIde } from './ideLauncher.js';
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
  saveDiagnosticReportIpcChannel,
  savePartialDiagnosticReportIpcChannel,
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
  openProjectIdeIpcChannel,
  openWorkspaceExternalFallbackIpcChannel,
  openWorkspaceResourceIpcChannel,
  openWorkspaceWebViewIpcChannel,
  reloadWorkspaceWebViewIpcChannel,
  resizeTerminalIpcChannel,
  saveWorkspaceResourceIpcChannel,
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
  validateDesktopWorkspaceExportRequest,
  validateDesktopWorkspaceOpenResourceRequest,
  validateDesktopWorkspaceOpenWebViewRequest,
  validateDesktopWorkspaceWebViewBoundsRequest,
  validateDesktopWorkspaceWebViewIdRequest,
  workspaceOpenFallbackResult,
} from './workspaceResourceBridge.js';
import { saveWorkspaceResourceAs } from './workspaceResourceExport.js';
import { createElectronWebViewFactory, DesktopWebViewService } from './webviewService.js';
import {
  applyRendererSecurity,
  buildBootstrapHtml,
  createWindowOptions,
  getPreloadPath,
} from './windowConfig.js';

const lifecycle = new DesktopLifecycle();
const startupStartedAt = performance.now();
type StartupPhase =
  | 'startup-begin'
  | 'assets-before'
  | 'assets-after'
  | 'backend-spawn'
  | 'backend-ready'
  | 'renderer-start'
  | 'renderer-ready'
  | 'window-ready'
  | 'cancel'
  | 'stop-confirmed'
  | 'stop-failed';
function reportStartupPhase(phase: StartupPhase): void {
  console.error(
    `AGENT_PLATFORM_STARTUP ${JSON.stringify({ phase, elapsedMs: Math.round(performance.now() - startupStartedAt) })}`,
  );
}
let shutdownComplete = false;
let shutdownStarted = false;
let diagnosticCapability = takeDiagnosticCapability(process.env);
const smokeMode = process.argv.includes('--smoke');
let mainWindow: BrowserWindow | undefined;
let desktopBackend: DesktopBackendHandle | undefined;
let standaloneRenderer: StandaloneRendererHandle | undefined;
let desktopTerminalService: DesktopTerminalService | undefined;
let desktopWebViewService: DesktopWebViewService | undefined;

export function createMainWindow(): Promise<BrowserWindow> {
  return lifecycle.run(async () => {
    const mainDir = dirname(fileURLToPath(import.meta.url));
    const rendererMode = resolveDesktopRendererMode(process.env);
    const rendererUrl = await resolveRendererUrl(mainDir, rendererMode);
    lifecycle.check();
    const window = new BrowserWindow(
      createWindowOptions(getPreloadPath(mainDir), {
        devTools: process.env.AGENT_PLATFORM_DESKTOP_DEVTOOLS === '1',
      }),
    );
    mainWindow = window;
    applyRendererSecurity(window, rendererUrl);
    const cancelWindow = (): void => {
      if (!window.isDestroyed()) window.destroy();
    };
    lifecycle.signal.addEventListener('abort', cancelWindow, { once: true });
    try {
      await window.loadURL(rendererUrl);
    } catch (error) {
      lifecycle.check();
      throw error;
    } finally {
      lifecycle.signal.removeEventListener('abort', cancelWindow);
    }
    lifecycle.check();
    reportStartupPhase('window-ready');

    if (process.env.AGENT_PLATFORM_DESKTOP_DEVTOOLS === '1') {
      window.webContents.openDevTools({ mode: 'detach' });
    }
    if (smokeMode) {
      window.close();
      app.quit();
    }
    return window;
  });
}

async function resolveRendererUrl(
  mainDir: string,
  rendererMode: DesktopRendererMode,
): Promise<string> {
  if (rendererMode === 'dev-server') {
    return resolveDesktopDevServerUrl(process.env);
  }

  lifecycle.check();
  if (rendererMode === 'standalone') {
    if (standaloneRenderer) return standaloneRenderer.url;
    reportStartupPhase('renderer-start');
    const repoRoot = getRepoRootFromMainDir(mainDir);
    standaloneRenderer = await lifecycle.own(
      startStandaloneRenderer({
        electronPath: process.execPath,
        paths: getStandaloneRendererPaths(repoRoot),
        env: diagnosticChildEnvironment(process.env, diagnosticCapability),
        signal: lifecycle.signal,
      }),
    );
    lifecycle.check();
    reportStartupPhase('renderer-ready');

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
  lifecycle.check();
  reportStartupPhase('startup-begin');
  const mainDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = getRepoRootFromMainDir(mainDir);
  const runtimePaths = resolveDesktopRuntimePathsFromApp(app, process.env);

  if (resolveDesktopBackendMode(process.env) === 'managed') {
    diagnosticCapability = randomBytes(32).toString('hex');
    ensureDesktopRuntimeDirectories(runtimePaths);
    const secrets = await ensureDesktopSecretsMasterKey({
      env: process.env,
      filePath: runtimePaths.secretsMasterKeyPath,
      protector: createElectronSafeStorageProtector(safeStorage),
    });
    lifecycle.check();
    desktopBackend = await lifecycle.own(
      startDesktopBackend({
        nodePath: resolveDesktopBackendNodePath(process.env, process.execPath),
        paths: getDesktopBackendPaths(repoRoot, runtimePaths),
        env: {
          ...diagnosticChildEnvironment(process.env, diagnosticCapability),
          DIAGNOSTICS_APP_VERSION: app.getVersion(),
        },
        secretsMasterKeyB64: secrets.masterKeyB64,
        signal: lifecycle.signal,
        onPhase: reportStartupPhase,
      }),
    );
    lifecycle.check();
    process.env.API_PROXY_URL = desktopBackend.url;
  }

  const window = await createMainWindow();
  lifecycle.check();
  registerDesktopMaintenanceIpc(window, runtimePaths);
  registerDesktopProjectIpc(window);
  registerDesktopTerminalIpc(window);
  registerDesktopWorkspaceIpc(window);

  app.on('activate', () => {
    if (lifecycle.signal.aborted) return;
    void activateWindow().catch(() => {
      if (!lifecycle.signal.aborted) app.quit();
    });
  });
  async function activateWindow(): Promise<void> {
    if (BrowserWindow.getAllWindows().length === 0) {
      const activatedWindow = await createMainWindow();
      lifecycle.check();
      registerDesktopMaintenanceIpc(activatedWindow, runtimePaths);
      registerDesktopProjectIpc(activatedWindow);
      registerDesktopTerminalIpc(activatedWindow);
      registerDesktopWorkspaceIpc(activatedWindow);
      return;
    }

    focusMainWindow();
  }
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
      ...diagnosticChildEnvironment(process.env),
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

  ipcMain.removeHandler(openProjectIdeIpcChannel);
  ipcMain.handle(openProjectIdeIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const object =
      typeof payload === 'object' && payload !== null
        ? (payload as { projectId?: unknown })
        : undefined;
    const projectId = typeof object?.projectId === 'string' ? object.projectId.trim() : '';
    if (!projectId) {
      return { ok: true, handled: false, reason: 'Project id is required.' };
    }

    const projectRoot = await fetchDesktopProjectRootFromApi(
      resolveDesktopTerminalApiBaseUrl(),
      projectId,
    );
    return openProjectRootInIde({
      env: process.env,
      platform: process.platform,
      projectRoot,
      shell,
    });
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

  ipcMain.removeHandler(saveDiagnosticReportIpcChannel);
  ipcMain.handle(saveDiagnosticReportIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    return saveDiagnosticReport(validateIpcPayload(payload, validateDiagnosticScope), {
      apiBaseUrl: resolveDesktopTerminalApiBaseUrl(),
      capability: diagnosticCapability,
      showSaveDialog: (options) => dialog.showSaveDialog(window, options),
    });
  });
  ipcMain.removeHandler(savePartialDiagnosticReportIpcChannel);
  ipcMain.handle(savePartialDiagnosticReportIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    return savePartialDiagnosticReport(validateIpcPayload(payload, validateDiagnosticPartial), {
      apiBaseUrl: resolveDesktopTerminalApiBaseUrl(),
      showSaveDialog: (options) => dialog.showSaveDialog(window, options),
    });
  });

  ipcMain.removeHandler(saveWorkspaceResourceIpcChannel);
  ipcMain.handle(saveWorkspaceResourceIpcChannel, async (event, payload) => {
    assertTrustedIpcSender(event, window.webContents);
    const request = validateIpcPayload(payload, validateDesktopWorkspaceExportRequest);
    return saveWorkspaceResourceAs(request, {
      apiBaseUrl: resolveDesktopTerminalApiBaseUrl(),
      showSaveDialog: (options) => dialog.showSaveDialog(window, options),
    });
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

app.on('before-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  // stop() aborts synchronously, before any asynchronous cleanup can yield.
  const stopped = lifecycle.stop();
  reportStartupPhase('cancel');
  desktopWebViewService?.disposeAll();
  desktopWebViewService = undefined;
  desktopTerminalService?.disposeAll();
  desktopTerminalService = undefined;
  void stopped.then(
    () => {
      standaloneRenderer = undefined;
      desktopBackend = undefined;
      shutdownComplete = true;
      reportStartupPhase('stop-confirmed');
      app.quit();
    },
    () => {
      reportStartupPhase('stop-failed');
      console.error('Desktop child shutdown was not confirmed. Retain runtime diagnostics.');
    },
  );
});

app.on('ready', () => {
  if (lifecycle.signal.aborted) return;
  void lifecycle.run(bootstrap).catch(() => {
    if (!lifecycle.signal.aborted) {
      console.error('Failed to start Agent Platform desktop shell. Retain runtime diagnostics.');
      app.quit();
    }
  });
});
