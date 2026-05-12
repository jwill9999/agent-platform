export interface DesktopVersionsApi {
  readonly chrome: () => string;
  readonly electron: () => string;
  readonly node: () => string;
}

export interface AgentPlatformDesktopApi {
  readonly versions: DesktopVersionsApi;
}

export const desktopBridgeApiName = 'agentPlatformDesktop';

export const desktopBridgeApiKeys = [
  'versions',
] as const satisfies readonly (keyof AgentPlatformDesktopApi)[];

export const desktopVersionsApiKeys = [
  'chrome',
  'electron',
  'node',
] as const satisfies readonly (keyof DesktopVersionsApi)[];
