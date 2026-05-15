import { contextBridge, ipcRenderer } from 'electron';

import {
  desktopBridgeApiName,
  createProjectFolderIpcChannel,
  createTerminalIpcChannel,
  disposeTerminalIpcChannel,
  inputTerminalIpcChannel,
  resetLocalDataConfirmationIpcChannel,
  resetLocalDataIpcChannel,
  resizeTerminalIpcChannel,
  selectProjectFolderIpcChannel,
  terminalDataIpcChannel,
  terminalExitIpcChannel,
  type AgentPlatformDesktopApi,
  type DesktopTerminalDataEvent,
  type DesktopTerminalExitEvent,
} from './desktopBridge.js';

const desktopApi = {
  maintenance: {
    getResetLocalDataConfirmation: () =>
      ipcRenderer.invoke(resetLocalDataConfirmationIpcChannel) as Promise<string>,
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
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
} as const satisfies AgentPlatformDesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeApiName, desktopApi);
