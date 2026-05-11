import { contextBridge } from 'electron';

const desktopApi = {
  versions: {
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    node: () => process.versions.node,
  },
} as const;

contextBridge.exposeInMainWorld('agentPlatformDesktop', desktopApi);

export type AgentPlatformDesktopApi = typeof desktopApi;
