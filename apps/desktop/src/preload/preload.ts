import { contextBridge } from 'electron';

import { desktopBridgeApiName, type AgentPlatformDesktopApi } from './desktopBridge.js';

const desktopApi = {
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
} as const satisfies AgentPlatformDesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeApiName, desktopApi);
