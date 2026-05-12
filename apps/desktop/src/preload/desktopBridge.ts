export interface DesktopVersionsApi {
  readonly chrome: () => string;
  readonly electron: () => string;
  readonly node: () => string;
}

export interface DesktopResetLocalDataRequest {
  readonly confirmation: string;
}

export interface DesktopResetLocalDataResult {
  readonly ok: true;
  readonly deletedPaths: readonly string[];
  readonly missingPaths: readonly string[];
  readonly preservedProjectFolders: true;
}

export interface DesktopSelectedProjectFolder {
  readonly path: string;
  readonly name: string;
}

export type DesktopProjectFolderSelectionResult =
  | { readonly canceled: true }
  | { readonly canceled: false; readonly folder: DesktopSelectedProjectFolder };

export interface DesktopMaintenanceApi {
  readonly getResetLocalDataConfirmation: () => Promise<string>;
  readonly resetLocalData: (
    request: DesktopResetLocalDataRequest,
  ) => Promise<DesktopResetLocalDataResult>;
}

export interface DesktopProjectsApi {
  readonly selectFolder: () => Promise<DesktopProjectFolderSelectionResult>;
}

export interface AgentPlatformDesktopApi {
  readonly maintenance: DesktopMaintenanceApi;
  readonly projects: DesktopProjectsApi;
  readonly versions: DesktopVersionsApi;
}

export const desktopBridgeApiName = 'agentPlatformDesktop';
export const resetLocalDataIpcChannel = 'agent-platform:reset-local-data';
export const resetLocalDataConfirmationIpcChannel =
  'agent-platform:get-reset-local-data-confirmation';
export const selectProjectFolderIpcChannel = 'agent-platform:select-project-folder';

export const desktopBridgeApiKeys = [
  'maintenance',
  'projects',
  'versions',
] as const satisfies readonly (keyof AgentPlatformDesktopApi)[];

export const desktopMaintenanceApiKeys = [
  'getResetLocalDataConfirmation',
  'resetLocalData',
] as const satisfies readonly (keyof DesktopMaintenanceApi)[];

export const desktopProjectsApiKeys = [
  'selectFolder',
] as const satisfies readonly (keyof DesktopProjectsApi)[];

export const desktopVersionsApiKeys = [
  'chrome',
  'electron',
  'node',
] as const satisfies readonly (keyof DesktopVersionsApi)[];
