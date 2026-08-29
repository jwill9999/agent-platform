import { contextBridge, ipcRenderer } from 'electron';

import {
  desktopBridgeApiName,
  createProjectFolderIpcChannel,
  createTerminalIpcChannel,
  disposeTerminalIpcChannel,
  closeWorkspaceWebViewIpcChannel,
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
  repairMacosVmRuntimeIpcChannel,
  resetLocalDataConfirmationIpcChannel,
  resetLocalDataIpcChannel,
  resizeTerminalIpcChannel,
  saveWorkspaceResourceIpcChannel,
  selectProjectFolderIpcChannel,
  setWorkspaceWebViewBoundsIpcChannel,
  terminalDataIpcChannel,
  terminalExitIpcChannel,
  workspaceWebViewUpdatedIpcChannel,
  type AgentPlatformDesktopApi,
  type DesktopTerminalDataEvent,
  type DesktopTerminalExitEvent,
  type DesktopWorkspaceWebViewState,
} from './desktopBridge.js';

const desktopApi = {
  maintenance: {
    getResetLocalDataConfirmation: () =>
      ipcRenderer.invoke(resetLocalDataConfirmationIpcChannel) as Promise<string>,
    repairMacosVmRuntime: () =>
      ipcRenderer.invoke(repairMacosVmRuntimeIpcChannel) as ReturnType<
        AgentPlatformDesktopApi['maintenance']['repairMacosVmRuntime']
      >,
    resetLocalData: (request) =>
      ipcRenderer.invoke(resetLocalDataIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['maintenance']['resetLocalData']
      >,
  },
  projects: {
    createFolder: (request) =>
      ipcRenderer.invoke(createProjectFolderIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['projects']['createFolder']
      >,
    openInIde: (request) =>
      ipcRenderer.invoke(openProjectIdeIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['projects']['openInIde']
      >,
    selectFolder: () =>
      ipcRenderer.invoke(selectProjectFolderIpcChannel) as ReturnType<
        AgentPlatformDesktopApi['projects']['selectFolder']
      >,
  },
  terminal: {
    create: (request) =>
      ipcRenderer.invoke(createTerminalIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['terminal']['create']
      >,
    input: (request) =>
      ipcRenderer.invoke(inputTerminalIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['terminal']['input']
      >,
    resize: (request) =>
      ipcRenderer.invoke(resizeTerminalIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['terminal']['resize']
      >,
    dispose: (request) =>
      ipcRenderer.invoke(disposeTerminalIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['terminal']['dispose']
      >,
    onData: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: DesktopTerminalDataEvent) => {
        callback(payload);
      };
      ipcRenderer.on(terminalDataIpcChannel, listener);
      return () => {
        ipcRenderer.removeListener(terminalDataIpcChannel, listener);
      };
    },
    onExit: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: DesktopTerminalExitEvent) => {
        callback(payload);
      };
      ipcRenderer.on(terminalExitIpcChannel, listener);
      return () => {
        ipcRenderer.removeListener(terminalExitIpcChannel, listener);
      };
    },
  },
  workspace: {
    saveResourceAs: (request) =>
      ipcRenderer.invoke(saveWorkspaceResourceIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['saveResourceAs']
      >,
    openResource: (request) =>
      ipcRenderer.invoke(openWorkspaceResourceIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['openResource']
      >,
    openExternalFallback: (request) =>
      ipcRenderer.invoke(openWorkspaceExternalFallbackIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['openExternalFallback']
      >,
    openWebView: (request) =>
      ipcRenderer.invoke(openWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['openWebView']
      >,
    closeWebView: (request) =>
      ipcRenderer.invoke(closeWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['closeWebView']
      >,
    focusWebView: (request) =>
      ipcRenderer.invoke(focusWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['focusWebView']
      >,
    listWebViews: () =>
      ipcRenderer.invoke(listWorkspaceWebViewsIpcChannel) as ReturnType<
        AgentPlatformDesktopApi['workspace']['listWebViews']
      >,
    setWebViewBounds: (request) =>
      ipcRenderer.invoke(setWorkspaceWebViewBoundsIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['setWebViewBounds']
      >,
    goBackWebView: (request) =>
      ipcRenderer.invoke(goBackWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['goBackWebView']
      >,
    goForwardWebView: (request) =>
      ipcRenderer.invoke(goForwardWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['goForwardWebView']
      >,
    reloadWebView: (request) =>
      ipcRenderer.invoke(reloadWorkspaceWebViewIpcChannel, request) as ReturnType<
        AgentPlatformDesktopApi['workspace']['reloadWebView']
      >,
    onWebViewUpdated: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: DesktopWorkspaceWebViewState,
      ) => {
        callback(payload);
      };
      ipcRenderer.on(workspaceWebViewUpdatedIpcChannel, listener);
      return () => {
        ipcRenderer.removeListener(workspaceWebViewUpdatedIpcChannel, listener);
      };
    },
  },
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
} as const satisfies AgentPlatformDesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeApiName, desktopApi);
