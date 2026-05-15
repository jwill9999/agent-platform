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

export interface DesktopCreateProjectFolderRequest {
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
  readonly createFolder: (
    request: DesktopCreateProjectFolderRequest,
  ) => Promise<DesktopProjectFolderSelectionResult>;
  readonly selectFolder: () => Promise<DesktopProjectFolderSelectionResult>;
}

export interface DesktopTerminalCreateRequest {
  readonly projectId?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopTerminalInputRequest {
  readonly terminalId: string;
  readonly data: string;
}

export interface DesktopTerminalResizeRequest {
  readonly terminalId: string;
  readonly cols: number;
  readonly rows: number;
}

export interface DesktopTerminalDisposeRequest {
  readonly terminalId: string;
}

export interface DesktopTerminalCreateResult {
  readonly terminalId: string;
  readonly cwd: string;
  readonly shell: string;
  readonly pid: number;
}

export interface DesktopTerminalDataEvent {
  readonly terminalId: string;
  readonly data: string;
}

export interface DesktopTerminalExitEvent {
  readonly terminalId: string;
  readonly exitCode: number;
  readonly signal?: number;
}

export type DesktopTerminalUnsubscribe = () => void;

export interface DesktopTerminalApi {
  readonly create: (request: DesktopTerminalCreateRequest) => Promise<DesktopTerminalCreateResult>;
  readonly input: (request: DesktopTerminalInputRequest) => Promise<void>;
  readonly resize: (request: DesktopTerminalResizeRequest) => Promise<void>;
  readonly dispose: (request: DesktopTerminalDisposeRequest) => Promise<void>;
  readonly onData: (
    callback: (event: DesktopTerminalDataEvent) => void,
  ) => DesktopTerminalUnsubscribe;
  readonly onExit: (
    callback: (event: DesktopTerminalExitEvent) => void,
  ) => DesktopTerminalUnsubscribe;
}

export interface AgentPlatformDesktopApi {
  readonly maintenance: DesktopMaintenanceApi;
  readonly projects: DesktopProjectsApi;
  readonly terminal: DesktopTerminalApi;
  readonly versions: DesktopVersionsApi;
}

export const desktopBridgeApiName = 'agentPlatformDesktop';
export const resetLocalDataIpcChannel = 'agent-platform:reset-local-data';
export const resetLocalDataConfirmationIpcChannel =
  'agent-platform:get-reset-local-data-confirmation';
export const selectProjectFolderIpcChannel = 'agent-platform:select-project-folder';
export const createProjectFolderIpcChannel = 'agent-platform:create-project-folder';
export const createTerminalIpcChannel = 'agent-platform:terminal:create';
export const inputTerminalIpcChannel = 'agent-platform:terminal:input';
export const resizeTerminalIpcChannel = 'agent-platform:terminal:resize';
export const disposeTerminalIpcChannel = 'agent-platform:terminal:dispose';
export const terminalDataIpcChannel = 'agent-platform:terminal:data';
export const terminalExitIpcChannel = 'agent-platform:terminal:exit';

export const desktopBridgeApiKeys = [
  'maintenance',
  'projects',
  'terminal',
  'versions',
] as const satisfies readonly (keyof AgentPlatformDesktopApi)[];

export const desktopMaintenanceApiKeys = [
  'getResetLocalDataConfirmation',
  'resetLocalData',
] as const satisfies readonly (keyof DesktopMaintenanceApi)[];

export const desktopProjectsApiKeys = [
  'createFolder',
  'selectFolder',
] as const satisfies readonly (keyof DesktopProjectsApi)[];

export const desktopTerminalApiKeys = [
  'create',
  'input',
  'resize',
  'dispose',
  'onData',
  'onExit',
] as const satisfies readonly (keyof DesktopTerminalApi)[];

export const desktopVersionsApiKeys = [
  'chrome',
  'electron',
  'node',
] as const satisfies readonly (keyof DesktopVersionsApi)[];
