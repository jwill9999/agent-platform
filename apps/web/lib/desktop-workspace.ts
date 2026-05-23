import type {
  DesktopWorkspaceOpenExternalFallbackResult,
  DesktopWorkspaceOpenResult,
  DesktopWorkspaceWebViewState,
  WorkspaceResource,
} from '@agent-platform/contracts';
export type {
  DesktopWebViewPolicyTier,
  DesktopWebViewStatus,
  DesktopWorkspaceOpenExternalFallbackResult,
  DesktopWorkspaceOpenResult,
  DesktopWorkspaceWebViewState,
} from '@agent-platform/contracts';

export type DesktopWorkspaceBridge = Readonly<{
  openResource: (request: { readonly uri: string }) => Promise<DesktopWorkspaceOpenResult>;
  openExternalFallback: (request: {
    readonly url: string;
  }) => Promise<DesktopWorkspaceOpenExternalFallbackResult>;
  openWebView: (request: {
    readonly url: string;
    readonly projectId?: string;
  }) => Promise<DesktopWorkspaceOpenResult>;
  closeWebView: (request: {
    readonly webviewId: string;
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  focusWebView: (request: {
    readonly webviewId: string;
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  listWebViews: () => Promise<readonly DesktopWorkspaceWebViewState[]>;
  setWebViewBounds: (request: {
    readonly webviewId: string;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  goBackWebView: (request: {
    readonly webviewId: string;
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  goForwardWebView: (request: {
    readonly webviewId: string;
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  reloadWebView: (request: {
    readonly webviewId: string;
  }) => Promise<DesktopWorkspaceWebViewState | null>;
  onWebViewUpdated: (callback: (event: DesktopWorkspaceWebViewState) => void) => () => void;
}>;

export function getDesktopWorkspaceBridge(): DesktopWorkspaceBridge | null {
  if (typeof window === 'undefined') return null;
  return (
    (
      window as Window & {
        agentPlatformDesktop?: { workspace?: DesktopWorkspaceBridge };
      }
    ).agentPlatformDesktop?.workspace ?? null
  );
}

function metadataString(resource: WorkspaceResource, key: string): string | undefined {
  const value = resource.metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function workspaceResourceFallbackUrl(resource: WorkspaceResource): string | undefined {
  return (
    metadataString(resource, 'url') ??
    metadataString(resource, 'previewUrl') ??
    metadataString(resource, 'externalFallbackUrl')
  );
}

export function hasDesktopWorkspaceWebViewBridge(): boolean {
  const bridge = getDesktopWorkspaceBridge();
  return Boolean(
    bridge &&
    typeof bridge.openWebView === 'function' &&
    typeof bridge.listWebViews === 'function' &&
    typeof bridge.setWebViewBounds === 'function' &&
    typeof bridge.onWebViewUpdated === 'function',
  );
}

export async function openWorkspaceWebUrl(input: {
  readonly url: string;
  readonly projectId?: string | null;
}): Promise<DesktopWorkspaceOpenResult | null> {
  const bridge = getDesktopWorkspaceBridge();
  if (!bridge) {
    window.open(input.url, '_blank', 'noopener,noreferrer');
    return null;
  }

  const result = await bridge.openWebView({
    url: input.url,
    ...(input.projectId ? { projectId: input.projectId } : {}),
  });
  if (!result.handled && result.externalFallbackUrl) {
    await bridge.openExternalFallback({ url: result.externalFallbackUrl });
  }
  return result;
}
