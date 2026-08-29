import type {
  DesktopCreateProjectFolderRequest,
  DesktopOpenProjectIdeRequest,
  DesktopOpenProjectIdeResult,
  DesktopProjectFolderSelectionResult,
  DesktopTerminalCreateRequest,
  DesktopTerminalCreateResult,
  DesktopTerminalDataEvent,
  DesktopTerminalExitEvent,
  DesktopWorkspaceOpenExternalFallbackResult,
  DesktopWorkspaceOpenResult,
  DesktopWorkspaceExportResult,
  WorkspaceResourceExportRequest,
  DesktopWorkspaceWebViewState,
} from '@agent-platform/contracts';
export type {
  DesktopWebViewPolicyTier,
  DesktopWebViewStatus,
  DesktopCreateProjectFolderRequest,
  DesktopOpenProjectIdeRequest,
  DesktopOpenProjectIdeResult,
  DesktopProjectFolderSelectionResult,
  DesktopTerminalCreateRequest,
  DesktopTerminalCreateResult,
  DesktopTerminalDataEvent,
  DesktopTerminalExitEvent,
  DesktopWorkspaceOpenExternalFallbackResult,
  DesktopWorkspaceOpenResult,
  DesktopWorkspaceExportResult,
  WorkspaceResourceExportRequest,
  DesktopWorkspaceWebViewState,
} from '@agent-platform/contracts';

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

export interface DesktopRepairMacosVmRuntimeResult {
  readonly ok: true;
  readonly runtimeDir: string;
  readonly stoppedRunningVm: boolean;
  readonly deletedPaths: readonly string[];
  readonly missingPaths: readonly string[];
  readonly repairedAssets: true;
  readonly preservedDiagnostics: boolean;
  readonly preservedProjectFolders: true;
}

export interface DesktopMaintenanceApi {
  readonly getResetLocalDataConfirmation: () => Promise<string>;
  readonly repairMacosVmRuntime: () => Promise<DesktopRepairMacosVmRuntimeResult>;
  readonly resetLocalData: (
    request: DesktopResetLocalDataRequest,
  ) => Promise<DesktopResetLocalDataResult>;
}

export interface DesktopProjectsApi {
  readonly createFolder: (
    request: DesktopCreateProjectFolderRequest,
  ) => Promise<DesktopProjectFolderSelectionResult>;
  readonly openInIde: (
    request: DesktopOpenProjectIdeRequest,
  ) => Promise<DesktopOpenProjectIdeResult>;
  readonly selectFolder: () => Promise<DesktopProjectFolderSelectionResult>;
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

export interface DesktopWorkspaceOpenResourceRequest {
  readonly uri: string;
}

export interface DesktopWorkspaceOpenExternalFallbackRequest {
  readonly url: string;
}

export interface DesktopWorkspaceOpenWebViewRequest {
  readonly url: string;
  readonly projectId?: string;
}

export interface DesktopWorkspaceWebViewIdRequest {
  readonly webviewId: string;
}

export interface DesktopWorkspaceWebViewBoundsRequest {
  readonly webviewId: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type DesktopWorkspaceWebViewUnsubscribe = () => void;

export interface DesktopWorkspaceApi {
  readonly saveResourceAs: (
    request: WorkspaceResourceExportRequest,
  ) => Promise<DesktopWorkspaceExportResult>;
  readonly openResource: (
    request: DesktopWorkspaceOpenResourceRequest,
  ) => Promise<DesktopWorkspaceOpenResult>;
  readonly openExternalFallback: (
    request: DesktopWorkspaceOpenExternalFallbackRequest,
  ) => Promise<DesktopWorkspaceOpenExternalFallbackResult>;
  readonly openWebView: (
    request: DesktopWorkspaceOpenWebViewRequest,
  ) => Promise<DesktopWorkspaceOpenResult>;
  readonly closeWebView: (
    request: DesktopWorkspaceWebViewIdRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly focusWebView: (
    request: DesktopWorkspaceWebViewIdRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly listWebViews: () => Promise<readonly DesktopWorkspaceWebViewState[]>;
  readonly setWebViewBounds: (
    request: DesktopWorkspaceWebViewBoundsRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly goBackWebView: (
    request: DesktopWorkspaceWebViewIdRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly goForwardWebView: (
    request: DesktopWorkspaceWebViewIdRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly reloadWebView: (
    request: DesktopWorkspaceWebViewIdRequest,
  ) => Promise<DesktopWorkspaceWebViewState | null>;
  readonly onWebViewUpdated: (
    callback: (event: DesktopWorkspaceWebViewState) => void,
  ) => DesktopWorkspaceWebViewUnsubscribe;
}

export interface AgentPlatformDesktopApi {
  readonly maintenance: DesktopMaintenanceApi;
  readonly projects: DesktopProjectsApi;
  readonly terminal: DesktopTerminalApi;
  readonly workspace: DesktopWorkspaceApi;
  readonly versions: DesktopVersionsApi;
}

export const desktopBridgeApiName = 'agentPlatformDesktop';
export const resetLocalDataIpcChannel = 'agent-platform:reset-local-data';
export const resetLocalDataConfirmationIpcChannel =
  'agent-platform:get-reset-local-data-confirmation';
export const repairMacosVmRuntimeIpcChannel = 'agent-platform:repair-macos-vm-runtime';
export const selectProjectFolderIpcChannel = 'agent-platform:select-project-folder';
export const createProjectFolderIpcChannel = 'agent-platform:create-project-folder';
export const openProjectIdeIpcChannel = 'agent-platform:project:open-ide';
export const createTerminalIpcChannel = 'agent-platform:terminal:create';
export const inputTerminalIpcChannel = 'agent-platform:terminal:input';
export const resizeTerminalIpcChannel = 'agent-platform:terminal:resize';
export const disposeTerminalIpcChannel = 'agent-platform:terminal:dispose';
export const terminalDataIpcChannel = 'agent-platform:terminal:data';
export const terminalExitIpcChannel = 'agent-platform:terminal:exit';
export const openWorkspaceResourceIpcChannel = 'agent-platform:workspace:open-resource';
export const saveWorkspaceResourceIpcChannel = 'agent-platform:workspace:save-resource-as';
export const openWorkspaceExternalFallbackIpcChannel =
  'agent-platform:workspace:open-external-fallback';
export const openWorkspaceWebViewIpcChannel = 'agent-platform:workspace:open-webview';
export const closeWorkspaceWebViewIpcChannel = 'agent-platform:workspace:close-webview';
export const focusWorkspaceWebViewIpcChannel = 'agent-platform:workspace:focus-webview';
export const listWorkspaceWebViewsIpcChannel = 'agent-platform:workspace:list-webviews';
export const setWorkspaceWebViewBoundsIpcChannel = 'agent-platform:workspace:set-webview-bounds';
export const goBackWorkspaceWebViewIpcChannel = 'agent-platform:workspace:webview-back';
export const goForwardWorkspaceWebViewIpcChannel = 'agent-platform:workspace:webview-forward';
export const reloadWorkspaceWebViewIpcChannel = 'agent-platform:workspace:webview-reload';
export const workspaceWebViewUpdatedIpcChannel = 'agent-platform:workspace:webview-updated';

export const desktopBridgeApiKeys = [
  'maintenance',
  'projects',
  'terminal',
  'workspace',
  'versions',
] as const satisfies readonly (keyof AgentPlatformDesktopApi)[];

export const desktopMaintenanceApiKeys = [
  'getResetLocalDataConfirmation',
  'repairMacosVmRuntime',
  'resetLocalData',
] as const satisfies readonly (keyof DesktopMaintenanceApi)[];

export const desktopProjectsApiKeys = [
  'createFolder',
  'openInIde',
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

export const desktopWorkspaceApiKeys = [
  'saveResourceAs',
  'openResource',
  'openExternalFallback',
  'openWebView',
  'closeWebView',
  'focusWebView',
  'listWebViews',
  'setWebViewBounds',
  'goBackWebView',
  'goForwardWebView',
  'reloadWebView',
  'onWebViewUpdated',
] as const satisfies readonly (keyof DesktopWorkspaceApi)[];

export const desktopVersionsApiKeys = [
  'chrome',
  'electron',
  'node',
] as const satisfies readonly (keyof DesktopVersionsApi)[];
