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

export interface DesktopMaintenanceApi {
  readonly getResetLocalDataConfirmation: () => Promise<string>;
  readonly resetLocalData: (
    request: DesktopResetLocalDataRequest,
  ) => Promise<DesktopResetLocalDataResult>;
}

export interface AgentPlatformDesktopApi {
  readonly maintenance: DesktopMaintenanceApi;
  readonly versions: DesktopVersionsApi;
}

export const desktopBridgeApiName = 'agentPlatformDesktop';
export const resetLocalDataIpcChannel = 'agent-platform:reset-local-data';
export const resetLocalDataConfirmationIpcChannel =
  'agent-platform:get-reset-local-data-confirmation';

export const desktopBridgeApiKeys = [
  'maintenance',
  'versions',
] as const satisfies readonly (keyof AgentPlatformDesktopApi)[];

export const desktopMaintenanceApiKeys = [
  'getResetLocalDataConfirmation',
  'resetLocalData',
] as const satisfies readonly (keyof DesktopMaintenanceApi)[];

export const desktopVersionsApiKeys = [
  'chrome',
  'electron',
  'node',
] as const satisfies readonly (keyof DesktopVersionsApi)[];
