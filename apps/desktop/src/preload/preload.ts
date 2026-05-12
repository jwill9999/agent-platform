import { contextBridge, ipcRenderer } from 'electron';

import {
  desktopBridgeApiName,
  resetLocalDataConfirmationIpcChannel,
  resetLocalDataIpcChannel,
  selectProjectFolderIpcChannel,
  type AgentPlatformDesktopApi,
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
    selectFolder: () =>
      ipcRenderer.invoke(selectProjectFolderIpcChannel) as ReturnType<
        AgentPlatformDesktopApi['projects']['selectFolder']
      >,
  },
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
} as const satisfies AgentPlatformDesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeApiName, desktopApi);
